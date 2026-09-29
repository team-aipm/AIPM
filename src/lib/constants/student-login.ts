/**
 * 아이 로그인 (COM-007 §2-2 · COM-002 §4)
 *
 * **아이도 이메일로 들어온다.** 로그인 화면은 부모와 아이가 같다.
 *
 * ## 전에는 아이디를 받았다 (2026-09-29 개정)
 *
 * Supabase Auth 는 이메일로만 로그인한다. 아이에게 이메일을 받지 않기로
 * 했던 때에는 아이디를 서버가 가짜 이메일로 바꿔 넘겼다.
 *
 * ```text
 *   아이가 치는 것        jaeun2016
 *   Auth 가 받는 것       jaeun2016@student.aipm.invalid
 * ```
 *
 * 로그인·회원가입 정책 v0.1 §7 이 **아이 계정도 로그인 이메일로 만들도록**
 * 정하면서 그 장치가 없어졌다. 부모가 **아이가 이미 쓰는 이메일**을
 * 입력한다.
 *
 * **아이 이메일이 없으면 계정을 만들 수 없다.** 부모가 먼저 만들어 주어야
 * 한다 — 초등 4~6학년에게 이메일이 없는 경우가 적지 않다.
 *
 * ## 아이는 스스로 비밀번호를 바꾸지 못한다
 *
 * 실제 이메일이 생기면서 `/password` 로 아이가 직접 재설정할 수 있게
 * 됐지만, 정책 §8 이 금지한다. 서버가 막는다(`password/_actions.ts`).
 * 재설정은 부모가 마이페이지에서 한다(MY-003).
 */

/**
 * 이메일 모양인가.
 *
 * **로그인 칸이 하나다.** 부모든 아이든 이메일을 친다. 「보호자용」/
 * 「학생용」 을 고르게 하면 아이가 고르는 것부터 틀린다.
 *
 * `hello@meti` 처럼 도메인이 덜 적힌 것을 걸러 준다. 느슨하게 두면
 * Auth 를 부르고 나서야 틀린 것을 알게 된다.
 */
const EMAIL = /^[^\s@]+@[^\s@.]+\.[^\s@]+$/;

export function looksLikeEmail(value: string): boolean {
  return EMAIL.test(value.trim());
}

/**
 * 비밀번호 규칙 (정책 v0.1 §3.2 · §7)
 *
 * **영문과 숫자를 함께 쓴 8자 이상.** 부모와 아이가 같은 규칙이다.
 * 전에는 8자 이상만 보고 조합은 「권장」 이라고만 적었다.
 */
export const PASSWORD_MIN = 8;

export function isValidPassword(value: string): boolean {
  return value.length >= PASSWORD_MIN && /[A-Za-z]/.test(value) && /[0-9]/.test(value);
}

export const PASSWORD_RULE_TEXT = '영문과 숫자를 섞어 8자 이상으로 해주세요.';
