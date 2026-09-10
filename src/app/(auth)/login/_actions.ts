'use server';

/**
 * AUTH-001 로그인.
 *
 * **부모와 아이가 같은 칸에 친다.** `@` 가 있으면 부모의 이메일이고, 없으면
 * 아이의 아이디다(`lib/constants/student-login.ts`). 「보호자용」/「학생용」
 * 을 고르게 하면 아이가 고르는 것부터 틀린다.
 *
 * 들어간 뒤 가는 곳이 다르다.
 *
 * ```text
 *   부모   /students   누구로 시작할지 고른다
 *   아이   /home       고를 것이 없다. 자기 자신이다
 * ```
 */

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { endSession } from '@/lib/supabase/sign-out';
import { EVENT, recordOnce } from '@/lib/analytics/events';
import { STUDENT_COOKIE } from '@/lib/constants/student-cookie';
import { emailForLoginId, isValidLoginId, looksLikeEmail } from '@/lib/constants/student-login';
import { studentIdOfViewer } from '@/lib/services/student-login';

export type SignInState = { error: string | null };

/** 어느 쪽이 틀렸는지 알려주지 않는다. 아래 주석 참고 */
const WRONG = '이메일이나 아이디, 또는 비밀번호가 맞지 않습니다.';

export async function signIn(
  _prev: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const typed = String(formData.get('login') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');

  if (typed === '' || password === '') {
    return { error: '아이디(또는 이메일)와 비밀번호를 모두 입력해주세요.' };
  }

  // 아이디 모양이 아니면 Auth 를 부르지 않는다. 어차피 그런 계정이 없다.
  if (!looksLikeEmail(typed) && !isValidLoginId(typed)) {
    return { error: WRONG };
  }

  const email = looksLikeEmail(typed) ? typed : emailForLoginId(typed);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error !== null) {
    // **어느 쪽이 틀렸는지 알려주지 않는다.** "그런 이메일 없음" 은 가입
    // 여부를 확인해 주는 답이라, 남의 이메일을 넣어 보며 회원인지 알아낼
    // 수 있다. 아이디도 마찬가지다 — 남의 아이 아이디를 찾아낼 수 있다.
    return { error: WRONG };
  }

  const { data: me } = await supabase.auth.getUser();
  if (me.user === null) return { error: WRONG };

  const studentId = await studentIdOfViewer(supabase, me.user.id);

  if (studentId !== null) {
    // 아이다. 고를 것이 없으므로 자기 자신을 쿠키에 넣고 바로 홈으로
    // 보낸다. 홈과 미션 화면은 이 쿠키만 보므로 손댈 것이 없다.
    const jar = await cookies();
    jar.set(STUDENT_COOKIE, studentId, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
    redirect('/home');
  }

  // 부모다. 가입 순간에는 세션이 없어 남길 수 없었던 것을 여기서 남긴다.
  // **아이 로그인은 가입이 아니므로 세지 않는다** — 퍼널이 어긋난다.
  await recordOnce(supabase, EVENT.signupCompleted, { accountId: me.user.id });

  // redirect 는 예외를 던져 흐름을 끊는다. try 안에 두면 안 된다.
  redirect('/students');
}

export async function signOut(): Promise<void> {
  await endSession();
  redirect('/login');
}
