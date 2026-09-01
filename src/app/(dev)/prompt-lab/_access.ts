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
 * 서버에서 키를 대신 써 줄지.
 *
 * 배포본에서는 쓰지 않는다. 잠금을 통과한 사람이라도 세팅 담당 개인의
 * Gemini 키로 무제한 호출하게 두지 않는다. 각자 화면에 자기 키를 넣는다.
 */
export function allowServerApiKey(): boolean {
  return !isProduction();
}
