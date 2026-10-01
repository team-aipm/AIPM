/**
 * LearningSession (COM-002 §5) · 하루 학습 단위.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

type Client = SupabaseClient<Database>;
export type LearningSession = Database['public']['Tables']['learning_session']['Row'];

/** 하루는 학생이 사는 곳의 날짜다. UTC 로 자르면 밤 9시에 날이 바뀐다 */
export function today(timeZone = 'Asia/Seoul'): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date());
}

/**
 * 오늘 세션. 없으면 `null`.
 *
 * 아직 시작 안 한 것과 다 끝낸 것을 구분하지 않는다 — 부르는 쪽이
 * `session_status` 로 판단한다.
 */
export async function findTodaySession(
  client: Client,
  studentId: string,
): Promise<LearningSession | null> {
  const { data, error } = await client
    .from('learning_session')
    .select('*')
    .eq('student_id', studentId)
    .eq('session_date', today())
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error !== null) throw new Error(`오늘 학습을 불러오지 못했습니다: ${error.message}`);
  return data;
}

/**
 * 오늘 세션을 잇거나 새로 연다.
 *
 * **하루에 한 세션이다.** 오늘 것이 이미 있으면 그걸 그대로 쓴다 — 앱을
 * 닫았다 다시 들어온 것을 새 세션으로 세면 "오늘 몇 문제" 가 초기화되고,
 * 어드민의 세션 수도 부풀려진다.
 *
 * 다 끝낸 세션(`completed`)이면 다시 열지 않고 그대로 돌려준다. 오늘 몫을
 * 끝낸 뒤 또 시작할지는 COM-001 이 정할 일이라 여기서 정하지 않는다.
 */
export async function openTodaySession(
  client: Client,
  studentId: string,
): Promise<{ session: LearningSession; resumed: boolean }> {
  const found = await findTodaySession(client, studentId);
  if (found !== null) return { session: found, resumed: true };

  const { data, error } = await client
    .from('learning_session')
    .insert({ student_id: studentId, session_date: today() })
    .select('*')
    .single();

  if (error !== null || data === null) {
    throw new Error(`학습을 시작하지 못했습니다: ${error?.message ?? '알 수 없음'}`);
  }
  return { session: data, resumed: false };
}

/** 이 학생이 오늘 말고 다른 날 학습한 적이 있는지. 01 의 is_first_use 가 이걸 본다 */
export async function hasEarlierSession(
  client: Client,
  studentId: string,
): Promise<boolean> {
  const { data, error } = await client
    .from('learning_session')
    .select('session_id')
    .eq('student_id', studentId)
    .neq('session_date', today())
    .limit(1)
    .maybeSingle();

  if (error !== null) return false;
  return data !== null;
}

/**
 * 문제 하나를 마쳤다. 오늘 몫이 다 찼으면 세션도 닫는다.
 *
 * **집계에서 빠지는 문제는 세지 않는다** — `system_interrupted` 와
 * `verification_failed` 는 학생이 못 푼 게 아니다(COM-001 §19). 부르는
 * 쪽이 완료로 판단한 것만 여기로 온다.
 */
export async function countCompleted(
  client: Client,
  session: LearningSession,
): Promise<{ done: number; sessionCompleted: boolean }> {
  const done = session.completed_problem_count + 1;
  const finished = done >= session.target_problem_count;

  const { error } = await client
    .from('learning_session')
    .update({
      completed_problem_count: done,
      session_status: finished ? 'completed' : session.session_status,
      ended_at: finished ? new Date().toISOString() : session.ended_at,
    })
    .eq('session_id', session.session_id);

  if (error !== null) throw new Error(`진행을 저장하지 못했습니다: ${error.message}`);
  return { done, sessionCompleted: finished };
}

// ============================================================
// 지난 미션 (COM-001 §11-2 · COM-003 STU-006)
// ============================================================

/**
 * 못 끝낸 평일 미션은 **세션 날짜부터 7일 동안** 이어서 할 수 있다.
 * 날짜로 계산한다 — COM-002 §5 의 `eligible_until` 은 날짜에서 바로 나오므로
 * 칸을 따로 두지 않는다.
 */
export const PAST_DAYS = 7;

/** 'YYYY-MM-DD' 에 날을 더한다. 시간대가 끼지 않게 UTC 자정으로 계산한다 */
export function addDays(date: string, days: number): string {
  const at = new Date(`${date}T00:00:00Z`);
  at.setUTCDate(at.getUTCDate() + days);
  return at.toISOString().slice(0, 10);
}

/** 두 날짜 사이의 날 수. b − a */
function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

export type PastSession = LearningSession & {
  /** 이어서 할 수 있는 마지막 날 */
  lastDay: string;
  /** 오늘부터 마지막 날까지. 0 이면 오늘까지, 음수면 만료 */
  daysLeft: number;
};

function asPast(session: LearningSession, now: string): PastSession {
  const lastDay = addDays(session.session_date, PAST_DAYS - 1);
  return { ...session, lastDay, daysLeft: daysBetween(now, lastDay) };
}

const unfinished = (session: LearningSession) =>
  session.session_status !== 'completed' &&
  session.completed_problem_count < session.target_problem_count;

/**
 * 지난 미션 목록. **최근 것이 먼저**다 — 화면은 맨 앞 하나를 큰 카드로 둔다.
 *
 * `expired` 는 기한이 막 지난 것(그 뒤 7일 안)이다. 만료 상태 화면이 쓴다.
 * 그보다 오래된 것은 보이지 않는다.
 *
 * 시작조차 안 한 날은 세션 행이 없어 여기에 없다. 이어 할 「못 끝낸 미션」
 * 이 아니라 아예 열지 않은 날이다.
 */
export async function listPastSessions(
  client: Client,
  studentId: string,
): Promise<{ open: PastSession[]; expired: PastSession[] }> {
  const now = today();
  const { data, error } = await client
    .from('learning_session')
    .select('*')
    .eq('student_id', studentId)
    .gte('session_date', addDays(now, -(PAST_DAYS * 2 - 1)))
    .lt('session_date', now)
    .order('session_date', { ascending: false });

  if (error !== null) throw new Error(`지난 미션을 불러오지 못했습니다: ${error.message}`);

  const past = (data ?? []).filter(unfinished).map((session) => asPast(session, now));
  return {
    open: past.filter((session) => session.daysLeft >= 0),
    expired: past.filter((session) => session.daysLeft < 0),
  };
}

/**
 * 이어 할 수 있는 지난 세션인지 확인해서 돌려준다. 아니면 `null`.
 *
 * 쿠키에 담긴 id 를 그대로 믿지 않는다 — 본인 것(RLS + 학생 일치) · 오늘이
 * 아님 · 7일 안 · 아직 안 끝남을 매번 본다.
 */
export async function findPastSession(
  client: Client,
  studentId: string,
  sessionId: string,
): Promise<PastSession | null> {
  if (sessionId === '') return null;
  const { data, error } = await client
    .from('learning_session')
    .select('*')
    .eq('session_id', sessionId)
    .eq('student_id', studentId)
    .maybeSingle();

  if (error !== null || data === null) return null;
  const now = today();
  if (data.session_date >= now || !unfinished(data)) return null;

  const past = asPast(data, now);
  return past.daysLeft >= 0 ? past : null;
}
