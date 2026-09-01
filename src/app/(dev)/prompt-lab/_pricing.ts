/**
 * 모델 가격표와 비용 계산.
 *
 * **가격은 코드가 아니라 화면에서 관리한다.** 모델 목록이 낡았던 것과
 * 같은 이유다. 가격은 예고 없이 바뀌고, 새 모델이 나오면 여기 없다.
 * 아래 표는 처음 열었을 때 채워지는 값일 뿐이며 화면에서 고칠 수 있고,
 * 고친 값은 설정과 함께 저장된다.
 *
 * 단위는 **100만 토큰당 USD** 다. 각 사의 요금 페이지가 그 단위로 적는다.
 */

export type Price = {
  /** 입력 100만 토큰당 USD */
  input: number;
  /** 출력 100만 토큰당 USD */
  output: number;
};

/**
 * 시작용 가격표. **확인하고 쓴다.**
 *
 * Gemini    ai.google.dev/gemini-api/docs/pricing 에서 2026-09-01 확인.
 *           텍스트 생성 모델만 넣었다. 임베딩·TTS·이미지 생성은 단가
 *           체계가 달라서(장당 과금 등) 제외했다.
 * Anthropic 2026-06-24 기준 확인값.
 * OpenAI    확인된 출처가 없어 비워 둔다.
 *
 * 가격이 없으면 계산하지 않고 화면이 "가격 미입력" 이라고 알린다.
 * 틀린 숫자를 그럴듯하게 보여주는 것보다 낫다.
 *
 * **주의 — 여기 값은 단순화된 수치다.**
 *   · 오디오 입력은 텍스트보다 비싼 모델이 있다. 텍스트 단가를 넣었다.
 *   · 긴 문맥(200k 초과)에 다른 단가를 매기는 모델이 있다. 낮은 쪽을
 *     넣었으므로 긴 입력에서는 실제보다 적게 나온다.
 *   · Batch·Flex 는 50% 할인이라 해당하면 직접 고쳐야 한다.
 */
export const SEED_PRICES: Record<string, Price> = {
  // Gemini · 텍스트 기준
  'gemini-3.6-flash': { input: 1.5, output: 7.5 },
  'gemini-3.5-flash': { input: 1.5, output: 9 },
  'gemini-3.5-flash-lite': { input: 0.3, output: 2.5 },
  'gemini-3.1-flash-lite': { input: 0.25, output: 1.5 },
  // 200k 이하 기준. 초과하면 입력 $4 / 출력 $18
  'gemini-3.1-pro-preview': { input: 2, output: 12 },
  'gemini-3-flash-preview': { input: 0.5, output: 3 },
  // 200k 이하 기준. 초과하면 입력 $2.5 / 출력 $15
  'gemini-2.5-pro': { input: 1.25, output: 10 },
  'gemini-2.5-flash': { input: 0.3, output: 2.5 },
  'gemini-2.5-flash-lite': { input: 0.1, output: 0.4 },

  // Anthropic
  'claude-fable-5': { input: 10, output: 50 },
  'claude-opus-5': { input: 5, output: 25 },
  'claude-opus-4-8': { input: 5, output: 25 },
  'claude-opus-4-7': { input: 5, output: 25 },
  'claude-opus-4-6': { input: 5, output: 25 },
  'claude-sonnet-5': { input: 2, output: 10 },
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-haiku-4-5': { input: 1, output: 5 },
};

/** 요금 페이지. 화면에서 안내로 쓴다. */
export const PRICING_PAGES: Record<string, string> = {
  gemini: 'ai.google.dev/gemini-api/docs/pricing',
  openai: 'openai.com/api/pricing',
  anthropic: 'anthropic.com/pricing',
};

/**
 * 모델명으로 가격을 찾는다.
 *
 * 정확히 일치하는 이름을 먼저 보고, 없으면 가장 긴 접두어를 쓴다.
 * `claude-opus-5-20260101` 같은 변형 이름도 `claude-opus-5` 값으로 잡힌다.
 */
export function findPrice(
  table: Record<string, Price>,
  model: string,
): { price: Price; matched: string } | null {
  const name = model.trim();
  if (name === '') return null;

  const exact = table[name];
  if (exact) return { price: exact, matched: name };

  let best: { price: Price; matched: string } | null = null;
  for (const [key, price] of Object.entries(table)) {
    if (!name.startsWith(key)) continue;
    if (best === null || key.length > best.matched.length) {
      best = { price, matched: key };
    }
  }
  return best;
}

/** 토큰 수와 가격으로 USD 비용을 낸다. 토큰이나 가격이 없으면 null. */
export function costOf(
  price: Price | null,
  tokens: { prompt: number | null; output: number | null },
): number | null {
  if (price === null) return null;
  if (tokens.prompt === null && tokens.output === null) return null;

  const inCost = ((tokens.prompt ?? 0) / 1_000_000) * price.input;
  const outCost = ((tokens.output ?? 0) / 1_000_000) * price.output;
  return inCost + outCost;
}

/** 아주 작은 금액도 0 으로 보이지 않게 자릿수를 늘린다. */
export function formatUsd(value: number): string {
  if (value === 0) return '$0';
  if (value < 0.01) return `$${value.toFixed(6)}`;
  if (value < 1) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(2)}`;
}

export function formatKrw(usd: number, rate: number): string {
  const won = usd * rate;
  if (won < 1) return `${won.toFixed(2)}원`;
  return `${Math.round(won).toLocaleString('ko-KR')}원`;
}
