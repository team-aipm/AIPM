/**
 * 부모가 보는 요약 (PAR-002 · RPT-001).
 *
 * **집계만 만든다.** 대화 원문은 여기서 다루지 않는다 — 부모가 볼 수는
 * 있지만(COM-007 §8) 그건 다른 화면의 일이다.
 *
 * 모델을 부르지 않는다. 이미 쌓인 `evaluation` · `logic_gap` 을 세는 것이
 * 전부다. 화면을 열 때마다 AI 를 부르면 돈이 나가고 숫자가 매번 달라진다.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

type Client = SupabaseClient<Database>;
type GapType = Database['public']['Enums']['gap_type'];

export type StudentSummary = {
  studentId: string;
  nickname: string;
  grade: number;
  persona: Database['public']['Enums']['persona_type'];
  /** 최근 7일 */
  solved: number;
  completed: number;
  needsReview: number;
  /** 0~2 평균. 관찰된 문제가 없으면 null */
  reasoning: number | null;
  rule: number | null;
  /** 0~4. 도움을 얼마나 받았는지 */
  support: number | null;
  selfCorrected: number;
  /** 자주 막힌 부분. 많이 나온 순서 */
  gaps: { type: GapType; count: number }[];
  lastLearnedAt: string | null;
};

const avg = (values: number[]): number | null =>
  values.length === 0 ? null : values.reduce((sum, v) => sum + v, 0) / values.length;

/** 며칠 전 날짜. 기본 7일 */
function since(days = 7): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

export async function summarize(
  client: Client,
  student: { student_id: string; nickname: string; grade: number; persona_type: Database['public']['Enums']['persona_type'] },
  days = 7,
): Promise<StudentSummary> {
  const { data, error } = await client
    .from('problem')
    .select('problem_id, problem_status, created_at, evaluation(*), logic_gap(gap_type)')
    .eq('student_id', student.student_id)
    .gte('created_at', since(days))
    .order('created_at', { ascending: false });

  if (error !== null) throw new Error(`요약을 만들지 못했습니다: ${error.message}`);

  const rows = data ?? [];
  // 진행 중인 문제는 결과가 아니다. 집계에서 뺀다.
  const done = rows.filter((row) => row.problem_status !== 'active');
  // 시스템 중단과 검증 실패도 뺀다 — 학생이 못 푼 게 아니다(COM-001 §19).
  const counted = done.filter(
    (row) =>
      row.problem_status !== 'system_interrupted' &&
      row.problem_status !== 'verification_failed',
  );

  const evaluations = counted
    .map((row) => (Array.isArray(row.evaluation) ? row.evaluation[0] : row.evaluation))
    .filter((item): item is NonNullable<typeof item> => item !== null && item !== undefined);

  const gapCount = new Map<GapType, number>();
  for (const row of counted) {
    const gaps = Array.isArray(row.logic_gap) ? row.logic_gap : [];
    for (const gap of gaps) {
      gapCount.set(gap.gap_type, (gapCount.get(gap.gap_type) ?? 0) + 1);
    }
  }

  return {
    studentId: student.student_id,
    nickname: student.nickname,
    grade: student.grade,
    persona: student.persona_type,
    solved: counted.length,
    completed: counted.filter((row) => row.problem_status === 'completed').length,
    needsReview: counted.filter((row) => row.problem_status === 'needs_review').length,
    reasoning: avg(evaluations.map((item) => item.reasoning_score)),
    rule: avg(evaluations.map((item) => item.rule_score)),
    support: avg(evaluations.map((item) => item.support_level)),
    selfCorrected: evaluations.filter((item) => item.self_correction).length,
    gaps: [...gapCount.entries()]
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count),
    lastLearnedAt: done[0]?.created_at ?? null,
  };
}
