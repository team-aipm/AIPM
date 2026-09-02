'use server';

import { notFound } from 'next/navigation';

import { isConfigured, isUnlocked, unlockWith } from './_access';

import { hasGeminiApiKey } from '@/lib/gemini/client';
import {
  callProvider,
  listModels,
  type ModelListResult,
  type SamplingParams,
} from './_providers';
import type { Attachment, ProviderId } from './_provider-meta';
import {
  checkOutput,
  type Check,
  type CheckRuleId,
  type OutputMode,
} from '@/lib/ai/schema-check';
import { checkFieldRules, type CustomRules } from './_field-rules';

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
  /** 화면에서 직접 만든 규칙. `checkRule` 과 함께 돈다 */
  rules: CustomRules;
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

/** 프로바이더에서 실제 모델 목록을 받아온다. 코드에 적힌 후보는 낡는다. */
export async function fetchModels(
  provider: ProviderId,
  apiKey: string,
): Promise<ModelListResult> {
  await assertAccess();
  return listModels(provider, apiKey);
}

/** 통과 암호 확인. 맞으면 쿠키를 심는다. */
export async function unlock(input: string): Promise<boolean> {
  if (!isConfigured()) notFound();
  return unlockWith(input);
}

export async function checkApiKey(): Promise<boolean> {
  await assertAccess();
  return hasGeminiApiKey();
}

export async function runStage(request: RunInput): Promise<RunResult> {
  await assertAccess();

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

  // 두 검사를 이어 붙인다. 프리셋 규칙과 직접 만든 규칙은 서로를
  // 대체하지 않는다. 하나만 쓰는 쪽이 훨씬 흔하지만 둘 다 켤 수 있다.
  const custom = checkFieldRules(
    request.rules ?? { fields: [], banned: '' },
    report.parsed,
    result.text,
  );

  return {
    ok: true,
    raw: result.text,
    error: null,
    checks: [...report.checks, ...custom],
    elapsed_ms: result.elapsed_ms,
    tokens: {
      prompt: result.usage.prompt_tokens,
      output: result.usage.output_tokens,
      total: result.usage.total_tokens,
    },
  };
}

/**
 * Server Action 은 page 와 **별개의 엔드포인트**로 노출된다. page 가
 * 잠겨 있어도 여기로 직접 요청이 들어올 수 있으므로 매번 다시 확인한다.
 */
async function assertAccess() {
  if (!isConfigured()) notFound();
  if (!(await isUnlocked())) notFound();
}
