'use server';

/**
 * 마이페이지의 쓰기 동작 (MY-003 · MY-005 · MY-006 · MY-008~010).
 *
 * 모두 `lib/services` 를 부르는 얇은 래퍼다(DEV-001). DB 쿼리를 직접 쓰지
 * 않는다.
 */

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { setPersona, softDeleteStudent, restoreStudent } from '@/lib/services/student';
import { createChildLogin, changeChildPassword } from '@/lib/services/student-login';
import { STUDENT_COOKIE } from '@/lib/constants/student-cookie';

export async function changePersona(formData: FormData): Promise<void> {
  const studentId = String(formData.get('student_id') ?? '');
  const persona = String(formData.get('persona') ?? '');
  if (persona !== 'friend' && persona !== 'villain') return;

  const supabase = await createClient();
  await setPersona(supabase, studentId, persona);
  revalidatePath(`/parent/my/students/${studentId}`);
}

/**
 * 학생 삭제 요청 (MY-003 · COM-007 §5-1).
 *
 * **지우지 않는다.** `deleted_pending` 으로 두고 30일 안에는 되돌릴 수
 * 있다. 학습기록은 1년 뒤에 지운다.
 */
export async function requestDeleteStudent(formData: FormData): Promise<void> {
  const studentId = String(formData.get('student_id') ?? '');
  const supabase = await createClient();
  await softDeleteStudent(supabase, studentId);
  redirect('/parent/my/students');
}

export async function undoDeleteStudent(formData: FormData): Promise<void> {
  const studentId = String(formData.get('student_id') ?? '');
  const supabase = await createClient();
  await restoreStudent(supabase, studentId);
  redirect('/parent/my/students');
}

/** MY-006 마케팅 수신설정. 3종을 각각 받는다(COM-002 §3 · COM-007 §9) */
export async function saveMarketing(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (auth.user === null) redirect('/login');

  const { error } = await supabase
    .from('account')
    .update({
      marketing_email_opt_in: formData.get('marketing_email_opt_in') === 'on',
      marketing_sms_opt_in: formData.get('marketing_sms_opt_in') === 'on',
      marketing_alimtalk_opt_in: formData.get('marketing_alimtalk_opt_in') === 'on',
      // 언제 바꿨는지가 동의 이력이다(COM-002 §3).
      marketing_consent_updated_at: new Date().toISOString(),
    })
    .eq('account_id', auth.user.id);

  if (error !== null) throw new Error(`저장하지 못했습니다: ${error.message}`);
  revalidatePath('/parent/my/marketing');
}

export async function signOutAccount(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();

  // 고른 학생도 함께 지운다. 남기면 다음 사람이 남의 학생 id 를 물고 있다.
  const jar = await cookies();
  jar.delete(STUDENT_COOKIE);

  redirect('/login');
}

// ============================================================
// MY-003 아이 로그인
// ============================================================

/**
 * 성공하면 `error` 가 null 이고 `done` 이 무엇을 했는지 말한다.
 * 화면이 그 자리에서 결과를 보여줘야 해서 던지지 않고 돌려준다.
 */
export type ChildLoginState = { error: string | null; done: string | null };

export async function makeChildLogin(
  _prev: ChildLoginState,
  formData: FormData,
): Promise<ChildLoginState> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (auth.user === null) redirect('/login');

  const studentId = String(formData.get('student_id') ?? '');
  const result = await createChildLogin(supabase, auth.user.id, {
    studentId,
    loginId: String(formData.get('login_id') ?? ''),
    password: String(formData.get('password') ?? ''),
  });

  if (!result.ok) return { error: result.error, done: null };

  revalidatePath(`/parent/my/students/${studentId}`);
  return { error: null, done: '아이 로그인을 만들었습니다.' };
}

export async function resetChildPassword(
  _prev: ChildLoginState,
  formData: FormData,
): Promise<ChildLoginState> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (auth.user === null) redirect('/login');

  const studentId = String(formData.get('student_id') ?? '');
  const result = await changeChildPassword(supabase, auth.user.id, {
    studentId,
    password: String(formData.get('password') ?? ''),
  });

  if (!result.ok) return { error: result.error, done: null };

  revalidatePath(`/parent/my/students/${studentId}`);
  return { error: null, done: '비밀번호를 바꿨습니다.' };
}
