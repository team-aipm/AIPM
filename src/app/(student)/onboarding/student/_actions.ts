'use server';

/**
 * STU-001 첫 학생 등록.
 *
 * 부모가 가입한 뒤 학생을 만든다. 학생은 부모 계정 안의 프로필이면서,
 * **아이가 직접 들어올 수 있는 계정이기도 하다**(COM-002 §4-1).
 *
 * 만드는 일 자체는 `lib/services/student-registration` 이 한다. MY-004
 * 학생 추가도 같은 것을 부른다 — 학년 검사 같은 규칙이 한쪽만 바뀌면 안
 * 된다(DEV-002 §3).
 *
 * **여기서만 하는 일은 그 다음이다.** 부모 홈으로 보낸다.
 *
 * 전에는 쿠키를 심고 `STU-003`(파트너 선택)으로 이어 갔다. 이제 파트너는
 * 아이가 자기 계정에서 고르고, 부모는 학생 화면에 들어가지 않는다. 심을
 * 쿠키도 갈 곳도 없다.
 */

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { readStudentForm, registerStudent } from '@/lib/services/student-registration';
import { checkLoginEmailFree, type IdCheck } from '@/lib/services/student-login';
import { requireParent } from '@/lib/services/viewer';
import type { NewStudentState } from '@/components/student/StudentForm';

/**
 * 아이디를 쓸 수 있는지 본다. 폼이 치는 동안 부른다.
 *
 * **부모만 부를 수 있다.** 이 답은 "그 아이디를 쓰는 아이가 있다" 를
 * 알려주는 것이라, 아무나 부르게 두면 남의 아이 아이디를 찾아낼 수 있다
 * (`AUTH-001` 이 로그인 실패 이유를 안 알려주는 것과 같은 이유다).
 */
export async function checkLoginId(loginEmail: string): Promise<IdCheck> {
  await requireParent();
  return checkLoginEmailFree(loginEmail);
}

export async function addStudent(
  _prev: NewStudentState,
  formData: FormData,
): Promise<NewStudentState> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (auth.user === null) redirect('/login');

  const result = await registerStudent(
    supabase,
    auth.user.id,
    readStudentForm(formData),
  );
  if (!result.ok) return { error: result.error };

  // 등록이 끝났다. 부모는 자기 화면으로 돌아간다. 아이는 방금 정해 준
  // 아이디로 자기 기기에서 들어온다.
  redirect('/parent');
}
