/**
 * LearningSession (COM-002 §5) · 하루 학습 단위.
 *
 * 이 PR 에서는 **읽기만** 한다. 홈이 "오늘 몇 문제까지 했는지" 를 보여줘야
 * 하는데, 세션을 시작하고 끝내는 일은 미션 화면의 것이라 그 화면과 함께
 * 넣는다.
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
