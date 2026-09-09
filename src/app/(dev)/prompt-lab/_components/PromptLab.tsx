'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

import { BLANK_STAGE, type StagePreset } from '@/lib/ai/prompts/stages';
import { COMMON_RULES } from '@/lib/ai/prompts/common-rules';
import {
  ACCEPTED_IMAGE_TYPES,
  DEFAULT_MODEL,
  MAX_IMAGE_BYTES,
  MODEL_CANDIDATES,
  PROVIDERS,
  type Attachment,
  type ProviderId,
} from '../_provider-meta';
import {
  CHECK_RULES,
  type Check,
  type CheckRuleId,
  type OutputMode,
} from '@/lib/ai/schema-check';
import { fetchModels, runStage, type RunResult } from '../_actions';
import { bridge } from '../_bridge';
import {
  BLANK_FIELD_RULE,
  EMPTY_RULES,
  FIELD_TYPES,
  type CustomRules,
  type FieldRule,
  type FieldType,
} from '../_field-rules';
import {
  applyMapping,
  mergeOutput,
  BLANK_MAP_ROW,
  hasMapping,
  MAP_SOURCES,
  type MapRow,
  type MapSource,
} from '../_mapping';
import {
  BLANK_ROUTE_ROW,
  defaultRouting,
  hasRouting,
  matchRoute,
  pickRoute,
  type RouteRow,
  type Routing,
} from '../_routing';
import {
  diffAgainst,
  pull,
  type Comparable,
} from '../_preset-diff';
import {
  lineChange,
  newRevision,
  toHistoryCsv,
  when,
  type Revision,
} from '../_history';
import {
  auditRun,
  AUDIT_RULES,
  tally,
  type Finding,
  type Trial,
} from '../_audit';
import {
  cleanStudentReply,
  DEFAULT_LIMITS,
  isTransient,
  waitFor,
  FINISH,
  PROFILE_PRESET,
  STAY,
  STOP_TEXT,
  studentInput,
  type AutoLimits,
  type AutoStep,
  type Profile,
  type StopReason,
} from '../_autorun';
import { stageColor } from '../_stage-colors';
import {
  toCasesJson,
  toRulesTs,
  toSpecMd,
  toStagesTs,
  type ExportStage,
  type GoldenCase,
} from '../_export';
import {
  applyVars,
  BLANK_VARIABLE,
  DEFAULT_VAR_SET,
  repairBareVars,
  undefinedRefs,
  usageOf,
  type Variable,
  type VarSet,
} from '../_vars';
import {
  costOf,
  findPrice,
  formatKrw,
  formatUsd,
  PRICING_PAGES,
  SEED_PRICES,
  type Price,
} from '../_pricing';
import {
  appendAiTurn,
  appendUserTurn,
  DEFAULT_CHAT_SHAPE,
  readChoices,
  type Choice,
  resetConversation,
  parseOutput,
  pickReply,
  readTurns,
  type ChatShape,
  type Turn,
} from '../_chat';

/**
 * 한 단계 안의 **대화 하나**.
 *
 * 같은 프롬프트·모델로 여러 시나리오를 나란히 두려고 단계와 분리했다.
 * "학생이 잘 답하는 경우"와 "몰라요만 하는 경우"를 각각 대화로 두고
 * 오가며 비교한다. 프롬프트를 고치면 모든 대화에 동시에 반영된다.
 */
type Thread = {
  /** React key 전용. DOM에 넣지 않는다 */
  key: string;
  name: string;
  input: string;
  /**
   * 평문 입력 단계의 대화 기록. 화면에만 쓴다.
   *
   * JSON 입력 단계는 입력 JSON 안의 배열이 곧 대화 기록이라 별도 상태가
   * 없다. 평문 단계는 담을 곳이 없어 여기 둔다.
   */
  transcript: Turn[];
  /** 다음 호출에 함께 보낼 이미지. 보내고 나면 비운다 */
  images: Attachment[];
  result: RunResult | null;
  running: boolean;
};

/**
 * 단계. 프롬프트·모델·파라미터는 여기 있고 대화는 `threads` 에 있다.
 * "무엇을 시험하는가"와 "어떻게 흘러갔는가"를 나눈 것이다.
 */
type Stage = StagePreset & {
  /** React key 전용. DOM에 넣지 않는다 */
  key: string;
  /**
   * 켜면 아래 모델 설정을 쓰고, 끄면 공통 설정을 따른다.
   *
   * 상속을 숨기지 않으려고 명시적인 스위치로 뒀다. 화면에서 이 단계가
   * 공통을 따르는 건지 직접 정한 건지 바로 보여야 한다.
   */
  ownSettings: boolean;
  provider: ProviderId;
  /** `ownSettings` 가 켜졌을 때만 쓴다. 비우면 프로바이더 기본 모델 */
  model: string;
  /** 비우면 기본 키 → 없으면 서버의 GEMINI_API_KEY */
  apiKey: string;
  /** 화면 입력값. 빈 문자열이면 해당 파라미터를 보내지 않는다 */
  temperature: string;
  maxTokens: string;
  topP: string;
  useCommonPrompt: boolean;
  forceJsonMimeType: boolean;
  /**
   * 사용자가 직접 만든 검증 규칙. `checkRule`(AIPM 규칙)과 **함께** 돈다.
   * 이쪽이 이 도구를 다른 프로젝트에서도 쓸 수 있게 하는 부분이다.
   */
  rules: CustomRules;
  /** 다음 단계로 무엇을 옮길지. 비어 있으면 AIPM 규칙 → 원문 순으로 넘어간다 */
  mapping: MapRow[];
  /** 결과를 보고 보낼 단계를 고르는 규칙. 비어 있으면 바로 다음 단계 */
  routing: Routing;
  threads: Thread[];
  activeThread: number;
};

function newThread(key: string, name: string, input: string): Thread {
  return {
    key,
    name,
    input,
    transcript: [],
    images: [],
    result: null,
    running: false,
  };
}

type Props = {
  preset: StagePreset[];
  /**
   * 변수 세트 프리셋.
   *
   * 프롬프트가 `{{persona}}` 를 쓰는데 변수가 비어 있으면 "정의 안 된
   * 변수" 로 시작한다. 말투 블록을 손으로 붙여 넣게 두지 않는다.
   */
  varPreset: VarSet[];
  hasEnvApiKey: boolean;
};

const LOG_LABEL: Record<AutoStep['kind'], string> = {
  ai: 'AI',
  student: '학생',
  move: '이동',
  end: '끝',
  error: '오류',
  retry: '재시도',
};

/** 견줄 칸만 뽑는다. routing 은 프리셋 쪽 출처가 달라 부르는 쪽이 붙인다 */
function pickComparable(from: Omit<Comparable, 'routing'>): Omit<Comparable, 'routing'> {
  return {
    prompt: from.prompt,
    inputMode: from.inputMode,
    outputMode: from.outputMode,
    checkRule: from.checkRule,
    historyKey: from.historyKey,
    replyKey: from.replyKey,
    recordKey: from.recordKey,
    choicesKey: from.choicesKey,
    studentTurn: from.studentTurn,
    studentField: from.studentField,
    aiTurn: from.aiTurn,
    aiField: from.aiField,
    latestKey: from.latestKey,
    turnCountKey: from.turnCountKey,
    remainingKey: from.remainingKey,
    limitKey: from.limitKey,
    resetKey: from.resetKey,
  };
}

/** 단계에서 대화 모양만 뽑는다 */
function shapeOf(stage: Stage): ChatShape {
  return {
    historyKey: stage.historyKey,
    studentTurn: stage.studentTurn,
    studentField: stage.studentField,
    aiTurn: stage.aiTurn,
    aiField: stage.aiField,
    latestKey: stage.latestKey,
    turnCountKey: stage.turnCountKey,
    remainingKey: stage.remainingKey,
    limitKey: stage.limitKey,
    resetKey: stage.resetKey,
  };
}

/** 프리셋 한 줄을 화면 상태로 바꾼다. key는 React 전용이며 DOM에 넣지 않는다. */
function toStage(base: StagePreset, key: string): Stage {
  return {
    ...base,
    key,
    // 새 단계는 공통 설정을 따른다. 이게 이 구조의 요점이다.
    ownSettings: false,
    provider: 'gemini',
    model: '',
    apiKey: '',
    temperature: '',
    maxTokens: '',
    topP: '',
    useCommonPrompt: true,
    forceJsonMimeType: false,
    rules: EMPTY_RULES,
    mapping: [],
    // 이름으로 찾는다. AIPM 프리셋이 아니면 빈 값이다.
    routing: defaultRouting(base.name),
    threads: [newThread(`${key}-t0`, '대화 1', base.sampleInput)],
    activeThread: 0,
  };
}


/**
 * 브라우저 저장 키.
 *
 * 이 도구는 개발 서버에서만 열린다. 저장 위치도 이 브라우저 안이며
 * 서버로 올라가지 않는다. 설정과 키를 나눠 둔 이유는, 설정은 켜 두고
 * 키는 저장하지 않는 조합을 기본으로 하기 위해서다.
 */
const CONFIG_STORAGE_KEY = 'prompt-lab:config:v1';
/**
 * 저장본 판. 값이 **있는데 낡은** 칸을 한 번만 고쳐 주려고 둔다.
 *
 * 없는 칸은 `fromSaved` 가 프리셋에서 채운다. 문제는 값이 있는
 * 경우다 — 응답 필드가 `ui.message` 하나였을 때 저장한 사람은,
 * 프리셋이 `ui.problem_text, ui.message` 로 늘어나도 계속 예전 값을
 * 쓴다. 문제는 나오는데 대화창에는 안 보인다.
 *
 * 판이 없는 저장본에만 손대고, 한 번 저장하면 다시는 손대지 않는다.
 * 그래야 사람이 일부러 줄여 놓은 값을 매번 되돌리지 않는다.
 */
const CONFIG_VERSION = 2;
const KEY_STORAGE_KEY = 'prompt-lab:keys:v1';
/**
 * 저장할지 말지 자체를 기억하는 자리.
 *
 * 설정 저장이 기본 켜짐이라, 끈 상태도 남겨 두지 않으면 새로고침할 때마다
 * 다시 켜진다. 저장을 끄면 설정은 지우되 "껐다"는 사실은 남긴다.
 */
const PREF_STORAGE_KEY = 'prompt-lab:prefs:v1';

/**
 * 모든 단계가 기본으로 따르는 모델 설정.
 *
 * 단계마다 프로바이더·모델을 따로 두는 게 이 도구의 핵심이지만, 전체를
 * 한 모델로 돌려 보는 일이 그만큼 잦다. 여기 한 번 넣으면 단계를 새로
 * 추가해도 따라온다.
 *
 * API 키는 여기 없다. 프로바이더별 기본 키(`defaultKeys`)가 이미 같은
 * 역할을 한다.
 */
export type CommonSettings = {
  provider: ProviderId;
  model: string;
  temperature: string;
  maxTokens: string;
  topP: string;
};

const DEFAULT_COMMON: CommonSettings = {
  provider: 'gemini',
  model: '',
  temperature: '',
  maxTokens: '',
  topP: '',
};

/**
 * 이 단계가 **실제로 쓸** 모델 설정.
 *
 * `ownSettings` 가 꺼져 있으면 공통 설정을 그대로 쓴다. 화면에서도 이
 * 값을 회색으로 보여준다. 빈칸으로 두면 "뭘 쓰는지 모르겠다" 가 다시
 * 생기기 때문이다.
 */
function effective(stage: Stage, common: CommonSettings): CommonSettings {
  if (!stage.ownSettings) return common;
  return {
    provider: stage.provider,
    model: stage.model,
    temperature: stage.temperature,
    maxTokens: stage.maxTokens,
    topP: stage.topP,
  };
}

/**
 * 그 단계가 실제로 보낼 systemInstruction 전문.
 *
 * 실행할 때와 "지금 프롬프트와 같은가" 를 비교할 때 **같은 함수**를 쓴다.
 * 두 곳에서 따로 조립하면 곧 어긋난다.
 */
function buildSystem(stage: Stage, commonPrompt: string): string {
  return stage.useCommonPrompt
    ? `${commonPrompt}\n\n---\n\n${stage.prompt}`
    : stage.prompt;
}

/**
 * 키 저장 묶음. 프로바이더별 기본 키와 **단계별 개별 키**를 함께 둔다.
 * 단계별 키는 순서대로 저장한다. 단계를 옮기거나 지우면 그 즉시 다시
 * 저장되므로 어긋나지 않는다.
 */
type SavedKeys = {
  defaults: Record<ProviderId, string>;
  stageKeys: string[];
};

/** 저장되는 단계. 실행 결과·이미지·단계별 키는 저장하지 않는다. */
type SavedStage = StagePreset & {
  ownSettings: boolean;
  provider: ProviderId;
  model: string;
  temperature: string;
  maxTokens: string;
  topP: string;
  useCommonPrompt: boolean;
  forceJsonMimeType: boolean;
  rules: CustomRules;
  mapping: MapRow[];
  routing: Routing;
  /** 대화는 이름과 입력만 남긴다. 결과는 다시 실행하면 되고 이미지는 무겁다 */
  threads: { name: string; input: string }[];
};

function toSaved(stage: Stage): SavedStage {
  return {
    name: stage.name,
    note: stage.note,
    prompt: stage.prompt,
    sampleInput: stage.threads[0]?.input ?? '',
    threads: stage.threads.map((t) => ({ name: t.name, input: t.input })),
    inputMode: stage.inputMode,
    outputMode: stage.outputMode,
    checkRule: stage.checkRule,
    historyKey: stage.historyKey,
    replyKey: stage.replyKey,
    recordKey: stage.recordKey,
    choicesKey: stage.choicesKey,
    studentTurn: stage.studentTurn,
    studentField: stage.studentField,
    aiTurn: stage.aiTurn,
    aiField: stage.aiField,
    latestKey: stage.latestKey,
    turnCountKey: stage.turnCountKey,
    remainingKey: stage.remainingKey,
    limitKey: stage.limitKey,
    resetKey: stage.resetKey,
    provider: stage.provider,
    model: stage.model,
    temperature: stage.temperature,
    maxTokens: stage.maxTokens,
    topP: stage.topP,
    useCommonPrompt: stage.useCommonPrompt,
    forceJsonMimeType: stage.forceJsonMimeType,
    ownSettings: stage.ownSettings,
    rules: stage.rules,
    mapping: stage.mapping,
    routing: stage.routing,
  };
}

/**
 * 저장본 한 줄을 화면 상태로 되돌린다.
 *
 * **없는 칸은 이름이 같은 프리셋에서 가져온다.** 예전에는 `BLANK_STAGE`
 * 에서 가져왔는데, 그러면 도구에 새 칸이 생길 때마다 이미 저장해 둔
 * 사람만 빈 값으로 열렸다. 대화 턴 모양이 그랬다 — 02 MODE A 를 열어도
 * v3.0 모양이 아니라 `{ speaker, message_text }` 로 돌아, 학생의 말이
 * 프롬프트가 읽는 자리에 안 들어갔다.
 *
 * 저장본에 **있는** 칸은 그대로 둔다. 사람이 고친 값이다.
 */
function fromSaved(
  item: Partial<SavedStage>,
  key: string,
  preset: StagePreset[],
): Stage {
  const matched = preset.find((stage) => stage.name === item.name);
  const base = { ...BLANK_STAGE, ...matched, ...item } as StagePreset;
  return {
    ...toStage(base, key),
    // 예전 저장본에는 이 값이 없다. 그때는 단계마다 값을 직접 넣었으므로
    // 전부 `별도` 로 읽는다. 공통을 따르게 바꾸면 쓰던 설정이 사라진다.
    ownSettings: item.ownSettings ?? true,
    provider: item.provider ?? 'gemini',
    model: item.model ?? '',
    temperature: item.temperature ?? '',
    maxTokens: item.maxTokens ?? '',
    topP: item.topP ?? '',
    useCommonPrompt: item.useCommonPrompt ?? true,
    forceJsonMimeType: item.forceJsonMimeType ?? false,
    // 예전 저장본에는 없다. 없으면 빈 규칙으로 연다.
    rules: {
      fields: Array.isArray(item.rules?.fields) ? item.rules.fields : [],
      banned: typeof item.rules?.banned === 'string' ? item.rules.banned : '',
    },
    mapping: Array.isArray(item.mapping) ? item.mapping : [],
    // 예전 저장본에는 없다. 이름이 프리셋과 같으면 기본 분기를 준다.
    routing:
      typeof item.routing?.from === 'string' && Array.isArray(item.routing.rows)
        ? { from: item.routing.from, rows: item.routing.rows }
        : defaultRouting(item.name ?? ''),
    // 예전 저장본에는 threads 가 없다. sampleInput 하나를 대화 1로 만든다.
    threads: (Array.isArray(item.threads) && item.threads.length > 0
      ? item.threads
      : [{ name: '대화 1', input: item.sampleInput ?? '' }]
    ).map((t, i) => newThread(`${key}-t${i}`, t.name ?? `대화 ${i + 1}`, t.input ?? '')),
    activeThread: 0,
  };
}

/**
 * 판이 없는 저장본의 **낡은 값**을 한 번 고친다.
 *
 * 손대는 기준은 하나다 — **사람이 정한 적 없는 값만 고친다.**
 *
 * ```text
 * 대화 모양   빈 단계의 기본값 그대로면 → 프리셋 값
 * 응답 필드   프리셋이 늘어나기만 했으면 → 프리셋 값
 * ```
 *
 * 대화 모양이 문제였던 이유: v1 에는 그 칸 자체가 없었다. 저장본을
 * 다시 열면 빈 단계의 기본값 `{ speaker, message_text }` 이 들어가고,
 * 그대로 저장된다. 학생의 말이 프롬프트가 읽는
 * `payload.interaction.latest_response.content` 에 안 들어가니, 모델은
 * 학생이 아직 답을 안 했다고 보고 같은 문제만 다시 냈다.
 *
 * 응답 필드가 문제였던 이유: 값이 `ui.message` 로 **있었다.** 프리셋이
 * `ui.problem_text, ui.message` 로 늘어나도 예전 값이 이긴다. 문제는
 * 나오는데 대화창에는 인사말만 보였다.
 */
function upgradeStage(
  item: Partial<SavedStage>,
  preset: StagePreset[],
): Partial<SavedStage> {
  const target = preset.find((stage) => stage.name === item.name);
  if (target === undefined) return item;

  const next: Partial<SavedStage> = { ...item };

  // 빈 단계의 기본값 그대로면 사람이 정한 적이 없다는 뜻이다.
  const untouched = [
    'historyKey',
    'recordKey',
    'choicesKey',
    'studentTurn',
    'studentField',
    'aiTurn',
    'aiField',
    'latestKey',
    'turnCountKey',
    'remainingKey',
    'limitKey',
    'resetKey',
  ] as const;
  for (const field of untouched) {
    if (next[field] === undefined || next[field] === BLANK_STAGE[field]) {
      next[field] = target[field];
    }
  }

  // 응답 필드는 빈 단계 값이 아니라 예전 프리셋 값이 들어 있다.
  // 적어 둔 경로가 전부 새 프리셋에도 있고 새 쪽이 더 많으면, 사람이
  // 지운 게 아니라 프리셋이 늘어난 것이다.
  const saved = splitPaths(next.replyKey ?? '');
  const wanted = splitPaths(target.replyKey);
  if (
    saved.length > 0 &&
    wanted.length > saved.length &&
    saved.every((path) => wanted.includes(path))
  ) {
    next.replyKey = target.replyKey;
  }

  return next;
}

function splitPaths(text: string): string[] {
  return text
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '');
}

