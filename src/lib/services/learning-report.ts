/**
 * LearningReport (COM-002 §13) · 하루 · 한 주 리포트.
 *
 * 06 DAILY ANALYZER 가 만든 하루 총평을 담는다. **한 번 만들고 다시
 * 만들지 않는다** — 화면을 열 때마다 모델을 부르면 새로고침마다 돈이 나가고,
 * 같은 하루의 총평이 매번 다른 말로 바뀐다.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

type Client = SupabaseClient<Database>;
export type LearningReport = Database['public']['Tables']['learning_report']['Row'];

export async function findDailyReport(
  client: Client,
  studentId: string,
  date: string,
): Promise<LearningReport | null> {
  const { data, error } = await client
    .from('learning_report')
    .select('*')
    .eq('student_id', studentId)
    .eq('report_type', 'daily_student')
    .eq('period_start', date)
    .limit(1)
    .maybeSingle();

  if (error !== null) throw new Error(`기록을 불러오지 못했습니다: ${error.message}`);
  return data;
}

export async function saveDailyReport(
  client: Client,
  input: { studentId: string; date: string; summary: Record<string, unknown> },
): Promise<void> {
  const { error } = await client.from('learning_report').insert({
    student_id: input.studentId,
    report_type: 'daily_student',
    period_start: input.date,
    period_end: input.date,
    summary_data: input.summary as never,
  });

  if (error !== null) throw new Error(`기록을 저장하지 못했습니다: ${error.message}`);
}
