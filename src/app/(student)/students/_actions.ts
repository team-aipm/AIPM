'use server';

/**
 * STU-002 학생 선택.
 *
 * 고른 학생을 쿠키에 둔다. **URL 에 두지 않는다** — 주소창에 학생 id 가
 * 남으면 화면을 캡처하거나 링크를 나눌 때 그대로 새어 나간다.
 *
 * 쿠키 값이 남의 학생 id 여도 RLS 가 행을 안 돌려주므로 화면에는 아무것도
 * 안 나온다. 쿠키는 "누구를 보고 있는가" 일 뿐 권한이 아니다.
 */

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { STUDENT_COOKIE } from '@/lib/constants/student-cookie';
import { endSession } from '@/lib/supabase/sign-out';

export async function selectStudent(formData: FormData): Promise<void> {
  const studentId = String(formData.get('student_id') ?? '');
  if (studentId === '') redirect('/students');

  const jar = await cookies();
  jar.set(STUDENT_COOKIE, studentId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });

  redirect('/home');
}

/** 로그아웃 (STU-002). 부모가 계정을 바꿀 때 여기가 가장 가까운 출구다 */
export async function leaveApp(): Promise<void> {
  await endSession();
  redirect('/login');
}
