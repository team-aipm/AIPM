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

/** 첨부 이미지. data 는 base64 본문만. */
export type GeminiImage = { mediaType: string; data: string };

export type GeminiRequest = {
  model: string;
  /** 프롬프트 본문. Gemini의 systemInstruction으로 보낸다. */
  system: string;
  /** 단계 입력. JSON 문자열을 그대로 넣는다. */
  input: string;
  /** 비우면(null) 보내지 않는다. 모델 기본값이 쓰인다 */
  temperature?: number | null;
  /** 비우면(null) 보내지 않는다 */
  maxOutputTokens?: number | null;
  /** 비우면(null) 보내지 않는다 */
  topP?: number | null;
  /**
   * true면 responseMimeType을 application/json으로 지정한다.
   * 프롬프트가 JSON만 내도록 강제되어 있는지 확인하려면 false로 두고
   * 모델이 실제로 무엇을 내는지 봐야 한다. (docs/prompts §1 공통 규칙)
   */
  forceJsonMimeType?: boolean;
  /**
   * 화면에서 입력한 키. 비우면 GEMINI_API_KEY 환경변수를 쓴다.
   *
   * 저장하지 않는다. 로그에 남기지 않는다. 오류 메시지에 넣지 않는다.
   * 단계마다 다른 키·다른 프로젝트로 시험할 수 있게 하기 위한 값이다.
   */
  apiKey?: string;
  /** 사용자 파트에 함께 보낼 이미지 */
  images?: GeminiImage[];
};

export function hasGeminiApiKey(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

export async function callGemini(req: GeminiRequest): Promise<GeminiResult> {
  const startedAt = Date.now();
  const elapsed = () => Date.now() - startedAt;

  // 배포본에서는 서버 키를 **대신** 써 주지 않는다. 잠금을 통과한 사람이라도
  // 세팅 담당 개인의 키로 무제한 호출하게 두지 않는다 — 개발 도구
  // (`/prompt-lab`)를 위한 방어다. 도구는 화면에서 키를 받는다.
  //
  // **제품은 다르다.** 학생에게 API 키를 입력하라고 할 수 없다. 그래서
  // 제품 경로(`lib/ai/pipeline/run.ts`)는 서버 키를 `apiKey` 로 직접
  // 넘긴다. 여기서 자동으로 집어 주지 않는 규칙은 그대로 둔다 — 부르는
  // 쪽이 무엇을 쓰는지 코드에 드러나야 한다.
  const serverKey =
    process.env.NODE_ENV === 'production' ? '' : process.env.GEMINI_API_KEY?.trim();
  const apiKey = req.apiKey?.trim() || serverKey;
  if (!apiKey) {
    return {
      ok: false,
      error:
        'API 키가 없습니다. 화면 상단에 입력하거나, .env.local의 GEMINI_API_KEY를 채우고 dev 서버를 다시 시작하세요.',
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
          contents: [
            {
              role: 'user',
              parts: [
                ...(req.images ?? []).map((image) => ({
                  inlineData: { mimeType: image.mediaType, data: image.data },
                })),
                { text: req.input },
              ],
            },
          ],
          // 지정하지 않은 값은 키 자체를 넣지 않는다. 빈 값을 0으로 바꿔
          // 보내면 사용자가 의도하지 않은 설정이 적용된다.
          generationConfig: {
            ...(req.temperature != null ? { temperature: req.temperature } : {}),
            ...(req.maxOutputTokens != null
              ? { maxOutputTokens: req.maxOutputTokens }
              : {}),
            ...(req.topP != null ? { topP: req.topP } : {}),
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
