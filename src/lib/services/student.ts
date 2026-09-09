/**
 * Student (COM-002 §4) · 학습자 프로필.
 *
 * **COM-002 엔티티와 1:1 이다**(DEV-001 §4). 화면과 Server Action 은 여기를
 * 부르고, DB 쿼리를 직접 쓰지 않는다.
 *
 * 클라이언트를 인자로 받는다 — 모듈 안에서 만들면 로그인한 사람의 세션이
 * 아니라 다른 요청의 세션을 쓰게 된다. 세션으로 부르므로 RLS 가 그대로
 * 적용된다: 남의 학생은 애초에 안 나온다(`student_select_own`).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

type Client = SupabaseClient<Database>;
export type Student = Database['public']['Tables']['student']['Row'];

/** 화면에서 고를 수 있는 최소한의 정보만. 목록에 전부를 실어 나르지 않는다 */
export type StudentCard = Pick<
  Student,
  'student_id' | 'student_name' | 'nickname' | 'grade' | 'persona_type'
>;

/**
 * 로그인한 계정의 학생들.
 *
 * **계정 id 를 인자로 받지 않는다.** RLS 가 이미 자기 계정 것만 돌려주므로
 * 여기서 한 번 더 거르면 같은 규칙을 두 곳에 적는 셈이 된다.
 *
 * 삭제 대기 상태는 뺀다(COM-002 §4 `student_status`). 실제 삭제 시점과
 * 보관 기간은 COM-007 이 확정한 뒤에 다룬다.
 */
export async function listStudents(client: Client): Promise<StudentCard[]> {
  const { data, error } = await client
    .from('student')
    .select('student_id, student_name, nickname, grade, persona_type')
    .eq('student_status', 'active')
    .order('created_at', { ascending: true });

  if (error !== null) throw new Error(`학생 목록을 불러오지 못했습니다: ${error.message}`);
  return data ?? [];
}

/**
 * 학생 하나.
 *
 * 없으면 `null` 이다. **남의 학생을 물어도 `null` 이다** — RLS 가 행을 안
 * 돌려주므로 "없음" 과 "권한 없음" 이 화면에서 같아진다. 그래야 남의
 * 학생이 있는지 없는지를 알아낼 수 없다.
 */
export async function getStudent(
  client: Client,
  studentId: string,
): Promise<Student | null> {
  const { data, error } = await client
    .from('student')
    .select('*')
    .eq('student_id', studentId)
    .maybeSingle();

  if (error !== null) throw new Error(`학생을 불러오지 못했습니다: ${error.message}`);
  return data;
}
