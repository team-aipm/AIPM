import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import type { Tables, TablesInsert } from '@/types/database';

/**
 * `Problem`(COM-002) 접근. DEV-001 §4 "services — COM-002 엔티티와 1:1".
 *
 * ⚠️ admin 클라이언트 사용 이유는 `learning-session.ts` 상단 주석과 같다.
 */

export type Problem = Tables<'problem'>;
export type NewProblem = TablesInsert<'problem'>;

export async function insertProblem(input: NewProblem): Promise<Problem> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('problem')
    .insert(input)
    .select('*')
    .single();

  if (error) {
    throw new Error(`problem 생성 실패: ${error.message}`);
  }
  return data;
}

/** studentId를 함께 확인해 다른 학생의 문제를 잘못 불러오지 않게 한다. */
export async function getProblem(
  problemId: string,
  studentId: string,
): Promise<Problem> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('problem')
    .select('*')
    .eq('problem_id', problemId)
    .eq('student_id', studentId)
    .single();

  if (error) {
    throw new Error(`problem 조회 실패 (${problemId}): ${error.message}`);
  }
  return data;
}

export async function updateProblemStatus(
  problemId: string,
  status: Problem['problem_status'],
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('problem')
    .update({ problem_status: status })
    .eq('problem_id', problemId);

  if (error) {
    throw new Error(`problem 상태 갱신 실패 (${problemId}): ${error.message}`);
  }
}
