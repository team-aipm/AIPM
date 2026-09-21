'use server';

/**
 * MY-004 학생 추가.
 *
 * 만드는 일은 STU-001 과 같은 것을 부른다(`student-registration`).
 * **다른 것은 그 다음이다.**
 *
 * ```text
 * STU-001  부모 홈으로      가입 직후라 볼 것이 거기 있다
 * MY-004   학생 프로필로    방금 넣은 것이 맞는지 거기서 보인다
 * ```
 *
 * 파트너는 받지 않는다. 아이가 자기 계정에서 고른다(COM-003 §4.2).
 */

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { readStudentForm, registerStudent } from '@/lib/services/student-registration';
import { checkLoginIdFree, type IdCheck } from '@/lib/services/student-login';
import { requireParent } from '@/lib/services/viewer';
import type { NewStudentState } from '@/components/student/StudentForm';

/**
 * 아이디를 쓸 수 있는지 본다. 폼이 치는 동안 부른다.
 *
 * **부모만 부를 수 있다.** 이 답은 "그 아이디를 쓰는 아이가 있다" 를
 * 알려주는 것이라, 아무나 부르게 두면 남의 아이 아이디를 찾아낼 수 있다
 * (`AUTH-001` 이 로그인 실패 이유를 안 알려주는 것과 같은 이유다).
 */
export async function checkLoginId(loginId: string): Promise<IdCheck> {
  await requireParent();
  return checkLoginIdFree(loginId);
}

export async function addStudentFromParent(
  _prev: NewStudentState,
  formData: FormData,
): Promise<NewStudentState> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (auth.user === null) redirect('/login');

  const result = await registerStudent(supabase, auth.user.id, readStudentForm(formData));
  if (!result.ok) return { error: result.error };

  // 등록한 아이의 프로필로 보낸다. 방금 넣은 것이 맞는지 거기서 보이고,
  // 파트너 · 아이 로그인도 그 화면에서 고친다.
  redirect(`/parent/my/students/${result.studentId}`);
}
