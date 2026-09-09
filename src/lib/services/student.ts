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

/**
 * 학생을 만든다 (STU-001).
 *
 * `account_id` 를 로그인한 사람으로 채운다. RLS 는 `account_id = auth.uid()`
 * 인 행만 넣게 하므로(`student_insert_own`) 남의 계정에 학생을 붙일 수
 * 없다. 그래도 여기서 명시적으로 넣는 이유는 **컬럼이 NOT NULL** 이기
 * 때문이다.
 *
 * `persona_type` 은 NOT NULL 인데 고르는 화면(STU-003)이 다음이다. 그래서
 * `friend` 로 두고 다음 화면에서 바꾼다 — 퍼널이 "첫 학생 등록" 과
 * "Persona 선택" 을 다른 칸으로 세기 때문에(ADM-002) 학생 행은 여기서
 * 생겨야 한다.
 *
 * `current_difficulty` 는 3 이다. COM-001 §9 "학생 grade 를 기준으로 중간
 * 난이도에서 시작한다", COM-002 §4 예시도 3.
 */
export async function createStudent(
  client: Client,
  accountId: string,
  input: {
    studentName: string;
    nickname: string;
    nicknameSource: Database['public']['Enums']['nickname_source'];
    birthDate: string;
    grade: number;
  },
): Promise<Student> {
  const { data, error } = await client
    .from('student')
    .insert({
      account_id: accountId,
      student_name: input.studentName,
      nickname: input.nickname,
      nickname_source: input.nicknameSource,
      birth_date: input.birthDate,
      grade: input.grade,
      persona_type: 'friend',
      current_difficulty: 3,
    })
    .select('*')
    .single();

  if (error !== null || data === null) {
    throw new Error(`학생을 등록하지 못했습니다: ${error?.message ?? '알 수 없음'}`);
  }
  return data;
}

/** Persona 를 정한다 (STU-003). 말투와 연출만 바뀐다 — COM-001 §19 */
export async function setPersona(
  client: Client,
  studentId: string,
  persona: Database['public']['Enums']['persona_type'],
): Promise<void> {
  const { error } = await client
    .from('student')
    .update({ persona_type: persona })
    .eq('student_id', studentId);

  if (error !== null) throw new Error(`파트너를 저장하지 못했습니다: ${error.message}`);
}
