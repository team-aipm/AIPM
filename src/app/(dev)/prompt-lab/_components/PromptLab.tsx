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
import { appendAiTurn, appendUserTurn, readTurns, type Turn } from '../_chat';

type Stage = StagePreset & {
  /** React key 전용. DOM에 넣지 않는다 */
  key: string;
  provider: ProviderId;
  /** 비우면 프로바이더 기본 모델 */
  model: string;
  /** 비우면 기본 키 → 없으면 서버의 GEMINI_API_KEY */
  apiKey: string;
  input: string;
  /** 화면 입력값. 빈 문자열이면 해당 파라미터를 보내지 않는다 */
  temperature: string;
  maxTokens: string;
  topP: string;
  /** 다음 호출에 함께 보낼 이미지. 보내고 나면 비운다 */
  images: Attachment[];
  /**
   * 평문 입력 단계의 대화 기록. 화면에만 쓴다.
   *
   * JSON 입력 단계는 입력 JSON 안의 배열이 곧 대화 기록이라 별도 상태가
   * 없다. 평문 단계는 담을 곳이 없어 여기 둔다.
   */
  transcript: Turn[];
  useCommonPrompt: boolean;
  forceJsonMimeType: boolean;
  result: RunResult | null;
  running: boolean;
};

type Props = {
  preset: StagePreset[];
  hasEnvApiKey: boolean;
};

