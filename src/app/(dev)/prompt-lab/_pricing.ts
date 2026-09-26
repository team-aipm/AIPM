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
  /**
   * 캐시에서 읽은 입력 100만 토큰당 USD.
   *
   * **할인율이 회사마다 다르다.** 하나로 뭉뚱그리면 틀린 금액을 그럴듯하게
   * 보여주게 된다 — 이 파일이 피하려는 바로 그것이다.
   *
   * 값이 없으면 캐시 토큰도 제값으로 친다. 실제보다 많이 나오지만,
   * 모르는 할인을 지어내는 것보다 낫다. 화면에서 채워 넣을 수 있다.
   */
  cachedInput?: number;
};

/**
 * 시작용 가격표. **확인하고 쓴다.**
 *
 * Gemini    ai.google.dev/gemini-api/docs/pricing 에서 2026-09-01 확인.
 * OpenAI    developers.openai.com/api/docs/pricing 에서 2026-09-01 확인.
 *           Standard 요금이다. Batch·Flex·Fast 는 단가가 다르다.
 * Anthropic 2026-06-24 기준 확인값.
 *
 * 셋 다 텍스트 생성 모델만 넣었다. 임베딩·TTS·이미지 생성은 단가 체계가
 * 달라서(장당 과금 등) 제외했다.
 *
 * 가격이 없으면 계산하지 않고 화면이 "가격 미입력" 이라고 알린다.
 * 틀린 숫자를 그럴듯하게 보여주는 것보다 낫다.
 *
 * **주의 — 여기 값은 단순화된 수치다.**
 *   · 오디오 입력은 텍스트보다 비싼 모델이 있다. 텍스트 단가를 넣었다.
 *   · 긴 문맥(200k 초과)에 다른 단가를 매기는 모델이 있다. 낮은 쪽을
 *     넣었으므로 긴 입력에서는 실제보다 적게 나온다.
 *   · Batch·Flex 는 할인 요금이라 해당하면 직접 고쳐야 한다.
 *   · 캐시 단가(`cachedInput`)는 Gemini 만 채워 두었다. OpenAI · Anthropic
 *     은 할인율이 모델 계열마다 달라 확인 없이 적지 않았다 — 필요하면
 *     화면에서 넣는다. 비어 있으면 캐시 토큰도 제값으로 쳐서 실제보다
 *     많게 나온다.
 */
export const SEED_PRICES: Record<string, Price> = {
  // Gemini · 텍스트 기준
  'gemini-3.6-flash': { input: 1.5, output: 7.5, cachedInput: 0.375 },
  'gemini-3.5-flash': { input: 1.5, output: 9, cachedInput: 0.375 },
  'gemini-3.5-flash-lite': { input: 0.3, output: 2.5, cachedInput: 0.075 },
  'gemini-3.1-flash-lite': { input: 0.25, output: 1.5, cachedInput: 0.0625 },
  // 200k 이하 기준. 초과하면 입력 $4 / 출력 $18
  'gemini-3.1-pro-preview': { input: 2, output: 12, cachedInput: 0.5 },
  'gemini-3-flash-preview': { input: 0.5, output: 3, cachedInput: 0.125 },
  // 200k 이하 기준. 초과하면 입력 $2.5 / 출력 $15
  'gemini-2.5-pro': { input: 1.25, output: 10, cachedInput: 0.3125 },
  'gemini-2.5-flash': { input: 0.3, output: 2.5, cachedInput: 0.075 },
  'gemini-2.5-flash-lite': { input: 0.1, output: 0.4, cachedInput: 0.025 },

  // OpenAI · Standard 요금. Batch·Flex·Fast 는 단가가 달라 직접 고쳐 쓴다
  'gpt-5.6-sol': { input: 4, output: 20 },
  'gpt-5.6-terra': { input: 2, output: 12 },
  'gpt-5.6-luna': { input: 0.2, output: 1.2 },
  'gpt-5.5-pro': { input: 30, output: 180 },
  'gpt-5.5': { input: 5, output: 30 },
  'gpt-5.4-pro': { input: 30, output: 180 },
  'gpt-5.4-mini': { input: 0.75, output: 4.5 },
  'gpt-5.4-nano': { input: 0.2, output: 1.25 },
  'gpt-5.4': { input: 2.5, output: 15 },
  'gpt-5.2-pro': { input: 21, output: 168 },
  'gpt-5.2': { input: 1.75, output: 14 },
  'gpt-5.1': { input: 1.25, output: 10 },
  'gpt-5-pro': { input: 15, output: 120 },
  'gpt-5-mini': { input: 0.25, output: 2 },
  'gpt-5-nano': { input: 0.05, output: 0.4 },
  'gpt-5': { input: 1.25, output: 10 },
  'gpt-4.1-mini': { input: 0.4, output: 1.6 },
  'gpt-4.1-nano': { input: 0.1, output: 0.4 },
  'gpt-4.1': { input: 2, output: 8 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4o': { input: 2.5, output: 10 },
  'o4-mini': { input: 1.1, output: 4.4 },
  'o3-mini': { input: 1.1, output: 4.4 },
  'o3-pro': { input: 20, output: 80 },
  'o3': { input: 2, output: 8 },

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
  openai: 'developers.openai.com/api/docs/pricing',
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

/**
 * 토큰 수와 가격으로 USD 비용을 낸다. 토큰이나 가격이 없으면 null.
 *
 * **캐시 토큰은 입력에 포함된 수다**(`_providers.ts` 에서 셋을 그 뜻으로
 * 맞춰 둔다). 그래서 더하지 않고 **빼서 따로 곱한다.**
 *
 *   제값 입력 = prompt - cached
 *   캐시 입력 = cached × cachedInput
 *
 * `cachedInput` 이 없으면 전부 제값으로 친다.
 */
export function costOf(
  price: Price | null,
  tokens: { prompt: number | null; output: number | null; cached?: number | null },
): number | null {
  if (price === null) return null;
  if (tokens.prompt === null && tokens.output === null) return null;

  const prompt = tokens.prompt ?? 0;
  // 캐시가 입력보다 많을 수는 없다. 이상한 값이 와도 음수로 새지 않게 막는다.
  const cached =
    price.cachedInput === undefined ? 0 : Math.min(Math.max(tokens.cached ?? 0, 0), prompt);

  const inCost = ((prompt - cached) / 1_000_000) * price.input;
  const cacheCost = (cached / 1_000_000) * (price.cachedInput ?? 0);
  const outCost = ((tokens.output ?? 0) / 1_000_000) * price.output;
  return inCost + cacheCost + outCost;
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
  if (won === 0) return '0원';
  if (won < 1) return `${won.toFixed(2)}원`;
  return `${Math.round(won).toLocaleString('ko-KR')}원`;
}
