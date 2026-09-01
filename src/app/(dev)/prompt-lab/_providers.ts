import 'server-only';

import { callGemini, type GeminiResult } from '@/lib/gemini/client';
import type { ProviderId } from './_provider-meta';

/**
 * prompt-lab 전용 멀티 프로바이더 호출.
 *
 * **이 파일이 `src/lib`이 아니라 dev route 안에 있는 이유:**
 * COM-005 §14는 기술 스택을 임의로 바꾸거나 새 외부 서비스를 도입하지
 * 말라고 한다. 제품은 Gemini만 쓴다. OpenAI·Anthropic 은 프롬프트를
 * 비교하기 위한 개발 도구에서만 쓰므로, 제품 코드가 실수로 import 할 수
 * 없도록 `(dev)` 안에 둔다. (DEV-001 §2 규칙 6)
 *
 * SDK를 설치하지 않고 REST를 직접 호출한다. package.json 은 공통 코드라
 * 단독 PR 대상이고(COM-005 §6), 제품이 쓰지도 않을 SDK 두 개를 의존성에
 * 넣는 것은 §14 취지에 어긋난다.
 *
 * OpenAI·Anthropic 키는 환경변수를 두지 않는다. 화면에서만 입력받는다.
 * 새 환경변수 이름은 팀 합의 사항이다. (COM-005 §8)
 */

export type ProviderRequest = {
  provider: ProviderId;
  model: string;
  system: string;
  input: string;
  apiKey: string;
  forceJson: boolean;
};

export type ProviderResult = GeminiResult;

export async function callProvider(req: ProviderRequest): Promise<ProviderResult> {
  switch (req.provider) {
    case 'gemini':
      return callGemini({
        model: req.model,
        system: req.system,
        input: req.input,
        apiKey: req.apiKey,
        forceJsonMimeType: req.forceJson,
      });
    case 'openai':
      return callOpenAi(req);
    case 'anthropic':
      return callAnthropic(req);
  }
}

// ── OpenAI ───────────────────────────────────────────────────────────────

async function callOpenAi(req: ProviderRequest): Promise<ProviderResult> {
  const started = Date.now();
  const elapsed = () => Date.now() - started;

  if (!req.apiKey.trim()) {
    return { ok: false, error: 'OpenAI API 키를 입력하세요.', elapsed_ms: elapsed() };
  }

  // temperature·max_tokens 를 보내지 않는다. 추론 계열 모델은 temperature 를
  // 거부하고 max_tokens 대신 max_completion_tokens 를 쓴다. 기본값에 맡기면
  // 모델 계열이 바뀌어도 그대로 동작한다.
  const body = {
    model: req.model.trim(),
    messages: [
      { role: 'system', content: req.system },
      { role: 'user', content: req.input },
    ],
    ...(req.forceJson ? { response_format: { type: 'json_object' } } : {}),
  };

  const response = await safeFetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${req.apiKey.trim()}`,
    },
    body: JSON.stringify(body),
  });

  if ('error' in response) {
    return { ok: false, error: response.error, elapsed_ms: elapsed() };
  }

  const { raw, ok, status } = response;
  if (!ok) {
    return { ok: false, error: `OpenAI ${status}\n${raw.slice(0, 2000)}`, elapsed_ms: elapsed() };
  }

  const parsed = parseJson(raw);
  if (parsed === null) {
    return { ok: false, error: `응답이 JSON이 아닙니다.\n${raw.slice(0, 2000)}`, elapsed_ms: elapsed() };
  }

  const choice = (parsed as { choices?: unknown[] }).choices?.[0];
  const text = (choice as { message?: { content?: unknown } })?.message?.content;

  if (typeof text !== 'string' || text.length === 0) {
    const reason = (choice as { finish_reason?: unknown })?.finish_reason;
    return {
      ok: false,
      error: `응답에서 텍스트를 찾지 못했습니다. finish_reason=${String(reason)}\n${raw.slice(0, 1500)}`,
      elapsed_ms: elapsed(),
    };
  }

  const usage = (parsed as { usage?: Record<string, unknown> }).usage;
  return {
    ok: true,
    text,
    elapsed_ms: elapsed(),
    usage: {
      prompt_tokens: num(usage?.prompt_tokens),
      output_tokens: num(usage?.completion_tokens),
      total_tokens: num(usage?.total_tokens),
    },
  };
}

// ── Anthropic ────────────────────────────────────────────────────────────

async function callAnthropic(req: ProviderRequest): Promise<ProviderResult> {
  const started = Date.now();
  const elapsed = () => Date.now() - started;

  if (!req.apiKey.trim()) {
    return { ok: false, error: 'Claude API 키를 입력하세요.', elapsed_ms: elapsed() };
  }

  // temperature 를 보내지 않는다. 현재 Claude 모델(Opus 5 · Sonnet 5 ·
  // Opus 4.7/4.8 · Fable 5)은 sampling 파라미터를 받으면 400 을 낸다.
  // max_tokens 는 필수다.
  const body = {
    model: req.model.trim(),
    max_tokens: 16000,
    system: req.system,
    messages: [{ role: 'user', content: req.input }],
  };

  const response = await safeFetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': req.apiKey.trim(),
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if ('error' in response) {
    return { ok: false, error: response.error, elapsed_ms: elapsed() };
  }

  const { raw, ok, status } = response;
  if (!ok) {
    return { ok: false, error: `Anthropic ${status}\n${raw.slice(0, 2000)}`, elapsed_ms: elapsed() };
  }

  const parsed = parseJson(raw);
  if (parsed === null) {
    return { ok: false, error: `응답이 JSON이 아닙니다.\n${raw.slice(0, 2000)}`, elapsed_ms: elapsed() };
  }

  const message = parsed as {
    content?: unknown[];
    stop_reason?: unknown;
    stop_details?: { category?: unknown; explanation?: unknown };
    usage?: Record<string, unknown>;
  };

  // 거부는 예외가 아니라 200 응답으로 온다. stop_reason 을 먼저 본다.
  if (message.stop_reason === 'refusal') {
    const detail = message.stop_details;
    return {
      ok: false,
      error: `모델이 요청을 거부했습니다. category=${String(detail?.category)}\n${String(detail?.explanation ?? '')}`,
      elapsed_ms: elapsed(),
    };
  }

  const text = (message.content ?? [])
    .filter((block): block is { type: string; text: string } => {
      const candidate = block as { type?: unknown; text?: unknown };
      return candidate.type === 'text' && typeof candidate.text === 'string';
    })
    .map((block) => block.text)
    .join('');

  if (text.length === 0) {
    return {
      ok: false,
      error: `응답에 text 블록이 없습니다. stop_reason=${String(message.stop_reason)}\n${raw.slice(0, 1500)}`,
      elapsed_ms: elapsed(),
    };
  }

  const input = num(message.usage?.input_tokens);
  const output = num(message.usage?.output_tokens);

  return {
    ok: true,
    text,
    elapsed_ms: elapsed(),
    usage: {
      prompt_tokens: input,
      output_tokens: output,
      total_tokens: input !== null && output !== null ? input + output : null,
    },
  };
}

// ── 공통 ─────────────────────────────────────────────────────────────────

type FetchOutcome =
  | { raw: string; ok: boolean; status: number }
  | { error: string };

async function safeFetch(url: string, init: RequestInit): Promise<FetchOutcome> {
  try {
    const response = await fetch(url, init);
    return { raw: await response.text(), ok: response.ok, status: response.status };
  } catch (cause) {
    return { error: `요청을 보내지 못했습니다: ${String(cause)}` };
  }
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function num(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}
