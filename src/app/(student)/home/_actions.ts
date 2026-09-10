'use server';

/**
 * STU-004 홈 · 미션 시작.
 *
 * **세션을 여는 일은 여기서 한다.** 화면을 여는 것(GET)만으로 DB 에 행이
 * 생기면, 새로고침할 때마다 세션이 늘고 어드민의 세션 수가 부풀려진다.
 * 학생이 버튼을 눌렀을 때만 연다.
 */

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { endSession } from '@/lib/supabase/sign-out';
import { getStudent } from '@/lib/services/student';
import { openTodaySession, hasEarlierSession } from '@/lib/services/learning-session';
import { EVENT, record } from '@/lib/analytics/events';
import { STUDENT_COOKIE } from '@/lib/constants/student-cookie';

export async function startMission(): Promise<void> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (auth.user === null) redirect('/login');

  const jar = await cookies();
  const studentId = jar.get(STUDENT_COOKIE)?.value ?? '';
  const student = studentId === '' ? null : await getStudent(supabase, studentId);
  if (student === null) redirect('/students');

  const everBefore = await hasEarlierSession(supabase, student.student_id);
  const { session, resumed } = await openTodaySession(supabase, student.student_id);

  const who = { studentId: student.student_id, sessionId: session.session_id };

  if (resumed) {
    await record(supabase, EVENT.sessionResumed, who);
  } else if (!everBefore) {
    // 이 학생의 **첫 학습**이다. 퍼널의 마지막 칸(ADM-002)이 이 값이다.
    await record(supabase, EVENT.firstLearningStarted, who);
  }

  redirect('/mission');
}

/**
 * 나가기 (STU-004).
 *
 * **아이 계정에는 여기가 유일한 출구다.** 부모 영역의 「계정 관리」에도
 * 로그아웃이 있지만 아이는 그곳에 못 들어간다.
 */
export async function leaveApp(): Promise<void> {
  await endSession();
  redirect('/login');
}
