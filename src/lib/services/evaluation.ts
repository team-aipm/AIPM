import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import type { Tables, TablesInsert } from '@/types/database';

/**
 * `Evaluation`(COM-002 §8) 접근. DEV-001 §4 "services — COM-002 엔티티와
 * 1:1".
 *
 * ⚠️ admin 클라이언트 사용 이유는 `learning-session.ts` 상단 주석과 같다.
 *
 * `LogicGap`(§9)은 이번 구현 범위에서 뺐다 — EVALUATOR 프롬프트 출력
 * (`primary_logic_gap`/`secondary_logic_gap`)이 enum 값만 내고
 * `logic_gap.description`(NOT NULL)에 채울 문장을 내지 않는다. 값을
 * 지어내는 대신, 이 불일치를 COM-001/프롬프트 쪽에 먼저 보고해야 한다.
 */

export type Evaluation = Tables<'evaluation'>;
export type NewEvaluation = TablesInsert<'evaluation'>;

export async function insertEvaluation(
  input: NewEvaluation,
): Promise<Evaluation> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('evaluation')
    .insert(input)
    .select('*')
    .single();

  if (error) {
    throw new Error(`evaluation 생성 실패: ${error.message}`);
  }
  return data;
}