/** 프리셋 한 줄을 화면 상태로 바꾼다. key는 React 전용이며 DOM에 넣지 않는다. */
function toStage(base: StagePreset, key: string): Stage {
  return {
    ...base,
    key,
    provider: 'gemini',
    model: '',
    apiKey: '',
    input: base.sampleInput,
    temperature: '',
    maxTokens: '',
    topP: '',
    images: [],
    transcript: [],
    useCommonPrompt: true,
    forceJsonMimeType: false,
    result: null,
    running: false,
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
  provider: ProviderId;
  model: string;
  temperature: string;
  maxTokens: string;
  topP: string;
  useCommonPrompt: boolean;
  forceJsonMimeType: boolean;
};

function toSaved(stage: Stage): SavedStage {
  return {
    name: stage.name,
    note: stage.note,
    prompt: stage.prompt,
    sampleInput: stage.input,
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
  };
}

function fromSaved(item: Partial<SavedStage>, key: string): Stage {
  const base = { ...BLANK_STAGE, ...item } as StagePreset;
  return {
    ...toStage(base, key),
    provider: item.provider ?? 'gemini',
    model: item.model ?? '',
    temperature: item.temperature ?? '',
    maxTokens: item.maxTokens ?? '',
    topP: item.topP ?? '',
    useCommonPrompt: item.useCommonPrompt ?? true,
    forceJsonMimeType: item.forceJsonMimeType ?? false,
    input: item.sampleInput ?? '',
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
  const [panel, setPanel] = useState<'none' | 'common' | 'config'>('none');
  const [configText, setConfigText] = useState('');
  const [draft, setDraft] = useState('');
  // 프로바이더에서 받아온 실제 모델 목록. 코드의 후보보다 이쪽이 정확하다.
  const [liveModels, setLiveModels] = useState<Partial<Record<ProviderId, string[]>>>({});
  const [loadingModels, setLoadingModels] = useState(false);
  const [, startTransition] = useTransition();

  // 저장 여부. 키는 따로 관리한다.
  const [remember, setRemember] = useState(false);
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
      const savedConfig = window.localStorage.getItem(CONFIG_STORAGE_KEY);
      if (savedConfig) {
        const parsed = JSON.parse(savedConfig) as {
          commonPrompt?: string;
          stages?: SavedStage[];
        };
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
        setRemember(true);
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
        setRememberKeys(true);
      }
    } catch {
      // 저장값이 깨졌으면 무시하고 기본값으로 연다.
    }
    setRestored(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

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
        JSON.stringify({ commonPrompt, stages: stages.map(toSaved) }),
      );
    } catch {
      // 용량 초과 등은 조용히 넘긴다. 화면 동작을 막지 않는다.
    }
  }, [restored, remember, commonPrompt, stages]);

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

  function patch(index: number, next: Partial<Stage>) {
    setStages((prev) =>
      prev.map((stage, i) => (i === index ? { ...stage, ...next } : stage)),
    );
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
  function readParams(stage: Stage): {
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
    if (!active || active.running) return;
    const params = readParams(active);
    if (params === null) return;
    const index = activeIndex;
    patch(index, { running: true, result: null });

    const system = active.useCommonPrompt
      ? `${commonPrompt}\n\n---\n\n${active.prompt}`
      : active.prompt;

    startTransition(async () => {
      const result = await runStage({
        provider: active.provider,
        model: active.model.trim() || DEFAULT_MODEL[active.provider],
        system,
        input,
        inputMode: active.inputMode,
        outputMode: active.outputMode,
        checkRule: active.checkRule,
        forceJsonMimeType: active.forceJsonMimeType,
        apiKey: active.apiKey.trim() || defaultKeys[active.provider].trim(),
        params,
        images: active.images,
      });
      patch(index, { running: false, result });
      onDone?.(result);
    });
  }

  function run() {
    if (!active) return;
    execute(active.input);
  }

  /** 지금 단계의 프로바이더에 실제 모델 목록을 물어본다. */
  async function loadModels() {
    if (!active || loadingModels) return;
    const provider = active.provider;
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

    if (added.length > 0) {
      setStages((prev) =>
        prev.map((stage, i) =>
          i === index ? { ...stage, images: [...stage.images, ...added] } : stage,
        ),
      );
    }
  }

  function removeImage(imageIndex: number) {
    setStages((prev) =>
      prev.map((stage, i) =>
        i === activeIndex
          ? { ...stage, images: stage.images.filter((_, k) => k !== imageIndex) }
          : stage,
      ),
    );
  }

  /**
   * 대화 전송. 입력 형식에 따라 기록이 쌓이는 곳이 다르다.
   *
   * json  입력 JSON 안의 배열에 학생 턴 -> 응답 턴을 붙인다.
   * text  보낸 글이 곧 입력이 된다. 기록은 화면(transcript)에만 남는다.
   */
  function send() {
    if (!active || active.running) return;
    const text = draft.trim();
    // 이미지만 붙여 보낼 수 있다. OCR 단계에서 자주 쓴다.
    if (!text && active.images.length === 0) return;

    const index = activeIndex;
    const names = active.images.map((image) => image.name);

    if (active.inputMode === 'text') {
      setDraft('');
      patch(index, {
        input: text,
        transcript: [...active.transcript, { who: 'user', text, attachments: names }],
      });

      execute(text, (result) => {
        if (!result.ok) return;
        setStages((prev) =>
          prev.map((stage, i) =>
            i === index
              ? {
                  ...stage,
                  transcript: [
                    ...stage.transcript,
                    { who: 'ai', text: result.raw, attachments: [] },
                  ],
                }
              : stage,
          ),
        );
      });
      patch(index, { images: [] });
      return;
    }

    const withUser = appendUserTurn(active.input, active.historyKey, text, names);
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
    patch(index, { input: withUser });

    execute(withUser, (result) => {
      if (!result.ok) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(result.raw);
      } catch {
        parsed = result.raw;
      }
      const withAi = appendAiTurn(withUser, historyKey, replyKey, parsed);
      if (withAi !== null) patch(index, { input: withAi });
    });

    // 이미지는 그 턴에만 붙는다. 대화 기록에는 파일명만 남는다.
    patch(index, { images: [] });
  }

  function sendToNext() {
    const nextIndex = activeIndex + 1;
    const raw = active?.result?.raw;
    if (!raw || nextIndex >= stages.length) return;

    let mapped: string | null = null;
    try {
      mapped = bridge(active.checkRule, JSON.parse(raw), stages[nextIndex].input);
    } catch {
      mapped = null;
    }

    patch(nextIndex, { input: mapped ?? raw });
    setActiveIndex(nextIndex);
  }

  function exportConfig() {
    // API 키는 내보내지 않는다.
    const payload = {
      commonPrompt,
      stages: stages.map((stage) => ({
        name: stage.name,
        note: stage.note,
        prompt: stage.prompt,
        sampleInput: stage.input,
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
      })),
    };
    const text = JSON.stringify(payload, null, 2);
    setConfigText(text);
    setPanel('config');
    void navigator.clipboard.writeText(text);
  }

  function importConfig() {
    let parsed: unknown;
    try {
      parsed = JSON.parse(configText);
    } catch {
      window.alert('설정 JSON을 파싱하지 못했습니다.');
      return;
    }
    const data = parsed as {
      commonPrompt?: string;
      stages?: Partial<SavedStage>[];
    };
    if (!Array.isArray(data.stages) || data.stages.length === 0) {
      window.alert('stages 배열이 없습니다.');
      return;
    }

    if (typeof data.commonPrompt === 'string') setCommonPrompt(data.commonPrompt);

    setStages(
      data.stages.map((item, index) => fromSaved(item, `s${keySeq + index}`)),
    );
    setKeySeq((prev) => prev + data.stages!.length);
    setActiveIndex(0);
    setPanel('none');
  }

  const activeProvider = active?.provider ?? 'gemini';
  const providerLabel =
    PROVIDERS.find((entry) => entry.id === activeProvider)?.label ?? activeProvider;

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
          <span className="text-neutral-500">단계별 프롬프트 실행·검증</span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2">
            <span className="text-neutral-500">{providerLabel} 기본 키</span>
            <input
              type="password"
              value={defaultKeys[activeProvider]}
              onChange={(event) =>
                setDefaultKeys((prev) => ({
                  ...prev,
                  [activeProvider]: event.target.value,
                }))
              }
              placeholder={
                activeProvider === 'gemini' && hasEnvApiKey
                  ? '.env 값을 씁니다'
                  : '키를 넣으세요'
              }
              className="w-56 rounded border border-neutral-300 bg-transparent px-2 py-1 dark:border-neutral-700"
            />
          </label>

          <Toggle checked={remember} onChange={setRemember} label="설정 저장" />
          <Toggle
            checked={rememberKeys}
            onChange={setRememberKeys}
            label="키 저장"
          />
          <span className="text-[11px] text-neutral-500">
            기본 키 + 단계별 키
          </span>

          <button
            onClick={() => {
              if (!window.confirm('단계를 기본 프리셋으로 되돌립니다. 계속할까요?'))
                return;
              setStages(preset.map((base, index) => toStage(base, `p${index}`)));
              setKeySeq(preset.length);
              setActiveIndex(0);
              setCommonPrompt(COMMON_RULES);
            }}
            className="text-neutral-500 hover:underline"
          >
            초기화
          </button>

          <button onClick={() => setPanel(panel === 'common' ? 'none' : 'common')} className="text-neutral-500 hover:underline">
            공통 프롬프트
          </button>
          <button onClick={exportConfig} className="text-neutral-500 hover:underline">
            내보내기
          </button>
          <button onClick={() => setPanel(panel === 'config' ? 'none' : 'config')} className="text-neutral-500 hover:underline">
            불러오기
          </button>
        </div>
      </header>

      {panel === 'common' && (
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

      {panel === 'config' && (
        <Panel title="설정 JSON" hint="API 키는 포함되지 않습니다">
          <textarea
            value={configText}
            onChange={(event) => setConfigText(event.target.value)}
            spellCheck={false}
            placeholder="여기에 붙여넣고 불러오기를 누르세요"
            className="h-56 w-full resize-y bg-transparent p-3 outline-none"
          />
          <div className="border-t border-neutral-200 px-3 py-2 dark:border-neutral-800">
            <button
              onClick={importConfig}
              className="rounded border border-neutral-400 px-3 py-1 dark:border-neutral-600"
            >
              불러오기 — 현재 단계를 모두 교체합니다
            </button>
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
            <StatusDot result={stage.result} />
            <span>{stage.name || '(이름 없음)'}</span>
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

      {active && (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="order-2 flex flex-col gap-3 lg:order-1">
            <Panel title="단계 설정">
              <div className="flex flex-col gap-2 p-3">
                <label className="flex items-center gap-2">
                  <span className="w-16 shrink-0 text-neutral-500">이름</span>
                  <input
                    value={active.name}
                    onChange={(event) => patch(activeIndex, { name: event.target.value })}
                    className="flex-1 rounded border border-neutral-300 bg-transparent px-2 py-1 dark:border-neutral-700"
                  />
                  <button onClick={() => moveStage(activeIndex, -1)} className="px-1 text-neutral-500">←</button>
                  <button onClick={() => moveStage(activeIndex, 1)} className="px-1 text-neutral-500">→</button>
                  <button
                    onClick={() => removeStage(activeIndex)}
                    disabled={stages.length === 1}
                    className="px-1 text-red-600 disabled:opacity-30 dark:text-red-400"
                  >
                    삭제
                  </button>
                </label>

                <label className="flex items-center gap-2">
                  <span className="w-16 shrink-0 text-neutral-500">설명</span>
                  <input
                    value={active.note}
                    onChange={(event) => patch(activeIndex, { note: event.target.value })}
                    className="flex-1 rounded border border-neutral-300 bg-transparent px-2 py-1 dark:border-neutral-700"
                  />
                </label>

                <label className="flex items-center gap-2">
                  <span className="w-16 shrink-0 text-neutral-500">프로바이더</span>
                  <select
                    value={active.provider}
                    onChange={(event) =>
                      patch(activeIndex, { provider: event.target.value as ProviderId })
                    }
                    className="rounded border border-neutral-300 bg-transparent px-2 py-1 dark:border-neutral-700"
                  >
                    {PROVIDERS.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.label}
                      </option>
                    ))}
                  </select>
                  <span className="text-[11px] text-neutral-500">
                    어느 회사 API로 보낼지만 정합니다
                  </span>
                </label>

                <label className="flex items-center gap-2">
                  <span className="w-16 shrink-0 text-neutral-500">모델</span>
                  <input
                    value={active.model}
                    onChange={(event) => patch(activeIndex, { model: event.target.value })}
                    placeholder={`모델명을 직접 입력. 비우면 ${DEFAULT_MODEL[active.provider]}`}
                    spellCheck={false}
                    autoComplete="off"
                    className="flex-1 rounded border border-neutral-300 bg-transparent px-2 py-1 dark:border-neutral-700"
                  />
                </label>

                {/* 목록이 아니라 입력이 원칙이다. 아래는 자주 쓰는 이름을
                    한 번에 채워 넣는 단축키일 뿐이고, 여기 없는 이름도
                    그대로 입력해서 쓸 수 있다. */}
                <div className="flex flex-wrap items-center gap-1.5 pl-[4.5rem]">
                  <button
                    type="button"
                    onClick={() => void loadModels()}
                    disabled={loadingModels}
                    className="rounded border border-neutral-400 px-1.5 py-0.5 text-[11px] disabled:opacity-40 dark:border-neutral-600"
                  >
                    {loadingModels ? '불러오는 중…' : '목록 불러오기'}
                  </button>
                  {liveModels[active.provider] === undefined && (
                    <span className="text-[11px] text-neutral-500">
                      아래는 코드에 적힌 값이라 낡았을 수 있습니다
                    </span>
                  )}
                  {(liveModels[active.provider] ?? MODEL_CANDIDATES[active.provider]).map((candidate) => (
                    <button
                      key={candidate}
                      type="button"
                      onClick={() => patch(activeIndex, { model: candidate })}
                      className={`rounded border px-1.5 py-0.5 text-[11px] ${
                        active.model === candidate
                          ? 'border-neutral-900 dark:border-neutral-100'
                          : 'border-neutral-300 text-neutral-500 dark:border-neutral-700'
                      }`}
                    >
                      {candidate}
                    </button>
                  ))}
                  {active.model !== '' && (
                    <button
                      type="button"
                      onClick={() => patch(activeIndex, { model: '' })}
                      className="px-1.5 py-0.5 text-[11px] text-neutral-500 hover:underline"
                    >
                      지우기
                    </button>
                  )}
                </div>

                <label className="flex items-center gap-2">
                  <span className="w-16 shrink-0 text-neutral-500">API 키</span>
                  <input
                    type="password"
                    value={active.apiKey}
                    onChange={(event) => patch(activeIndex, { apiKey: event.target.value })}
                    placeholder={`비우면 기본 ${providerLabel} 키`}
                    className="flex-1 rounded border border-neutral-300 bg-transparent px-2 py-1 dark:border-neutral-700"
                  />
                  <span className="shrink-0 text-neutral-500">사용: {keySource}</span>
                </label>

                <div className="flex flex-wrap items-center gap-3 border-t border-neutral-200 pt-2 dark:border-neutral-800">
                  <span className="text-neutral-500">생성 파라미터</span>
                  <ParamField
                    label="temperature"
                    value={active.temperature}
                    onChange={(next) => patch(activeIndex, { temperature: next })}
                  />
                  <ParamField
                    label="max output"
                    value={active.maxTokens}
                    onChange={(next) => patch(activeIndex, { maxTokens: next })}
                    placeholder={active.provider === 'anthropic' ? '비우면 16000' : '미전송'}
                  />
                  <ParamField
                    label="top_p"
                    value={active.topP}
                    onChange={(next) => patch(activeIndex, { topP: next })}
                  />
                </div>

                <p className="text-[11px] text-neutral-500">
                  비우면 그 항목을 <b>아예 보내지 않습니다</b>. 넣으면 그대로
                  전송합니다.
                  {active.provider === 'anthropic' && (
                    <>
                      {' '}
                      Claude는 <b>max output이 필수</b>라 비우면 16000을 씁니다.
                      현재 모델(Opus 5 · Sonnet 5 · Opus 4.7/4.8 · Fable 5)은{' '}
                      <b>temperature·top_p를 받으면 400</b>입니다.
                    </>
                  )}
                  {active.provider === 'openai' && (
                    <>
                      {' '}
                      추론 계열 모델은 temperature를 거부합니다. max output은{' '}
                      <code>max_completion_tokens</code>로 보냅니다.
                    </>
                  )}
                </p>

                <div className="flex flex-wrap items-center gap-4 border-t border-neutral-200 pt-2 dark:border-neutral-800">
                  <label className="flex items-center gap-2">
                    <span className="text-neutral-500">입력</span>
                    <select
                      value={active.inputMode}
                      onChange={(event) =>
                        patch(activeIndex, { inputMode: event.target.value as OutputMode })
                      }
                      className="rounded border border-neutral-300 bg-transparent px-2 py-1 disabled:opacity-50 dark:border-neutral-700"
                    >
                      <option value="json">JSON</option>
                      <option value="text">평문</option>
                    </select>
                  </label>

                  <label className="flex items-center gap-2">
                    <span className="text-neutral-500">출력</span>
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
                    <span className="text-neutral-500">검증</span>
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
                </div>

                {active.inputMode === 'json' && (
                  <div className="flex flex-wrap items-center gap-4 border-t border-neutral-200 pt-2 dark:border-neutral-800">
                    <label className="flex items-center gap-2">
                      <span className="text-neutral-500">대화 배열 키</span>
                      <input
                        value={active.historyKey}
                        onChange={(event) =>
                          patch(activeIndex, { historyKey: event.target.value })
                        }
                        className="w-40 rounded border border-neutral-300 bg-transparent px-2 py-1 dark:border-neutral-700"
                      />
                    </label>
                    <label className="flex items-center gap-2">
                      <span className="text-neutral-500">응답 필드</span>
                      <input
                        value={active.replyKey}
                        onChange={(event) =>
                          patch(activeIndex, { replyKey: event.target.value })
                        }
                        className="w-40 rounded border border-neutral-300 bg-transparent px-2 py-1 dark:border-neutral-700"
                      />
                    </label>
                  </div>
                )}
              </div>
            </Panel>

            <Panel
              title="프롬프트"
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

          <section className="order-1 flex flex-col gap-3 lg:order-2">
            {/* 대화창은 모든 단계에 있다. 입력 형식에 따라 기록이 쌓이는
                곳만 다르다. JSON 이면 입력 JSON 안의 배열, 평문이면 화면
                에만 남는다. */}
            <ChatPanel
              turns={
                active.inputMode === 'json'
                  ? readTurns(active.input, active.historyKey)
                  : active.transcript
              }
              draft={draft}
              onDraft={setDraft}
              onSend={send}
              running={active.running}
              lastChecks={active.result?.ok ? active.result.checks : null}
              images={active.images}
              onAttach={attachFiles}
              onRemoveImage={removeImage}
              hint={
                active.inputMode === 'json'
                  ? `입력 JSON 의 ${active.historyKey} 에 쌓입니다`
                  : '보낸 글이 곧 입력이 됩니다. 기록은 화면에만 남습니다'
              }
              onClear={() =>
                patch(activeIndex, {
                  transcript: [],
                  ...(active.inputMode === 'json'
                    ? { input: clearHistory(active.input, active.historyKey) }
                    : {}),
                })
              }
            />

            <Panel
              title="입력"
              hint={
                active.inputMode === 'json'
                  ? '대화창과 같은 값이다. 여기서 고쳐도 된다'
                  : '평문 그대로 보낸다'
              }
              onCopy={() => navigator.clipboard.writeText(active.input)}
            >
              <textarea
                value={active.input}
                onChange={(event) => patch(activeIndex, { input: event.target.value })}
                spellCheck={false}
                className="h-[200px] w-full resize-y bg-transparent p-3 outline-none"
              />
            </Panel>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={run}
                disabled={active.running}
                className="rounded bg-neutral-900 px-4 py-2 text-white disabled:opacity-40 dark:bg-white dark:text-neutral-900"
              >
                {active.running ? '실행 중…' : '입력 그대로 실행'}
              </button>

              {active.result?.ok && activeIndex + 1 < stages.length && (
                <button
                  onClick={sendToNext}
                  className="rounded border border-neutral-400 px-3 py-2 dark:border-neutral-600"
                >
                  → {stages[activeIndex + 1].name} 입력으로
                </button>
              )}

              {active.result && <Meta result={active.result} />}
            </div>

            <ResultView result={active.result} />
          </section>
        </div>
      )}
    </main>
  );
}

