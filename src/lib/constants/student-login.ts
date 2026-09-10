/**
 * 아이 로그인 아이디 (COM-005 §9 · COM-002 §4)
 *
 * Supabase Auth 는 이메일로만 로그인한다. 그런데 **아이에게 이메일 주소를
 * 받지 않는다** — 만 14세 미만에게서 굳이 더 걷지 않기로 했다(COM-007).
 *
 * 그래서 아이디를 서버에서 가짜 이메일로 바꿔 Auth 에 넘긴다.
 *
 * ```text
 *   아이가 치는 것        jaeun2016
 *   Auth 가 받는 것       jaeun2016@student.aipm.invalid
 * ```
 *
 * **이 주소로는 메일이 오갈 수 없다.** `.invalid` 는 그러라고 예약된
 * TLD 다(RFC 2606) — 누가 실수로 등록할 수도 없다. 그래서 아이 계정에는
 * 이메일로 비밀번호를 재설정하는 길이 없다. 부모가 마이페이지에서
 * 바꿔 준다(MY-003).
 */

/** 도메인을 바꾸면 이미 만든 아이 계정은 로그인하지 못한다. 함부로 고치지 않는다 */
export const STUDENT_EMAIL_DOMAIN = 'student.aipm.invalid';

/**
 * 영문 소문자 · 숫자 · 밑줄, 4~20자.
 *
 * DB 의 `student_login_id_format` 제약과 **같은 글자로 맞춰 둔다**. 한쪽만
 * 고치면 화면은 받아 놓고 저장에서 터진다.
 */
export const LOGIN_ID_PATTERN = /^[a-z0-9_]{4,20}$/;

export function isValidLoginId(value: string): boolean {
  return LOGIN_ID_PATTERN.test(value);
}

export function emailForLoginId(loginId: string): string {
  return `${loginId}@${STUDENT_EMAIL_DOMAIN}`;
}

/**
 * 로그인 칸에 들어온 글이 이메일인가 아이디인가.
 *
 * **칸을 두 개로 나누지 않는다.** `@` 가 있으면 부모의 이메일이고, 없으면
 * 아이의 아이디다. 「보호자용」/「학생용」 을 고르게 하면 아이가 고르는
 * 것부터 틀린다.
 */
export function looksLikeEmail(value: string): boolean {
  return value.includes('@');
}