export function PromptLab({ preset, varPreset, hasEnvApiKey }: Props) {
  const [stages, setStages] = useState<Stage[]>(() =>
    preset.map((base, index) => toStage(base, `s${index}`)),
  );
  // 새 단계에 줄 key. 순서를 바꿔도 React가 상태를 잃지 않도록 고유하게 둔다.
  const [keySeq, setKeySeq] = useState(preset.length);
  const [activeIndex, setActiveIndex] = useState(0);
  // 프로바이더별 기본 키. 화면에서만 산다. 저장하지 않는다.
  const [defaultKeys, setDefaultKeys] = useState<Record<ProviderId, string>>({
    gemini: '',
    openai: '',
    anthropic: '',
  });
  const [commonPrompt, setCommonPrompt] = useState(COMMON_RULES);
  const [common, setCommon] = useState<CommonSettings>(DEFAULT_COMMON);
  /**
   * 변수 세트.
   *
   * 말투 블록처럼 통째로 갈아끼우는 값이 있다. 빌런과 친구를 오가며
   * 비교하려면 두 벌을 나란히 둘 곳이 필요하다. 세트가 곧 테스트
   * 케이스다.
   *
   * 세트마다 이름 목록이 독립이다. 어긋나면 "정의 안 된 변수" 경고가
   * 잡아 주므로 굳이 묶지 않는다.
   */
  /**
   * 잘 나온 호출을 남긴 것. 회귀 테스트의 재료다.
   *
   * 좋은 결과가 나왔을 때 그 자리에서 버튼 하나로 남길 수 있어야 실제로
   * 쌓인다. 나중에 손으로 옮기려면 아무도 안 한다.
   */
  const [cases, setCases] = useState<GoldenCase[]>([]);
  const [varSets, setVarSets] = useState<VarSet[]>(
    varPreset.length > 0 ? varPreset : [DEFAULT_VAR_SET],
  );
  const [activeSet, setActiveSet] = useState(0);
  const [panel, setPanel] = useState<
    'none' | 'prompt' | 'price' | 'settings' | 'vars' | 'export' | 'auto'
  >('none');
  const [exportKind, setExportKind] = useState<
    'stages' | 'cases' | 'rules' | 'spec' | 'history'
  >('stages');
  const [draft, setDraft] = useState('');
  // 프로바이더에서 받아온 실제 모델 목록. 코드의 후보보다 이쪽이 정확하다.
  const [liveModels, setLiveModels] = useState<Partial<Record<ProviderId, string[]>>>({});
  const [loadingModels, setLoadingModels] = useState(false);
  /**
   * 모델 후보 목록을 펼쳐 둘지.
   *
   * 프로바이더에서 받아오면 수십 개가 온다. 접을 방법이 없으면 칩이
   * 화면을 다 먹는다. 모델은 한 번 고르면 계속 안 바꾸므로 접어 두는
   * 쪽이 기본이어야 맞지만, 방금 불러온 사람은 보고 싶어 한다.
   */
  const [showModels, setShowModels] = useState(false);
  /** 목록이 길면 눈으로 훑기 어렵다. 이름 조각으로 거른다 */
  const [modelFilter, setModelFilter] = useState('');
  /** 마지막 응답을 말풍선에 넣지 않은 이유. 데이터 단계에서 정상이다 */
  const [replyNote, setReplyNote] = useState<string | null>(null);
  // 모델 가격표. 화면에서 고치고 설정과 함께 저장한다.
  const [prices, setPrices] = useState<Record<string, Price>>(SEED_PRICES);
  const [krwRate, setKrwRate] = useState('1400');
  /** 이번 세션 누적 비용. 새로고침하면 0 부터 다시 센다 */
  const [spentUsd, setSpentUsd] = useState(0);
  /**
   * 이번 세션 누적 토큰. 비용과 따로 센다.
   * 가격을 모르는 모델도 토큰은 나오므로, 비용이 0 이어도 사용량은 쌓인다.
   */
  const [spentTokens, setSpentTokens] = useState({ prompt: 0, output: 0 });
  const [priceDraft, setPriceDraft] = useState({ model: '', input: '', output: '' });
  /**
   * 자동 실행. AI 가 학생 자리에 앉아 끝까지 돌린다.
   *
   * 중지는 ref 로 본다. 루프가 도는 동안 state 는 옛 값이 잡혀 있어
   * 버튼을 눌러도 루프가 못 본다.
   */
  /**
   * 프롬프트 변경 장부.
   *
   * 되돌리기가 아니다. 무엇을 왜 고쳤는지 적어 두는 곳이다. 결과가
   * 나아졌을 때 "무엇 때문에" 를 말할 수 있어야 한다.
   */
  const [history, setHistory] = useState<Revision[]>([]);
  /** 이유를 받는 칸. null 이면 접혀 있다 */
  const [reasonDraft, setReasonDraft] = useState<string | null>(null);

  const [profiles, setProfiles] = useState<Profile[]>(PROFILE_PRESET);
  const [activeProfile, setActiveProfile] = useState(0);
  /** 반복 실행 회차. 프로필마다 이만큼씩 돈다 */
  const [autoRepeat, setAutoRepeat] = useState(3);
  const [autoAll, setAutoAll] = useState(true);
  /**
   * 대화를 비우고 시작할지.
   *
   * 켜 두는 게 맞다. 손으로 대화하던 입력이나 앞 회차의 끝 상태에서
   * 시작하면 모델이 예전 대화를 이어받는다. 끄는 건 "다섯 턴째부터
   * 어떻게 되나" 를 일부러 볼 때다.
   */
  const [autoFresh, setAutoFresh] = useState(true);
  const [trials, setTrials] = useState<Trial[]>([]);
  /** 몇 번째를 돌고 있나. 반복 중에만 채운다 */
  const [autoAt, setAutoAt] = useState<string | null>(null);
  const [autoLimits, setAutoLimits] = useState<AutoLimits>(DEFAULT_LIMITS);
  const [autoStart, setAutoStart] = useState(0);
  const [autoLog, setAutoLog] = useState<AutoStep[]>([]);
  const [autoRunning, setAutoRunning] = useState(false);
  const [autoStop, setAutoStop] = useState<StopReason | null>(null);
  const stopFlag = useRef(false);

  /**
   * 실행 점검. 로그가 바뀔 때마다 다시 센다.
   *
   * 실행 중에도 쌓이는 대로 보여 준다. 스무 걸음을 다 기다린 뒤에야
   * "3걸음째부터 같은 말을 하고 있었다" 를 알면 늦다.
   */
  const audit =
    autoLog.length === 0
      ? null
      : auditRun(
          autoLog,
          stages.map((stage) => ({
            name: stage.name,
            turnCountKey: stage.turnCountKey,
            limitKey: stage.limitKey,
            choicesKey: stage.choicesKey,
          })),
        );

  /** 반복 실행 통과율. 회차가 없으면 안 보여 준다 */
  const rate =
    trials.length === 0 ? null : tally(trials, stages.map((stage) => stage.name));

  /** 규칙별로 묶는다. 같은 위반이 열 번 나오면 한 줄로 접어야 읽힌다 */
  const byRule: { rule: (typeof AUDIT_RULES)[number]; hits: Finding[] }[] =
    audit === null
      ? []
      : AUDIT_RULES.map((rule) => ({
          rule,
          hits: audit.findings.filter((found) => found.rule === rule.id),
        })).filter((row) => row.hits.length > 0);

  /** 결과를 보낼 단계. null 이면 기본값(다음 단계, 마지막이면 처음) */
  const [sendTarget, setSendTarget] = useState<number | null>(null);
  /** 방금 옮긴 결과를 알린다. 어느 규칙으로 옮겼는지 보여야 한다 */
  const [sendNote, setSendNote] = useState<string | null>(null);
  /**
   * 결과를 보낼 때 대화도 같이 옮길지.
   *
   * 기본 켜짐이다. 대화를 이어가는 쪽이 흔하다. 다만 매핑이나 검증
   * 프리셋이 이미 대화를 다루면 그쪽이 이긴다 — 02 → 03 처럼 새 문제로
   * 시작하느라 **일부러 비우는** 전이가 있기 때문이다.
   */
  const [carryConversation, setCarryConversation] = useState(true);
  /** 방금 어느 단계에서 어디로 옮겼는지. 빈 대화창이 이유를 설명할 때 쓴다 */
  const [lastTransfer, setLastTransfer] = useState<{
    from: number;
    to: number;
  } | null>(null);
  /**
   * 상단 설정 패널의 펼침 상태.
   *
   * 단계마다 두지 않는다. 단계를 옮길 때마다 접혔다 펴졌다 하면 오히려
   * 성가시다. 자주 고치는 프롬프트만 열어 두고 시작한다.
   */
  const [openPanel, setOpenPanel] = useState({
    setting: false,
    prompt: true,
  });

  /**
   * 단계 설정 안의 탭.
   *
   * 셋 다 "이 단계의 설정" 이라 패널을 따로 두면 제목줄만 세 줄이 된다.
   * 그렇다고 이어 붙이면 펼쳤을 때 너무 길다. 탭이 답이다.
   */
  const [settingTab, setSettingTab] = useState<
    'model' | 'chat' | 'rules' | 'mapping' | 'routing'
  >('model');

  function togglePanel(name: keyof typeof openPanel) {
    setOpenPanel((prev) => ({ ...prev, [name]: !prev[name] }));
  }
  const [, startTransition] = useTransition();

  // 저장 여부. 키는 따로 관리한다.
  //
  // 설정은 기본으로 저장한다. 새로고침할 때마다 프로바이더·모델·프롬프트를
  // 다시 넣는 건 이 도구를 못 쓰게 만든다. 키는 민감하므로 기본 꺼짐이다.
  const [remember, setRemember] = useState(true);
  const [rememberKeys, setRememberKeys] = useState(false);
  const [restored, setRestored] = useState(false);
  /**
   * 마지막 저장이 어떻게 됐는지.
   *
   * 지금까지 `catch {}` 로 조용히 삼켰다. localStorage 용량을 넘기면
   * (이미지 붙인 대화가 쌓이면 가능하다) 저장된 줄 알고 있다가
   * 새로고침하면 날아간다.
   */
  const [saveState, setSaveState] = useState<'idle' | 'saved' | 'failed'>('idle');

  // 최초 1회 복원. SSR 결과와 어긋나지 않도록 mount 후에 읽는다.
  //
  // localStorage 는 React 밖의 저장소이므로 mount 시점에 한 번 읽어 상태로
  // 옮기는 수밖에 없다. 의존성이 빈 배열이라 재실행되지 않고, 연쇄 렌더를
  // 만들지 않는다.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      // 저장 여부를 먼저 읽는다. 껐다면 그 상태를 지켜야 한다.
      const savedPrefs = window.localStorage.getItem(PREF_STORAGE_KEY);
      if (savedPrefs) {
        const prefs = JSON.parse(savedPrefs) as {
          remember?: boolean;
          rememberKeys?: boolean;
        };
        if (typeof prefs.remember === 'boolean') setRemember(prefs.remember);
        if (typeof prefs.rememberKeys === 'boolean') {
          setRememberKeys(prefs.rememberKeys);
        }
      }

      const savedConfig = window.localStorage.getItem(CONFIG_STORAGE_KEY);
      if (savedConfig) {
        const parsed = JSON.parse(savedConfig) as {
          version?: number;
          /** 예전 저장본. 세트 없이 배열 하나였다 */
          vars?: Variable[];
          varSets?: VarSet[];
          cases?: GoldenCase[];
          activeSet?: number;
          common?: Partial<CommonSettings>;
          commonPrompt?: string;
          stages?: SavedStage[];
          prices?: Record<string, Price>;
          krwRate?: string;
          /** 예전 저장본. 학생이 하나였다 */
          autoPrompt?: string;
          profiles?: Profile[];
          autoLimits?: Partial<AutoLimits>;
          history?: Revision[];
        };
        if (parsed.prices && typeof parsed.prices === 'object') {
          setPrices(parsed.prices);
        }
        if (typeof parsed.krwRate === 'string') setKrwRate(parsed.krwRate);
        if (Array.isArray(parsed.history)) setHistory(parsed.history);
        if (Array.isArray(parsed.profiles) && parsed.profiles.length > 0) {
          setProfiles(parsed.profiles);
        } else if (typeof parsed.autoPrompt === 'string') {
          // 예전 저장본은 학생이 하나였다. 첫 프로필로 옮긴다.
          setProfiles((prev) =>
            prev.map((item, i) => (i === 0 ? { ...item, prompt: parsed.autoPrompt! } : item)),
          );
        }
        if (parsed.autoLimits && typeof parsed.autoLimits === 'object') {
          setAutoLimits({ ...DEFAULT_LIMITS, ...parsed.autoLimits });
        }
        // 예전 저장본은 세트가 없다. 통째로 `기본` 세트로 옮긴다.
        if (Array.isArray(parsed.cases)) setCases(parsed.cases);
        if (Array.isArray(parsed.varSets) && parsed.varSets.length > 0) {
          setVarSets(parsed.varSets);
          if (typeof parsed.activeSet === 'number') {
            setActiveSet(
              Math.min(Math.max(0, parsed.activeSet), parsed.varSets.length - 1),
            );
          }
        } else if (Array.isArray(parsed.vars) && parsed.vars.length > 0) {
          setVarSets([{ name: '기본', vars: parsed.vars }]);
        }
        if (parsed.common && typeof parsed.common === 'object') {
          setCommon({ ...DEFAULT_COMMON, ...parsed.common });
        }
        if (Array.isArray(parsed.stages) && parsed.stages.length > 0) {
          // 판이 없으면 낡은 칸을 한 번 손본다. 다음 저장부터는 안 한다.
          const old = (parsed.version ?? 1) < CONFIG_VERSION;
          setStages(
            parsed.stages.map((item, index) =>
              fromSaved(old ? upgradeStage(item, preset) : item, `r${index}`, preset),
            ),
          );
          setKeySeq(parsed.stages.length);
          setActiveIndex(0);
        }
        if (typeof parsed.commonPrompt === 'string') {
          setCommonPrompt(parsed.commonPrompt);
        }
      }

      const savedKeys = window.localStorage.getItem(KEY_STORAGE_KEY);
      if (savedKeys) {
        const parsed = JSON.parse(savedKeys) as {
          defaults?: Partial<Record<ProviderId, string>>;
          stageKeys?: unknown;
        };
        const defaults = parsed.defaults ?? {};
        setDefaultKeys({
          gemini: defaults.gemini ?? '',
          openai: defaults.openai ?? '',
          anthropic: defaults.anthropic ?? '',
        });

        const stageKeys = parsed.stageKeys;
        if (Array.isArray(stageKeys)) {
          setStages((prev) =>
            prev.map((stage, index) => ({
              ...stage,
              apiKey: typeof stageKeys[index] === 'string' ? stageKeys[index] : '',
            })),
          );
        }
      }
    } catch {
      // 저장값이 깨졌으면 무시하고 기본값으로 연다.
    }
    setRestored(true);
    // 저장본은 mount 때 딱 한 번 읽는다. `preset` 은 서버에서 내려온
    // 상수라 바뀌지 않고, 넣으면 저장본을 다시 읽어 화면을 되돌린다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // 저장 여부 자체를 남긴다. 이게 없으면 끈 상태가 유지되지 않는다.
  useEffect(() => {
    if (!restored) return;
    try {
      window.localStorage.setItem(
        PREF_STORAGE_KEY,
        JSON.stringify({ remember, rememberKeys }),
      );
    } catch {
      // 무시
    }
  }, [restored, remember, rememberKeys]);

  // 설정 저장. 키는 포함하지 않는다.
  //
  // 저장 결과를 화면에 알려야 해서 effect 안에서 setState 를 한다. 저장은
  // localStorage 라는 React 밖의 부수효과이고, 그 성패는 렌더 중에 알 수
  // 없다. 값이 그대로면 React 가 리렌더를 건너뛰므로 연쇄 렌더도 없다.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!restored) return;
    if (!remember) {
      window.localStorage.removeItem(CONFIG_STORAGE_KEY);
      return;
    }
    try {
      window.localStorage.setItem(
        CONFIG_STORAGE_KEY,
        JSON.stringify({
          version: CONFIG_VERSION,
          varSets,
          activeSet,
          cases,
          common,
          commonPrompt,
          stages: stages.map(toSaved),
          prices,
          krwRate,
          profiles,
          autoLimits,
          history,
        }),
      );
      setSaveState('saved');
    } catch {
      // 화면 동작은 막지 않되, 조용히 넘기지는 않는다.
      setSaveState('failed');
    }
  }, [
    restored,
    remember,
    varSets,
    activeSet,
    cases,
    common,
    commonPrompt,
    stages,
    prices,
    krwRate,
    profiles,
    autoLimits,
    history,
  ]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // 키 저장은 따로 켠다. 기본은 꺼짐이다.
  // 기본 키와 단계별 개별 키를 함께 저장한다. 단계마다 다른 프로젝트·
  // 다른 계정으로 시험하는 경우가 있어 기본 키만으로는 모자란다.
  useEffect(() => {
    if (!restored) return;
    if (!rememberKeys) {
      window.localStorage.removeItem(KEY_STORAGE_KEY);
      return;
    }
    try {
      const payload: SavedKeys = {
        defaults: defaultKeys,
        stageKeys: stages.map((stage) => stage.apiKey),
      };
      window.localStorage.setItem(KEY_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // 무시
    }
  }, [restored, rememberKeys, defaultKeys, stages]);

  const active = stages[activeIndex];
  /** 지금 보고 있는 대화 */
  const thread: Thread | null = active?.threads[active.activeThread] ?? null;

  /**
   * 마지막 결과를 만든 프롬프트와 지금 화면의 프롬프트가 다른가.
   *
   * 서버가 돌려준 `sentSystem` 과 비교한다. 화면이 기억하는 값이 아니라
   * 서버에 실제로 도착했던 값이라, "고쳤는데 반영이 됐나" 를 여기서 끝낸다.
   */
  /**
   * 응답 필드가 아무 일도 하지 않는 상태.
   *
   * 출력이 평문이면 `pickReply` 가 응답 필드를 보지 않고 원문을 그대로
   * 말풍선에 넣는다. 그런데 칸이 열려 있어서 값을 넣게 만들고, 넣어 놓고도
   * 왜 안 먹는지 알 수가 없었다.
   */
  const replyKeyOff = active?.outputMode === 'text';

  /** 지금 고른 세트의 변수들. 실행과 경고가 모두 이걸 본다 */
  const vars = varSets[activeSet]?.vars ?? [];

  /** 지금 세트의 변수 목록만 고친다 */
  function setVars(next: (prev: Variable[]) => Variable[]) {
    setVarSets((prev) =>
      prev.map((set, i) => (i === activeSet ? { ...set, vars: next(set.vars) } : set)),
    );
  }

  /** 이 단계가 쓰는데 정의되지 않은 변수. 조용히 빈칸으로 바꾸지 않는다 */
  const missingVars = active
    ? undefinedRefs(
        [
          active.prompt,
          ...(active.useCommonPrompt ? [commonPrompt] : []),
          ...(thread ? [thread.input] : []),
        ],
        vars,
      )
    : [];

  /**
   * 이 단계에 마지막으로 기록해 둔 프롬프트.
   *
   * 없으면 프리셋을 기준으로 삼는다. 처음 고친 것도 "무엇에서
   * 무엇으로" 가 남아야 한다.
   */
  const lastRecorded = ((): string => {
    if (active === undefined) return '';
    const mine = history.filter((item) => item.stage === active.name);
    const last = mine[mine.length - 1];
    if (last !== undefined) return last.after;
    return preset.find((item) => item.name === active.name)?.prompt ?? '';
  })();

  /** 아직 안 적어 둔 변경이 있는가 */
  const unrecorded = active !== undefined && active.prompt !== lastRecorded;

  function record(reason: string) {
    if (active === undefined) return;
    const made = newRevision(active.name, reason, lastRecorded, active.prompt);
    if (made === null) return;
    setHistory((prev) => [...prev, made]);
    setReasonDraft(null);
  }

  /**
   * 이 단계가 프리셋과 다른 곳.
   *
   * 저장본이 프리셋보다 오래됐는지 보라고 만든 것이다. 손으로 고친
   * 것도 여기 잡히므로 "다르다" 가 곧 "낡았다" 는 아니다. 무엇이
   * 다른지 보고 사람이 정한다.
   */
  const drift = ((): { diffs: ReturnType<typeof diffAgainst>; base: Comparable } | null => {
    if (active === undefined) return null;
    const found = preset.find((item) => item.name === active.name);
    if (found === undefined) return null;
    const base: Comparable = { ...pickComparable(found), routing: defaultRouting(found.name) };
    const mine = pickComparable(active);
    const diffs = diffAgainst({ ...mine, routing: active.routing }, base);
    return diffs.length === 0 ? null : { diffs, base };
  })();

  /**
   * 방금 답에 들어 있던 보기.
   *
   * 대화창에 버튼으로 띄운다. 누르면 그 글이 곧 학생의 말이 된다 —
   * 학생이 자유서술로 답하기 어려울 때 쓰라고 프롬프트가 내는 것이다.
   */
  const choices: Choice[] =
    active !== undefined && thread?.result?.ok
      ? readChoices(thread.result.raw, active.outputMode, active.choicesKey)
      : [];

  /** 지금 단계의 대화 모양. 여러 곳에서 쓰므로 한 번만 만든다 */
  const chatShape: ChatShape = active === undefined ? DEFAULT_CHAT_SHAPE : shapeOf(active);

  /** 지금 단계가 실제로 쓸 모델 설정. 공통을 따를 수도, 직접 정했을 수도 */
  const eff = active ? effective(active, common) : common;
  function addVarSet(from?: VarSet) {
    const name = window.prompt(
      from ? '복제할 세트의 새 이름' : '새 세트 이름',
      from ? `${from.name} 복사본` : `세트 ${varSets.length + 1}`,
    );
    if (name === null || name.trim() === '') return;
    setVarSets((prev) => [
      ...prev,
      { name: name.trim(), vars: from ? from.vars.map((v) => ({ ...v })) : [] },
    ]);
    setActiveSet(varSets.length);
  }

  function renameVarSet() {
    const current = varSets[activeSet];
    if (!current) return;
    const name = window.prompt('세트 이름', current.name);
    if (name === null || name.trim() === '') return;
    setVarSets((prev) =>
      prev.map((set, i) => (i === activeSet ? { ...set, name: name.trim() } : set)),
    );
  }

  function removeVarSet() {
    if (varSets.length === 1) return;
    const current = varSets[activeSet];
    if (!window.confirm(`세트 "${current?.name}" 을 지웁니다. 계속할까요?`)) return;
    setVarSets((prev) => prev.filter((_, i) => i !== activeSet));
    setActiveSet((prev) => (prev > 0 ? prev - 1 : 0));
  }

  /**
   * 지금 결과를 케이스로 남긴다.
   *
   * `note` 를 사람이 적게 하는 게 중요하다. "이 케이스가 무엇을 지키는
   * 건지" 를 나중에 알 수 없으면 테스트가 쓸모없어진다.
   */
  function saveCase() {
    if (!active || !thread?.result?.ok) return;
    const note = window.prompt(
      '이 케이스가 무엇을 지키는지 한 줄로 적으세요.\n' +
        '예: 빌런 말투로 3턴째, 학생이 규칙을 못 찾는 경우',
      '',
    );
    if (note === null) return;

    setCases((prev) => [
      ...prev,
      {
        stage: active.name,
        model: activeModel,
        params: {
          temperature: eff.temperature,
          maxTokens: eff.maxTokens,
          topP: eff.topP,
        },
        system: thread.result?.sentSystem ?? '',
        input: thread.input,
        output: thread.result?.raw ?? '',
        checks: thread.result?.checks ?? [],
        note: note.trim(),
        at: new Date().toISOString(),
      },
    ]);
  }

  /** 내보내기가 필요로 하는 만큼만 단계에서 뽑는다 */
  function exportStages(): ExportStage[] {
    return stages.map((stage) => {
      const settings = effective(stage, common);
      return {
        name: stage.name,
        note: stage.note,
        prompt: stage.prompt,
        sampleInput: stage.threads[0]?.input ?? stage.sampleInput,
        inputMode: stage.inputMode,
        outputMode: stage.outputMode,
        checkRule: stage.checkRule,
        historyKey: stage.historyKey,
        replyKey: stage.replyKey,
        recordKey: stage.recordKey,
        choicesKey: stage.choicesKey,
        useCommonPrompt: stage.useCommonPrompt,
        forceJsonMimeType: stage.forceJsonMimeType,
        provider: settings.provider,
        model: settings.model,
        temperature: settings.temperature,
        maxTokens: settings.maxTokens,
        topP: settings.topP,
        ownSettings: stage.ownSettings,
        rules: stage.rules,
        mapping: stage.mapping,
        routing: stage.routing,
      };
    });
  }

  /** 고른 종류의 내보내기 결과 */
  const exportText = ((): string => {
    if (panel !== 'export') return '';
    const list = exportStages();
    if (exportKind === 'stages') return toStagesTs(list, commonPrompt, vars);
    if (exportKind === 'cases') return toCasesJson(cases);
    if (exportKind === 'rules') return toRulesTs(list);
    if (exportKind === 'history') return toHistoryCsv(history);
    return toSpecMd(list, commonPrompt);
  })();

  const exportFile = {
    stages: 'stages.ts',
    cases: 'golden-cases.json',
    rules: 'stage-rules.ts',
    spec: 'pipeline-spec.md',
    history: 'prompt-history.csv',
  }[exportKind];

  function downloadExport() {
    // CSV 는 MIME 를 맞춰야 Excel 이 바로 연다.
    const blob = new Blob([exportText], {
      type:
        exportKind === 'history'
          ? 'text/csv;charset=utf-8'
          : 'text/plain;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = exportFile;
    link.click();
    URL.revokeObjectURL(url);
  }

  /** 지금 프로바이더의 모델 후보. 불러온 게 있으면 그쪽이 정확하다 */
  const modelCandidates =
    liveModels[eff.provider] ?? MODEL_CANDIDATES[eff.provider];
  /** 거르기를 적용한 목록 */
  const shownModels = ((): string[] => {
    const needle = modelFilter.trim().toLowerCase();
    if (needle === '') return modelCandidates;
    return modelCandidates.filter((name) => name.toLowerCase().includes(needle));
  })();

  /** 공통을 따르는 단계 수. 공통 설정 패널에서 보여준다 */
  const followers = stages.filter((stage) => !stage.ownSettings).length;

  const promptChanged =
    active !== undefined &&
    thread?.result != null &&
    (thread.result.sentSystem ?? '') !== '' &&
    thread.result.sentSystem !== buildSystem(active, commonPrompt);

  function patch(index: number, next: Partial<Stage>) {
    setStages((prev) =>
      prev.map((stage, i) => (i === index ? { ...stage, ...next } : stage)),
    );
  }

  /** 특정 단계의 특정 대화만 고친다. */
  function patchThread(
    stageIndex: number,
    threadIndex: number,
    next: Partial<Thread>,
  ) {
    setStages((prev) =>
      prev.map((stage, i) =>
        i !== stageIndex
          ? stage
          : {
              ...stage,
              threads: stage.threads.map((t, k) =>
                k === threadIndex ? { ...t, ...next } : t,
              ),
            },
      ),
    );
  }

  /** 지금 단계의 지금 대화를 고친다. */
  function patchActive(next: Partial<Thread>) {
    if (!active) return;
    patchThread(activeIndex, active.activeThread, next);
  }

  // ── 검증 규칙 · 단계 연결 ──────────────────────────────────────────────

  function setFieldRule(index: number, next: Partial<FieldRule>) {
    if (!active) return;
    patch(activeIndex, {
      rules: {
        ...active.rules,
        fields: active.rules.fields.map((rule, i) =>
          i === index ? { ...rule, ...next } : rule,
        ),
      },
    });
  }

  function addFieldRule() {
    if (!active) return;
    patch(activeIndex, {
      rules: { ...active.rules, fields: [...active.rules.fields, BLANK_FIELD_RULE] },
    });
  }

  function removeFieldRule(index: number) {
    if (!active) return;
    patch(activeIndex, {
      rules: {
        ...active.rules,
        fields: active.rules.fields.filter((_, i) => i !== index),
      },
    });
  }

  function setMapRow(index: number, next: Partial<MapRow>) {
    if (!active) return;
    patch(activeIndex, {
      mapping: active.mapping.map((row, i) => (i === index ? { ...row, ...next } : row)),
    });
  }

  function addMapRow() {
    if (!active) return;
    patch(activeIndex, { mapping: [...active.mapping, BLANK_MAP_ROW] });
  }

  function removeMapRow(index: number) {
    if (!active) return;
    patch(activeIndex, { mapping: active.mapping.filter((_, i) => i !== index) });
  }

  function setRouting(next: Partial<Routing>) {
    if (!active) return;
    patch(activeIndex, { routing: { ...active.routing, ...next } });
  }

  function setRouteRow(index: number, next: Partial<RouteRow>) {
    if (!active) return;
    setRouting({
      rows: active.routing.rows.map((row, i) => (i === index ? { ...row, ...next } : row)),
    });
  }

  function addRouteRow() {
    if (!active) return;
    setRouting({ rows: [...active.routing.rows, BLANK_ROUTE_ROW] });
  }

  function removeRouteRow(index: number) {
    if (!active) return;
    setRouting({ rows: active.routing.rows.filter((_, i) => i !== index) });
  }

  function addStage() {
    setStages((prev) => [...prev, toStage(BLANK_STAGE, `s${keySeq}`)]);
    setKeySeq((prev) => prev + 1);
    setActiveIndex(stages.length);
  }

  function removeStage(index: number) {
    if (stages.length === 1) return;
    setStages((prev) => prev.filter((_, i) => i !== index));
    setActiveIndex((current) => (current >= index && current > 0 ? current - 1 : current));
  }

  function moveStage(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= stages.length) return;
    setStages((prev) => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setActiveIndex(target);
  }

  /**
   * 빈 문자열이면 null(=보내지 않음). 숫자가 아니면 실행을 막는다.
   * 사용자가 넣은 값을 조용히 무시하지 않기 위해서다.
   */
  function readParams(stage: CommonSettings): {
    temperature: number | null;
    maxTokens: number | null;
    topP: number | null;
  } | null {
    const parse = (raw: string, label: string): number | null | 'bad' => {
      const text = raw.trim();
      if (text === '') return null;
      const value = Number(text);
      if (!Number.isFinite(value)) {
        window.alert(`${label} 값이 숫자가 아닙니다: ${text}`);
        return 'bad';
      }
      return value;
    };

    const temperature = parse(stage.temperature, 'temperature');
    if (temperature === 'bad') return null;
    const maxTokens = parse(stage.maxTokens, 'max output tokens');
    if (maxTokens === 'bad') return null;
    const topP = parse(stage.topP, 'top_p');
    if (topP === 'bad') return null;

    return { temperature, maxTokens, topP };
  }

  /** 한 번 호출한다. onDone 으로 후처리를 넘긴다. */
  function execute(input: string, onDone?: (result: RunResult) => void) {
    if (!active || !thread || thread.running) return;
    const settings = effective(active, common);
    const params = readParams(settings);
    if (params === null) return;
    const index = activeIndex;
    const threadIndex = active.activeThread;
    patchThread(index, threadIndex, { running: true, result: null });
    setSendNote(null);

    // 변수는 **보낼 때만** 치환한다. 화면의 프롬프트와 입력에는
    // {{이름}} 이 그대로 남아 재사용된다. 서버가 받은 값은
    // [보낸 프롬프트] 에 나오므로 치환 결과를 눈으로 확인할 수 있다.
    const system = applyVars(buildSystem(active, commonPrompt), vars);

    const model = settings.model.trim() || DEFAULT_MODEL[settings.provider];

    startTransition(async () => {
      const result = await runStage({
        provider: settings.provider,
        model,
        system,
        // JSON 파싱 전에 치환한다. 그래서 "grade": {{grade}} 는 숫자로,
        // "name": "{{nickname}}" 은 문자로 들어간다.
        input: applyVars(input, vars),
        inputMode: active.inputMode,
        outputMode: active.outputMode,
        checkRule: active.checkRule,
        rules: active.rules,
        forceJsonMimeType: active.forceJsonMimeType,
        apiKey: active.apiKey.trim() || defaultKeys[settings.provider].trim(),
        params,
        images: thread.images,
      });
      patchThread(index, threadIndex, { running: false, result });

      if (result.ok) {
        // 토큰은 가격을 몰라도 쌓는다.
        setSpentTokens((prev) => ({
          prompt: prev.prompt + (result.tokens.prompt ?? 0),
          output: prev.output + (result.tokens.output ?? 0),
        }));

        // 비용은 가격을 아는 모델만 더한다.
        const found = findPrice(prices, model);
        const cost = costOf(found?.price ?? null, result.tokens);
        if (cost !== null) setSpentUsd((prev) => prev + cost);
      }

      onDone?.(result);
    });
  }

  function run() {
    if (!thread) return;
    execute(thread.input);
  }

  /**
   * 단계 하나를 부른다. 화면 상태를 안 건드리고 결과만 준다.
   *
   * `execute` 는 지금 보고 있는 단계에 묶여 있어 루프에서 못 쓴다.
   */
  async function callStage(stage: Stage, input: string): Promise<RunResult | null> {
    const settings = effective(stage, common);
    const params = readParams(settings);
    if (params === null) return null;
    const model = settings.model.trim() || DEFAULT_MODEL[settings.provider];
    const result = await runStage({
      provider: settings.provider,
      model,
      system: applyVars(buildSystem(stage, commonPrompt), vars),
      input: applyVars(input, vars),
      inputMode: stage.inputMode,
      outputMode: stage.outputMode,
      checkRule: stage.checkRule,
      rules: stage.rules,
      forceJsonMimeType: stage.forceJsonMimeType,
      apiKey: stage.apiKey.trim() || defaultKeys[settings.provider].trim(),
      params,
      images: [],
    });
    countSpend(model, result);
    return result;
  }

  /** 학생 역할 모델. 공통 설정을 쓰고 평문으로 주고받는다 */
  async function callStudent(prompt: string, text: string): Promise<RunResult> {
    const model = common.model.trim() || DEFAULT_MODEL[common.provider];
    const result = await runStage({
      provider: common.provider,
      model,
      system: prompt,
      input: text,
      inputMode: 'text',
      outputMode: 'text',
      checkRule: null,
      rules: EMPTY_RULES,
      forceJsonMimeType: false,
      apiKey: defaultKeys[common.provider].trim(),
      params: { temperature: null, maxTokens: null, topP: null },
      images: [],
    });
    countSpend(model, result);
    return result;
  }

  function countSpend(model: string, result: RunResult) {
    if (!result.ok) return;
    setSpentTokens((prev) => ({
      prompt: prev.prompt + (result.tokens.prompt ?? 0),
      output: prev.output + (result.tokens.output ?? 0),
    }));
    const found = findPrice(prices, model);
    const cost = costOf(found?.price ?? null, result.tokens);
    if (cost !== null) setSpentUsd((prev) => prev + cost);
  }

  /**
   * 한 바퀴 돌린다.
   *
   * 단계 실행 → 학생에게 보일 말 → 학생 모델 → 학생 발화 → 다시 실행.
   * 분기 규칙이 `(끝)` 을 내면 마치고, 다른 단계를 내면 옮긴다.
   *
   * 입력 JSON 은 루프가 손에 들고 다닌다. 화면 상태로 오가면 렌더를
   * 기다려야 해서 옛 값을 읽는다. 화면에는 매 걸음 결과만 적어 준다.
   */
  /**
   * 멈추라는 신호를 보면서 기다린다.
   *
   * 45초를 통째로 자면 [중지] 를 눌러도 그동안 안 멈춘다.
   */
  async function pause(seconds: number): Promise<void> {
    for (let left = seconds; left > 0; left -= 1) {
      if (stopFlag.current) return;
      await new Promise((done) => window.setTimeout(done, 1000));
    }
  }

  /**
   * 일시적 오류면 다시 해 본다.
   *
   * 503 은 "지금 붐빈다" 는 뜻이지 우리가 뭘 잘못한 게 아니다.
   * 그런데 지금까지는 그걸로 실행 전체가 죽었다 — 아홉 회차를 돌리다
   * 여섯 번째에 503 이 나면 앞의 다섯 회차까지 같이 버려졌다.
   *
   * 400 · 401 · 404 는 다시 불러도 똑같으므로 바로 포기한다.
   */
  async function withRetry(
    call: () => Promise<RunResult | null>,
    limit: number,
    onWait: (attempt: number, seconds: number, error: string) => void,
  ): Promise<RunResult | null> {
    for (let attempt = 0; ; attempt += 1) {
      const result = await call();
      if (result === null || result.ok) return result;
      if (attempt >= limit || !isTransient(result.error) || stopFlag.current) {
        return result;
      }
      const seconds = waitFor(attempt);
      onWait(attempt + 1, seconds, result.error ?? '');
      await pause(seconds);
      if (stopFlag.current) return result;
    }
  }

  /**
   * 한 회차. **화면을 갱신할지는 부르는 쪽이 정한다.**
   *
   * 한 번만 돌릴 때는 걸음마다 로그와 입력을 화면에 적어 준다.
   * 반복할 때는 안 적는다 — 아홉 번 돌면서 매번 입력을 덮으면 화면이
   * 요동치고, 다음 회차가 앞 회차의 끝 상태에서 시작하게 된다.
   */
  async function runOnce(
    prompt: string,
    live: boolean,
  ): Promise<{ steps: AutoStep[]; reason: StopReason; visited: string[] }> {
    const log: AutoStep[] = [];
    const names = stages.map((stage) => stage.name);
    const start = Math.min(Math.max(0, autoStart), stages.length - 1);
    /** 지나간 단계. 중복 없이 순서대로 */
    const visited: string[] = [names[start]];
    let laps = 0;
    let at = start;
    let input = stages[at].threads[stages[at].activeThread]?.input ?? '';
    if (autoFresh) input = resetConversation(input, shapeOf(stages[at]));
    let n = 0;
    let students = 0;
    let moves = 0;
    let calls = 0;
    let reason: StopReason = 'finished';

    const add = (step: Omit<AutoStep, 'n'>) => {
      n += 1;
      log.push({ ...step, n });
      if (live) setAutoLog([...log]);
    };

    // 한 바퀴가 끝날 때까지 순서대로 부른다. 병렬로 돌 수 없는 일이다.
    for (;;) {
      if (stopFlag.current) {
        reason = 'stopped';
        break;
      }
      if (calls >= autoLimits.calls) {
        reason = 'call-limit';
        break;
      }

      const stage = stages[at];
      const shape = shapeOf(stage);

      calls += 1;
      const result = await withRetry(
        () => callStage(stage, input),
        autoLimits.retries,
        (attempt, seconds, error) =>
          add({
            stage: at,
            kind: 'retry',
            text: `${seconds}초 뒤 다시 (${attempt}/${autoLimits.retries})`,
            note: error.split('\n')[0],
          }),
      );
      if (result === null || !result.ok) {
        add({
          stage: at,
          kind: 'error',
          text: result?.error ?? '설정값을 읽지 못했습니다.',
          raw: result?.raw,
        });
        reason = 'error';
        break;
      }

      const failed = result.checks.filter((check) => check.level === 'fail');
      const parsed = parseOutput(result.raw) ?? result.raw;
      const pick = pickReply(result.raw, stage.outputMode, stage.replyKey);
      const narrow =
        stage.recordKey.trim() === ''
          ? null
          : pickReply(result.raw, stage.outputMode, stage.recordKey);
      const recorded = narrow !== null && narrow.show ? narrow : pick;

      add({
        stage: at,
        kind: 'ai',
        text: pick.show ? pick.text : '(보여줄 말 없음)',
        note: failed.length > 0 ? `검증 실패 ${failed.length}건` : undefined,
        raw: result.raw,
        // 점검이 나중에 읽는다. 보낸 뒤가 아니라 **보낸 그 입력**이어야
        // turn_limit 과 student_turn_count 가 그 걸음의 값이 된다.
        input,
        failed: failed.length,
      });

      const withAi = appendAiTurn(
        input,
        shape,
        stage.replyKey,
        parsed,
        recorded.show ? recorded.text : null,
      );
      if (withAi !== null) input = withAi;
      // 화면에도 남긴다. 끝나고 단계를 열면 마지막 상태가 보인다.
      if (live) patchThread(at, stage.activeThread, { input, result });

      // ── 어디로 갈지 ──────────────────────────────────────────────
      const matched = matchRoute(stage.routing, parsed);
      const to = matched?.to ?? STAY;

      if (to === FINISH) {
        add({ stage: at, kind: 'end', text: matched?.note ?? '' });
        reason = 'finished';
        break;
      }

      if (to !== STAY && to !== names[at]) {
        const next = names.indexOf(to);
        if (next === -1) {
          add({ stage: at, kind: 'error', text: `"${to}" 라는 단계가 없습니다.` });
          reason = 'error';
          break;
        }
        if (moves >= autoLimits.moves) {
          reason = 'move-limit';
          break;
        }
        moves += 1;

        const target = stages[next];
        const targetInput = target.threads[target.activeThread]?.input ?? '{}';
        // 받는 쪽 입력에 남아 있던 대화도 지운다. 옮겨온 대화가 그
        // 위에 얹히면 두 번 나온다.
        const cleanTarget = autoFresh
          ? resetConversation(targetInput, shapeOf(target))
          : targetInput;
        input =
          applyMapping(stage.mapping, parsed, input, cleanTarget)?.json ??
          bridge(stage.checkRule, parsed, input, cleanTarget) ??
          mergeOutput(cleanTarget, parsed) ??
          result.raw;

        add({ stage: next, kind: 'move', text: `${names[at]} → ${to}`, note: matched?.note });
        at = next;
        if (!visited.includes(names[at])) visited.push(names[at]);

        // 시작 단계로 돌아오면 한 바퀴다. AIPM 에서는 한 문제다.
        if (at === start) {
          laps += 1;
          if (laps >= autoLimits.laps) {
            add({ stage: at, kind: 'end', text: `${laps}바퀴 돌았습니다.` });
            reason = 'lap-limit';
            break;
          }
        }
        if (live) {
          patchThread(at, target.activeThread, { input });
          setActiveIndex(at);
        }
        continue;
      }

      // ── 학생이 한 번 더 말한다 ──────────────────────────────────
      if (students >= autoLimits.students) {
        reason = 'student-limit';
        break;
      }
      if (!pick.show) {
        add({ stage: at, kind: 'error', text: '학생에게 보여줄 말이 없어 대화를 이어갈 수 없습니다.' });
        reason = 'error';
        break;
      }

      students += 1;
      calls += 1;
      const said = await withRetry(
        () =>
          callStudent(
            prompt,
            studentInput(
              readTurns(input, stage.historyKey),
              pick.text,
              readChoices(result.raw, stage.outputMode, stage.choicesKey).map(
                (choice) => choice.label,
              ),
            ),
          ),
        autoLimits.retries,
        (attempt, seconds, error) =>
          add({
            stage: at,
            kind: 'retry',
            text: `${seconds}초 뒤 다시 (${attempt}/${autoLimits.retries})`,
            note: error.split('\n')[0],
          }),
      );
      if (said === null || !said.ok) {
        add({ stage: at, kind: 'error', text: said?.error ?? '학생 모델 호출 실패' });
        reason = 'error';
        break;
      }
      const text = cleanStudentReply(said.raw);
      add({ stage: at, kind: 'student', text });

      const withUser = appendUserTurn(input, shape, text);
      if (withUser === null) {
        add({ stage: at, kind: 'error', text: '입력 JSON을 읽지 못해 학생 발화를 넣을 수 없습니다.' });
        reason = 'error';
        break;
      }
      input = withUser;
      if (live) patchThread(at, stage.activeThread, { input });
    }

    return { steps: log, reason, visited };
  }

  /** 한 번 돌린다. 걸음이 화면에 그대로 쌓인다 */
  async function runAuto() {
    if (autoRunning || stages.length === 0) return;
    stopFlag.current = false;
    setAutoRunning(true);
    setAutoStop(null);
    setAutoLog([]);
    setTrials([]);
    setAutoAt(null);
    setPanel('auto');

    const done = await runOnce(profiles[activeProfile]?.prompt ?? '', true);
    setAutoStop(done.reason);
    setAutoRunning(false);
  }

  /**
   * 여러 번 돌려 통과율을 낸다.
   *
   * 한 번 통과했다고 괜찮은 게 아니고, 한 번 실패했다고 망가진 것도
   * 아니다. 프롬프트를 고쳤을 때 나아졌는지 말하려면 이게 있어야 한다.
   *
   * 회차 사이에 화면 상태를 안 건드리므로 매번 같은 자리에서 시작한다.
   */
  async function repeatAuto() {
    if (autoRunning || stages.length === 0) return;
    const list = autoAll ? profiles : [profiles[activeProfile]];
    const rounds = Math.max(1, autoRepeat);

    stopFlag.current = false;
    setAutoRunning(true);
    setAutoStop(null);
    setAutoLog([]);
    setTrials([]);
    setPanel('auto');

    const shapes = stages.map((stage) => ({
      name: stage.name,
      turnCountKey: stage.turnCountKey,
      limitKey: stage.limitKey,
      choicesKey: stage.choicesKey,
    }));

    const got: Trial[] = [];
    let n = 0;
    for (const profile of list) {
      for (let round = 0; round < rounds; round += 1) {
        if (stopFlag.current) break;
        n += 1;
        setAutoAt(`${n} / ${list.length * rounds} · ${profile.name} ${round + 1}회차`);

        const done = await runOnce(profile.prompt, false);
        const checked = auditRun(done.steps, shapes);
        got.push({
          n,
          profile: profile.name,
          reason: done.reason,
          steps: checked.steps,
          students: checked.students,
          findings: checked.findings,
          visited: done.visited,
        });
        setTrials([...got]);
        // 마지막 회차의 걸음은 화면에 남긴다. 통과율만 보면 무슨 말이
        // 오갔는지 알 수 없다.
        setAutoLog(done.steps);
      }
      if (stopFlag.current) break;
    }

    setAutoAt(null);
    setAutoStop(stopFlag.current ? 'stopped' : 'finished');
    setAutoRunning(false);
  }

  /** 지금 단계의 프로바이더에 실제 모델 목록을 물어본다. */
  async function loadModels() {
    if (!active || loadingModels) return;
    const provider = effective(active, common).provider;
    const key = active.apiKey.trim() || defaultKeys[provider].trim();

    setLoadingModels(true);
    const result = await fetchModels(provider, key);
    setLoadingModels(false);
    // 방금 부른 사람은 보고 싶어 한다. 불러오면 펼친다.
    setShowModels(true);

    if (!result.ok) {
      window.alert(result.error);
      return;
    }
    setLiveModels((prev) => ({ ...prev, [provider]: result.models }));
  }

  /** 파일을 base64로 읽어 현재 단계에 붙인다. */
  async function attachFiles(files: FileList | null) {
    if (!files || files.length === 0 || !active) return;
    const index = activeIndex;
    const added: Attachment[] = [];

    for (const file of Array.from(files)) {
      if (file.size > MAX_IMAGE_BYTES) {
        window.alert(
          `${file.name} 은 ${(file.size / 1024 / 1024).toFixed(1)}MB 입니다. ` +
            `${MAX_IMAGE_BYTES / 1024 / 1024}MB 이하만 붙일 수 있습니다.`,
        );
        continue;
      }
      const buffer = await file.arrayBuffer();
      added.push({
        name: file.name,
        mediaType: file.type || 'image/png',
        data: toBase64(buffer),
      });
    }

    if (added.length > 0 && thread) {
      patchThread(index, active.activeThread, {
        images: [...thread.images, ...added],
      });
    }
  }

  function removeImage(imageIndex: number) {
    if (!thread) return;
    patchActive({ images: thread.images.filter((_, k) => k !== imageIndex) });
  }

  /**
   * 대화 전송. 입력 형식에 따라 기록이 쌓이는 곳이 다르다.
   *
   * json  입력 JSON 안의 배열에 학생 턴 -> 응답 턴을 붙인다.
   * text  보낸 글이 곧 입력이 된다. 기록은 화면(transcript)에만 남는다.
   */
  /** `picked` 를 주면 입력칸 대신 그 글을 보낸다. 보기 버튼이 쓴다 */
  function send(picked?: string) {
    if (!active || !thread || thread.running) return;
    const text = (picked ?? draft).trim();
    // 이미지만 붙여 보낼 수 있다. OCR 단계에서 자주 쓴다.
    if (!text && thread.images.length === 0) return;

    const index = activeIndex;
    const threadIndex = active.activeThread;
    const names = thread.images.map((image) => image.name);
    setReplyNote(null);

    if (active.inputMode === 'text') {
      setDraft('');
      patchThread(index, threadIndex, {
        input: text,
        transcript: [...thread.transcript, { who: 'user', text, attachments: names }],
      });

      execute(text, (result) => {
        if (!result.ok) return;
        const pick = pickReply(result.raw, active.outputMode, active.replyKey);
        setReplyNote(pick.show ? null : pick.reason);
        if (!pick.show) return;
        setStages((prev) =>
          prev.map((stage, i) =>
            i !== index
              ? stage
              : {
                  ...stage,
                  threads: stage.threads.map((t, k) =>
                    k !== threadIndex
                      ? t
                      : {
                          ...t,
                          transcript: [
                            ...t.transcript,
                            { who: 'ai' as const, text: pick.text, attachments: [] },
                          ],
                        },
                  ),
                },
          ),
        );
      });
      patchThread(index, threadIndex, { images: [] });
      return;
    }

    let source = thread.input;
    let withUser = appendUserTurn(source, chatShape, text, names);

    // 안내만 하고 손으로 고치게 두면, 저장된 설정을 쓰는 사람은 매번 같은
    // 벽을 만난다. 고칠 수 있으면 그 자리에서 고쳐 준다.
    if (withUser === null) {
      const repair = repairBareVars(source, vars);
      if (
        repair !== null &&
        window.confirm(
          [
            `따옴표 없는 변수 때문에 입력을 읽지 못했습니다: ${repair.replaced.join(' ')}`,
            '',
            '지금 값으로 바꿔서 이어갈까요?',
            '',
            '입력 JSON 은 변수 치환 전에도 유효해야 합니다.',
            '대화가 입력 JSON 안의 배열이라 보내기 전에 읽어야 하기 때문입니다.',
          ].join('\n'),
        )
      ) {
        source = repair.text;
        patchThread(index, threadIndex, { input: source });
        withUser = appendUserTurn(source, chatShape, text, names);
      }
    }

    if (withUser === null) {
      window.alert(inputParseHint(source));
      return;
    }

    const shapeAtSend = chatShape;
    const replyKey = active.replyKey;
    const recordKey = active.recordKey;

    setDraft('');
    patchThread(index, threadIndex, { input: withUser });

    const outputMode = active.outputMode;

    execute(withUser, (result) => {
      if (!result.ok) return;
      // 울타리를 벗기고 읽는다. 이게 없으면 stage_status 같은 상태가
      // 조용히 안 옮겨진다.
      const parsed = parseOutput(result.raw) ?? result.raw;

      const pick = pickReply(result.raw, outputMode, replyKey);
      setReplyNote(pick.show ? null : pick.reason);

      // 화면에는 문제를 매 턴 다시 보여 주고, 기록에는 말풍선만 남긴다.
      // 기록용 경로가 아무것도 못 찾으면 보여 준 것을 그대로 남긴다.
      const narrow =
        recordKey.trim() === '' ? null : pickReply(result.raw, outputMode, recordKey);
      const recorded = narrow !== null && narrow.show ? narrow : pick;

      // 말풍선을 만들지 않아도 stage_status 같은 상태 이월은 그대로 한다.
      const withAi = appendAiTurn(
        withUser,
        shapeAtSend,
        replyKey,
        parsed,
        recorded.show ? recorded.text : null,
      );
      if (withAi !== null) patchThread(index, threadIndex, { input: withAi });
    });

    // 이미지는 그 턴에만 붙는다. 대화 기록에는 파일명만 남는다.
    patchThread(index, threadIndex, { images: [] });
  }

  /**
   * 결과를 다른 단계의 입력으로 보낸다.
   *
   * 다음 단계로만 갈 수 있으면 마지막 단계에서 막힌다. 학습은 한 바퀴를
   * 돌아 다시 문제로 돌아오므로(06 → 02) 대상을 고를 수 있어야 한다.
   */
  function sendTo(nextIndex: number) {
    const raw = thread?.result?.raw;
    if (!active || !thread || !raw) return;
    if (nextIndex < 0 || nextIndex >= stages.length) return;
    if (nextIndex === activeIndex) return;

    // 받는 쪽도 지금 보고 있는 대화에 넣는다.
    const target = stages[nextIndex];
    const targetThread = target.activeThread;

    const targetInput = target.threads[targetThread]?.input ?? '{}';
    // 평문 출력이거나 JSON 이 깨졌으면 null 이 된다. 아래에서 원문을
    // 그대로 넣는다.
    const output: unknown = parseOutput(raw);

    // 우선순위: 사용자가 적은 매핑 → AIPM 규칙 → 출력 원문.
    // 손으로 적은 것이 항상 이긴다. 도구가 몰래 다르게 옮기면 안 된다.
    // 우선순위: 사용자가 적은 매핑 → AIPM 규칙 → 출력 원문.
    let nextInput: string;
    const notes: string[] = [];

    const custom = applyMapping(active.mapping, output, thread.input, targetInput);
    if (custom !== null) {
      nextInput = custom.json;
      notes.push(`${custom.applied}칸 옮겼습니다.`, ...custom.notes);
    } else {
      // 출력만이 아니라 이 단계의 입력도 넘긴다. 대화 기록이 거기 있다.
      const mapped = bridge(active.checkRule, output, thread.input, targetInput);
      if (mapped !== null) {
        nextInput = mapped;
        notes.push('검증 규칙에 맞춰 옮겼습니다.');
      } else {
        // 통째로 갈아치우지 않는다. 받는 쪽 입력에 있던 student_id ·
        // grade · turn_limit 같은 값이 사라지면 프롬프트가 못 읽는다.
        const merged = mergeOutput(targetInput, output);
        nextInput = merged ?? raw;
        notes.push(
          merged !== null
            ? '옮길 규칙이 없어 결과를 입력에 얹었습니다. 없던 칸은 그대로 둡니다.'
            : '옮길 규칙이 없고 입력이 JSON이 아니라 결과 원문을 그대로 넣었습니다.',
        );
      }
    }

    // 규칙이 대화를 다루지 않을 때만 체크박스가 일한다.
    //
    // **위에서 만든 nextInput 위에 이어서 얹는다.** 예전에는 patchThread
    // 를 한 번 더 하려고 setTimeout 을 썼는데, 그 콜백이 옛 stages 를
    // 붙잡고 있어서 방금 넣은 입력을 못 보고 덮어썼다.
    if (!conversationHandled && carryConversation) {
      const carried = carryInto(
        thread.input,
        active.historyKey,
        nextInput,
        target.historyKey,
      );
      if (carried !== null) {
        nextInput = carried;
        notes.push('대화도 함께 옮겼습니다.');
      }
    }

    patchThread(nextIndex, targetThread, { input: nextInput });
    setSendNote(notes.join(' '));

    setLastTransfer({ from: activeIndex, to: nextIndex });
    setActiveIndex(nextIndex);
    setSendTarget(null);
  }

  /**
   * 대화를 옮겨 넣은 입력을 만든다. 옮길 게 없으면 null.
   *
   * 상태를 건드리지 않는다. 부르는 쪽이 결과를 어떻게 쓸지 정한다.
   * 받는 쪽의 `대화 배열 키` 이름에 맞춰 넣으므로 이름이 서로 달라도 된다.
   */
  function carryInto(
    fromInput: string,
    fromKey: string,
    toInput: string,
    toKey: string,
  ): string | null {
    if (readTurns(fromInput, fromKey).length === 0) return null;
    const result = applyMapping(
      [{ source: 'input', from: fromKey, to: toKey }],
      null,
      fromInput,
      toInput,
    );
    return result === null || result.applied === 0 ? null : result.json;
  }

  /** 빈 대화창의 [가져오기] 버튼. 지금 상태를 읽어 옮긴다 */
  function copyConversation(fromIndex: number, toIndex: number): boolean {
    const from = stages[fromIndex];
    const to = stages[toIndex];
    if (!from || !to) return false;

    const carried = carryInto(
      from.threads[from.activeThread]?.input ?? '',
      from.historyKey,
      to.threads[to.activeThread]?.input ?? '{}',
      to.historyKey,
    );
    if (carried === null) return false;

    patchThread(toIndex, to.activeThread, { input: carried });
    return true;
  }

  /**
   * 매핑이나 검증 프리셋이 이미 대화를 다루는가.
   *
   * 그러면 체크박스를 잠근다. 규칙이 비우기로 정했는데 체크박스가 다시
   * 채워 넣으면 어느 쪽이 이기는지 알 수 없게 된다.
   */
  const conversationHandled =
    active !== undefined &&
    (hasMapping(active.mapping) || active.checkRule !== null);

  /**
   * 대화가 비었을 때 보여줄 이유.
   *
   * 정상적으로 비는 경우도 있다. 그때 "잘못됐나" 하고 헤매지 않게 한다.
   */
  const emptyReason = (():
    | { text: string; action?: { label: string; run: () => void } }
    | undefined => {
    if (!active || !thread) return undefined;
    if (readTurns(thread.input, active.historyKey).length > 0) return undefined;
    if (active.inputMode !== 'json') {
      return {
        text:
          '이 단계는 입력이 평문이라 대화가 입력 JSON 에 쌓이지 않습니다.\n' +
          '주고받은 내용은 화면에만 남습니다.',
      };
    }

    const parsed = ((): Record<string, unknown> | null => {
      try {
        const value: unknown = JSON.parse(thread.input);
        return typeof value === 'object' && value !== null && !Array.isArray(value)
          ? (value as Record<string, unknown>)
          : null;
      } catch {
        return null;
      }
    })();

    // 배열은 있는데 이름이 다른 경우. 가장 잦은 실수다.
    const arrays = parsed
      ? Object.keys(parsed).filter((key) => Array.isArray(parsed[key]))
      : [];
    const other = arrays.filter((key) => key !== active.historyKey);
    if (other.length > 0) {
      return {
        text:
          `입력에 ${other.map((key) => `${key}`).join(' · ')} 배열이 있는데 ` +
          `대화 배열 키는 ${active.historyKey} 입니다.\n` +
          '이름을 맞추면 대화가 보입니다.',
      };
    }

    // 방금 이 단계로 넘어왔는데 대화가 안 왔다.
    if (lastTransfer?.to === activeIndex) {
      const from = stages[lastTransfer.from];
      const fromName = from?.name || '이전 단계';
      if (from && from.checkRule === 'aipm-problem') {
        return {
          text: `${fromName} 는 새 문제로 시작하는 단계라 대화를 비웠습니다.\n정상입니다.`,
        };
      }
      return {
        text: `${fromName} 에서 넘어왔지만 대화는 오지 않았습니다.`,
        action: {
          label: `${fromName} 의 대화 가져오기`,
          run: () => {
            const ok = copyConversation(lastTransfer.from, activeIndex);
            if (!ok) window.alert('가져올 대화가 없습니다.');
          },
        },
      };
    }

    return undefined;
  })();

  /**
   * 결과를 보고 고른 대상. 규칙이 없으면 null, 규칙은 있는데 못 골랐으면
   * `index` 만 null 이고 이유가 `note` 에 남는다.
   */
  const routePick =
    active && thread?.result?.raw
      ? pickRoute(
          active.routing,
          parseOutput(thread.result.raw),
          stages.map((stage) => stage.name),
          activeIndex,
        )
      : null;

  /**
   * 기본 대상. 조건부 규칙 → 다음 단계 → 마지막이면 처음.
   *
   * **정하기만 하고 보내지는 않는다.** 자동으로 넘어가면 결과를 보기도
   * 전에 화면이 바뀐다. 무엇을 보고 정했는지 옆에 적어 두고 누르게 한다.
   */
  const straightTarget = activeIndex + 1 < stages.length ? activeIndex + 1 : 0;
  const defaultTarget = routePick?.index ?? straightTarget;

  // ── 대화 관리 ──────────────────────────────────────────────────────────

  /** 빈 대화를 추가한다. 입력은 그 단계의 예시로 시작한다. */
  function addThread() {
    if (!active) return;
    const next = newThread(
      `${active.key}-t${keySeq}`,
      `대화 ${active.threads.length + 1}`,
      active.sampleInput,
    );
    setKeySeq((prev) => prev + 1);
    patch(activeIndex, {
      threads: [...active.threads, next],
      activeThread: active.threads.length,
    });
  }

  /**
   * 지금 대화를 복제한다. 입력까지 그대로 가져가므로 같은 지점에서
   * 다르게 답해보는 분기 시험에 쓴다. 결과는 가져가지 않는다.
   */
  function duplicateThread() {
    if (!active || !thread) return;
    const copy = newThread(
      `${active.key}-t${keySeq}`,
      `${thread.name} 사본`,
      thread.input,
    );
    copy.transcript = [...thread.transcript];
    setKeySeq((prev) => prev + 1);
    patch(activeIndex, {
      threads: [...active.threads, copy],
      activeThread: active.threads.length,
    });
  }

  function removeThread(index: number) {
    if (!active || active.threads.length === 1) return;
    const threads = active.threads.filter((_, i) => i !== index);
    patch(activeIndex, {
      threads,
      activeThread: Math.min(active.activeThread, threads.length - 1),
    });
  }

  function renameThread(index: number, name: string) {
    patchThread(activeIndex, index, { name });
  }


  const accent = stageColor(activeIndex).border;
  const activeModel = active
    ? eff.model.trim() || DEFAULT_MODEL[eff.provider]
    : '';
  const activePrice = findPrice(prices, activeModel)?.price ?? null;
  const activeProvider = eff.provider;
  const providerLabel =
    PROVIDERS.find((entry) => entry.id === eff.provider)?.label ?? eff.provider;

  const keySource = active?.apiKey.trim()
    ? '이 단계 키'
    : defaultKeys[activeProvider].trim()
      ? `기본 ${providerLabel} 키`
      : activeProvider === 'gemini' && hasEnvApiKey
        ? '.env GEMINI_API_KEY'
        : '없음';

  return (
    <main className="mx-auto flex w-full max-w-[1500px] flex-col gap-4 p-6 font-mono text-[13px]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-3 dark:border-neutral-800">
        <div className="flex items-baseline gap-3">
          <h1 className="text-base font-bold">Prompt Lab</h1>
          <span className="rounded bg-amber-200 px-1.5 py-0.5 text-[11px] text-amber-900">
            dev 전용
          </span>
          <span className="text-neutral-500">
            단계별 프롬프트를 AI에 보내고 결과를 검증합니다
          </span>
        </div>

        {/* 헤더에는 비용과 저장만 둔다. 값을 편집하는 것들(키·가격표·
            공통 프롬프트)은 패널로 내렸다. */}
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-neutral-500">
            이번 세션{' '}
            <b className="text-neutral-900 dark:text-neutral-100">
              {(spentTokens.prompt + spentTokens.output).toLocaleString('ko-KR')} tok
            </b>
            {` (in ${spentTokens.prompt.toLocaleString('ko-KR')} / out ${spentTokens.output.toLocaleString('ko-KR')}) · `}
            <b className="text-neutral-900 dark:text-neutral-100">
              {formatUsd(spentUsd)}
            </b>
            {Number(krwRate) > 0 && ` ${formatKrw(spentUsd, Number(krwRate))}`}
          </span>
          {(spentUsd > 0 || spentTokens.prompt + spentTokens.output > 0) && (
            <button
              onClick={() => {
                setSpentUsd(0);
                setSpentTokens({ prompt: 0, output: 0 });
              }}
              className="text-neutral-500 hover:underline"
            >
              사용량 초기화
            </button>
          )}

          <Toggle
            checked={remember}
            onChange={setRemember}
            label={
              !remember
                ? '설정 저장'
                : saveState === 'failed'
                  ? '설정 저장 · 저장 실패'
                  : '설정 저장 · 저장됨'
            }
            tone={remember && saveState === 'failed' ? 'danger' : undefined}
          />
          <Toggle checked={rememberKeys} onChange={setRememberKeys} label="키 저장" />
        </div>
      </header>

      <nav className="flex flex-wrap items-center gap-3 text-neutral-500">
        {(
          [
            ['settings', '공통 설정'],
            ['vars', '변수'],
            ['price', '가격표'],
            ['prompt', '공통 프롬프트'],
            ['export', '내보내기'],
            ['auto', '자동 실행'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setPanel(panel === id ? 'none' : id)}
            className={`rounded border px-2 py-1 ${
              panel === id
                ? 'border-neutral-900 text-neutral-900 dark:border-neutral-100 dark:text-neutral-100'
                : 'border-neutral-300 dark:border-neutral-700'
            }`}
          >
            {label}
          </button>
        ))}
        <button
          onClick={() => {
            if (
              !window.confirm(
                '단계 · 공통 프롬프트 · 변수 세트를 기본 프리셋으로 되돌립니다.\n' +
                  '프롬프트가 변수를 참조하므로 셋을 같이 되돌려야 합니다.\n\n' +
                  '계속할까요?',
              )
            ) {
              return;
            }
            setStages(preset.map((base, index) => toStage(base, `p${index}`)));
            setKeySeq(preset.length);
            setActiveIndex(0);
            setCommonPrompt(COMMON_RULES);
            // 프롬프트만 되돌리고 변수를 두면 {{persona}} 가 깨진다.
            setVarSets(varPreset.length > 0 ? varPreset : [DEFAULT_VAR_SET]);
            setActiveSet(0);
          }}
          className="rounded border border-dashed border-neutral-300 px-2 py-1 dark:border-neutral-700"
        >
          단계 초기화
        </button>
        <button
          onClick={() => {
            if (
              !window.confirm(
                '모든 단계의 대화와 응답 횟수를 비웁니다.\n' +
                  '프롬프트 · 설정 · student_id · grade · turn_limit 은 그대로 둡니다.\n\n' +
                  '계속할까요?',
              )
            ) {
              return;
            }
            setStages((prev) =>
              prev.map((stage) => ({
                ...stage,
                threads: stage.threads.map((t) => ({
                  ...t,
                  transcript: [],
                  result: null,
                  images: [],
                  input:
                    stage.inputMode === 'json'
                      ? resetConversation(t.input, shapeOf(stage))
                      : t.input,
                })),
              })),
            );
            setAutoLog([]);
            setTrials([]);
            setAutoStop(null);
            setSendNote(null);
            setReplyNote(null);
          }}
          className="rounded border border-dashed border-neutral-300 px-2 py-1 dark:border-neutral-700"
          title="프롬프트와 설정은 그대로 둡니다"
        >
          대화 비우기
        </button>
      </nav>

      {panel === 'settings' && (
        <Panel
          title="공통 설정"
          hint={`모든 단계의 기본값 · 지금 ${followers} / ${stages.length} 단계가 따릅니다`}
          onClose={() => setPanel('none')}
        >
          <div className="flex flex-col gap-3 p-3">
            {/* 여기 한 번 넣으면 단계를 새로 추가해도 따라온다. 단계마다
                일일이 고치지 않아도 되는 게 이 패널의 존재 이유다. */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <label className="flex items-center gap-2">
                <span className="shrink-0 text-neutral-500">프로바이더</span>
                <select
                  value={common.provider}
                  onChange={(event) =>
                    setCommon((prev) => ({
                      ...prev,
                      provider: event.target.value as ProviderId,
                    }))
                  }
                  className="rounded border border-neutral-300 bg-transparent px-2 py-1 dark:border-neutral-700"
                >
                  {PROVIDERS.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex min-w-[15rem] flex-1 items-center gap-2">
                <span className="shrink-0 text-neutral-500">모델</span>
                <input
                  value={common.model}
                  onChange={(event) =>
                    setCommon((prev) => ({ ...prev, model: event.target.value }))
                  }
                  placeholder={`직접 입력. 비우면 ${DEFAULT_MODEL[common.provider]}`}
                  spellCheck={false}
                  autoComplete="off"
                  className="min-w-0 flex-1 rounded border border-neutral-300 bg-transparent px-2 py-1 dark:border-neutral-700"
                />
              </label>

              <ParamField
                label="temperature"
                value={common.temperature}
                onChange={(next) =>
                  setCommon((prev) => ({ ...prev, temperature: next }))
                }
              />
              <ParamField
                label="max output"
                value={common.maxTokens}
                onChange={(next) => setCommon((prev) => ({ ...prev, maxTokens: next }))}
                placeholder={common.provider === 'anthropic' ? '비우면 16000' : '미전송'}
              />
              <ParamField
                label="top_p"
                value={common.topP}
                onChange={(next) => setCommon((prev) => ({ ...prev, topP: next }))}
              />
            </div>

            <div className="flex flex-col gap-2 border-t border-neutral-200 pt-3 dark:border-neutral-800">
              <span className="text-neutral-500">프로바이더별 기본 키</span>
              {PROVIDERS.map((entry) => (
                <label key={entry.id} className="flex items-center gap-2">
                  <span className="w-20 shrink-0 text-neutral-500">{entry.label}</span>
                  <input
                    type="password"
                    value={defaultKeys[entry.id]}
                    onChange={(event) =>
                      setDefaultKeys((prev) => ({
                        ...prev,
                        [entry.id]: event.target.value,
                      }))
                    }
                    placeholder={
                      entry.id === 'gemini' && hasEnvApiKey
                        ? '.env 값을 씁니다'
                        : '키를 넣으세요'
                    }
                    className="flex-1 rounded border border-neutral-300 bg-transparent px-2 py-1 dark:border-neutral-700"
                  />
                </label>
              ))}
            </div>

            <div className="flex flex-col gap-1 border-t border-neutral-200 pt-3 text-[11px] text-neutral-500 dark:border-neutral-800">
              <p>
                단계에서 <b>[이 단계는 따로 설정]</b>을 켜지 않으면 여기 값을
                그대로 씁니다. 새로 만든 단계도 마찬가지입니다.
              </p>
              <p>
                <b>키</b>는 이 브라우저에만 저장되고 서버로 올라가지 않습니다.
                우선순위는 <b>이 단계 키 → 기본 키</b> 순입니다. 특정 단계만 다른
                계정으로 돌리려면 그 단계의 API 키에 따로 넣으세요.
              </p>
            </div>
          </div>
        </Panel>
      )}

      {panel === 'vars' && (
        <Panel
          title="변수"
          hint={`프롬프트와 입력에서 {{이름}} 으로 씁니다 · 세트 ${varSets.length}개`}
          onClose={() => setPanel('none')}
        >
          <div className="flex flex-col gap-2 p-3">
            {/* 세트가 곧 테스트 케이스다. 빌런/친구처럼 말투 블록을
                통째로 갈아끼울 때 값을 다시 붙여넣지 않아도 된다. */}
            <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200 pb-3 dark:border-neutral-800">
              <span className="text-neutral-500">세트</span>
              <select
                value={activeSet}
                onChange={(event) => setActiveSet(Number(event.target.value))}
                className="rounded border border-neutral-300 bg-transparent px-2 py-1 dark:border-neutral-700"
              >
                {varSets.map((set, index) => (
                  <option key={index} value={index}>
                    {set.name || '(이름 없음)'}
                  </option>
                ))}
              </select>
              <button
                onClick={() => addVarSet()}
                className="rounded border border-dashed border-neutral-400 px-2 py-1 text-[11px] text-neutral-500 dark:border-neutral-600"
              >
                + 세트
              </button>
              <button
                onClick={() => addVarSet(varSets[activeSet])}
                className="text-[11px] text-neutral-500 hover:underline"
              >
                복제
              </button>
              <button
                onClick={renameVarSet}
                className="text-[11px] text-neutral-500 hover:underline"
              >
                이름 바꾸기
              </button>
              {varSets.length > 1 && (
                <button
                  onClick={removeVarSet}
                  className="text-[11px] text-red-600 hover:underline dark:text-red-400"
                >
                  삭제
                </button>
              )}
              <span className="ml-auto text-[11px] text-neutral-500">
                세트를 바꾸면 값이 통째로 바뀝니다. 프롬프트는 그대로입니다
              </span>
            </div>

            {vars.length > 0 && (
              <div className="hidden gap-1 text-[11px] text-neutral-500 md:flex">
                <span className="w-40">이름</span>
                <span className="w-72">값 · 여러 줄 가능</span>
                <span>쓰인 곳</span>
              </div>
            )}
            {vars.map((item, index) => (
              <div key={index} className="flex flex-wrap items-start gap-1">
                <input
                  value={item.name}
                  onChange={(event) =>
                    setVars((prev) =>
                      prev.map((row, i) =>
                        i === index ? { ...row, name: event.target.value } : row,
                      ),
                    )
                  }
                  placeholder="grade"
                  spellCheck={false}
                  className="w-40 rounded border border-neutral-300 bg-transparent px-2 py-1 dark:border-neutral-700"
                />
                {/* 말투 블록처럼 문단짜리 값이 들어온다. 한 줄 칸에는
                    넣을 수도 고칠 수도 없다. */}
                <textarea
                  value={item.value}
                  onChange={(event) =>
                    setVars((prev) =>
                      prev.map((row, i) =>
                        i === index ? { ...row, value: event.target.value } : row,
                      ),
                    )
                  }
                  rows={item.value.includes('\n') ? 4 : 1}
                  placeholder="4 또는 여러 줄짜리 말투 블록"
                  spellCheck={false}
                  className="w-72 resize-y rounded border border-neutral-300 bg-transparent px-2 py-1 dark:border-neutral-700"
                />
                <span className="px-2 py-1.5 text-[11px] text-neutral-500">
                  {usageOf(item.name, [
                    {
                      label: '프롬프트',
                      texts: [commonPrompt, ...stages.map((stage) => stage.prompt)],
                    },
                    {
                      label: '입력',
                      texts: stages.flatMap((stage) =>
                        stage.threads.map((t) => t.input),
                      ),
                    },
                  ])}
                </span>
                <button
                  onClick={() =>
                    setVars((prev) => prev.filter((_, i) => i !== index))
                  }
                  className="px-2 py-1 text-neutral-400 hover:text-red-600"
                  title="이 줄 삭제"
                >
                  ×
                </button>
              </div>
            ))}
            <div>
              <button
                onClick={() => setVars((prev) => [...prev, BLANK_VARIABLE])}
                className="rounded border border-dashed border-neutral-400 px-2 py-1 text-neutral-500 dark:border-neutral-600"
              >
                + 변수
              </button>
            </div>
            <p className="text-[11px] text-neutral-500">
              보낼 때만 치환합니다. 프롬프트와 입력에는 <code>{'{{이름}}'}</code>이
              그대로 남습니다. 치환된 결과는 답변 아래{' '}
              <b>[보낸 프롬프트]</b>에서 확인하세요.
            </p>
            <p className="text-[11px] text-neutral-500">
              <b>입력 JSON 에서는 문자열 자리에만 쓰세요.</b>{' '}
              <code>&quot;id&quot;: &quot;{'{{student_id}}'}&quot;</code> 는 되지만{' '}
              <code>&quot;grade&quot;: {'{{grade}}'}</code> 는 안 됩니다. 치환은 보낼 때만
              일어나는데 대화창은 그 전에 입력을 읽어야 하기 때문입니다. 숫자는 직접
              적으세요.
            </p>
            <p className="text-[11px] text-neutral-500">
              프롬프트 안에서는 어디에나 쓸 수 있습니다. 따옴표는 직접 관리합니다. 파싱 전에 치환하므로{' '}
              <code>&quot;grade&quot;: {'{{grade}}'}</code>는 숫자로,{' '}
              <code>&quot;name&quot;: &quot;{'{{nickname}}'}&quot;</code>는 문자로
              들어갑니다. <b>정의하지 않은 이름은 바꾸지 않고 그대로 둡니다.</b>
            </p>
            <p className="text-[11px] text-neutral-500">
              말투처럼 문단짜리 값도 됩니다. 공통 프롬프트에{' '}
              <code>{'{{persona_tone}}'}</code>만 써 두고, 빌런 세트와 친구 세트를
              만들어 오가며 비교하세요. <b>[복제]</b>로 베낀 뒤 그 값만 고치면
              됩니다.
            </p>
          </div>
        </Panel>
      )}

      {panel === 'auto' && (
        <Panel
          title="자동 실행"
          hint={
            autoRunning
              ? '도는 중… 아래 [중지]로 멈춥니다'
              : 'AI가 학생 자리에 앉아 끝까지 돌립니다'
          }
          onClose={() => setPanel('none')}
        >
          <div className="flex flex-col gap-3 p-3">
            <p className="text-[11px] text-neutral-500">
              <b>대화 비우고 시작</b>이 켜져 있으면 시작 단계와 옮겨 갈 단계의
              대화를 지우고 돕니다. 끄면 지금 입력에 쌓인 대화를 이어받습니다 —
              &ldquo;다섯 턴째부터 어떻게 되나&rdquo; 를 일부러 볼 때만 끄세요.{' '}
              <code>student_id</code> · <code>grade</code> ·{' '}
              <code>turn_limit</code> 같은 설정은 어느 쪽이든 그대로 둡니다.
            </p>

            <p className="text-[11px] text-neutral-500">
              <b>503</b> 같은 일시적 오류는 <b>3 · 8 · 20 · 45초</b> 를 쉬며 다시
              해 봅니다. 붐빌 때 바로 다시 부르면 더 붐빕니다. 반면{' '}
              <b>400 · 401 · 404</b> 는 다시 불러도 똑같으므로 바로 멈춥니다 —
              기다리는 동안 원인만 늦게 압니다. 재시도를 0 으로 두면 안 합니다.
            </p>

            <p className="text-[11px] text-neutral-500">
              단계를 실행하고, 학생에게 보일 말을 <b>학생 역할 모델</b>에 넘기고,
              그 답을 다시 단계에 넣습니다. 어디로 갈지는 각 단계의{' '}
              <b>[분기]</b> 표가 정합니다 — 거기서 <code>{STAY}</code> 와{' '}
              <code>{FINISH}</code> 를 고를 수 있습니다. 규칙이 없으면 학생 발화
              상한에 걸릴 때까지 대화를 이어갑니다.
            </p>

            <div className="flex flex-wrap items-end gap-3">
              <label className="flex items-center gap-2">
                <span className="shrink-0 text-neutral-500">시작 단계</span>
                <select
                  value={autoStart}
                  onChange={(event) => setAutoStart(Number(event.target.value))}
                  disabled={autoRunning}
                  className="rounded border border-neutral-300 bg-transparent px-1 py-1 dark:border-neutral-700"
                >
                  {stages.map((stage, index) => (
                    <option key={stage.key} value={index}>
                      {stage.name || '(이름 없음)'}
                    </option>
                  ))}
                </select>
              </label>

              {(
                [
                  ['students', '학생 발화'],
                  ['moves', '단계 이동'],
                  ['calls', '호출'],
                  ['retries', '재시도'],
                  ['laps', '바퀴'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2">
                  <span className="shrink-0 text-neutral-500">
                    {label} {key === 'retries' || key === 'laps' ? '' : '상한'}
                  </span>
                  <input
                    value={String(autoLimits[key])}
                    onChange={(event) =>
                      setAutoLimits((prev) => ({
                        ...prev,
                        // 재시도는 0 이 "안 한다" 라서 아래를 열어 둔다.
                        [key]:
                          key === 'retries'
                            ? Math.max(0, Number(event.target.value) || 0)
                            : Math.max(1, Number(event.target.value) || 1),
                      }))
                    }
                    disabled={autoRunning}
                    inputMode="numeric"
                    className="w-16 rounded border border-neutral-300 bg-transparent px-2 py-1 dark:border-neutral-700"
                  />
                </label>
              ))}

              {autoRunning ? (
                <button
                  onClick={() => {
                    stopFlag.current = true;
                  }}
                  className="rounded bg-red-600 px-4 py-2 text-white"
                >
                  중지
                </button>
              ) : (
                <>
                  <button
                    onClick={runAuto}
                    className="rounded bg-neutral-900 px-4 py-2 text-white dark:bg-white dark:text-neutral-900"
                  >
                    한 번
                  </button>
                  <button
                    onClick={repeatAuto}
                    className="rounded border border-neutral-400 px-4 py-2 dark:border-neutral-600"
                    title={`${(autoAll ? profiles.length : 1) * Math.max(1, autoRepeat)}회 돌립니다`}
                  >
                    반복 {(autoAll ? profiles.length : 1) * Math.max(1, autoRepeat)}회
                  </button>
                  <label className="flex items-center gap-2">
                    <span className="shrink-0 text-neutral-500">회차</span>
                    <input
                      value={String(autoRepeat)}
                      onChange={(event) =>
                        setAutoRepeat(Math.max(1, Number(event.target.value) || 1))
                      }
                      inputMode="numeric"
                      className="w-14 rounded border border-neutral-300 bg-transparent px-2 py-1 dark:border-neutral-700"
                    />
                  </label>
                  <Toggle checked={autoAll} onChange={setAutoAll} label="학생 전부" />
                  <Toggle
                    checked={autoFresh}
                    onChange={setAutoFresh}
                    label="대화 비우고 시작"
                  />
                </>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-1">
                <span className="mr-1 text-neutral-500">학생</span>
                {profiles.map((profile, index) => (
                  <button
                    key={index}
                    onClick={() => setActiveProfile(index)}
                    className={`rounded border px-2 py-1 ${
                      activeProfile === index
                        ? 'border-neutral-400 font-bold dark:border-neutral-500'
                        : 'border-neutral-200 text-neutral-500 dark:border-neutral-800'
                    }`}
                  >
                    {profile.name || '(이름 없음)'}
                  </button>
                ))}
                <button
                  onClick={() =>
                    setProfiles((prev) => [
                      ...prev,
                      { name: `학생 ${prev.length + 1}`, prompt: prev[0]?.prompt ?? '' },
                    ])
                  }
                  disabled={autoRunning}
                  className="rounded border border-dashed border-neutral-400 px-2 py-1 text-neutral-500 dark:border-neutral-600"
                >
                  +
                </button>
                {profiles.length > 1 && (
                  <button
                    onClick={() => {
                      setProfiles((prev) => prev.filter((_, i) => i !== activeProfile));
                      setActiveProfile(0);
                    }}
                    disabled={autoRunning}
                    className="px-2 text-neutral-400 hover:text-red-600"
                    title="이 학생 삭제"
                  >
                    ×
                  </button>
                )}
              </div>

              <label className="flex items-center gap-2">
                <span className="shrink-0 text-neutral-500">이름</span>
                <input
                  value={profiles[activeProfile]?.name ?? ''}
                  onChange={(event) =>
                    setProfiles((prev) =>
                      prev.map((item, i) =>
                        i === activeProfile ? { ...item, name: event.target.value } : item,
                      ),
                    )
                  }
                  disabled={autoRunning}
                  className="w-40 rounded border border-neutral-300 bg-transparent px-2 py-1 dark:border-neutral-700"
                />
                <span className="text-[11px] text-neutral-500">
                  공통 설정의 모델을 씁니다 · 평문으로 주고받습니다
                </span>
              </label>

              <textarea
                value={profiles[activeProfile]?.prompt ?? ''}
                onChange={(event) =>
                  setProfiles((prev) =>
                    prev.map((item, i) =>
                      i === activeProfile ? { ...item, prompt: event.target.value } : item,
                    ),
                  )
                }
                disabled={autoRunning}
                spellCheck={false}
                className="h-40 w-full resize-y rounded border border-neutral-300 bg-transparent p-2 outline-none dark:border-neutral-700"
              />
            </div>

            {autoAt !== null && (
              <p className="text-neutral-500">돌아가는 중… {autoAt}</p>
            )}

            {rate !== null && (
              <div className="flex flex-col gap-2 border-t border-neutral-200 pt-2 dark:border-neutral-800">
                <p>
                  <b>{rate.runs}회</b> · 위반 없이 끝난 회차{' '}
                  <b
                    className={
                      rate.clean === rate.runs
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-red-600 dark:text-red-400'
                    }
                  >
                    {rate.clean} / {rate.runs}
                  </b>{' '}
                  · 걸음 평균 {rate.avgSteps} · 학생 발화 평균 {rate.avgStudents}
                </p>

                {rate.rules.map(({ rule, trials: hit, total }) => (
                  <div key={rule.id} className="flex flex-wrap items-baseline gap-x-2">
                    <span className="w-16 shrink-0 tabular-nums">
                      <b
                        className={
                          hit === 0
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : rule.level === 'fail'
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-amber-700 dark:text-amber-500'
                        }
                      >
                        {hit} / {rate.runs}
                      </b>
                    </span>
                    <span className={hit === 0 ? 'text-neutral-400' : ''}>
                      {hit === 0 ? '○' : rule.level === 'fail' ? '✕' : '△'} {rule.label}
                    </span>
                    <span className="text-[11px] text-neutral-500">
                      {rule.source}
                      {total > 0 && ` · 총 ${total}건`}
                    </span>
                  </div>
                ))}

                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
                  <span className="text-neutral-500">지나간 단계</span>
                  {rate.coverage.map((row) => (
                    <span
                      key={row.stage}
                      className={
                        row.trials === 0
                          ? 'text-amber-700 dark:text-amber-500'
                          : 'text-neutral-500'
                      }
                    >
                      {row.trials === 0 && '△ '}
                      {row.stage} {row.trials}/{rate.runs}
                    </span>
                  ))}
                </div>

                {rate.coverage.some((row) => row.trials === 0) && (
                  <p className="text-[11px] text-amber-700 dark:text-amber-500">
                    한 번도 안 지난 단계가 있습니다. 통과율이 멀쩡해도 그 단계는
                    한 줄도 확인 못 한 것입니다 — 분기를 보거나 시작 단계를
                    바꿔서 돌려 보세요.
                  </p>
                )}

                <p className="text-[11px] text-neutral-500">
                  멈춘 이유 ·{' '}
                  {rate.reasons
                    .map((row) => `${STOP_TEXT[row.reason as StopReason]} ${row.count}`)
                    .join(' / ')}
                </p>

                <details className="text-[11px]">
                  <summary className="cursor-pointer text-neutral-500">
                    회차별로 보기
                  </summary>
                  <div className="flex flex-col gap-0.5 pt-1">
                    {trials.map((trial) => (
                      <div key={trial.n} className="flex gap-2">
                        <span className="w-6 shrink-0 text-right text-neutral-400">
                          {trial.n}
                        </span>
                        <span className="w-28 shrink-0 text-neutral-500">
                          {trial.profile}
                        </span>
                        <span
                          className={
                            trial.findings.length === 0
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-red-600 dark:text-red-400'
                          }
                        >
                          {trial.findings.length === 0
                            ? '통과'
                            : `${trial.findings.length}건`}
                        </span>
                        <span className="text-neutral-500">
                          걸음 {trial.steps} · 학생 {trial.students} ·{' '}
                          {STOP_TEXT[trial.reason as StopReason]}
                        </span>
                      </div>
                    ))}
                  </div>
                </details>

                <p className="text-[11px] text-neutral-500">
                  아래 걸음 기록은 <b>마지막 회차</b>의 것입니다. 통과율만 보면
                  무슨 말이 오갔는지 알 수 없습니다.
                </p>
              </div>
            )}

            {(autoLog.length > 0 || autoStop !== null) && (
              <div className="flex flex-col gap-1 border-t border-neutral-200 pt-2 dark:border-neutral-800">
                {autoLog.map((step) => (
                  <div key={step.n} className="flex gap-2 border-b border-dashed border-neutral-200 py-1 last:border-0 dark:border-neutral-800">
                    <span className="w-6 shrink-0 text-right text-[11px] text-neutral-400">
                      {step.n}
                    </span>
                    <span
                      className={`w-24 shrink-0 text-[11px] ${
                        stageColor(step.stage).text
                      }`}
                    >
                      {stages[step.stage]?.name ?? '?'}
                    </span>
                    <span className="w-12 shrink-0 text-[11px] text-neutral-500">
                      {LOG_LABEL[step.kind]}
                    </span>
                    <span
                      className={`min-w-0 flex-1 whitespace-pre-wrap ${
                        step.kind === 'error' ? 'text-red-600 dark:text-red-400' : ''
                      }`}
                    >
                      {step.text}
                      {step.note !== undefined && (
                        <span className="text-[11px] text-neutral-500"> · {step.note}</span>
                      )}
                    </span>
                  </div>
                ))}

                {autoStop !== null && (
                  <p
                    className={`pt-1 text-[11px] ${
                      autoStop === 'finished'
                        ? 'text-neutral-500'
                        : 'text-amber-700 dark:text-amber-500'
                    }`}
                  >
                    {STOP_TEXT[autoStop]} 각 단계를 열면 마지막 입력과 결과가
                    그대로 남아 있습니다.
                  </p>
                )}

                {audit !== null && (
                  <div className="flex flex-col gap-2 border-t border-neutral-200 pt-2 dark:border-neutral-800">
                    <p className="text-neutral-500">
                      걸음 {audit.steps} · 학생 발화 {audit.students} · 단계 이동{' '}
                      {audit.moves} ·{' '}
                      {byRule.length === 0 ? (
                        <b className="text-emerald-700 dark:text-emerald-400">
                          점검 통과
                        </b>
                      ) : (
                        <b className="text-red-600 dark:text-red-400">
                          {audit.findings.length}건
                        </b>
                      )}
                    </p>

                    {byRule.map(({ rule, hits }) => (
                      <div key={rule.id} className="flex flex-wrap items-baseline gap-x-2">
                        <span
                          className={`shrink-0 ${
                            rule.level === 'fail'
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-amber-700 dark:text-amber-500'
                          }`}
                        >
                          {rule.level === 'fail' ? '✕' : '△'} {rule.label}
                        </span>
                        <span className="text-[11px] text-neutral-500">
                          {rule.source} · {hits.length}건 ·{' '}
                          {hits
                            .slice(0, 4)
                            .map((found) => `${found.step}걸음 ${found.detail}`)
                            .join(' / ')}
                          {hits.length > 4 && ` 외 ${hits.length - 4}건`}
                        </span>
                      </div>
                    ))}

                    <p className="text-[11px] text-neutral-500">
                      <b>✕</b> 는 문서가 금지한 것, <b>△</b> 는 확인해 볼 것입니다.
                      전부 코드로 판정합니다 — 모델에게 채점시키지 않습니다.
                      되묻기가 좋았는지 같은 <b>품질</b>은 여기서 못 봅니다.
                      로그를 읽으세요.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </Panel>
      )}

      {panel === 'export' && (
        <Panel
          title="내보내기"
          hint={`코드로 옮길 자료 · 케이스 ${cases.length}개`}
          onCopy={() => navigator.clipboard.writeText(exportText)}
          onClose={() => setPanel('none')}
        >
          <div className="flex flex-col gap-2 p-3">
            <div className="flex flex-wrap items-center gap-1">
              {(
                [
                  ['stages', '파이프라인 설정', 'stages.ts'],
                  ['cases', '골든 케이스', `${cases.length}개`],
                  ['rules', '검증 규칙', 'stage-rules.ts'],
                  ['spec', '실행 명세', '빈칸 있음'],
                  ['history', '프롬프트 이력', `${history.length}건`],
                ] as const
              ).map(([id, label, tag]) => (
                <button
                  key={id}
                  onClick={() => setExportKind(id)}
                  className={`flex items-center gap-1.5 rounded border px-2 py-1 ${
                    exportKind === id
                      ? 'border-neutral-900 font-bold dark:border-neutral-100'
                      : 'border-neutral-300 text-neutral-500 dark:border-neutral-700'
                  }`}
                >
                  {label}
                  <span className="text-[10px] text-neutral-500">{tag}</span>
                </button>
              ))}
              <button
                onClick={downloadExport}
                className="ml-auto rounded border border-neutral-400 px-2 py-1 dark:border-neutral-600"
              >
                {exportFile} 내려받기
              </button>
            </div>

            <p className="text-[11px] text-neutral-500">
              {exportKind === 'stages' &&
                '프롬프트 · 모델 · 파라미터 · 입출력 형식을 한 번에. lib/ai/prompts/stages.ts 를 갈아끼울 수 있습니다.'}
              {exportKind === 'cases' &&
                '회귀 테스트의 재료입니다. 출력 문자열을 비교하지 마세요 — LLM 은 같은 입력에도 매번 다르게 답합니다. 검증 규칙을 통과하는지로 봅니다.'}
              {exportKind === 'rules' &&
                '규칙 데이터만 뽑습니다. 검사 로직은 checkFieldRules 를 그대로 쓰면 됩니다. 두 벌 만들 이유가 없습니다.'}
              {exportKind === 'spec' &&
                '빈칸이 있습니다. 화면에서 [입력으로] 를 손으로 누르며 내리던 판단이라 도구가 채울 수 없습니다. 이게 안 채워지면 코드를 쓸 때 지어내게 됩니다.'}
              {exportKind === 'history' &&
                'Excel 이 바로 여는 CSV 입니다. 한 줄에 날짜 · 단계 · 변경 이유 · 수정 전 · 수정 후가 들어갑니다. 아래 [파일로 내려받기] 를 쓰세요 — 화면에서 복사하면 줄바꿈이 든 칸이 깨집니다.'}
            </p>

            {exportKind === 'history' && (
              <div className="flex flex-col gap-1 border-y border-neutral-200 py-2 dark:border-neutral-800">
                {history.length === 0 && (
                  <p className="text-[11px] text-neutral-500">
                    아직 없습니다. 프롬프트를 고친 뒤 <b>프롬프트</b> 패널 위의{' '}
                    <b>[변경 기록]</b> 을 누르고 이유를 한 줄 적으세요.
                  </p>
                )}
                {[...history]
                  .map((item, index) => ({ item, index }))
                  .reverse()
                  .map(({ item, index }) => {
                    const change = lineChange(item.before, item.after);
                    return (
                      <details key={index} className="text-[11px]">
                        <summary className="flex cursor-pointer flex-wrap items-baseline gap-2">
                          <span className="text-neutral-400">{index + 1}</span>
                          <span className="w-32 shrink-0 truncate text-neutral-500">
                            {item.stage}
                          </span>
                          <span className="min-w-0 flex-1 truncate">
                            {item.reason || '(이유 없음)'}
                          </span>
                          <span className="shrink-0 text-neutral-500">
                            −{change.removed} +{change.added}
                          </span>
                          <span className="shrink-0 text-neutral-500">
                            {when(item.at)}
                          </span>
                          <button
                            onClick={(event) => {
                              event.preventDefault();
                              setHistory((prev) => prev.filter((_, i) => i !== index));
                            }}
                            className="px-1 text-neutral-400 hover:text-red-600"
                            title="이 기록 삭제"
                          >
                            ×
                          </button>
                        </summary>
                        <div className="grid gap-2 pt-1 md:grid-cols-2">
                          {(
                            [
                              ['수정 전', item.before],
                              ['수정 후', item.after],
                            ] as const
                          ).map(([label, text]) => (
                            <div key={label} className="flex min-w-0 flex-col gap-1">
                              <span className="text-neutral-500">{label}</span>
                              <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded border border-neutral-200 p-2 dark:border-neutral-800">
                                {text || '(비어 있음)'}
                              </pre>
                            </div>
                          ))}
                        </div>
                      </details>
                    );
                  })}
              </div>
            )}

            {exportKind === 'cases' && cases.length > 0 && (
              <div className="flex flex-col gap-1 border-y border-neutral-200 py-2 dark:border-neutral-800">
                {cases.map((item, index) => (
                  <div key={index} className="flex items-center gap-2 text-[11px]">
                    <span className="w-32 shrink-0 truncate text-neutral-500">
                      {item.stage}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {item.note || '(설명 없음)'}
                    </span>
                    <span className="shrink-0 text-neutral-500">
                      {item.at.slice(5, 16).replace('T', ' ')}
                    </span>
                    <button
                      onClick={() =>
                        setCases((prev) => prev.filter((_, i) => i !== index))
                      }
                      className="px-1 text-neutral-400 hover:text-red-600"
                      title="이 케이스 삭제"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {exportKind === 'cases' && cases.length === 0 && (
              <p className="text-[11px] text-neutral-500">
                아직 없습니다. 좋은 결과가 나왔을 때 답변 옆{' '}
                <b>[케이스로 저장]</b>을 누르세요.
              </p>
            )}

            <textarea
              value={exportText}
              readOnly
              spellCheck={false}
              className="h-72 w-full resize-y rounded border border-neutral-200 bg-transparent p-3 font-mono text-[11px] dark:border-neutral-800"
            />
          </div>
        </Panel>
      )}

      {panel === 'prompt' && (
        <Panel
          title="공통 프롬프트"
          hint={`포함을 켠 단계의 프롬프트 앞에 붙습니다 · 지금 ${
            stages.filter((stage) => stage.useCommonPrompt).length
          } / ${stages.length} 단계`}
          onCopy={() => navigator.clipboard.writeText(commonPrompt)}
          onClose={() => setPanel('none')}
        >
          <textarea
            value={commonPrompt}
            onChange={(event) => setCommonPrompt(event.target.value)}
            spellCheck={false}
            className="h-72 w-full resize-y bg-transparent p-3 outline-none"
          />
        </Panel>
      )}

      {panel === 'price' && (
        <Panel
          title="모델 가격표"
          hint="100만 토큰당 USD. 각 사 요금 페이지에서 확인해 넣으세요"
          onClose={() => setPanel('none')}
        >
          <div className="p-3">
            <p className="mb-3 text-[11px] text-neutral-500">
              가격은 코드에 박아두지 않았습니다. 바뀌면 여기서 고치세요.
              고친 값은 설정과 함께 저장됩니다. 가격이 없는 모델은 비용을
              계산하지 않고 &ldquo;가격 미입력&rdquo;이라고만 표시합니다.
              <br />
              <b>기본값은 텍스트 단가입니다.</b> 오디오 입력이 더 비싼 모델,
              200k 토큰을 넘으면 단가가 오르는 모델(gemini-2.5-pro ·
              gemini-3.1-pro-preview)이 있습니다. 그런 경우 실제보다 적게
              나오니 직접 고쳐 쓰세요. Batch·Flex 는 50% 할인입니다.
              <br />
              요금 페이지 — Gemini {PRICING_PAGES.gemini} · OpenAI{' '}
              {PRICING_PAGES.openai} · Claude {PRICING_PAGES.anthropic}
            </p>

            <div className="mb-3 flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-neutral-500">모델명</span>
                <input
                  value={priceDraft.model}
                  onChange={(event) =>
                    setPriceDraft({ ...priceDraft, model: event.target.value })
                  }
                  placeholder={activeModel || 'gemini-3.6-flash'}
                  className="w-56 rounded border border-neutral-300 bg-transparent px-2 py-1 dark:border-neutral-700"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-neutral-500">입력 $/1M</span>
                <input
                  value={priceDraft.input}
                  onChange={(event) =>
                    setPriceDraft({ ...priceDraft, input: event.target.value })
                  }
                  inputMode="decimal"
                  className="w-24 rounded border border-neutral-300 bg-transparent px-2 py-1 dark:border-neutral-700"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-neutral-500">출력 $/1M</span>
                <input
                  value={priceDraft.output}
                  onChange={(event) =>
                    setPriceDraft({ ...priceDraft, output: event.target.value })
                  }
                  inputMode="decimal"
                  className="w-24 rounded border border-neutral-300 bg-transparent px-2 py-1 dark:border-neutral-700"
                />
              </label>
              <button
                onClick={() => {
                  const name = priceDraft.model.trim();
                  const input = Number(priceDraft.input);
                  const output = Number(priceDraft.output);
                  if (name === '') return;
                  if (!Number.isFinite(input) || !Number.isFinite(output)) {
                    window.alert('가격은 숫자로 넣어 주세요.');
                    return;
                  }
                  setPrices((prev) => ({ ...prev, [name]: { input, output } }));
                  setPriceDraft({ model: '', input: '', output: '' });
                }}
                className="rounded border border-neutral-400 px-3 py-1 dark:border-neutral-600"
              >
                추가 · 수정
              </button>

              <label className="ml-auto flex flex-col gap-1">
                <span className="text-[11px] text-neutral-500">환율 USD→KRW</span>
                <input
                  value={krwRate}
                  onChange={(event) => setKrwRate(event.target.value)}
                  inputMode="decimal"
                  placeholder="0이면 원화 표시 안 함"
                  className="w-36 rounded border border-neutral-300 bg-transparent px-2 py-1 dark:border-neutral-700"
                />
              </label>
            </div>

            <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {Object.entries(prices).length === 0 && (
                <li className="py-2 text-neutral-500">등록된 가격이 없습니다.</li>
              )}
              {Object.entries(prices)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([name, price]) => (
                  <li key={name} className="flex items-center gap-3 py-1.5">
                    <span className="flex-1">{name}</span>
                    <span className="text-neutral-500">
                      in ${price.input} / out ${price.output}
                    </span>
                    <button
                      onClick={() =>
                        setPriceDraft({
                          model: name,
                          input: String(price.input),
                          output: String(price.output),
                        })
                      }
                      className="text-neutral-500 hover:underline"
                    >
                      수정
                    </button>
                    <button
                      onClick={() =>
                        setPrices((prev) => {
                          const next = { ...prev };
                          delete next[name];
                          return next;
                        })
                      }
                      className="text-red-600 hover:underline dark:text-red-400"
                    >
                      삭제
                    </button>
                  </li>
                ))}
            </ul>
          </div>
        </Panel>
      )}


      <nav className="flex flex-wrap items-center gap-2">
        {stages.map((stage, index) => (
          <button
            key={stage.key}
            onClick={() => setActiveIndex(index)}
            className={`flex items-center gap-2 rounded border px-3 py-1.5 ${
              index === activeIndex
                ? 'border-neutral-900 dark:border-neutral-100'
                : 'border-neutral-300 dark:border-neutral-700'
            }`}
          >
            <span className={`h-4 w-1 shrink-0 rounded ${stageColor(index).bar}`} />
            <StatusDot result={stage.threads[stage.activeThread]?.result ?? null} />
            <span className={index === activeIndex ? stageColor(index).text : undefined}>
              {stage.name || '(이름 없음)'}
            </span>
            <span className="text-[10px] text-neutral-500">
              {PROVIDERS.find((entry) => entry.id === stage.provider)?.label}
            </span>
            {stage.inputMode === 'text' && (
              <span className="rounded bg-neutral-200 px-1 text-[10px] text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200">
                평문
              </span>
            )}
          </button>
        ))}
        <button
          onClick={addStage}
          className="rounded border border-dashed border-neutral-400 px-3 py-1.5 text-neutral-500 dark:border-neutral-600"
        >
          + 단계 추가
        </button>
      </nav>

      {active && thread && (
        <div className="flex flex-col gap-4">
          {/* 설정은 위에 모아 두고 접는다. 한 번 맞추면 계속 볼 이유가 없고,
              접어야 대화와 결과가 화면에 들어온다. 넓게 쓸 수 있어서
              검증 규칙 표도 여기가 낫다. */}
          <section className="flex flex-col gap-3">
            {drift !== null && (
              <div className="flex flex-col gap-2 rounded border border-amber-400 p-3 dark:border-amber-600">
                <p>
                  <b className="text-amber-700 dark:text-amber-500">
                    프리셋과 다른 곳이 {drift.diffs.length}군데 있습니다.
                  </b>{' '}
                  <span className="text-[11px] text-neutral-500">
                    직접 고치신 것일 수도, 저장본이 프리셋보다 오래된 것일 수도
                    있습니다. 받아오면 <b>그 묶음만</b> 프리셋 값으로 바뀝니다.
                  </span>
                </p>

                <div className="flex flex-wrap items-center gap-2">
                  {drift.diffs.map(({ group, fields }) => (
                    <button
                      key={group.id}
                      onClick={() => {
                        if (active === undefined) return;
                        patch(
                          activeIndex,
                          pull(
                            { ...pickComparable(active), routing: active.routing },
                            drift.base,
                            [group.id],
                          ),
                        );
                      }}
                      className="rounded border border-amber-400 px-2 py-1 dark:border-amber-600"
                      title={`받아올 칸: ${fields.join(' · ')}`}
                    >
                      {group.label} 받아오기
                      {fields.length > 1 && (
                        <span className="ml-1 text-[11px] text-neutral-500">
                          {fields.length}칸
                        </span>
                      )}
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      if (active === undefined) return;
                      if (
                        !window.confirm(
                          '프리셋과 다른 곳을 모두 프리셋 값으로 바꿉니다.\n' +
                            '고쳐 두신 프롬프트도 함께 바뀝니다.\n\n계속할까요?',
                        )
                      ) {
                        return;
                      }
                      patch(
                        activeIndex,
                        pull(
                          { ...pickComparable(active), routing: active.routing },
                          drift.base,
                          drift.diffs.map(({ group }) => group.id),
                        ),
                      );
                    }}
                    className="rounded border border-dashed border-neutral-400 px-2 py-1 text-neutral-500 dark:border-neutral-600"
                  >
                    전부 받아오기
                  </button>
                </div>

                <p className="text-[11px] text-neutral-500">
                  프롬프트를 받아오기 전에 <b>[변경 기록]</b> 으로 지금 것을 남겨
                  두면 무엇이 어떻게 바뀌었는지 나중에 볼 수 있습니다.
                </p>
              </div>
            )}

            <Panel
              title="단계 설정"
              accent={accent}
              open={openPanel.setting}
              onToggle={() => togglePanel('setting')}
              hint={`${eff.provider} · ${eff.model.trim() || DEFAULT_MODEL[eff.provider]} · ${
                active.ownSettings ? '별도' : '공통'
              }`}
            >
              {/* 탭에 개수를 붙인다. 접힌 제목줄만 보고도 상태를 알 수
                  있던 정보를 합치면서 잃으면 안 된다. */}
              <div className="flex flex-wrap items-center gap-1 border-b border-neutral-200 px-3 pt-2 dark:border-neutral-800">
                {(
                  [
                    ['model', '모델 · 형식', ''],
                    [
                      'chat',
                      '대화 모양',
                      active.latestKey.trim() !== '' || active.resetKey.trim() !== ''
                        ? '고급'
                        : '',
                    ],
                    [
                      'rules',
                      '검증 규칙',
                      active.rules.fields.length > 0 || active.rules.banned.trim() !== ''
                        ? String(active.rules.fields.length)
                        : '',
                    ],
                    [
                      'mapping',
                      '다음 단계',
                      active.mapping.length > 0 ? String(active.mapping.length) : '',
                    ],
                    [
                      'routing',
                      '분기',
                      hasRouting(active.routing) ? String(active.routing.rows.length) : '',
                    ],
                  ] as const
                ).map(([id, label, count]) => (
                  <button
                    key={id}
                    onClick={() => setSettingTab(id)}
                    className={`flex items-center gap-1.5 rounded-t border border-b-0 px-3 py-1.5 ${
                      settingTab === id
                        ? 'border-neutral-300 bg-white font-bold dark:border-neutral-700 dark:bg-neutral-900'
                        : 'border-transparent text-neutral-500'
                    }`}
                  >
                    {label}
                    {count !== '' && (
                      <span className="rounded bg-neutral-200 px-1 text-[10px] text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200">
                        {count}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* 한 줄에 들어갈 것은 한 줄에 둔다. 항목마다 줄을 나누면
                  설정만으로 화면이 다 찬다. 성격이 같은 것끼리 묶었다. */}
              <div hidden={settingTab !== 'model'} className="flex flex-col gap-2 p-3">
                {/* 상속을 숨기지 않는다. 공통을 따르는지 직접 정했는지가
                    스위치 하나로 보이고, 꺼져 있어도 실제 값은 회색으로
                    그대로 보여준다. 빈칸이면 뭘 쓰는지 다시 모르게 된다. */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <Toggle
                    checked={active.ownSettings}
                    onChange={(next) => {
                      // 공통 → 별도로 켤 때 지금 쓰던 값을 그대로 물려준다.
                      // 켜자마자 값이 바뀌면 놀란다.
                      patch(
                        activeIndex,
                        next ? { ownSettings: true, ...eff } : { ownSettings: false },
                      );
                    }}
                    label="이 단계는 따로 설정"
                  />
                  {active.ownSettings ? (
                    <button
                      type="button"
                      onClick={() => patch(activeIndex, { ownSettings: false })}
                      className="text-[11px] text-neutral-500 hover:underline"
                    >
                      공통값으로 되돌리기
                    </button>
                  ) : (
                    <span className="text-[11px] text-neutral-500">
                      공통 설정을 따릅니다
                    </span>
                  )}
                </div>

                {/* 어디로 · 무엇으로 · 누구 키로 보낼지 */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-neutral-200 pt-2 dark:border-neutral-800">
                  <label className="flex items-center gap-2">
                    <span className="shrink-0 text-neutral-500">프로바이더</span>
                    <select
                      value={eff.provider}
                      onChange={(event) =>
                        patch(activeIndex, { provider: event.target.value as ProviderId })
                      }
                      disabled={!active.ownSettings}
                      className="rounded border border-neutral-300 bg-transparent px-2 py-1 disabled:text-neutral-400 dark:border-neutral-700"
                    >
                      {PROVIDERS.map((entry) => (
                        <option key={entry.id} value={entry.id}>
                          {entry.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex min-w-[15rem] flex-1 items-center gap-2">
                    <span className="shrink-0 text-neutral-500">모델</span>
                    <input
                      value={eff.model}
                      onChange={(event) => patch(activeIndex, { model: event.target.value })}
                      placeholder={`직접 입력. 비우면 ${DEFAULT_MODEL[eff.provider]}`}
                      spellCheck={false}
                      autoComplete="off"
                      disabled={!active.ownSettings}
                      className="min-w-0 flex-1 rounded border border-neutral-300 bg-transparent px-2 py-1 disabled:text-neutral-400 dark:border-neutral-700"
                    />
                  </label>

                  <label className="flex items-center gap-2">
                    <span className="shrink-0 text-neutral-500">API 키</span>
                    <input
                      type="password"
                      value={active.apiKey}
                      onChange={(event) => patch(activeIndex, { apiKey: event.target.value })}
                      placeholder={`비우면 기본 ${providerLabel} 키`}
                      // 키는 공통 설정과 무관하다. 단계마다 다른 계정으로
                      // 돌리는 일이 있어서 항상 열어 둔다.
                      className="w-44 rounded border border-neutral-300 bg-transparent px-2 py-1 dark:border-neutral-700"
                    />
                    <span className="shrink-0 text-[11px] text-neutral-500">
                      사용: {keySource}
                    </span>
                  </label>

                </div>

                {/* 목록이 아니라 입력이 원칙이다. 아래는 자주 쓰는 이름을
                    한 번에 채워 넣는 단축키일 뿐이고, 여기 없는 이름도
                    그대로 입력해서 쓸 수 있다. */}
                <div
                  className="flex flex-wrap items-center gap-1.5"
                  hidden={!active.ownSettings}
                >
                  <button
                    type="button"
                    onClick={() => setShowModels((prev) => !prev)}
                    className="text-[11px] text-neutral-500 hover:underline"
                  >
                    {showModels ? '▾' : '▸'} 모델 후보 {modelCandidates.length}개
                  </button>
                  <button
                    type="button"
                    onClick={() => void loadModels()}
                    disabled={loadingModels}
                    className="rounded border border-neutral-400 px-1.5 py-0.5 text-[11px] disabled:opacity-40 dark:border-neutral-600"
                  >
                    {loadingModels ? '불러오는 중…' : '목록 불러오기'}
                  </button>
                  {liveModels[eff.provider] === undefined && (
                    <span className="text-[11px] text-neutral-500">
                      코드에 적힌 값이라 낡았을 수 있습니다
                    </span>
                  )}
                  {eff.model !== '' && (
                    <button
                      type="button"
                      onClick={() => patch(activeIndex, { model: '' })}
                      className="px-1.5 py-0.5 text-[11px] text-neutral-500 hover:underline"
                    >
                      모델 지우기
                    </button>
                  )}
                </div>

                {/* 불러오면 수십 개가 온다. 접을 수 있어야 하고, 길면
                    걸러서 봐야 한다. */}
                <div
                  className="flex flex-wrap items-center gap-1.5"
                  hidden={!active.ownSettings || !showModels}
                >
                  {modelCandidates.length > 12 && (
                    <input
                      value={modelFilter}
                      onChange={(event) => setModelFilter(event.target.value)}
                      placeholder="이름으로 거르기"
                      spellCheck={false}
                      className="w-36 rounded border border-neutral-300 bg-transparent px-2 py-0.5 text-[11px] dark:border-neutral-700"
                    />
                  )}
                  {shownModels.map((candidate) => (
                    <button
                      key={candidate}
                      type="button"
                      onClick={() => patch(activeIndex, { model: candidate })}
                      className={`rounded border px-1.5 py-0.5 text-[11px] ${
                        eff.model === candidate
                          ? 'border-neutral-900 dark:border-neutral-100'
                          : 'border-neutral-300 text-neutral-500 dark:border-neutral-700'
                      }`}
                    >
                      {candidate}
                    </button>
                  ))}
                  {shownModels.length === 0 && (
                    <span className="text-[11px] text-neutral-500">
                      {modelFilter.trim()} 에 맞는 모델이 없습니다
                    </span>
                  )}
                  {modelFilter.trim() !== '' && (
                    <button
                      type="button"
                      onClick={() => setModelFilter('')}
                      className="px-1.5 py-0.5 text-[11px] text-neutral-500 hover:underline"
                    >
                      거르기 지우기
                    </button>
                  )}
                </div>

                {/* 이 단계가 무엇인지. 순서 변경·삭제도 이름 옆에 둔다 */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-neutral-200 pt-2 dark:border-neutral-800">
                  <label className="flex min-w-[12rem] flex-1 items-center gap-2">
                    <span className="shrink-0 text-neutral-500">이름</span>
                    <input
                      value={active.name}
                      onChange={(event) => patch(activeIndex, { name: event.target.value })}
                      className="min-w-0 flex-1 rounded border border-neutral-300 bg-transparent px-2 py-1 dark:border-neutral-700"
                    />
                  </label>

                  <label className="flex min-w-[14rem] flex-[2] items-center gap-2">
                    <span className="shrink-0 text-neutral-500">설명</span>
                    <input
                      value={active.note}
                      onChange={(event) => patch(activeIndex, { note: event.target.value })}
                      className="min-w-0 flex-1 rounded border border-neutral-300 bg-transparent px-2 py-1 dark:border-neutral-700"
                    />
                  </label>

                  <span className="flex shrink-0 items-center gap-1">
                    <button onClick={() => moveStage(activeIndex, -1)} className="px-1 text-neutral-500">←</button>
                    <button onClick={() => moveStage(activeIndex, 1)} className="px-1 text-neutral-500">→</button>
                    <button
                      onClick={() => removeStage(activeIndex)}
                      disabled={stages.length === 1}
                      className="px-1 text-red-600 disabled:opacity-30 dark:text-red-400"
                    >
                      삭제
                    </button>
                  </span>
                </div>

                {/* 어떻게 생성하고 무엇으로 주고받을지 */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-neutral-200 pt-2 dark:border-neutral-800">
                  <ParamField
                    label="temperature"
                    value={eff.temperature}
                    onChange={(next) => patch(activeIndex, { temperature: next })}
                    disabled={!active.ownSettings}
                  />
                  <ParamField
                    label="max output"
                    value={eff.maxTokens}
                    onChange={(next) => patch(activeIndex, { maxTokens: next })}
                    placeholder={eff.provider === 'anthropic' ? '비우면 16000' : '미전송'}
                    disabled={!active.ownSettings}
                  />
                  <ParamField
                    label="top_p"
                    value={eff.topP}
                    onChange={(next) => patch(activeIndex, { topP: next })}
                    disabled={!active.ownSettings}
                  />

                  <label className="flex items-center gap-2">
                    <span className="shrink-0 text-neutral-500">입력</span>
                    <select
                      value={active.inputMode}
                      onChange={(event) =>
                        patch(activeIndex, { inputMode: event.target.value as OutputMode })
                      }
                      className="rounded border border-neutral-300 bg-transparent px-2 py-1 dark:border-neutral-700"
                    >
                      <option value="json">JSON</option>
                      <option value="text">평문</option>
                    </select>
                  </label>

                  <label className="flex items-center gap-2">
                    <span className="shrink-0 text-neutral-500">출력</span>
                    <select
                      value={active.outputMode}
                      onChange={(event) =>
                        patch(activeIndex, { outputMode: event.target.value as OutputMode })
                      }
                      className="rounded border border-neutral-300 bg-transparent px-2 py-1 dark:border-neutral-700"
                    >
                      <option value="json">JSON</option>
                      <option value="text">텍스트</option>
                    </select>
                  </label>

                  <label className="flex items-center gap-2">
                    {/* 이 목록은 AIPM 전용이다. 다른 프로젝트에서 쓸 검사는
                        아래 [검증 규칙] 패널에서 직접 만든다. */}
                    <span className="shrink-0 text-neutral-500">검증 프리셋</span>
                    <select
                      value={active.checkRule ?? ''}
                      onChange={(event) =>
                        patch(activeIndex, {
                          checkRule: (event.target.value || null) as CheckRuleId | null,
                        })
                      }
                      className="rounded border border-neutral-300 bg-transparent px-2 py-1 dark:border-neutral-700"
                    >
                      <option value="">없음 (형식만)</option>
                      {CHECK_RULES.map((rule) => (
                        <option key={rule.id} value={rule.id}>
                          {rule.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {/* 보낼 때 붙일 것과, 주고받은 것 중 어디를 볼지 */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-neutral-200 pt-2 dark:border-neutral-800">
                  {/* 토글은 여기 있는데 내용은 화면 맨 위에 있었다.
                      둘 사이가 멀어 연결이 안 보였다. 길이를 붙이고
                      바로 여는 링크를 둔다. */}
                  <span className="flex items-center gap-2">
                    <Toggle
                      checked={active.useCommonPrompt}
                      onChange={(next) => patch(activeIndex, { useCommonPrompt: next })}
                      label={`공통 프롬프트 포함 (${commonPrompt.length}자)`}
                    />
                    <button
                      type="button"
                      onClick={() => setPanel('prompt')}
                      className="text-[11px] text-neutral-500 hover:underline"
                    >
                      보기 · 편집
                    </button>
                  </span>
                  <Toggle
                    checked={active.forceJsonMimeType}
                    onChange={(next) => patch(activeIndex, { forceJsonMimeType: next })}
                    label="JSON 강제"
                  />
                  {active.inputMode === 'json' && (
                    <label className="flex items-center gap-2">
                      <span className="shrink-0 text-neutral-500">대화 배열 키</span>
                      <input
                        value={active.historyKey}
                        onChange={(event) =>
                          patch(activeIndex, { historyKey: event.target.value })
                        }
                        className="w-32 rounded border border-neutral-300 bg-transparent px-2 py-1 dark:border-neutral-700"
                      />
                    </label>
                  )}
                  {/* 출력이 평문이면 응답 필드를 아예 보지 않는다. 칸을
                      열어 두면 값을 넣게 만들고, 왜 안 먹는지 알 방법이
                      없다. 대화 배열 키를 숨기는 것과 같은 규칙이다. */}
                  <label className="flex items-center gap-2">
                    <span
                      className={`shrink-0 ${
                        replyKeyOff ? 'text-neutral-400' : 'text-neutral-500'
                      }`}
                    >
                      응답 필드
                    </span>
                    <input
                      value={active.replyKey}
                      onChange={(event) =>
                        patch(activeIndex, { replyKey: event.target.value })
                      }
                      disabled={replyKeyOff}
                      placeholder={
                        replyKeyOff ? '해당 없음' : '쉼표로 여러 개. 비우면 표시 안 함'
                      }
                      title={
                        replyKeyOff
                          ? '출력이 텍스트라 원문을 그대로 보여줍니다'
                          : undefined
                      }
                      className="w-32 rounded border border-neutral-300 bg-transparent px-2 py-1 disabled:bg-neutral-100 disabled:text-neutral-400 dark:border-neutral-700 dark:disabled:bg-neutral-800"
                    />
                  </label>
                  <label className="flex items-center gap-2">
                    <span
                      className={`shrink-0 ${
                        replyKeyOff ? 'text-neutral-400' : 'text-neutral-500'
                      }`}
                    >
                      기록 필드
                    </span>
                    <input
                      value={active.recordKey}
                      onChange={(event) =>
                        patch(activeIndex, { recordKey: event.target.value })
                      }
                      disabled={replyKeyOff}
                      placeholder={replyKeyOff ? '해당 없음' : '비우면 응답 필드와 같음'}
                      className="w-32 rounded border border-neutral-300 bg-transparent px-2 py-1 disabled:bg-neutral-100 disabled:text-neutral-400 dark:border-neutral-700 dark:disabled:bg-neutral-800"
                    />
                  </label>
                  <label className="flex items-center gap-2">
                    <span
                      className={`shrink-0 ${
                        replyKeyOff ? 'text-neutral-400' : 'text-neutral-500'
                      }`}
                    >
                      보기 필드
                    </span>
                    <input
                      value={active.choicesKey}
                      onChange={(event) =>
                        patch(activeIndex, { choicesKey: event.target.value })
                      }
                      disabled={replyKeyOff}
                      placeholder={replyKeyOff ? '해당 없음' : '예: ui.choices'}
                      className="w-32 rounded border border-neutral-300 bg-transparent px-2 py-1 disabled:bg-neutral-100 disabled:text-neutral-400 dark:border-neutral-700 dark:disabled:bg-neutral-800"
                    />
                  </label>
                  {replyKeyOff && (
                    <span className="text-[11px] text-neutral-500">
                      출력이 텍스트라 원문을 그대로 보여줍니다
                    </span>
                  )}
                </div>

                {/* 안내는 한 덩어리로 모은다. 컨트롤 사이사이에 끼우면
                    줄 수가 두 배가 된다. */}
                <div className="flex flex-col gap-1 border-t border-neutral-200 pt-2 text-[11px] text-neutral-500 dark:border-neutral-800">
                  <p>
                    <b>temperature · max output · top_p</b>는 비우면 아예 보내지
                    않습니다.
                    {eff.provider === 'anthropic' && (
                      <>
                        {' '}
                        Claude는 max output이 필수라 비우면 16000을 씁니다. 현재
                        모델(Opus 5 · Sonnet 5 · Opus 4.7/4.8 · Fable 5)은
                        temperature·top_p를 받으면 400입니다.
                      </>
                    )}
                    {eff.provider === 'openai' && (
                      <>
                        {' '}
                        추론 계열 모델은 temperature를 거부합니다. max output은{' '}
                        <code>max_completion_tokens</code>로 보냅니다.
                      </>
                    )}
                  </p>
                  <p>
                    <b>검증 프리셋</b>은 이 프로젝트(AIPM) 규격이 코드에 박힌
                    것입니다. 다른 프로젝트에서는 아래 <b>[검증 규칙]</b>에 직접
                    적어 쓰세요.
                  </p>
                  <p>
                    <b>응답 필드</b>는 출력 중 말풍선에 보여줄 부분입니다. 쉼표로
                    여러 개를 적으면 이어서 보여줍니다 —{' '}
                    <code>ui.problem_text, ui.message</code> 처럼 문제와 말풍선이
                    다른 필드에 나오는 경우에 씁니다.
                    {replyKeyOff
                      ? ' 출력이 JSON일 때만 씁니다. 지금은 출력이 텍스트라 원문이 그대로 나갑니다.'
                      : active.replyKey.trim() === ''
                        ? ' 지금은 비어 있어 아무것도 표시하지 않습니다. 데이터만 만드는 단계에 맞습니다.'
                        : ' 보여줄 문장이 없는 단계(평가·기억 저장 등)는 비워 두세요.'}
                  </p>
                  <p>
                    <b>기록 필드</b>는 그중 <b>대화 기록에 남길</b> 부분입니다.
                    화면에는 문제를 매 턴 다시 보여 줘야 하지만, 기록에까지 매 턴
                    넣으면 같은 문단이 열 번 쌓입니다. 모델은 문제를{' '}
                    <code>problem_state</code> 에서 읽으므로 기록에는 말풍선만
                    남기면 됩니다. 비우면 응답 필드와 같습니다.
                  </p>
                  <p>
                    <b>보기 필드</b>는 학생에게 <b>버튼으로 보여줄 선택지</b>가 담긴
                    자리입니다. v3.0 은 <code>ui.choices</code> 에 냅니다. 누르면 그
                    글이 학생의 말로 들어가고, 자동 실행의 학생 모델도 같은 보기를
                    받습니다. <code>{'{ label, value }'}</code> 목록도, 글자만 있는
                    목록도 읽습니다.
                  </p>
                </div>
              </div>

              {/* 프롬프트마다 대화를 담는 모양이 다르다. 도구가 한 모양으로
                  고정해 쓰면 모델이 학생의 말을 자기가 읽는 자리에서 못
                  찾는다. */}
              <div hidden={settingTab !== 'chat'} className="flex flex-col gap-2 p-3">
                <p className="text-[11px] text-neutral-500">
                  대화창에서 보낸 말이 <b>입력 JSON 의 어디에 어떤 모양으로</b>{' '}
                  들어갈지 정합니다. 프롬프트가 읽는 자리와 맞아야 모델이 학생의
                  말을 찾습니다.
                </p>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-neutral-200 pt-2 dark:border-neutral-800">
                  <label className="flex min-w-[20rem] flex-1 items-center gap-2">
                    <span className="shrink-0 text-neutral-500">대화 배열</span>
                    <input
                      value={active.historyKey}
                      onChange={(event) =>
                        patch(activeIndex, { historyKey: event.target.value })
                      }
                      spellCheck={false}
                      className="min-w-0 flex-1 rounded border border-neutral-300 bg-transparent px-2 py-1 dark:border-neutral-700"
                    />
                  </label>
                  <label className="flex min-w-[20rem] flex-1 items-center gap-2">
                    <span className="shrink-0 text-neutral-500">마지막 발화</span>
                    <input
                      value={active.latestKey}
                      onChange={(event) =>
                        patch(activeIndex, { latestKey: event.target.value })
                      }
                      placeholder="비우면 안 씁니다"
                      spellCheck={false}
                      className="min-w-0 flex-1 rounded border border-neutral-300 bg-transparent px-2 py-1 dark:border-neutral-700"
                    />
                  </label>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  {(
                    [
                      ['turnCountKey', '학생 발화 수', '비우면 안 씀'],
                      ['limitKey', '한도', '비우면 안 씀'],
                      ['remainingKey', '남은 횟수', '한도가 있어야 계산'],
                      ['resetKey', '문제 바뀜 기준', '비우면 안 씀'],
                    ] as const
                  ).map(([key, label, ph]) => (
                    <label key={key} className="flex min-w-[16rem] flex-1 items-center gap-2">
                      <span className="shrink-0 text-neutral-500">{label}</span>
                      <input
                        value={active[key]}
                        onChange={(event) =>
                          patch(activeIndex, { [key]: event.target.value })
                        }
                        placeholder={ph}
                        spellCheck={false}
                        className="min-w-0 flex-1 rounded border border-neutral-300 bg-transparent px-2 py-1 dark:border-neutral-700"
                      />
                    </label>
                  ))}
                </div>

                <div className="flex flex-col gap-2 border-t border-neutral-200 pt-2 dark:border-neutral-800">
                  {(
                    [
                      ['studentTurn', 'studentField', '학생 턴 모양', ''],
                      ['aiTurn', 'aiField', 'AI 턴 모양', '비우면 배열에 안 남깁니다'],
                    ] as const
                  ).map(([tKey, fKey, label, ph]) => (
                    <div key={tKey} className="flex flex-wrap items-start gap-2">
                      <span className="w-24 shrink-0 py-1.5 text-neutral-500">{label}</span>
                      <textarea
                        value={active[tKey]}
                        onChange={(event) =>
                          patch(activeIndex, { [tKey]: event.target.value })
                        }
                        placeholder={ph}
                        rows={2}
                        spellCheck={false}
                        className="min-w-[20rem] flex-1 resize-y rounded border border-neutral-300 bg-transparent px-2 py-1 font-mono text-[11px] dark:border-neutral-700"
                      />
                      <label className="flex items-center gap-2">
                        <span className="shrink-0 text-neutral-500">말이 들어갈 자리</span>
                        <input
                          value={active[fKey]}
                          onChange={(event) =>
                            patch(activeIndex, { [fKey]: event.target.value })
                          }
                          spellCheck={false}
                          className="w-32 rounded border border-neutral-300 bg-transparent px-2 py-1 dark:border-neutral-700"
                        />
                      </label>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-1 border-t border-neutral-200 pt-2 text-[11px] text-neutral-500 dark:border-neutral-800">
                  <p>
                    <b>마지막 발화</b>는 배열에 쌓는 것과 별개로, 직전 학생 발화를
                    한 곳에 더 두는 자리입니다. 프롬프트가{' '}
                    <code>latest_response</code> 같은 필드를 읽을 때 씁니다.
                  </p>
                  <p>
                    <b>남은 횟수</b>는 <b>한도 − 학생 발화 수</b>로 도구가
                    계산합니다. 모델에게 숫자를 비교시키지 않으려고 두는 값이라
                    도구가 채우는 게 맞습니다.
                  </p>
                  <p>
                    <b>문제 바뀜 기준</b>은 새 문제가 시작된 것을 알아보는
                    자리입니다. 결과의 이 값이 입력과 달라지면 대화 기록과
                    횟수를 <b>0부터 다시</b> 시작합니다 — COM-001 §7의 5회는
                    한 문제 기준이기 때문입니다. 화면의 말풍선은 따로 쌓이므로
                    지워지지 않습니다.
                  </p>
                  <p>
                    <b>AI 턴 모양</b>을 비우면 AI 응답을 대화 배열에 남기지
                    않습니다. 학생 응답만 기록하는 프롬프트에 맞춥니다. 대신
                    대화창에도 AI 말풍선이 쌓이지 않습니다.
                  </p>
                </div>
              </div>

              <div hidden={settingTab !== 'rules'} className="flex flex-col gap-2 p-3">
                <p className="text-[11px] text-neutral-500">
                  실행할 때마다 아래 규칙을 봅니다. 필드가 빠졌는지, 값이
                  범위를 벗어났는지, 정해진 값 말고 다른 걸 냈는지 잡습니다.
                  경로는 <code>evaluation.score</code> 처럼 적고, 목록 전체를
                  보려면 <code>logic_gaps[].gap_type</code> 처럼 적습니다.
                </p>

                {active.rules.fields.length > 0 && (
                  <div className="hidden gap-1 text-[11px] text-neutral-500 md:flex">
                    <span className="w-40">필드 경로</span>
                    <span className="w-20">종류</span>
                    <span className="w-24">필수 / null</span>
                    <span className="w-36">허용값 (쉼표)</span>
                    <span className="w-28">최소 / 최대</span>
                  </div>
                )}

                {active.rules.fields.map((rule, index) => (
                  <div
                    key={index}
                    className="flex flex-wrap items-center gap-1 border-b border-dashed border-neutral-200 pb-2 dark:border-neutral-800 md:border-0 md:pb-0"
                  >
                    <input
                      value={rule.path}
                      onChange={(event) => setFieldRule(index, { path: event.target.value })}
                      placeholder="필드 경로"
                      spellCheck={false}
                      className="w-40 rounded border border-neutral-300 bg-transparent px-2 py-1 dark:border-neutral-700"
                    />
                    <select
                      value={rule.type}
                      onChange={(event) =>
                        setFieldRule(index, { type: event.target.value as FieldType })
                      }
                      className="w-20 rounded border border-neutral-300 bg-transparent px-1 py-1 dark:border-neutral-700"
                    >
                      {FIELD_TYPES.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                    <span className="flex w-24 items-center gap-2">
                      <label className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={rule.required}
                          onChange={(event) =>
                            setFieldRule(index, { required: event.target.checked })
                          }
                        />
                        필수
                      </label>
                      <label className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={rule.nullable}
                          onChange={(event) =>
                            setFieldRule(index, { nullable: event.target.checked })
                          }
                        />
                        null
                      </label>
                    </span>
                    <input
                      value={rule.allowed}
                      onChange={(event) => setFieldRule(index, { allowed: event.target.value })}
                      placeholder="비우면 안 봄"
                      spellCheck={false}
                      className="w-36 rounded border border-neutral-300 bg-transparent px-2 py-1 dark:border-neutral-700"
                    />
                    <input
                      value={rule.min}
                      onChange={(event) => setFieldRule(index, { min: event.target.value })}
                      placeholder="최소"
                      className="w-14 rounded border border-neutral-300 bg-transparent px-2 py-1 dark:border-neutral-700"
                    />
                    <input
                      value={rule.max}
                      onChange={(event) => setFieldRule(index, { max: event.target.value })}
                      placeholder="최대"
                      className="w-14 rounded border border-neutral-300 bg-transparent px-2 py-1 dark:border-neutral-700"
                    />
                    <button
                      onClick={() => removeFieldRule(index)}
                      className="px-2 text-neutral-400 hover:text-red-600"
                      title="이 줄 삭제"
                    >
                      ×
                    </button>
                  </div>
                ))}

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={addFieldRule}
                    className="rounded border border-dashed border-neutral-400 px-2 py-1 text-neutral-500 dark:border-neutral-600"
                  >
                    + 규칙
                  </button>
                  <label className="flex flex-1 items-center gap-2">
                    <span className="text-neutral-500">금지어</span>
                    <input
                      value={active.rules.banned}
                      onChange={(event) =>
                        patch(activeIndex, {
                          rules: { ...active.rules, banned: event.target.value },
                        })
                      }
                      placeholder="쉼표로 나눠 적습니다. 결과 전체에서 찾습니다"
                      className="min-w-0 flex-1 rounded border border-neutral-300 bg-transparent px-2 py-1 dark:border-neutral-700"
                    />
                  </label>
                </div>

                <p className="text-[11px] text-neutral-500">
                  <b>최소 / 최대</b>는 숫자면 값, 문자면 글자 수, 목록이면
                  개수입니다. <b>null</b> 을 켜면 값이 비어 있어도 통과합니다.
                </p>
              </div>

              <div hidden={settingTab !== 'mapping'} className="flex flex-col gap-2 p-3">
                <p className="text-[11px] text-neutral-500">
                  적어 두면 다음 단계 입력에서 <b>여기 적은 칸만</b> 덮어씁니다.
                  나머지는 건드리지 않습니다. 한 줄도 없으면 결과 원문을 그대로
                  넣습니다.
                </p>

                {active.mapping.map((row, index) => (
                  <div
                    key={index}
                    className="flex flex-wrap items-center gap-1 border-b border-dashed border-neutral-200 pb-2 dark:border-neutral-800 md:border-0 md:pb-0"
                  >
                    <select
                      value={row.source}
                      onChange={(event) =>
                        setMapRow(index, { source: event.target.value as MapSource })
                      }
                      className="w-28 rounded border border-neutral-300 bg-transparent px-1 py-1 dark:border-neutral-700"
                    >
                      {MAP_SOURCES.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                    <input
                      value={row.from}
                      onChange={(event) => setMapRow(index, { from: event.target.value })}
                      placeholder={
                        MAP_SOURCES.find((item) => item.id === row.source)?.hint ?? ''
                      }
                      spellCheck={false}
                      className="w-44 rounded border border-neutral-300 bg-transparent px-2 py-1 dark:border-neutral-700"
                    />
                    <span className="text-neutral-400">→</span>
                    <input
                      value={row.to}
                      onChange={(event) => setMapRow(index, { to: event.target.value })}
                      placeholder="다음 입력의 위치"
                      spellCheck={false}
                      className="w-44 rounded border border-neutral-300 bg-transparent px-2 py-1 dark:border-neutral-700"
                    />
                    <button
                      onClick={() => removeMapRow(index)}
                      className="px-2 text-neutral-400 hover:text-red-600"
                      title="이 줄 삭제"
                    >
                      ×
                    </button>
                  </div>
                ))}

                <div>
                  <button
                    onClick={addMapRow}
                    className="rounded border border-dashed border-neutral-400 px-2 py-1 text-neutral-500 dark:border-neutral-600"
                  >
                    + 옮길 값
                  </button>
                </div>

                <p className="text-[11px] text-neutral-500">
                  <b>이 단계 입력</b>은 대화 기록을 그대로 넘길 때 씁니다.
                  대화는 결과가 아니라 입력에 쌓여 있기 때문입니다.
                  <b> 직접 적기</b>는 고정값입니다. 새 문제로 넘어갈 때
                  대화를 비우려면 <code>[]</code> 를 넣으세요.
                </p>
              </div>

              <div hidden={settingTab !== 'routing'} className="flex flex-col gap-2 p-3">
                <p className="text-[11px] text-neutral-500">
                  결과의 값을 보고 <b>[입력으로] 의 기본 대상</b>을 정합니다.
                  정하기만 하고 보내지는 않습니다 — 결과를 보고 나서 누르세요.
                  규칙이 없으면 바로 다음 단계가 기본입니다.
                </p>

                <label className="flex items-center gap-2">
                  <span className="w-20 shrink-0 text-neutral-500">읽을 값</span>
                  <input
                    value={active.routing.from}
                    onChange={(event) => setRouting({ from: event.target.value })}
                    placeholder="예: recommended_mode · payload.next.action"
                    spellCheck={false}
                    className="min-w-0 flex-1 rounded border border-neutral-300 bg-transparent px-2 py-1 dark:border-neutral-700"
                  />
                </label>

                {active.routing.rows.map((row, index) => (
                  <div key={index} className="flex flex-wrap items-center gap-1">
                    <span className="w-20 shrink-0 text-right text-neutral-400">
                      {index === 0 ? '이 값이면' : '아니면'}
                    </span>
                    <input
                      value={row.equals}
                      onChange={(event) => setRouteRow(index, { equals: event.target.value })}
                      placeholder="비우면 그밖의 모든 값"
                      spellCheck={false}
                      className="w-40 rounded border border-neutral-300 bg-transparent px-2 py-1 dark:border-neutral-700"
                    />
                    <span className="text-neutral-400">→</span>
                    <select
                      value={row.to}
                      onChange={(event) => setRouteRow(index, { to: event.target.value })}
                      className="w-52 rounded border border-neutral-300 bg-transparent px-1 py-1 dark:border-neutral-700"
                    >
                      {/* 저장해 둔 이름의 단계가 지금 없을 수도 있다. 그때도
                          고른 값이 보이게 빈 칸을 맨 앞에 둔다. */}
                      <option value="">(고르세요)</option>
                      {/* 자동 실행 전용. 손으로 보낼 때는 못 고른 것으로 본다 */}
                      <option value={STAY}>{STAY} · 학생이 한 번 더</option>
                      <option value={FINISH}>{FINISH} · 실행을 마친다</option>
                      {stages.map((stage, i) =>
                        i === activeIndex ? null : (
                          <option key={stage.key} value={stage.name}>
                            {stage.name || '(이름 없음)'}
                          </option>
                        ),
                      )}
                      {row.to !== '' &&
                        row.to !== STAY &&
                        row.to !== FINISH &&
                        !stages.some((stage) => stage.name === row.to) && (
                          <option value={row.to}>{row.to} (없는 단계)</option>
                        )}
                    </select>
                    <button
                      onClick={() => removeRouteRow(index)}
                      className="px-2 text-neutral-400 hover:text-red-600"
                      title="이 줄 삭제"
                    >
                      ×
                    </button>
                  </div>
                ))}

                <div>
                  <button
                    onClick={addRouteRow}
                    className="rounded border border-dashed border-neutral-400 px-2 py-1 text-neutral-500 dark:border-neutral-600"
                  >
                    + 분기
                  </button>
                </div>

                <p className="text-[11px] text-neutral-500">
                  <b>{STAY}</b> 와 <b>{FINISH}</b> 는 <b>[자동 실행]</b> 에서만
                  씁니다. 손으로 <b>[입력으로]</b> 를 누를 때는 못 고른 것으로 보고
                  기본 대상으로 갑니다.
                </p>

                <p className="text-[11px] text-neutral-500">
                  위에서부터 먼저 맞는 줄이 이깁니다. 대소문자는 가리지 않고,
                  숫자와 <code>null</code> 도 보이는 대로 적으면 맞습니다.
                  대상은 자리가 아니라 <b>단계 이름</b>으로 기억하므로 단계를
                  넣거나 옮겨도 따라갑니다.
                </p>
              </div>
            </Panel>

            <Panel
              title="프롬프트"
              accent={accent}
              open={openPanel.prompt}
              onToggle={() => togglePanel('prompt')}
              // 고쳐 놓고 안 보낸 상태를 여기서 먼저 알린다. 답변 아래까지
              // 내려가야 알 수 있으면 늦다.
              warn={promptChanged || missingVars.length > 0}
              hint={
                missingVars.length > 0
                  ? `정의 안 된 변수 ${missingVars.length}개: ${missingVars
                      .map((name) => `{{${name}}}`)
                      .join(' ')}`
                  : promptChanged
                    ? '고친 뒤 아직 보내지 않았습니다'
                    : `${active.prompt.length}자${active.useCommonPrompt ? ' · 공통 포함' : ''}`
              }
              onCopy={() => navigator.clipboard.writeText(active.prompt)}
            >
              <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200 px-3 py-2 dark:border-neutral-800">
                {reasonDraft === null ? (
                  <>
                    <button
                      onClick={() => setReasonDraft('')}
                      disabled={!unrecorded}
                      className="rounded border border-neutral-300 px-2 py-1 disabled:opacity-40 dark:border-neutral-700"
                      title={
                        unrecorded
                          ? '지금 프롬프트를 이유와 함께 장부에 남깁니다'
                          : '마지막 기록과 같습니다'
                      }
                    >
                      변경 기록
                    </button>
                    <span className="text-[11px] text-neutral-500">
                      {unrecorded
                        ? (() => {
                            const change = lineChange(lastRecorded, active.prompt);
                            return `마지막 기록과 다릅니다 · 빠진 줄 ${change.removed} · 새 줄 ${change.added}`;
                          })()
                        : '마지막 기록과 같습니다'}
                    </span>
                  </>
                ) : (
                  <>
                    <input
                      value={reasonDraft}
                      onChange={(event) => setReasonDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && reasonDraft.trim() !== '') {
                          record(reasonDraft);
                        }
                        if (event.key === 'Escape') setReasonDraft(null);
                      }}
                      autoFocus
                      placeholder="왜 고쳤는지 한 줄. 예: 첫 턴부터 보기를 주게"
                      className="min-w-0 flex-1 rounded border border-neutral-300 bg-transparent px-2 py-1 dark:border-neutral-700"
                    />
                    <button
                      onClick={() => record(reasonDraft)}
                      disabled={reasonDraft.trim() === ''}
                      className="rounded bg-neutral-900 px-3 py-1 text-white disabled:opacity-40 dark:bg-white dark:text-neutral-900"
                    >
                      남기기
                    </button>
                    <button
                      onClick={() => setReasonDraft(null)}
                      className="px-2 text-neutral-500"
                    >
                      취소
                    </button>
                  </>
                )}
              </div>
              <textarea
                value={active.prompt}
                onChange={(event) => patch(activeIndex, { prompt: event.target.value })}
                spellCheck={false}
                placeholder="이 단계의 system 프롬프트"
                className="h-64 w-full resize-y bg-transparent p-3 outline-none"
              />
            </Panel>

          </section>

          {/* 실제로 손이 가는 곳. 왼쪽에서 대화하고 오른쪽에서 결과를 본다 */}
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="flex flex-col gap-3">
              {/* 같은 프롬프트로 여러 시나리오를 나란히 둔다. 프롬프트·모델은
                  단계에 있으므로 고치면 모든 대화에 함께 반영된다. */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-neutral-500">대화</span>
                {active.threads.map((t, index) => (
                  <button
                    key={t.key}
                    onClick={() => patch(activeIndex, { activeThread: index })}
                    className={`flex items-center gap-2 rounded border px-2 py-1 ${
                      index === active.activeThread
                        ? 'border-neutral-900 dark:border-neutral-100'
                        : 'border-neutral-300 text-neutral-500 dark:border-neutral-700'
                    }`}
                  >
                    <StatusDot result={t.result} />
                    {t.name || '(이름 없음)'}
                  </button>
                ))}

                <button
                  onClick={addThread}
                  className="rounded border border-dashed border-neutral-400 px-2 py-1 text-neutral-500 dark:border-neutral-600"
                >
                  + 대화
                </button>
                <button
                  onClick={duplicateThread}
                  className="text-neutral-500 hover:underline"
                >
                  복제
                </button>
                {active.threads.length > 1 && (
                  <button
                    onClick={() => removeThread(active.activeThread)}
                    className="text-red-600 hover:underline dark:text-red-400"
                  >
                    삭제
                  </button>
                )}

                <input
                  value={thread.name}
                  onChange={(event) =>
                    renameThread(active.activeThread, event.target.value)
                  }
                  className="ml-auto w-40 rounded border border-neutral-300 bg-transparent px-2 py-1 dark:border-neutral-700"
                />
              </div>

              {/* 대화창은 모든 단계에 있다. 입력 형식에 따라 기록이 쌓이는
                  곳만 다르다. JSON 이면 입력 JSON 안의 배열, 평문이면 화면
                  에만 남는다. */}
              <ChatPanel
                accent={accent}
                turns={
                  active.inputMode === 'json'
                    ? readTurns(thread.input, active.historyKey)
                    : thread.transcript
                }
                draft={draft}
                onDraft={setDraft}
                onSend={send}
                running={thread.running}
                lastChecks={thread.result?.ok ? thread.result.checks : null}
                images={thread.images}
                onAttach={attachFiles}
                onRemoveImage={removeImage}
                hint={
                  active.inputMode === 'json'
                    ? `입력 JSON 의 ${active.historyKey} 에 쌓입니다`
                    : '보낸 글이 곧 입력이 됩니다. 기록은 화면에만 남습니다'
                }
                note={replyNote}
                choices={choices}
                onChoice={(text) => send(text)}
                emptyReason={emptyReason}
                onClear={() =>
                  patchActive({
                    transcript: [],
                    // 대화만 지우면 student_turn_count 가 그대로 남는다.
                    // 다음 턴이 6번째로 세어져 시작부터 한도를 넘는다.
                    ...(active.inputMode === 'json'
                      ? { input: resetConversation(thread.input, chatShape) }
                      : {}),
                  })
                }
              />
            </section>

            <section className="flex flex-col gap-3">
              <Panel
                title="입력"
                accent={accent}
                hint={
                  active.inputMode === 'json'
                    ? '대화창과 같은 값이다. 여기서 고쳐도 된다'
                    : '평문 그대로 보낸다'
                }
                onCopy={() => navigator.clipboard.writeText(thread.input)}
              >
                <textarea
                  value={thread.input}
                  onChange={(event) => patchActive({ input: event.target.value })}
                  spellCheck={false}
                  className="h-[200px] w-full resize-y bg-transparent p-3 outline-none"
                />
              </Panel>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={run}
                  disabled={thread.running}
                  className="rounded bg-neutral-900 px-4 py-2 text-white disabled:opacity-40 dark:bg-white dark:text-neutral-900"
                >
                  {thread.running ? '보내는 중…' : '새 메시지 없이 보내기'}
                </button>

                {thread.result?.ok && stages.length > 1 && (
                  <div
                    className={`flex items-center gap-1 rounded border border-l-4 border-neutral-400 py-1 pl-2 dark:border-neutral-600 ${
                      stageColor(sendTarget ?? defaultTarget).border
                    }`}
                  >
                    <span className="text-neutral-500">→</span>
                    <select
                      value={sendTarget ?? defaultTarget}
                      onChange={(event) => setSendTarget(Number(event.target.value))}
                      className="bg-transparent px-1 py-1 outline-none"
                    >
                      {stages.map((stage, index) =>
                        index === activeIndex ? null : (
                          <option key={stage.key} value={index}>
                            {stage.name || '(이름 없음)'}
                          </option>
                        ),
                      )}
                    </select>
                    <span className="border-l border-neutral-300 px-2 dark:border-neutral-700">
                      <Toggle
                        checked={conversationHandled ? true : carryConversation}
                        onChange={setCarryConversation}
                        label={conversationHandled ? '규칙이 정합니다' : '대화도 함께'}
                        disabled={conversationHandled}
                      />
                    </span>
                    <button
                      onClick={() => sendTo(sendTarget ?? defaultTarget)}
                      className="px-2 py-1"
                    >
                      입력으로
                    </button>
                  </div>
                )}

                {thread.result?.ok && routePick !== null && (
                  <span
                    className={`text-[11px] ${
                      routePick.index === null
                        ? 'text-amber-700 dark:text-amber-500'
                        : 'text-neutral-500'
                    }`}
                  >
                    {routePick.index === null ? '⚠ ' : '분기 · '}
                    {routePick.note}
                  </span>
                )}

                {thread.result?.ok && (
                  <button
                    onClick={saveCase}
                    className="rounded border border-neutral-400 px-2 py-1 dark:border-neutral-600"
                    title="이 호출을 회귀 테스트 재료로 남깁니다"
                  >
                    케이스로 저장
                  </button>
                )}

                {thread.result && (
                  <Meta
                    result={thread.result}
                    model={activeModel}
                    price={activePrice}
                    krwRate={Number(krwRate) || 0}
                  />
                )}
              </div>

              {sendNote && (
                <p className="text-[11px] text-neutral-500">{sendNote}</p>
              )}

                <ResultView
                result={thread.result}
                accent={accent}
                currentSystem={buildSystem(active, commonPrompt)}
              />
            </section>
          </div>
        </div>
      )}
    </main>
  );
}

function ChatPanel({
  accent,
  turns,
  draft,
  onDraft,
  onSend,
  running,
  lastChecks,
  images,
  onAttach,
  onRemoveImage,
  hint,
  note,
  choices,
  onChoice,
  onClear,
  emptyReason,
}: {
  accent: string;
  turns: { who: 'user' | 'ai' | 'other'; text: string; attachments: string[] }[];
  draft: string;
  onDraft: (next: string) => void;
  onSend: () => void;
  running: boolean;
  lastChecks: Check[] | null;
  images: Attachment[];
  onAttach: (files: FileList | null) => void;
  onRemoveImage: (index: number) => void;
  hint: string;
  note: string | null;
  /** 방금 답이 낸 보기. 비어 있으면 안 그린다 */
  choices: Choice[];
  onChoice: (text: string) => void;
  onClear: () => void;
  /** 대화가 비었을 때 왜 비었는지. 없으면 기본 문구를 쓴다 */
  emptyReason?: { text: string; action?: { label: string; run: () => void } };
}) {
  const failed = lastChecks?.filter((check) => check.level === 'fail') ?? [];

  return (
    <div
      className={`rounded border border-l-4 border-neutral-200 dark:border-neutral-800 ${accent}`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-neutral-200 px-3 py-1.5 dark:border-neutral-800">
        <div className="flex items-baseline gap-2">
          <span className="font-bold">대화</span>
          <span className="text-[11px] text-neutral-500">{hint}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-neutral-500">{turns.length}턴</span>
          {turns.length > 0 && (
            <button onClick={onClear} className="text-neutral-500 hover:underline">
              비우기
            </button>
          )}
        </div>
      </div>

      <div className="flex max-h-[320px] flex-col gap-2 overflow-auto p-3">
        {/* 비었을 때 왜 비었는지 말해 준다. 넘어왔는데 백지면 매핑을
            안 적어서인지, 이름이 안 맞아서인지, 원래 비는 게 맞는지
            알 수가 없었다. */}
        {turns.length === 0 && (
          <div className="flex flex-col items-start gap-2">
            <p className="whitespace-pre-wrap text-neutral-500">
              {emptyReason?.text ??
                '아직 대화가 없습니다. 아래에 학생 답변을 입력해 보세요.'}
            </p>
            {emptyReason?.action && (
              <button
                onClick={emptyReason.action.run}
                className="rounded border border-neutral-400 px-2 py-1 text-neutral-600 dark:border-neutral-600 dark:text-neutral-300"
              >
                {emptyReason.action.label}
              </button>
            )}
          </div>
        )}

        {turns.map((turn, index) => (
          <div
            key={index}
            className={turn.who === 'user' ? 'flex justify-end' : 'flex justify-start'}
          >
            <div
              className={`max-w-[80%] whitespace-pre-wrap rounded px-3 py-2 ${
                turn.who === 'user'
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                  : 'bg-neutral-100 dark:bg-neutral-900'
              }`}
            >
              <span className="mr-2 text-[11px] opacity-60">
                {turn.who === 'user' ? '학생' : turn.who === 'ai' ? 'AI' : '?'}
              </span>
              {turn.text}
              {turn.attachments.length > 0 && (
                <div className="mt-1 text-[11px] opacity-70">
                  첨부 {turn.attachments.join(' · ')}
                </div>
              )}
            </div>
          </div>
        ))}

        {running && <p className="text-neutral-500">응답을 기다리는 중…</p>}
      </div>

      {choices.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 border-t border-neutral-200 p-2 dark:border-neutral-800">
          <span className="mr-1 text-[11px] text-neutral-500">보기</span>
          {choices.map((choice) => (
            <button
              key={choice.id}
              onClick={() => onChoice(choice.label)}
              disabled={running}
              className="rounded-full border border-neutral-300 px-3 py-1 disabled:opacity-40 dark:border-neutral-700"
              title={
                choice.value === choice.label
                  ? undefined
                  : `보내는 값: ${choice.label} (value=${choice.value})`
              }
            >
              {choice.label}
            </button>
          ))}
          <span className="text-[11px] text-neutral-500">
            · 누르면 그 글이 학생의 말로 들어갑니다. 직접 써도 됩니다
          </span>
        </div>
      )}

      {note && (
        <div className="border-t border-neutral-200 px-3 py-1.5 text-[11px] text-neutral-500 dark:border-neutral-800">
          마지막 응답을 말풍선에 넣지 않았습니다 — {note}. 답변 패널에서 전체
          출력을 볼 수 있습니다.
        </div>
      )}

      {failed.length > 0 && (
        <div className="border-t border-neutral-200 px-3 py-1.5 text-red-600 dark:border-neutral-800 dark:text-red-400">
          마지막 응답 검증 실패 {failed.length}건 — {failed.map((c) => c.label).join(' · ')}
        </div>
      )}

      {images.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t border-neutral-200 p-2 dark:border-neutral-800">
          {images.map((image, index) => (
            <span
              key={`${image.name}-${index}`}
              className="flex items-center gap-2 rounded border border-neutral-300 px-2 py-1 text-[11px] dark:border-neutral-700"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`data:${image.mediaType};base64,${image.data}`}
                alt=""
                className="h-8 w-8 rounded object-cover"
              />
              {image.name}
              <button
                onClick={() => onRemoveImage(index)}
                className="text-neutral-500 hover:underline"
              >
                제거
              </button>
            </span>
          ))}
          <span className="self-center text-[11px] text-neutral-500">
            이 턴에만 함께 보냅니다. 대화 기록에는 파일명만 남습니다.
          </span>
        </div>
      )}

      <div className="flex gap-2 border-t border-neutral-200 p-2 dark:border-neutral-800">
        <label className="flex cursor-pointer items-center rounded border border-neutral-300 px-3 py-1.5 text-neutral-500 dark:border-neutral-700">
          이미지
          <input
            type="file"
            accept={ACCEPTED_IMAGE_TYPES.join(',')}
            multiple
            onChange={(event) => {
              onAttach(event.target.files);
              event.target.value = '';
            }}
            className="hidden"
          />
        </label>
        <input
          value={draft}
          onChange={(event) => onDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              onSend();
            }
          }}
          placeholder="학생이 되어 답해 보세요. Enter로 전송"
          className="flex-1 rounded border border-neutral-300 bg-transparent px-2 py-1.5 dark:border-neutral-700"
        />
        <button
          onClick={onSend}
          disabled={running || (draft.trim() === '' && images.length === 0)}
          className="rounded bg-neutral-900 px-4 py-1.5 text-white disabled:opacity-40 dark:bg-white dark:text-neutral-900"
        >
          보내기
        </button>
      </div>
    </div>
  );
}

function StatusDot({ result }: { result: RunResult | null }) {
  const status = !result
    ? 'idle'
    : !result.ok
      ? 'error'
      : result.checks.some((check) => check.level === 'fail')
        ? 'fail'
        : result.checks.some((check) => check.level === 'warn')
          ? 'warn'
          : 'pass';

  const color = {
    idle: 'bg-neutral-300 dark:bg-neutral-700',
    pass: 'bg-emerald-500',
    warn: 'bg-amber-500',
    fail: 'bg-red-500',
    error: 'bg-red-700',
  }[status];

  return <span className={`h-2 w-2 rounded-full ${color}`} />;
}

function Meta({
  result,
  model,
  price,
  krwRate,
}: {
  result: RunResult;
  model: string;
  price: Price | null;
  krwRate: number;
}) {
  const cost = costOf(price, result.tokens);

  return (
    <span className="text-neutral-500">
      {result.elapsed_ms}ms
      {result.tokens.total !== null && ` · ${result.tokens.total} tok`}
      {result.tokens.prompt !== null &&
        result.tokens.output !== null &&
        ` (in ${result.tokens.prompt} / out ${result.tokens.output})`}
      {cost !== null ? (
        <>
          {' · '}
          <b className="text-neutral-900 dark:text-neutral-100">
            {formatUsd(cost)}
          </b>
          {krwRate > 0 && ` ${formatKrw(cost, krwRate)}`}
        </>
      ) : (
        result.tokens.total !== null && (
          <span className="text-amber-600 dark:text-amber-400">
            {` · ${model} 가격 미입력`}
          </span>
        )
      )}
    </span>
  );
}

function ResultView({
  result,
  accent,
  currentSystem,
}: {
  result: RunResult | null;
  accent: string;
  /** 지금 화면의 프롬프트. 결과가 옛 프롬프트로 나온 것인지 비교한다 */
  currentSystem: string;
}) {
  if (result === null) {
    return (
      <Panel title="답변" hint="AI에게 보내면 여기에 나옵니다" accent={accent}>
        <p className="p-3 text-neutral-500">
          아직 AI에게 보내지 않았습니다. API 키를 넣고, 대화창에 메시지를
          보내거나 아래 <b>새 메시지 없이 보내기</b>를 누르세요.
        </p>
      </Panel>
    );
  }

  const sent = <SentPrompt result={result} currentSystem={currentSystem} accent={accent} />;

  if (!result.ok) {
    return (
      <>
        <Panel title="오류" accent={accent}>
          <pre className="whitespace-pre-wrap p-3 text-red-600 dark:text-red-400">
            {result.error}
          </pre>
        </Panel>
        {sent}
      </>
    );
  }

  return (
    <>
      <Panel title="검증" accent={accent}>
        <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
          {result.checks.map((check, index) => (
            <CheckRow key={`${check.label}-${index}`} check={check} />
          ))}
        </ul>
      </Panel>

      <Panel
        title="출력"
        accent={accent}
        onCopy={() => navigator.clipboard.writeText(result.raw)}
      >
        <pre className="max-h-[360px] overflow-auto whitespace-pre-wrap p-3">
          {result.raw}
        </pre>
      </Panel>

      {sent}
    </>
  );
}

/**
 * 이 결과를 만들 때 **서버가 실제로 받은 프롬프트**.
 *
 * 프롬프트를 고치고 다시 보내면 바뀐 게 갔는지 확인할 방법이 없었다.
 * 화면이 "보냈다고 믿는 것"이 아니라 서버가 돌려준 것을 그대로 보여준다.
 * 지금 화면의 프롬프트와 다르면 제목줄에서 알린다.
 */
function SentPrompt({
  result,
  currentSystem,
  accent,
}: {
  result: RunResult;
  currentSystem: string;
  accent: string;
}) {
  const [open, setOpen] = useState(false);
  const sent = result.sentSystem ?? '';
  const stale = sent !== '' && sent !== currentSystem;

  return (
    <Panel
      title="보낸 프롬프트"
      accent={accent}
      open={open}
      onToggle={() => setOpen((prev) => !prev)}
      warn={stale}
      hint={
        stale
          ? '지금 프롬프트와 다릅니다 — 고친 뒤 아직 안 보냈습니다'
          : `지금 프롬프트와 같습니다 · ${sent.length}자`
      }
      onCopy={() => navigator.clipboard.writeText(sent)}
    >
      <pre className="max-h-[320px] overflow-auto whitespace-pre-wrap p-3 text-neutral-600 dark:text-neutral-400">
        {sent || '(비어 있음)'}
      </pre>
    </Panel>
  );
}

function CheckRow({ check }: { check: Check }) {
  const mark = { pass: '✓', warn: '!', fail: '✕' }[check.level];
  const color = {
    pass: 'text-emerald-600 dark:text-emerald-400',
    warn: 'text-amber-600 dark:text-amber-400',
    fail: 'text-red-600 dark:text-red-400',
  }[check.level];

  return (
    <li className="flex gap-3 px-3 py-1.5">
      <span className={`w-3 shrink-0 ${color}`}>{mark}</span>
      <span className="shrink-0">{check.label}</span>
      {check.detail && <span className="text-neutral-500">{check.detail}</span>}
    </li>
  );
}

/**
 * 제목줄이 붙은 상자.
 *
 * `onToggle` 을 주면 제목줄을 눌러 접을 수 있다. 설정 패널이 그렇다.
 * 한 번 맞춰 두면 계속 펼쳐 둘 이유가 없고, 접어야 대화와 결과가
 * 화면에 들어온다.
 */
function Panel({
  title,
  hint,
  onCopy,
  accent,
  open,
  onToggle,
  warn,
  onClose,
  children,
}: {
  title: string;
  hint?: string;
  onCopy?: () => void;
  /** 단계 색. 왼쪽 테두리로 어느 단계를 보고 있는지 알린다 */
  accent?: string;
  /** `onToggle` 이 있을 때만 본다 */
  open?: boolean;
  onToggle?: () => void;
  /** 켜면 hint 를 눈에 띄게 칠한다. 주의를 끌어야 할 때만 쓴다 */
  warn?: boolean;
  /**
   * 닫기 버튼. 상단 버튼으로 여는 패널에 준다.
   *
   * 같은 버튼을 다시 눌러도 닫히지만, 그걸 알 방법이 없었다. 패널 안에
   * 닫는 길이 있어야 한다.
   */
  onClose?: () => void;
  children: React.ReactNode;
}) {
  const collapsible = onToggle !== undefined;
  const shown = !collapsible || open !== false;

  return (
    <div
      className={`rounded border border-neutral-200 dark:border-neutral-800 ${
        accent ? `border-l-4 ${accent}` : ''
      }`}
    >
      <div
        className={`flex items-center justify-between border-neutral-200 px-3 py-1.5 dark:border-neutral-800 ${
          shown ? 'border-b' : ''
        }`}
      >
        {collapsible ? (
          <button
            onClick={onToggle}
            className="flex flex-1 items-baseline gap-2 text-left"
            aria-expanded={shown}
          >
            <span className="text-neutral-400">{shown ? '▾' : '▸'}</span>
            <span className="font-bold">{title}</span>
            {hint && (
              <span className={warn ? 'font-bold text-amber-600 dark:text-amber-400' : 'text-neutral-500'}>
                {hint}
              </span>
            )}
          </button>
        ) : (
          <div className="flex items-baseline gap-2">
            <span className="font-bold">{title}</span>
            {hint && (
              <span className={warn ? 'font-bold text-amber-600 dark:text-amber-400' : 'text-neutral-500'}>
                {hint}
              </span>
            )}
          </div>
        )}
        <span className="flex shrink-0 items-center gap-3">
          {onCopy && (
            <button onClick={onCopy} className="text-neutral-500 hover:underline">
              복사
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              title="닫기"
              className="px-1 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
            >
              ✕
            </button>
          )}
        </span>
      </div>
      {/* 접어도 상태는 그대로 둔다. 다시 펴면 쓰던 값이 그대로 있어야 한다 */}
      <div hidden={!shown}>{children}</div>
    </div>
  );
}

/**
 * 입력 JSON 이 왜 안 읽히는지 알려준다.
 *
 * "JSON 을 고쳐 주세요" 만으로는 어디가 잘못됐는지 알 수 없다. 가장 흔한
 * 원인이 **따옴표 없는 변수**라, 그 경우를 따로 짚어 준다.
 *
 * 변수 치환은 보낼 때만 일어나는데 대화창은 그 전에 입력을 파싱해야 한다.
 * 그래서 입력 JSON 은 **치환 전에도 유효해야 한다.**
 */
function inputParseHint(input: string): string {
  // 값 자리에 따옴표 없이 놓인 {{변수}}
  const bare = [...input.matchAll(/[:[,]\s*(\{\{[^{}]+\}\})/g)].map((m) => m[1]);
  if (bare.length > 0) {
    const one = bare[0];
    return [
      `따옴표 없는 변수 때문에 입력을 읽지 못했습니다: ${bare.join(' ')}`,
      '',
      '변수 치환은 보낼 때만 일어나는데, 대화창은 그 전에 입력을 읽어야 합니다.',
      '입력 JSON 은 치환 전에도 유효해야 합니다.',
      '',
      '고치는 법',
      `  문자로 쓸 값이면   "${one}"  처럼 따옴표로 감쌉니다`,
      '  숫자로 쓸 값이면   변수 대신 숫자를 직접 적습니다',
    ].join('\n');
  }

  try {
    JSON.parse(input);
  } catch (cause) {
    return `입력 JSON 을 읽지 못했습니다.\n\n${String(cause)}`;
  }

  return [
    '입력이 JSON 객체가 아닙니다. 대화를 쌓으려면 { } 로 감싼 객체여야 합니다.',
    '대화가 필요 없는 단계라면 단계 설정에서 입력을 평문으로 바꾸세요.',
  ].join('\n');
}

/** ArrayBuffer -> base64. 큰 파일에서 스택이 넘치지 않게 나눠 처리한다. */
function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const CHUNK = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function ParamField({
  label,
  value,
  onChange,
  placeholder = '미전송',
  disabled,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  /** 공통 설정을 따르는 단계에서는 잠근다. 값은 그대로 보여준다 */
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center gap-1.5">
      <span className={disabled ? 'text-neutral-400' : 'text-neutral-500'}>
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        inputMode="decimal"
        disabled={disabled}
        className="w-24 rounded border border-neutral-300 bg-transparent px-2 py-1 disabled:text-neutral-400 dark:border-neutral-700"
      />
    </label>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  disabled,
  tone,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  /** 규칙이 이미 정한 값일 때 잠근다. 어느 쪽이 이기는지 헷갈리지 않게 */
  disabled?: boolean;
  /** 눈에 띄어야 할 때만 쓴다 */
  tone?: 'danger';
}) {
  return (
    <label
      className={`flex items-center gap-1.5 ${
        disabled ? 'text-neutral-400' : ''
      } ${tone === 'danger' ? 'font-bold text-red-600 dark:text-red-400' : ''}`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}
