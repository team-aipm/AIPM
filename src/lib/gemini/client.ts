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

/**
 * 안전 설정을 **코드에 적어 둔다.**
 *
 * 지금까지 아무것도 보내지 않아 모델 기본값에 맡기고 있었다. 기본값은
 * 제공자가 바꿀 수 있고, 바뀌어도 우리는 모른다. **초등학생이 쓰는
 * 서비스**에서 그 값이 조용히 느슨해지는 것을 두고 볼 수는 없다.
 *
 * ```text
 * 성적 표현        BLOCK_LOW_AND_ABOVE       한 칸 더 엄하게
 * 괴롭힘 · 혐오     BLOCK_MEDIUM_AND_ABOVE    문서상의 기본값
 * 위험 행동        BLOCK_MEDIUM_AND_ABOVE    문서상의 기본값
 * ```
 *
 * **성적 표현만 한 칸 올렸다.** 수학 학습 대화에서 잘못 걸릴 일이 거의
 * 없는 항목이라 올려도 잃는 것이 없다.
 *
 * **나머지는 올리지 않았다.** 「사탕을 셋이 나눠 먹는데 하나가 깨졌다」
 * 같은 문장이 위험 항목에 낮은 점수로 걸릴 수 있다. 엄하게 할수록 멀쩡한
 * 문제가 막히고, 아이는 이유를 모른 채 같은 화면을 다시 본다. 아이를
 * 지키는 일과 학습을 막는 일은 다르다.
 *
 * **느슨하게 하는 쪽(`BLOCK_NONE`)은 쓰지 않는다.** 어떤 이유로도.
 */
const SAFETY_SETTINGS = [
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_LOW_AND_ABOVE' },
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
] as const;

/** 응답이 잘린 것이 아니라 **막힌** 것임을 뜻하는 값들 */
const BLOCKED_FINISH = new Set([
  'SAFETY',
  'PROHIBITED_CONTENT',
  'BLOCKLIST',
  'SPII',
  'IMAGE_SAFETY',
]);

export type GeminiUsage = {
  prompt_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  /**
   * 그중 **캐시에서 온 것**. `prompt_tokens` 안에 포함된 수다 — 더하면 안 된다.
   *
   * Gemini 2.5 부터 implicit caching 이 기본으로 켜져 있다. 프롬프트 앞부분이
   * 직전 호출과 같고 일정 길이를 넘으면 그만큼 싸게 친다(75% 할인, 저장 비용
   * 없음). 우리가 부르는 방식(`systemInstruction` 에 큰 고정 덩어리, 변하는
   * 것은 `contents`)은 이미 그 모양이다.
   *
   * **`null` 과 `0` 은 다르다.**
   *   null  응답에 그 칸이 없었다 — 모델이 캐싱을 아예 안 하거나 옛 모델이다
   *   0     칸은 있는데 못 맞혔다 — 프롬프트가 바뀌었거나 길이가 모자라다
   *
   * 이 값을 읽기 전에는 캐싱이 걸리는지조차 알 수 없었다. 쓰는 모델
   * (`gemini-3.1-flash-lite`)이 캐싱 최소 길이 표에 없어서 더 그렇다.
   */
  cached_tokens: number | null;
};

/**
 * 왜 실패했나. **부르는 쪽이 학생에게 할 말을 고르는 데 쓴다.**
 *
 * ```text
 * blocked     안전 필터가 막았다. 입력이 막힌 것과 출력이 막힌 것 둘 다
 * truncated   길이에 걸려 잘렸다. JSON 이면 읽을 수 없다
 * other       그 밖 (통신 · 5xx · JSON 아님 · 키 없음)
 * ```
 *
 * 전에는 셋이 한 문구로 나갔다 — 「잠깐 멈췄어. 다시 한 번 말해줄래?」.
 * 안전 필터에 걸린 아이는 같은 말을 다시 해도 같은 화면을 보게 되고,
 * 왜 그런지 알 길이 없었다.
 */
export type GeminiFailure = 'blocked' | 'truncated' | 'other';

