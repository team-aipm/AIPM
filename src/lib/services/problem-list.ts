/**
 * 오늘 푼 문제 목록 (STU-005 오늘의 기록).
 *
 * `problem.ts` 와 나누지 않고 거기 둘 수도 있지만, **학생 화면에 나가는
 * 모양**이라 따로 둔다. `verified_answer` 를 고르지 않는 것이 이 함수의
 * 요점이다 — 실수로 넘기면 정답이 화면까지 간다.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

type Client = SupabaseClient<Database>;

export type SolvedProblem = {
  problemId: string;
  problemText: string;
  status: Database['public']['Enums']['problem_status'];
  learningMode: string;
  createdAt: string;
};

export async function listTodayProblems(
  client: Client,
  sessionId: string,
): Promise<SolvedProblem[]> {
  const { data, error } = await client
    .from('problem')
    .select('problem_id, problem_text, problem_status, learning_mode, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (error !== null) throw new Error(`오늘 기록을 불러오지 못했습니다: ${error.message}`);

  return (data ?? []).map((row) => ({
    problemId: row.problem_id,
    problemText: row.problem_text,
    status: row.problem_status,
    learningMode: row.learning_mode,
    createdAt: row.created_at,
  }));
}
