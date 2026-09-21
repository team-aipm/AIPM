/**
 * LearningReport (COM-002 §13) · 하루 · 한 주 리포트.
 *
 * 06 DAILY ANALYZER 가 만든 하루 총평을 담는다. **한 번 만들고 다시
 * 만들지 않는다** — 화면을 열 때마다 모델을 부르면 새로고침마다 돈이 나가고,
 * 같은 하루의 총평이 매번 다른 말로 바뀐다.
 */

import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
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

/**
 * 하루 총평을 남긴다.
 *
 * **service_role 로 쓴다.** `learning_report` 에는 INSERT 정책이 없다 —
 * 일부러 없다. RLS 파일이 그렇게 적어 두었다.
 *
 * ```text
 * 리포트는 배치(service_role)가 생성한다. 부모는 조회만.
 * (20260831090200_enable_rls_policies.sql)
 * ```
 *
 * **이건 사용자의 요청이 아니라 시스템이 만드는 산출물이다.** 학생이
 * 마지막 문제를 끝낸 김에 서버가 06 을 돌려 남기는 것뿐이고, 내용도
 * 사용자가 준 값이 아니라 모델이 낸 값이다. 주간 리포트 배치가
 * `createAdminClient()` 를 쓰는 것과 같은 이유다(DEV-001 §8 의 「배치 ·
 * 운영 작업」).
 *
 * 부르는 쪽이 넘긴 client 를 쓰지 않는다. 거기에 사용자 세션이 오면
 * RLS 에 막혀 **조용히 실패한다** — 실제로 그랬다. `catch` 가 로그만 남기고
 * 넘어가 하루 총평이 한 건도 안 쌓였고, 07 주간 리포트는 늘 재료가 없다며
 * 건너뛰었다(2026-09-18).
 */
export async function saveDailyReport(
  input: { studentId: string; date: string; summary: Record<string, unknown> },
): Promise<void> {
  const { error } = await createAdminClient().from('learning_report').insert({
    student_id: input.studentId,
    report_type: 'daily_student',
    period_start: input.date,
    period_end: input.date,
    summary_data: input.summary as never,
  });

  if (error !== null) throw new Error(`기록을 저장하지 못했습니다: ${error.message}`);
}
