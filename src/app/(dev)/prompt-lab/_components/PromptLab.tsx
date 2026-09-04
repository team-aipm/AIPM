'use client';

import { useEffect, useState, useTransition } from 'react';

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
  BLANK_MAP_ROW,
  MAP_SOURCES,
  type MapRow,
  type MapSource,
} from '../_mapping';
import { stageColor } from '../_stage-colors';
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
  parseOutput,
  pickReply,
  readTurns,
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
  hasEnvApiKey: boolean;
};

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
  };
}

function fromSaved(item: Partial<SavedStage>, key: string): Stage {
  const base = { ...BLANK_STAGE, ...item } as StagePreset;
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
    // 예전 저장본에는 threads 가 없다. sampleInput 하나를 대화 1로 만든다.
    threads: (Array.isArray(item.threads) && item.threads.length > 0
      ? item.threads
      : [{ name: '대화 1', input: item.sampleInput ?? '' }]
    ).map((t, i) => newThread(`${key}-t${i}`, t.name ?? `대화 ${i + 1}`, t.input ?? '')),
    activeThread: 0,
  };
}

export function PromptLab({ preset, hasEnvApiKey }: Props) {
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
  const [panel, setPanel] = useState<'none' | 'prompt' | 'price' | 'settings'>(
    'none',
  );
  const [draft, setDraft] = useState('');
  // 프로바이더에서 받아온 실제 모델 목록. 코드의 후보보다 이쪽이 정확하다.
  const [liveModels, setLiveModels] = useState<Partial<Record<ProviderId, string[]>>>({});
  const [loadingModels, setLoadingModels] = useState(false);
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
  /** 결과를 보낼 단계. null 이면 기본값(다음 단계, 마지막이면 처음) */
  const [sendTarget, setSendTarget] = useState<number | null>(null);
  /** 방금 옮긴 결과를 알린다. 어느 규칙으로 옮겼는지 보여야 한다 */
  const [sendNote, setSendNote] = useState<string | null>(null);
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
  const [settingTab, setSettingTab] = useState<'model' | 'rules' | 'mapping'>(
    'model',
  );

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
          common?: Partial<CommonSettings>;
          commonPrompt?: string;
          stages?: SavedStage[];
          prices?: Record<string, Price>;
          krwRate?: string;
        };
        if (parsed.prices && typeof parsed.prices === 'object') {
          setPrices(parsed.prices);
        }
        if (typeof parsed.krwRate === 'string') setKrwRate(parsed.krwRate);
        if (parsed.common && typeof parsed.common === 'object') {
          setCommon({ ...DEFAULT_COMMON, ...parsed.common });
        }
        if (Array.isArray(parsed.stages) && parsed.stages.length > 0) {
          setStages(
            parsed.stages.map((item, index) =>
              fromSaved(item, `r${index}`),
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
          common,
          commonPrompt,
          stages: stages.map(toSaved),
          prices,
          krwRate,
        }),
      );
    } catch {
      // 용량 초과 등은 조용히 넘긴다. 화면 동작을 막지 않는다.
    }
  }, [restored, remember, common, commonPrompt, stages, prices, krwRate]);

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

  /** 지금 단계가 실제로 쓸 모델 설정. 공통을 따를 수도, 직접 정했을 수도 */
  const eff = active ? effective(active, common) : common;
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

    const system = buildSystem(active, commonPrompt);

    const model = settings.model.trim() || DEFAULT_MODEL[settings.provider];

    startTransition(async () => {
      const result = await runStage({
        provider: settings.provider,
        model,
        system,
        input,
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

  /** 지금 단계의 프로바이더에 실제 모델 목록을 물어본다. */
  async function loadModels() {
    if (!active || loadingModels) return;
    const provider = effective(active, common).provider;
    const key = active.apiKey.trim() || defaultKeys[provider].trim();

    setLoadingModels(true);
    const result = await fetchModels(provider, key);
    setLoadingModels(false);

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
  function send() {
    if (!active || !thread || thread.running) return;
    const text = draft.trim();
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

    const withUser = appendUserTurn(thread.input, active.historyKey, text, names);
    if (withUser === null) {
      window.alert(
        '입력 JSON을 파싱하지 못해 대화를 이어갈 수 없습니다. ' +
          '입력을 평문으로 바꾸거나 JSON을 고쳐 주세요.',
      );
      return;
    }

    const historyKey = active.historyKey;
    const replyKey = active.replyKey;

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

      // 말풍선을 만들지 않아도 stage_status 같은 상태 이월은 그대로 한다.
      const withAi = appendAiTurn(
        withUser,
        historyKey,
        replyKey,
        parsed,
        pick.show ? pick.text : null,
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
    const custom = applyMapping(active.mapping, output, thread.input, targetInput);
    if (custom !== null) {
      patchThread(nextIndex, targetThread, { input: custom.json });
      setSendNote(
        custom.notes.length > 0
          ? `${custom.applied}칸 옮겼습니다. ${custom.notes.join(' ')}`
          : `${custom.applied}칸 옮겼습니다.`,
      );
    } else {
      // 출력만이 아니라 이 단계의 입력도 넘긴다. 대화 기록이 거기 있다.
      const mapped = bridge(active.checkRule, output, thread.input, targetInput);
      patchThread(nextIndex, targetThread, { input: mapped ?? raw });
      setSendNote(
        mapped !== null
          ? '검증 규칙에 맞춰 옮겼습니다.'
          : '옮길 규칙이 없어 결과 원문을 그대로 넣었습니다.',
      );
    }

    setActiveIndex(nextIndex);
    setSendTarget(null);
  }

  /** 기본 대상. 다음 단계가 있으면 그쪽, 마지막이면 처음으로 돌아간다. */
  const defaultTarget = activeIndex + 1 < stages.length ? activeIndex + 1 : 0;

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

          <Toggle checked={remember} onChange={setRemember} label="설정 저장" />
          <Toggle checked={rememberKeys} onChange={setRememberKeys} label="키 저장" />
        </div>
      </header>

      <nav className="flex flex-wrap items-center gap-3 text-neutral-500">
        {(
          [
            ['settings', '공통 설정'],
            ['price', '가격표'],
            ['prompt', '공통 프롬프트'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setPanel(panel === id ? 'none' : id)}
            className={panel === id ? 'text-neutral-900 dark:text-neutral-100' : 'hover:underline'}
          >
            {label}
          </button>
        ))}
        <button
          onClick={() => {
            if (!window.confirm('단계를 기본 프리셋으로 되돌립니다. 계속할까요?')) return;
            setStages(preset.map((base, index) => toStage(base, `p${index}`)));
            setKeySeq(preset.length);
            setActiveIndex(0);
            setCommonPrompt(COMMON_RULES);
          }}
          className="hover:underline"
        >
          단계 초기화
        </button>
      </nav>

      {panel === 'settings' && (
        <Panel
          title="공통 설정"
          hint={`모든 단계의 기본값 · 지금 ${followers} / ${stages.length} 단계가 따릅니다`}
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

      {panel === 'prompt' && (
        <Panel
          title="공통 프롬프트"
          hint="포함을 켠 단계의 프롬프트 앞에 붙습니다"
          onCopy={() => navigator.clipboard.writeText(commonPrompt)}
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
                    onClick={() => void loadModels()}
                    disabled={loadingModels}
                    className="rounded border border-neutral-400 px-1.5 py-0.5 text-[11px] disabled:opacity-40 dark:border-neutral-600"
                  >
                    {loadingModels ? '불러오는 중…' : '목록 불러오기'}
                  </button>
                  {liveModels[eff.provider] === undefined && (
                    <span className="text-[11px] text-neutral-500">
                      아래는 코드에 적힌 값이라 낡았을 수 있습니다
                    </span>
                  )}
                  {(liveModels[eff.provider] ?? MODEL_CANDIDATES[eff.provider]).map((candidate) => (
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
                  {eff.model !== '' && (
                    <button
                      type="button"
                      onClick={() => patch(activeIndex, { model: '' })}
                      className="px-1.5 py-0.5 text-[11px] text-neutral-500 hover:underline"
                    >
                      지우기
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
                  <Toggle
                    checked={active.useCommonPrompt}
                    onChange={(next) => patch(activeIndex, { useCommonPrompt: next })}
                    label="공통 프롬프트 포함"
                  />
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
                      placeholder={replyKeyOff ? '해당 없음' : '비우면 표시 안 함'}
                      title={
                        replyKeyOff
                          ? '출력이 텍스트라 원문을 그대로 보여줍니다'
                          : undefined
                      }
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
                    <b>응답 필드</b>는 출력 중 말풍선에 보여줄 부분입니다.
                    {replyKeyOff
                      ? ' 출력이 JSON일 때만 씁니다. 지금은 출력이 텍스트라 원문이 그대로 나갑니다.'
                      : active.replyKey.trim() === ''
                        ? ' 지금은 비어 있어 아무것도 표시하지 않습니다. 데이터만 만드는 단계에 맞습니다.'
                        : ' 보여줄 문장이 없는 단계(평가·기억 저장 등)는 비워 두세요.'}
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
            </Panel>

            <Panel
              title="프롬프트"
              accent={accent}
              open={openPanel.prompt}
              onToggle={() => togglePanel('prompt')}
              // 고쳐 놓고 안 보낸 상태를 여기서 먼저 알린다. 답변 아래까지
              // 내려가야 알 수 있으면 늦다.
              warn={promptChanged}
              hint={
                promptChanged
                  ? '고친 뒤 아직 보내지 않았습니다'
                  : `${active.prompt.length}자${active.useCommonPrompt ? ' · 공통 포함' : ''}`
              }
              onCopy={() => navigator.clipboard.writeText(active.prompt)}
            >
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
                onClear={() =>
                  patchActive({
                    transcript: [],
                    ...(active.inputMode === 'json'
                      ? { input: clearHistory(thread.input, active.historyKey) }
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
                    <button
                      onClick={() => sendTo(sendTarget ?? defaultTarget)}
                      className="px-2 py-1"
                    >
                      입력으로
                    </button>
                  </div>
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
  onClear,
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
  onClear: () => void;
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
        {turns.length === 0 && (
          <p className="text-neutral-500">
            아직 대화가 없습니다. 아래에 학생 답변을 입력해 보세요.
          </p>
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
        {onCopy && (
          <button onClick={onCopy} className="text-neutral-500 hover:underline">
            복사
          </button>
        )}
      </div>
      {/* 접어도 상태는 그대로 둔다. 다시 펴면 쓰던 값이 그대로 있어야 한다 */}
      <div hidden={!shown}>{children}</div>
    </div>
  );
}

/** 입력 JSON 의 대화 배열만 비운다. 나머지 필드는 그대로 둔다. */
function clearHistory(inputJson: string, historyKey: string): string {
  try {
    const root = JSON.parse(inputJson);
    if (typeof root !== 'object' || root === null || Array.isArray(root)) {
      return inputJson;
    }
    return JSON.stringify({ ...root, [historyKey]: [] }, null, 2);
  } catch {
    return inputJson;
  }
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
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-1.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}
