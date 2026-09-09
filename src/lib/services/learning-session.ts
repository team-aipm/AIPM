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
