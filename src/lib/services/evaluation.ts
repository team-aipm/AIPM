/**
 * Evaluation (COM-002 §8) · LogicGap (COM-002 §9)
 *
 * 문제 하나가 끝날 때 05 EVALUATOR 가 만든 평가를 남긴다. **학생 화면에는
 * 나가지 않는다**(COM-003). 부모 리포트와 다음 문제 선정이 이 값을 읽는다.
 *
 * 점수를 0 으로 채우지 않는다. 전이를 묻지 않고 끝난 문제의
 * `transfer_score` 는 0 이 아니라 **없음(null)** 이다 — 0 으로 넣으면
 * "물었는데 못했다" 가 되어 누적 평균이 실제보다 낮아진다. 컬럼도 그래서
 * NULL 을 허용한다(`20260901014500` · `20260909114511`).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { GAP_DEFINITIONS } from '@/lib/ai/taxonomy';

type Client = SupabaseClient<Database>;
type Enums = Database['public']['Enums'];

export type EvaluationInput = {
  problemId: string;
  studentId: string;
  initialAccuracy: boolean | null;
  reasoningScore: number;
  ruleScore: number;
  selfCorrection: boolean;
  transferScore: number | null;
  reflectionScore: number | null;
  supportLevel: number;
  /** 맞혀서 끝났는가. 05 는 이 값을 내지 않으므로 완료 상태에서 정한다 */
  finalAccuracy: boolean;
};

/** 문제 하나당 최대 1건이다(COM-002 §8 · unique(problem_id)) */
export async function saveEvaluation(
  client: Client,
  input: EvaluationInput,
): Promise<void> {
  const { error } = await client.from('evaluation').insert({
    problem_id: input.problemId,
    student_id: input.studentId,
    initial_accuracy: input.initialAccuracy,
    reasoning_score: input.reasoningScore,
    rule_score: input.ruleScore,
    self_correction: input.selfCorrection,
    transfer_score: input.transferScore,
    reflection_score: input.reflectionScore,
    support_level: input.supportLevel,
    final_accuracy: input.finalAccuracy,
  });

  if (error !== null) throw new Error(`평가를 저장하지 못했습니다: ${error.message}`);
}

/**
 * 이번 문제에서 드러난 사고 오류.
 *
 * 05 는 `primary_logic_gap` · `secondary_logic_gap` 두 개까지 낸다. 근거가
 * 없으면 null 이며, **그때는 행을 만들지 않는다** — 단순히 틀렸다는 이유로
 * 지정하지 않는다(COMMON SYSTEM).
 *
 * `description` 은 그 종류의 뜻을 넣는다. 05 의 출력에는 문제별 설명이
 * 없는데 COM-002 §9 는 이 칸을 필수로 둔다. 지어내는 대신 정의를 넣고,
 * 프롬프트에 설명을 추가할지는 문서에서 정한다.
 */
export async function saveLogicGaps(
  client: Client,
  input: {
    problemId: string;
    studentId: string;
    concept: string;
    gaps: (Enums['gap_type'] | null)[];
  },
): Promise<void> {
  const rows = input.gaps
    .filter((gap): gap is Enums['gap_type'] => gap !== null)
    .map((gap) => ({
      problem_id: input.problemId,
      student_id: input.studentId,
      gap_type: gap,
      concept: input.concept,
      description: GAP_DEFINITIONS[gap],
    }));

  if (rows.length === 0) return;

  const { error } = await client.from('logic_gap').insert(rows);
  if (error !== null) throw new Error(`사고 오류를 저장하지 못했습니다: ${error.message}`);
}
