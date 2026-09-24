/**
 * 「로그인 유지」 (AUTH-001 · Figma `통합 로그인`)
 *
 * **Supabase 에는 이런 스위치가 없다.** `signInWithPassword` 는 세션을 항상
 * 같은 방식으로 저장한다. 그래서 우리가 쿠키 수명을 직접 손봐야 한다.
 *
 * ```text
 *   켜짐   Supabase 가 준 만료시각 그대로  → 브라우저를 닫아도 남는다
 *   꺼짐   만료시각을 지운다               → 브라우저를 닫으면 사라진다
 * ```
 *
 * 끈 것을 **어딘가에 적어 둬야 한다.** 토큰은 미들웨어가 수시로 갱신하면서
 * 쿠키를 다시 쓰는데, 그때 이 표시가 없으면 만료시각이 되살아난다. 한 번
 * 껐는데 며칠 뒤 다시 로그인된 채로 열리는 일이 그래서 생긴다.
 *
 * **이 표시 자체도 브라우저를 닫으면 사라진다.** 남겨 둘 이유가 없다 —
 * 세션이 이미 없는데 「유지 안 함」 만 남아 있어 봐야 할 일이 없다.
 *
 * 형제가 한 대를 함께 쓰는 경우(유저 케이스 3)가 이 스위치의 이유다.
 */

/** 값이 있으면 「유지 안 함」 이다. 없으면 유지한다(기본값) */
export const REMEMBER_COOKIE = 'meti-remember';

export const REMEMBER_OFF = '0';

/** 만료시각이 없는 쿠키 = 세션 쿠키. 브라우저가 닫히면 같이 사라진다 */
type Expiring = { maxAge?: number; expires?: Date };

export function untilBrowserCloses<T extends Expiring>(options: T): T {
  const next = { ...options };
  delete next.maxAge;
  delete next.expires;
  return next;
}
