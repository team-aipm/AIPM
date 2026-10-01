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
import { openTodaySession, hasEarlierSession, findPastSession } from '@/lib/services/learning-session';
import { EVENT, record } from '@/lib/analytics/events';
import { PAST_SESSION_COOKIE, STUDENT_COOKIE } from '@/lib/constants/student-cookie';

export async function startMission(): Promise<void> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (auth.user === null) redirect('/login');

  const jar = await cookies();
  const studentId = jar.get(STUDENT_COOKIE)?.value ?? '';
  const student = studentId === '' ? null : await getStudent(supabase, studentId);
  if (student === null) redirect('/students');

  // 오늘 미션을 고른 것이다. 이어 하던 지난 미션 표시를 지운다 — 남아 있으면
  // 미션 화면이 지난 세션을 연다(`mission/_session.ts`).
  jar.delete(PAST_SESSION_COOKIE);

  const everBefore = await hasEarlierSession(supabase, student.student_id);
  const { session, resumed } = await openTodaySession(supabase, student.student_id);

  // **오늘 몫을 다 했으면 미션으로 보내지 않는다** (COM-001 §11-2). 하단 Nav 의
  // 「학습하기」도 이 액션을 부른다 — 홈 카드 버튼은 끝나면 「오늘의 기록」으로
  // 바뀌지만 Nav 는 그대로라, 여기를 안 막으면 끝낸 세션에 문제가 더 생긴다.
  if (session.session_status === 'completed' || session.completed_problem_count >= session.target_problem_count) {
    redirect('/home/today');
  }

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
 * STU-006 지난 미션 · 이어하기 (COM-001 §11-2).
 *
 * 고른 세션을 쿠키에 적고 미션 화면으로 보낸다. 적기 전에 **이어 할 수 있는
 * 것인지 본다** — 본인 것 · 7일 안 · 아직 안 끝남. 아니면 지난 미션 목록으로
 * 돌려보낸다(만료 상태가 그려진다).
 */
export async function continuePastMission(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (auth.user === null) redirect('/login');

  const jar = await cookies();
  const studentId = jar.get(STUDENT_COOKIE)?.value ?? '';
  const student = studentId === '' ? null : await getStudent(supabase, studentId);
  if (student === null) redirect('/students');

  const sessionId = String(formData.get('session_id') ?? '');
  const past = await findPastSession(supabase, student.student_id, sessionId);
  if (past === null) redirect(`/missions/past?expired=${encodeURIComponent(sessionId)}`);

  // 브라우저를 닫으면 사라진다. 다음에 들어오면 오늘 미션부터다.
  jar.set(PAST_SESSION_COOKIE, past.session_id, { httpOnly: true, sameSite: 'lax', path: '/' });
  await record(supabase, EVENT.sessionResumed, { studentId: student.student_id, sessionId: past.session_id });
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
