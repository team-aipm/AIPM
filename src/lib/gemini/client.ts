import 'server-only';

/**
 * Gemini REST API 호출.
 *
 * SDK를 쓰지 않고 fetch로 직접 호출한다. COM-005 §14 "새 외부 라이브러리를
 * 임의로 도입하지 않는다"와, package.json이 공통 코드라 단독 PR이어야 한다는
 * 제약(COM-005 §6) 때문이다. 필요해지면 그때 SDK 도입을 제안한다.
 *
 * GEMINI_API_KEY는 서버에만 둔다. NEXT_PUBLIC_ 접두어를 붙이지 않는다.
 */

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

export type GeminiUsage = {
  prompt_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
};

export type GeminiResult =
  | { ok: true; text: string; usage: GeminiUsage; elapsed_ms: number }
  | { ok: false; error: string; elapsed_ms: number };

export type GeminiRequest = {
  model: string;
  /** 프롬프트 본문. Gemini의 systemInstruction으로 보낸다. */
  system: string;
  /** 단계 입력. JSON 문자열을 그대로 넣는다. */
  input: string;
  temperature?: number;
  /**
   * true면 responseMimeType을 application/json으로 지정한다.
   * 프롬프트가 JSON만 내도록 강제되어 있는지 확인하려면 false로 두고
   * 모델이 실제로 무엇을 내는지 봐야 한다. (docs/prompts §1 공통 규칙)
   */
  forceJsonMimeType?: boolean;
};

export function hasGeminiApiKey(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

export async function callGemini(req: GeminiRequest): Promise<GeminiResult> {
  const startedAt = Date.now();
  const elapsed = () => Date.now() - startedAt;

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return {
      ok: false,
      error:
        'GEMINI_API_KEY가 없습니다. .env.local에 넣고 dev 서버를 다시 시작하세요. (DEV-004 §2)',
      elapsed_ms: elapsed(),
    };
  }

  if (!req.model.trim()) {
    return { ok: false, error: '모델명이 비어 있습니다.', elapsed_ms: elapsed() };
  }

  let response: Response;
  try {
    response = await fetch(
      `${ENDPOINT}/${encodeURIComponent(req.model.trim())}:generateContent`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: req.system }] },
          contents: [{ role: 'user', parts: [{ text: req.input }] }],
          generationConfig: {
            temperature: req.temperature ?? 0,
            ...(req.forceJsonMimeType
              ? { responseMimeType: 'application/json' }
              : {}),
          },
        }),
      },
    );
  } catch (cause) {
    return {
      ok: false,
      error: `요청을 보내지 못했습니다: ${String(cause)}`,
      elapsed_ms: elapsed(),
    };
  }

  const raw = await response.text();

  if (!response.ok) {
    return {
      ok: false,
      error: `Gemini ${response.status}\n${raw.slice(0, 2000)}`,
      elapsed_ms: elapsed(),
    };
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      error: `응답이 JSON이 아닙니다.\n${raw.slice(0, 2000)}`,
      elapsed_ms: elapsed(),
    };
  }

  const text = extractText(body);
  if (text === null) {
    return {
      ok: false,
      error: `응답에서 텍스트를 찾지 못했습니다. 안전 필터에 걸렸을 수 있습니다.\n${JSON.stringify(body).slice(0, 2000)}`,
      elapsed_ms: elapsed(),
    };
  }

  return { ok: true, text, usage: extractUsage(body), elapsed_ms: elapsed() };
}

function extractText(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null;
  const candidates = (body as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return null;

  const parts = (candidates[0] as { content?: { parts?: unknown } })?.content
    ?.parts;
  if (!Array.isArray(parts)) return null;

  const text = parts
    .map((part) => (part as { text?: unknown }).text)
    .filter((value): value is string => typeof value === 'string')
    .join('');

  return text.length > 0 ? text : null;
}

function extractUsage(body: unknown): GeminiUsage {
  const meta = (body as { usageMetadata?: Record<string, unknown> })
    ?.usageMetadata;
  const num = (value: unknown) => (typeof value === 'number' ? value : null);

  return {
    prompt_tokens: num(meta?.promptTokenCount),
    output_tokens: num(meta?.candidatesTokenCount),
    total_tokens: num(meta?.totalTokenCount),
  };
}
