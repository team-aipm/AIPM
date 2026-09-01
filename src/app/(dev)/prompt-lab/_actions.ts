'use server';

import { notFound } from 'next/navigation';

import { callGemini, hasGeminiApiKey } from '@/lib/gemini/client';
import { checkStageOutput, type Check } from '@/lib/ai/schema-check';
import { COMMON_RULES } from '@/lib/ai/prompts/common-rules';
import type { StageId } from '@/lib/ai/prompts/stages';

/**
 * prompt-lab 전용 실행 Action.
 *
 * DB를 건드리지 않으므로 lib/services를 거치지 않는다. Gemini 호출과
 * 스키마 검사만 한다.
 */

export type RunInput = {
  stageId: StageId;
  model: string;
  /** 화면에서 편집한 프롬프트. COMMON_RULES가 앞에 붙는다. */
  prompt: string;
  /** 단계 입력 JSON */
  input: string;
  includeCommonRules: boolean;
  forceJsonMimeType: boolean;
};

export type RunResult = {
  ok: boolean;
  /** 모델이 낸 원문 */
  raw: string;
  /** 실패 시 사유 */
  error: string | null;
  checks: Check[];
  elapsed_ms: number;
  tokens: { prompt: number | null; output: number | null; total: number | null };
};

export async function checkApiKey(): Promise<boolean> {
  assertDevOnly();
  return hasGeminiApiKey();
}

export async function runStage(request: RunInput): Promise<RunResult> {
  assertDevOnly();

  const empty = {
    tokens: { prompt: null, output: null, total: null },
    checks: [] as Check[],
    raw: '',
  };

  // 입력 JSON이 깨져 있으면 호출 전에 잡는다. 토큰을 낭비할 이유가 없다.
  try {
    JSON.parse(request.input);
  } catch (cause) {
    return {
      ...empty,
      ok: false,
      error: `입력 JSON을 파싱하지 못했습니다.\n${String(cause)}`,
      elapsed_ms: 0,
    };
  }

  const system = request.includeCommonRules
    ? `${COMMON_RULES}\n\n---\n\n${request.prompt}`
    : request.prompt;

  const result = await callGemini({
    model: request.model,
    system,
    input: request.input,
    forceJsonMimeType: request.forceJsonMimeType,
  });

  if (!result.ok) {
    return {
      ...empty,
      ok: false,
      error: result.error,
      elapsed_ms: result.elapsed_ms,
    };
  }

  const report = checkStageOutput(request.stageId, result.text);

  return {
    ok: true,
    raw: result.text,
    error: null,
    checks: report.checks,
    elapsed_ms: result.elapsed_ms,
    tokens: {
      prompt: result.usage.prompt_tokens,
      output: result.usage.output_tokens,
      total: result.usage.total_tokens,
    },
  };
}

/**
 * 개발 서버에서만 동작한다. 빌드된 앱에서는 page가 이미 404지만,
 * Server Action은 별도 엔드포인트로 노출되므로 여기서도 막는다.
 */
function assertDevOnly() {
  if (process.env.NODE_ENV === 'production') notFound();
}
