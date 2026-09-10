import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import type { Tables } from '@/types/database';

/**
 * `LearningSession`(COM-002) 접근. DEV-001 §4 "services — COM-002
 * 엔티티와 1:1".
 *
 * ⚠️ 임시로 admin(service_role) 클라이언트를 쓴다. 학생 화면에는 아직
 * STU-002(학생 프로필 선택) 세션이 없어 `auth.uid()` 로 걸리는 RLS를 통과할
 * 방법이 없다 — `admin.ts` 자체가 "사용자 세션이 없는 경우에만 쓴다"고
 * 명시하는 바로 그 상황이다. STU-002가 생기면 `lib/supabase/server.ts`로
 * 옮기고 여기서 studentId를 파라미터로 받지 않고 세션에서 읽어야 한다.
 */

export type LearningSession = Tables<'learning_session'>;

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

/** 오늘 날짜의 진행 중 세션을 찾고, 없으면 새로 만든다. */
export async function getOrCreateTodaySession(
  studentId: string,
): Promise<LearningSession> {
  const supabase = createAdminClient();
  const today = todayDateString();

  const { data: existing, error: findError } = await supabase
    .from('learning_session')
    .select('*')
    .eq('student_id', studentId)
    .eq('session_date', today)
    .eq('session_status', 'active')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (findError) {
    throw new Error(`learning_session 조회 실패: ${findError.message}`);
  }
  if (existing) return existing;

  const { data: created, error: insertError } = await supabase
    .from('learning_session')
    .insert({ student_id: studentId, session_date: today })
    .select('*')
    .single();

  if (insertError) {
    throw new Error(`learning_session 생성 실패: ${insertError.message}`);
  }
  return created;
}
