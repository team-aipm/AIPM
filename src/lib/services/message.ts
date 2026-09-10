import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import type { Tables, TablesInsert } from '@/types/database';

/**
 * `Message`(COM-002 §7) 접근. DEV-001 §4 "services — COM-002 엔티티와 1:1".
 *
 * 학생 화면에 보이는 대화창과 별개로, 이 테이블은 COM-001 §12 "매 턴
 * 즉시 저장"이 요구하는 감사 로그다. Drill-down 진행에 필요한 구조화된
 * 대화 이력(`response_history`)은 이 테이블 모양과 다르므로(자유 텍스트
 * 뿐) 여기서 되짚어 만들지 않는다 — `lib/ai/drilldown.ts`가 클라이언트가
 * 들고 있는 구조화된 이력을 그대로 쓰고, 이 테이블에는 표시용 텍스트만
 * 남긴다.
 *
 * ⚠️ admin 클라이언트 사용 이유는 `learning-session.ts` 상단 주석과 같다.
 */

export type Message = Tables<'message'>;
export type NewMessage = TablesInsert<'message'>;

export async function insertMessage(input: NewMessage): Promise<Message> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('message')
    .insert(input)
    .select('*')
    .single();

  if (error) {
    throw new Error(`message 생성 실패: ${error.message}`);
  }
  return data;
}

/** 현재까지 쌓인 메시지 수 — `turn_number` 채번과 student_turn_count 재계산에 쓴다. */
export async function countMessages(problemId: string): Promise<number> {
  const supabase = createAdminClient();
  const { count, error } = await supabase
    .from('message')
    .select('message_id', { count: 'exact', head: true })
    .eq('problem_id', problemId);

  if (error) {
    throw new Error(`message 개수 조회 실패 (${problemId}): ${error.message}`);
  }
  return count ?? 0;
}

/**
 * 학생이 실제로 답한 횟수. COM-001 §7 turnLimit(5)은 "학생 응답 횟수"
 * 기준이므로 AI 메시지를 섞어 세지 않는다. **서버가 직접 센다** —
 * 클라이언트가 보낸 횟수를 신뢰하지 않는다 (`policy.ts` 원칙).
 */
export async function countStudentTurns(problemId: string): Promise<number> {
  const supabase = createAdminClient();
  const { count, error } = await supabase
    .from('message')
    .select('message_id', { count: 'exact', head: true })
    .eq('problem_id', problemId)
    .eq('speaker', 'student');

  if (error) {
    throw new Error(`student turn 조회 실패 (${problemId}): ${error.message}`);
  }
  return count ?? 0;
}

/**
 * 문제 하나에서 AI가 남긴 support_level 중 최대값. `Evaluation.support_level`
 * 최종값 계산에 쓴다 (COM-001 §10, `policy.finalSupportLevel`과 같은 원칙).
 */
export async function maxAiSupportLevel(problemId: string): Promise<number> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('message')
    .select('support_level')
    .eq('problem_id', problemId)
    .eq('speaker', 'ai');

  if (error) {
    throw new Error(`support_level 조회 실패 (${problemId}): ${error.message}`);
  }
  return (data ?? []).reduce((max, row) => Math.max(max, row.support_level), 0);
}
