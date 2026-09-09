/**
 * Problem (COM-002 §6) · 학습한 문제 1개.
 *
 * **`verified_answer` 는 학생 화면에 나가면 안 된다**(COM-003 · CLAUDE.md).
 * 그래서 화면으로 보내는 함수와 서버에서만 쓰는 함수를 나눠 둔다.
 * 문제를 종료할 때는 정답과 해설을 보여주므로(COM-001 §8), 그때는 모델이
 * 만든 종료 안내 문장을 쓴다 — 이 값을 직접 그리지 않는다.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

type Client = SupabaseClient<Database>;
export type Problem = Database['public']['Tables']['problem']['Row'];
type Enums = Database['public']['Enums'];

export async function createProblem(
  client: Client,
  input: {
    sessionId: string;
    studentId: string;
    problemSource: Enums['problem_source'];
    problemText: string;
    concept: string;
    difficulty: number;
    learningMode: Enums['learning_mode'];
    verifiedAnswer: unknown;
    answerLock: boolean;
    /** MODE B 에서 AI 가 만든 의도적 오답. 화면에 나가지 않는다(COM-002 §20-A) */
    wrongAnswer?: unknown;
    wrongReasoning?: string | null;
    misconception?: string | null;
  },
): Promise<Problem> {
  const { data, error } = await client
    .from('problem')
    .insert({
      session_id: input.sessionId,
      student_id: input.studentId,
      problem_source: input.problemSource,
      problem_text: input.problemText,
      concept: input.concept,
      difficulty: input.difficulty,
      learning_mode: input.learningMode,
      // 검증 실패면 NULL 이다(COM-002 §6). 지어내지 않는다.
      verified_answer: (input.verifiedAnswer ?? null) as never,
      answer_lock_status: input.answerLock ? 'locked' : 'recheck',
      ai_wrong_answer: (input.wrongAnswer ?? null) as never,
      ai_wrong_reasoning: input.wrongReasoning ?? null,
      target_misconception: input.misconception ?? null,
    })
    .select('*')
    .single();

  if (error !== null || data === null) {
    throw new Error(`문제를 저장하지 못했습니다: ${error?.message ?? '알 수 없음'}`);
  }
  return data;
}

/** 이 세션에서 아직 끝나지 않은 문제. 새로고침해도 이어서 풀 수 있게 한다 */
export async function findActiveProblem(
  client: Client,
  sessionId: string,
): Promise<Problem | null> {
  const { data, error } = await client
    .from('problem')
    .select('*')
    .eq('session_id', sessionId)
    .eq('problem_status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error !== null) throw new Error(`문제를 불러오지 못했습니다: ${error.message}`);
  return data;
}

export async function finishProblem(
  client: Client,
  problemId: string,
  status: Enums['problem_status'],
): Promise<void> {
  const { error } = await client
    .from('problem')
    .update({ problem_status: status })
    .eq('problem_id', problemId);

  if (error !== null) throw new Error(`문제를 마치지 못했습니다: ${error.message}`);
}
