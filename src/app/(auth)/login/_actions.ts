'use server';

/**
 * AUTH-001 로그인.
 *
 * `lib/services` 를 부르는 얇은 래퍼로 둔다(DEV-001). 인증은 Supabase Auth
 * 가 통째로 맡으므로 여기에는 서비스 계층이 없다 — 우리 테이블을 건드리지
 * 않기 때문이다(COM-005 §9).
 */

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { EVENT, recordOnce } from '@/lib/analytics/events';

export type SignInState = { error: string | null };

export async function signIn(
  _prev: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (email === '' || password === '') {
    return { error: '이메일과 비밀번호를 모두 입력해주세요.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error !== null) {
    // **어느 쪽이 틀렸는지 알려주지 않는다.** "그런 이메일 없음" 은 가입
    // 여부를 확인해 주는 답이라, 남의 이메일을 넣어 보며 회원인지 알아낼
    // 수 있다.
    return { error: '이메일이나 비밀번호가 맞지 않습니다.' };
  }

  // 가입 순간에는 세션이 없어 남길 수 없었던 것을 여기서 남긴다.
  // 이미 있으면 넘어간다.
  const { data: me } = await supabase.auth.getUser();
  if (me.user !== null) {
    await recordOnce(supabase, EVENT.signupCompleted, { accountId: me.user.id });
  }

  // redirect 는 예외를 던져 흐름을 끊는다. try 안에 두면 안 된다.
  redirect('/students');
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