export type GeminiResult =
  | { ok: true; text: string; usage: GeminiUsage; elapsed_ms: number }
  | { ok: false; kind: GeminiFailure; error: string; elapsed_ms: number };

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
      kind: 'other',
      error:
        'API 키가 없습니다. 화면 상단에 입력하거나, .env.local의 GEMINI_API_KEY를 채우고 dev 서버를 다시 시작하세요.',
      elapsed_ms: elapsed(),
    };
  }

  if (!req.model.trim()) {
    return { ok: false, kind: 'other', error: '모델명이 비어 있습니다.', elapsed_ms: elapsed() };
  }

  /**
   * 응답이 안 오면 끊는다.
   *
   * **없으면 영원히 기다린다.** 자동 실행이 두 번 그렇게 멈췄다 —
   * 오류도 재시도도 없이 화면만 「도는 중」이었다. `withRetry` 는 503 같은
   * **돌아온 오류**를 다시 부를 뿐, 안 돌아오는 것은 다루지 못한다.
   *
   * 제품에서는 더 나쁘다. 아이가 답을 기다리다 아무 일도 안 일어난다.
   * 끊어야 "잠깐 멈췄어. 다시 말해줄래?" 라도 보여줄 수 있다.
   *
   * 60초는 넉넉하다. 오늘 가장 오래 걸린 호출이 21초였다.
   */
  const TIMEOUT_MS = 60_000;
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);

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
          safetySettings: SAFETY_SETTINGS,
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
        signal: abort.signal,
      },
    );
  } catch (cause) {
    // 끊긴 것과 못 보낸 것을 나눠 말한다. 부르는 쪽이 다시 부를지
    // 정해야 하는데, "요청을 보내지 못했습니다" 로 뭉치면 알 수 없다.
    if (abort.signal.aborted) {
      return {
        ok: false,
        kind: 'other',
        error: `응답이 ${TIMEOUT_MS / 1000}초 안에 오지 않아 끊었습니다.`,
        elapsed_ms: elapsed(),
      };
    }
    return {
      ok: false,
      kind: 'other',
      error: `요청을 보내지 못했습니다: ${String(cause)}`,
      elapsed_ms: elapsed(),
    };
  } finally {
    clearTimeout(timer);
  }

  const raw = await response.text();

  if (!response.ok) {
    return {
      ok: false,
      kind: 'other',
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
      kind: 'other',
      error: `응답이 JSON이 아닙니다.\n${raw.slice(0, 2000)}`,
      elapsed_ms: elapsed(),
    };
  }

  /**
   * **막힌 것을 먼저 본다.** 텍스트가 있느냐보다 앞이다.
   *
   * 길이에 걸려 잘린 응답(`MAX_TOKENS`)은 텍스트가 **있다.** 그대로
   * 넘기면 반쪽 JSON 이 다음 단계로 흘러가 「JSON 으로 읽지 못했습니다」가
   * 되고, 진짜 원인(너무 길었다)이 사라진다.
   */
  const promptBlock = blockReasonOf(body);
  if (promptBlock !== null) {
    // **입력이 막혔다.** 모델은 아무 말도 하지 않았다.
    //
    // 이유 값만 남긴다. 전에는 응답 본문을 2,000자까지 오류에 붙였는데,
    // 그 글이 `recordAiFailure` 를 지나 DB 로 간다 — 무엇이 들어 있을지
    // 모르는 것을 아이 기록 옆에 쌓지 않는다(COM-002 §14).
    return {
      ok: false,
      kind: 'blocked',
      error: `차단됨(입력 · ${promptBlock})`,
      elapsed_ms: elapsed(),
    };
  }

  const stop = finishReasonOf(body);

  if (stop !== null && BLOCKED_FINISH.has(stop)) {
    return {
      ok: false,
      kind: 'blocked',
      error: `차단됨(출력 · ${stop})`,
      elapsed_ms: elapsed(),
    };
  }

  if (stop === 'MAX_TOKENS') {
    return {
      ok: false,
      kind: 'truncated',
      error: '응답이 길이 제한에 걸려 잘렸습니다(MAX_TOKENS).',
      elapsed_ms: elapsed(),
    };
  }

  const text = extractText(body);
  if (text === null) {
    return {
      ok: false,
      kind: 'other',
      error: `응답에서 텍스트를 찾지 못했습니다(finishReason: ${stop ?? '없음'}).`,
      elapsed_ms: elapsed(),
    };
  }

  return { ok: true, text, usage: extractUsage(body), elapsed_ms: elapsed() };
}

/** 입력 자체가 막혔을 때 `promptFeedback.blockReason` 에 이유가 온다 */
function blockReasonOf(body: unknown): string | null {
  const feedback = (body as { promptFeedback?: { blockReason?: unknown } })?.promptFeedback;
  const reason = feedback?.blockReason;
  return typeof reason === 'string' && reason !== '' ? reason : null;
}

/** 모델이 왜 멈췄나. `STOP` 이 정상이다 */
function finishReasonOf(body: unknown): string | null {
  const candidates = (body as { candidates?: unknown })?.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  const reason = (candidates[0] as { finishReason?: unknown })?.finishReason;
  return typeof reason === 'string' && reason !== '' ? reason : null;
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
    cached_tokens: num(meta?.cachedContentTokenCount),
  };
}
