'use client';

import { useState, useTransition } from 'react';

import type { Stage, StageId } from '@/lib/ai/prompts/stages';
import {
  DEFAULT_GEMINI_MODEL,
  GEMINI_MODEL_CANDIDATES,
} from '@/lib/gemini/models';
import type { Check } from '@/lib/ai/schema-check';
import { runStage, type RunResult } from '../_actions';
import { bridge } from '../_bridge';

type StageState = {
  model: string;
  prompt: string;
  input: string;
  result: RunResult | null;
  running: boolean;
};

type Props = {
  stages: Stage[];
  hasApiKey: boolean;
};

export function PromptLab({ stages, hasApiKey }: Props) {
  const [activeId, setActiveId] = useState<StageId>('02');
  const [includeCommonRules, setIncludeCommonRules] = useState(true);
  const [forceJsonMimeType, setForceJsonMimeType] = useState(false);
  const [, startTransition] = useTransition();

  const [state, setState] = useState<Record<StageId, StageState>>(() =>
    Object.fromEntries(
      stages.map((stage) => [
        stage.id,
        {
          model: DEFAULT_GEMINI_MODEL,
          prompt: stage.prompt,
          input: stage.sampleInput,
          result: null,
          running: false,
        },
      ]),
    ) as Record<StageId, StageState>,
  );

  const active = stages.find((stage) => stage.id === activeId)!;
  const current = state[activeId];

  const patch = (id: StageId, next: Partial<StageState>) =>
    setState((prev) => ({ ...prev, [id]: { ...prev[id], ...next } }));

  function run() {
    if (current.running) return;
    patch(activeId, { running: true, result: null });

    startTransition(async () => {
      const result = await runStage({
        stageId: activeId,
        model: current.model,
        prompt: current.prompt,
        input: current.input,
        includeCommonRules,
        forceJsonMimeType,
      });
      patch(activeId, { running: false, result });
    });
  }

  function sendToNext() {
    const target = active.feedsInto;
    const raw = current.result?.raw;
    if (!target || !raw) return;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }

    const merged = bridge(activeId, parsed, state[target].input);
    if (merged === null) return;

    patch(target, { input: merged });
    setActiveId(target);
  }

  const canSendToNext =
    active.feedsInto !== null && current.result?.ok === true && current.result.raw !== '';

  return (
    <main className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 p-6 font-mono text-[13px]">
      <Header hasApiKey={hasApiKey} />

      <StageRail
        stages={stages}
        activeId={activeId}
        state={state}
        onSelect={setActiveId}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2">
              <span className="text-neutral-500">모델</span>
              <input
                list="gemini-models"
                value={current.model}
                onChange={(event) => patch(activeId, { model: event.target.value })}
                className="w-56 rounded border border-neutral-300 bg-transparent px-2 py-1 dark:border-neutral-700"
              />
              <datalist id="gemini-models">
                {GEMINI_MODEL_CANDIDATES.map((model) => (
                  <option key={model} value={model} />
                ))}
              </datalist>
            </label>

            <Toggle
              checked={includeCommonRules}
              onChange={setIncludeCommonRules}
              label="공통 규칙 붙이기"
              hint="docs/prompts §1"
            />
            <Toggle
              checked={forceJsonMimeType}
              onChange={setForceJsonMimeType}
              label="JSON 강제"
              hint="responseMimeType"
            />
          </div>

          <Panel
            title={`프롬프트 · ${active.name}`}
            hint={`쓰는 테이블: ${active.writes}`}
            onCopy={() => navigator.clipboard.writeText(current.prompt)}
          >
            <textarea
              value={current.prompt}
              onChange={(event) => patch(activeId, { prompt: event.target.value })}
              spellCheck={false}
              className="h-[420px] w-full resize-y bg-transparent p-3 outline-none"
            />
          </Panel>
        </section>

        <section className="flex flex-col gap-3">
          <Panel
            title="입력 JSON"
            hint={active.summary}
            onCopy={() => navigator.clipboard.writeText(current.input)}
          >
            <textarea
              value={current.input}
              onChange={(event) => patch(activeId, { input: event.target.value })}
              spellCheck={false}
              className="h-[220px] w-full resize-y bg-transparent p-3 outline-none"
            />
          </Panel>

          <div className="flex items-center gap-3">
            <button
              onClick={run}
              disabled={current.running || activeId === '01'}
              className="rounded bg-neutral-900 px-4 py-2 text-white disabled:opacity-40 dark:bg-white dark:text-neutral-900"
            >
              {current.running ? '실행 중…' : '실행'}
            </button>

            {canSendToNext && (
              <button
                onClick={sendToNext}
                className="rounded border border-neutral-400 px-3 py-2 dark:border-neutral-600"
              >
                → {active.feedsInto} 입력으로 보내기
              </button>
            )}

            {current.result && <Meta result={current.result} />}
          </div>

          {activeId === '01' && (
            <p className="text-neutral-500">
              01은 원칙 문서다. 단독 호출하지 않고 다른 단계 앞에 붙여 쓴다.
            </p>
          )}

          {current.result && <ResultView result={current.result} />}
        </section>
      </div>
    </main>
  );
}

