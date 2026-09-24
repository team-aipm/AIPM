'use server';

/**
 * AUTH-005 비밀번호 찾기 / 재설정 · `/password` (DEV-002 §2)
 *
 * 한 Route 에 두 걸음이 들어 있다. COM-003 §13-3 — State 를 별도 Route 로
 * 만들지 않는다.
 *
 * ```text
 *   1. 메일 보내기      가입한 이메일을 받아 재설정 링크를 보낸다
 *   2. 새 비밀번호      메일 속 링크로 돌아와서 비밀번호를 바꾼다
 * ```
 *
 * **Route Handler 를 만들지 않았다.** 메일 링크는 `?code=` 를 달고 `/password`
 * 로 그냥 돌아온다. 보통 쓰는 `/api/auth/callback` 은 DEV-002 §9 의 Route
 * Handler 목록에 없고, 같은 문서가 "그 외 서버 로직은 Route Handler 를 만들지
 * 않고 Server Action 을 쓴다" 고 못박았다. 그래서 code 를 폼에 싣고 와서
 * **비밀번호를 바꾸는 그 순간에** 세션으로 바꾼다.
 *
 * 덤으로 안전해진다 — 링크를 연 것만으로는 로그인되지 않는다. 메일을 열어
 * 본 사람이 새 비밀번호를 치기 전까지 세션이 생기지 않는다.
 */

import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { endSession } from '@/lib/supabase/sign-out';

// ============================================================
// 1. 메일 보내기
// ============================================================

export type ResetRequestState =
  | { status: 'idle' }
  /** 화면에 그대로 나가는 말이다. 칸 아래 빨간 줄로 붙는다 */
  | { status: 'error'; message: string }
  /**
   * 보냈다. 「메일을 보냈어요」 State 로 넘어간다.
   *
   * `sentAt` 은 화면에 안 나간다. **「다시 받기」 를 눌렀다는 것을 화면이
   * 알아채는 유일한 표시**다 — 이메일도 문구도 그대로라 다른 값이 없다.
   * 이것이 바뀌어야 60초를 처음부터 다시 센다.
   */
  | { status: 'sent'; email: string; sentAt: number };

/**
 * **`looksLikeEmail`(`@` 포함) 로는 모자라다.**
 *
 * 로그인 칸은 부모 이메일과 아이 아이디를 함께 받으므로 느슨한 편이 맞다.
 * 여기는 아니다 — 받는 것이 이메일 하나뿐이라, `hello@meti` 처럼 도메인이
 * 덜 적힌 것을 걸러 주지 않으면 "메일을 보냈어요" 를 본 뒤 오지 않는 메일을
 * 기다리게 된다. 그 사람은 자기가 오타를 냈다는 것을 영영 모른다.
 */
const EMAIL = /^[^\s@]+@[^\s@.]+\.[^\s@]+$/;

export async function requestReset(
  _prev: ResetRequestState,
  formData: FormData,
): Promise<ResetRequestState> {
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();

  if (email === '') {
    return { status: 'error', message: '이메일을 입력해 주세요.' };
  }

  if (!EMAIL.test(email)) {
    return {
      status: 'error',
      message: '이메일 형식이 올바르지 않아요. 다시 확인해 주세요.',
    };
  }

  const supabase = await createClient();

  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await origin()}/password`,
  });

  /**
   * **결과를 보지 않는다.** 가입된 이메일이든 아니든 같은 화면을 보여준다.
   *
   * 로그인 · 회원가입과 같은 규칙이다(`login/_actions.ts` · `signup/_actions.ts`).
   * "그런 계정 없음" 은 남의 이메일을 넣어 보며 회원인지 알아낼 수 있는
   * 답이다. 화면 문구도 「…가입된 이메일이라면 보냈어요」 로 적혀 있다.
   */
  return { status: 'sent', email, sentAt: Date.now() };
}

/**
 * 메일 속 링크가 돌아올 주소.
 *
 * `NEXT_PUBLIC_SITE_URL` 같은 환경변수를 새로 만들지 않았다 — COM-005 에
 * 없는 값이다. 요청 헤더에서 읽으면 로컬 · Preview · 프로덕션이 각자 자기
 * 주소를 쓴다. DEV-003 §4-4 의 Redirect URLs 세 줄이 그대로 맞아떨어진다.
 */
async function origin(): Promise<string> {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

// ============================================================
// 2. 새 비밀번호
// ============================================================

export type NewPasswordState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  /** 링크가 죽었다. 다시 받아야 한다 */
  | { status: 'expired' }
  | { status: 'done' };

export async function setNewPassword(
  _prev: NewPasswordState,
  formData: FormData,
): Promise<NewPasswordState> {
  const code = String(formData.get('code') ?? '');
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('password_confirm') ?? '');

  if (code === '') return { status: 'expired' };

  /**
   * **비밀번호를 먼저 본다.** code 는 한 번 쓰면 죽는다.
   *
   * 순서를 뒤집어 code 를 먼저 세션으로 바꾸면, 비밀번호 확인이 어긋났을 때
   * 이미 code 가 타 버린 뒤다. 다시 치면 이번엔 「링크가 만료됐어요」 가
   * 뜬다 — 사람은 오타 하나 냈을 뿐인데 메일부터 다시 받아야 한다.
   */
  if (password === '' || confirm === '') {
    return { status: 'error', message: '새 비밀번호를 두 칸 모두 입력해 주세요.' };
  }

  if (password.length < 8) {
    return { status: 'error', message: '비밀번호는 8자 이상으로 해주세요.' };
  }

  if (password !== confirm) {
    return { status: 'error', message: '두 비밀번호가 서로 달라요. 다시 확인해 주세요.' };
  }

  const supabase = await createClient();

  const { error: exchangeFailed } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeFailed !== null) {
    /**
     * 만료 말고도 여기로 오는 길이 하나 더 있다 — **메일을 다른 기기나 다른
     * 브라우저에서 연 경우**다. 재설정을 요청한 브라우저에만 남는 값이
     * 있어야 세션으로 바꿀 수 있다. 어느 쪽인지 화면에서 가릴 방법이 없어
     * 문구로 둘 다 덮는다.
     */
    return { status: 'expired' };
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error !== null) {
    return {
      status: 'error',
      message: '비밀번호를 바꾸지 못했어요. 잠시 후 다시 해주세요.',
    };
  }

  /**
   * **바꾼 뒤 세션을 끊는다.** 화면이 「새 비밀번호로 로그인해 주세요」 라고
   * 말하는데 이미 들어와 있으면 말과 화면이 어긋난다. 새 비밀번호를 한 번
   * 쳐 보게 하는 편이 기억에도 남는다.
   *
   * 학생 쿠키도 같이 지워진다 — `endSession` 이 하는 일이다.
   */
  await endSession();

  return { status: 'done' };
}