function ChatPanel({
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
  onClear,
}: {
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
  onClear: () => void;
}) {
  const failed = lastChecks?.filter((check) => check.level === 'fail') ?? [];

  return (
    <div className="rounded border border-neutral-200 dark:border-neutral-800">
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

function Meta({ result }: { result: RunResult }) {
  return (
    <span className="text-neutral-500">
      {result.elapsed_ms}ms
      {result.tokens.total !== null && ` · ${result.tokens.total} tok`}
      {result.tokens.prompt !== null &&
        result.tokens.output !== null &&
        ` (in ${result.tokens.prompt} / out ${result.tokens.output})`}
    </span>
  );
}

function ResultView({ result }: { result: RunResult | null }) {
  if (result === null) {
    return (
      <Panel title="답변" hint="실행하면 여기에 나옵니다">
        <p className="p-3 text-neutral-500">
          아직 실행하지 않았습니다. API 키를 넣고 대화창에 메시지를 보내거나,
          입력을 채우고 실행하세요.
        </p>
      </Panel>
    );
  }

  if (!result.ok) {
    return (
      <Panel title="오류">
        <pre className="whitespace-pre-wrap p-3 text-red-600 dark:text-red-400">
          {result.error}
        </pre>
      </Panel>
    );
  }

  return (
    <>
      <Panel title="검증">
        <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
          {result.checks.map((check, index) => (
            <CheckRow key={`${check.label}-${index}`} check={check} />
          ))}
        </ul>
      </Panel>

      <Panel title="출력" onCopy={() => navigator.clipboard.writeText(result.raw)}>
        <pre className="max-h-[360px] overflow-auto whitespace-pre-wrap p-3">
          {result.raw}
        </pre>
      </Panel>
    </>
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

function Panel({
  title,
  hint,
  onCopy,
  children,
}: {
  title: string;
  hint?: string;
  onCopy?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded border border-neutral-200 dark:border-neutral-800">
      <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-1.5 dark:border-neutral-800">
        <div className="flex items-baseline gap-2">
          <span className="font-bold">{title}</span>
          {hint && <span className="text-neutral-500">{hint}</span>}
        </div>
        {onCopy && (
          <button onClick={onCopy} className="text-neutral-500 hover:underline">
            복사
          </button>
        )}
      </div>
      {children}
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
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="flex items-center gap-1.5">
      <span className="text-neutral-500">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        inputMode="decimal"
        className="w-24 rounded border border-neutral-300 bg-transparent px-2 py-1 dark:border-neutral-700"
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
