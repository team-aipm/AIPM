import 'server-only';

import { createHash, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

/**
 * prompt-lab 접근 통제.
 *
 * 이 도구는 원래 개발 서버 전용이었다. 배포본에서도 열기로 하면서
 * 잠금이 필요해졌다. 주소만 알면 누구나 들어오고, 서버의 Gemini 키가
 * 그대로 쓰이기 때문이다.
 *
 * 규칙
 *   개발 서버        항상 열림. 암호를 묻지 않는다
 *   배포본           PROMPT_LAB_PASSCODE 가 있어야 열린다
 *   암호 미설정      404. 열어두는 쪽이 아니라 닫는 쪽으로 실패한다
 *
 * 학생·부모 데이터를 다루지 않는 도구이므로 Supabase Auth 를 끌어오지
 * 않는다. 팀 내부용 공용 암호 하나로 충분하다.
 */

const COOKIE = 'prompt_lab_access';

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

function passcode(): string {
  return process.env.PROMPT_LAB_PASSCODE?.trim() ?? '';
}

/** 배포본에서 암호가 설정되어 있는가. 없으면 route 자체를 닫는다. */
export function isConfigured(): boolean {
  return !isProduction() || passcode().length > 0;
}

/** 쿠키에 넣는 값. 원문 암호를 브라우저에 저장하지 않는다. */
function token(): string {
  return createHash('sha256').update(`prompt-lab:${passcode()}`).digest('hex');
}

function sameToken(candidate: string): boolean {
  const expected = Buffer.from(token(), 'utf8');
  const actual = Buffer.from(candidate, 'utf8');
  // 길이가 다르면 timingSafeEqual 이 throw 한다. 먼저 확인한다.
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

export async function isUnlocked(): Promise<boolean> {
  if (!isProduction()) return true;
  if (passcode().length === 0) return false;

  const value = (await cookies()).get(COOKIE)?.value;
  return typeof value === 'string' && sameToken(value);
}

/** 암호가 맞으면 쿠키를 심는다. 맞으면 true. */
export async function unlockWith(input: string): Promise<boolean> {
  const expected = passcode();
  if (expected.length === 0) return false;

  const a = Buffer.from(input.trim(), 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;

  (await cookies()).set(COOKIE, token(), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/prompt-lab',
    maxAge: 60 * 60 * 12,
  });
  return true;
}

/**
 * 이 도구가 대신 써 줄 Gemini 키.
 *
 * 없으면 빈 문자열이다. 그때는 각자 화면에 자기 키를 넣어야 한다.
 *
 * ## 제품 키(`GEMINI_API_KEY`)를 쓰지 않는 이유
 *
 * 배포본의 랩은 암호만 알면 들어온다. 거기서 제품 키를 쓰게 하면 **학생이
 * 쓸 몫을 도구가 갉아먹는다.** 어디서 얼마나 썼는지도 구분되지 않는다.
 *
 * `PROMPT_LAB_GEMINI_API_KEY` 는 따로 발급한 키다. 한도를 따로 걸 수 있고,
 * 새면 이것만 버리면 된다. 제품은 멈추지 않는다.
 *
 * 개발 서버에서는 지금까지처럼 `GEMINI_API_KEY` 로 물러난다 — 내 기계의
 * 내 키다.
 */
export function labApiKey(): string {
  const own = process.env.PROMPT_LAB_GEMINI_API_KEY?.trim() ?? '';
  if (own !== '') return own;
  return isProduction() ? '' : (process.env.GEMINI_API_KEY?.trim() ?? '');
}

/** 화면의 「키 출처」 표시등에 쓴다 */
export function allowServerApiKey(): boolean {
  return labApiKey() !== '';
}
