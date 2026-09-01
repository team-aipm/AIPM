'use server';

import { notFound } from 'next/navigation';

import { hasGeminiApiKey } from '@/lib/gemini/client';
import { callProvider, type SamplingParams } from './_providers';
import type { Attachment, ProviderId } from './_provider-meta';
import {
  checkOutput,
  type Check,
  type CheckRuleId,
  type OutputMode,
} from '@/lib/ai/schema-check';

/**
 * prompt-lab 전용 실행 Action.
 *
 * DB를 건드리지 않으므로 lib/services를 거치지 않는다. 모델 호출과
 * 출력 검사만 한다.
 *
 * apiKey는 화면에서 받아 해당 프로바이더로 그대로 보낸다. 저장하지 않고,
 * 로그에 남기지 않고, 반환값에도 넣지 않는다.
 */

export type RunInput = {
  provider: ProviderId;
  model: string;
  /** systemInstruction 전문. 공통 프롬프트 결합은 화면에서 끝낸다 */
  system: string;
  /** 단계 입력 */
  input: string;
  inputMode: OutputMode;
  outputMode: OutputMode;
  checkRule: CheckRuleId | null;
  forceJsonMimeType: boolean;
  params: SamplingParams;
  images: Attachment[];
  /** 비우면 서버의 GEMINI_API_KEY를 쓴다 */
  apiKey: string;
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

  // 입력을 JSON으로 다루는 단계면 호출 전에 파싱해 본다. 토큰을 낭비할
  // 이유가 없다. 평문 입력 단계는 그대로 보낸다.
  //
  // 입력 형식은 출력 형식과 별개다. 평문을 넣고 JSON을 받는 단계가 있다.
  if (request.inputMode === 'json') {
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
  }

  const result = await callProvider({
    provider: request.provider,
    model: request.model,
    system: request.system,
    input: request.input,
    forceJson: request.forceJsonMimeType,
    apiKey: request.apiKey,
    params: request.params,
    images: request.images,
  });

  if (!result.ok) {
    return {
      ...empty,
      ok: false,
      error: result.error,
      elapsed_ms: result.elapsed_ms,
    };
  }

  const report = checkOutput({
    outputMode: request.outputMode,
    rule: request.checkRule,
    raw: result.text,
  });

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
