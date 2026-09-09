'use server';

/**
 * STU-001 첫 학생 등록.
 *
 * 부모가 가입한 뒤 학생을 만든다. **학생 계정이 따로 있는 게 아니라**
 * 부모 계정 안의 프로필이다(COM-002 §4).
 */

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createStudent } from '@/lib/services/student';
import { EVENT, record } from '@/lib/analytics/events';
import { STUDENT_COOKIE } from '@/lib/constants/student-cookie';

export type NewStudentState = { error: string | null };

export async function addStudent(
  _prev: NewStudentState,
  formData: FormData,
): Promise<NewStudentState> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (auth.user === null) redirect('/login');

  const studentName = String(formData.get('student_name') ?? '').trim();
  const nicknameRaw = String(formData.get('nickname') ?? '').trim();
  const birthDate = String(formData.get('birth_date') ?? '').trim();
  const grade = Number(formData.get('grade') ?? 0);

  if (studentName === '' || birthDate === '') {
    return { error: '이름과 생년월일을 채워주세요.' };
  }

  // MVP 는 4~6학년이다(COM-002 §4 · DB CHECK 제약). 화면에서 막고, DB 도
  // 막는다. 한쪽만 막으면 다른 경로로 들어온 값이 통과한다.
  if (grade < 4 || grade > 6) {
    return { error: '지금은 4~6학년만 시작할 수 있어요.' };
  }

  // 닉네임 기본값은 이름이다(COM-002 §4). 무엇을 기본으로 썼는지도 남긴다 —
  // 나중에 "AI 가 왜 이 이름으로 부르지" 를 설명할 수 있어야 한다.
  const usedDefault = nicknameRaw === '';
  const nickname = usedDefault ? studentName : nicknameRaw;

  let studentId: string;
  try {
    const student = await createStudent(supabase, auth.user.id, {
      studentName,
      nickname,
      nicknameSource: usedDefault ? 'name_default' : 'custom',
      birthDate,
      grade,
    });
    studentId = student.student_id;
  } catch (error) {
    console.error(`[onboarding] 학생 등록 실패: ${String(error)}`);
    return { error: '등록하지 못했어요. 잠시 후 다시 해주세요.' };
  }

  await record(supabase, EVENT.studentCreated, {
    accountId: auth.user.id,
    studentId,
  });

  // 다음 화면이 이 학생의 파트너를 정한다. 쿠키로 넘긴다 — 주소창에 학생
  // id 를 남기지 않는다.
  const jar = await cookies();
  jar.set(STUDENT_COOKIE, studentId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });

  redirect('/onboarding/persona');
}
