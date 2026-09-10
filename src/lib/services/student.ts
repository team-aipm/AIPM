import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import type { Tables } from '@/types/database';

/**
 * `Student`(COM-002) 읽기 전용 접근. 쓰기(생성·탈퇴 등)는 STU-002/COM-007
 * 확정 전까지 다루지 않는다 — 여기서는 미션 진행에 필요한 조회만 한다.
 *
 * ⚠️ admin 클라이언트 사용 이유는 `learning-session.ts` 상단 주석과 같다.
 */

export type Student = Tables<'student'>;

export async function getStudent(studentId: string): Promise<Student> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('student')
    .select('*')
    .eq('student_id', studentId)
    .single();

  if (error) {
    throw new Error(`student 조회 실패 (${studentId}): ${error.message}`);
  }
  return data;
}