function Header({ hasApiKey }: { hasApiKey: boolean }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-3 dark:border-neutral-800">
      <div className="flex items-baseline gap-3">
        <h1 className="text-base font-bold">Prompt Lab</h1>
        <span className="rounded bg-amber-200 px-1.5 py-0.5 text-[11px] text-amber-900">
          dev 전용
        </span>
        <span className="text-neutral-500">docs/prompts/logic-auditor.md</span>
      </div>

      {hasApiKey ? (
        <span className="text-emerald-600 dark:text-emerald-400">
          GEMINI_API_KEY 있음
        </span>
      ) : (
        <span className="text-red-600 dark:text-red-400">
          GEMINI_API_KEY 없음 — .env.local에 넣고 dev 서버를 다시 시작하세요
        </span>
      )}
    </header>
  );
}

function StageRail({
  stages,
  activeId,
  state,
  onSelect,
}: {
  stages: Stage[];
  activeId: StageId;
  state: Record<StageId, StageState>;
  onSelect: (id: StageId) => void;
}) {
  return (
    <nav className="flex flex-wrap gap-2">
      {stages.map((stage) => {
        const result = state[stage.id].result;
        const status = !result
          ? 'idle'
          : !result.ok
            ? 'error'
            : result.checks.some((check) => check.level === 'fail')
              ? 'fail'
              : result.checks.some((check) => check.level === 'warn')
                ? 'warn'
                : 'pass';

        return (
          <button
            key={stage.id}
            onClick={() => onSelect(stage.id)}
            className={`flex items-center gap-2 rounded border px-3 py-1.5 ${
              stage.id === activeId
                ? 'border-neutral-900 dark:border-neutral-100'
                : 'border-neutral-300 dark:border-neutral-700'
            }`}
          >
            <StatusDot status={status} />
            <span className="text-neutral-500">{stage.id}</span>
            <span>{stage.name}</span>
          </button>
        );
      })}
    </nav>
  );
}

function StatusDot({ status }: { status: 'idle' | 'pass' | 'warn' | 'fail' | 'error' }) {
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

function ResultView({ result }: { result: RunResult }) {
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
      <Panel title="스키마 검증" hint="COM-002 기준">
        <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
          {result.checks.map((check, index) => (
            <CheckRow key={`${check.label}-${index}`} check={check} />
          ))}
        </ul>
      </Panel>

      <Panel
        title="출력 원문"
        onCopy={() => navigator.clipboard.writeText(result.raw)}
      >
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
      {check.detail && (
        <span className="text-neutral-500">{check.detail}</span>
      )}
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

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex items-center gap-1.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
      {hint && <span className="text-neutral-500">{hint}</span>}
    </label>
  );
}
