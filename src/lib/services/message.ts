/**
 * Message (COM-002 §7) · 대화 한 턴.
 *
 * **`problem_id` 가 필수다.** 문제가 생기기 전의 말(01 이 모드를 묻는
 * 대화)은 담을 자리가 없다. 지금은 남기지 않는다 — COM-002 변경이 필요한
 * 자리라 문서를 먼저 고쳐야 한다.
 *
 * `turn_number` 는 (problem_id, turn_number) 로 유일하다. 서버가 센다 —
 * 화면이 세면 두 탭에서 같은 번호를 보낼 수 있다.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

type Client = SupabaseClient<Database>;
export type Message = Database['public']['Tables']['message']['Row'];
type Enums = Database['public']['Enums'];

export async function listMessages(client: Client, problemId: string): Promise<Message[]> {
  const { data, error } = await client
    .from('message')
    .select('*')
    .eq('problem_id', problemId)
    .order('turn_number', { ascending: true });

  if (error !== null) throw new Error(`대화를 불러오지 못했습니다: ${error.message}`);
  return data ?? [];
}

export async function appendMessage(
  client: Client,
  input: {
    problemId: string;
    sessionId: string;
    studentId: string;
    speaker: Enums['speaker'];
    text: string;
    turnNumber: number;
    supportLevel: number;
    drilldownStage?: Enums['drilldown_stage'] | null;
  },
): Promise<void> {
  const { error } = await client.from('message').insert({
    problem_id: input.problemId,
    session_id: input.sessionId,
    student_id: input.studentId,
    speaker: input.speaker,
    message_text: input.text,
    turn_number: input.turnNumber,
    support_level: input.supportLevel,
    drilldown_stage: input.drilldownStage ?? null,
  });

  // **대화 저장은 실패하면 던진다.** 이벤트와 다르다 — 이건 학습 기록
  // 자체다. 조용히 넘어가면 다음 턴의 입력이 통째로 어긋난다.
  if (error !== null) throw new Error(`대화를 저장하지 못했습니다: ${error.message}`);
}
