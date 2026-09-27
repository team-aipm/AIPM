import 'server-only';

/**
 * 프롬프트 랩이 **테스트 학생 자리에 앉는다**.
 *
 * ## 왜 필요한가
 *
 * 랩은 지금 프롬프트만 돌린다. `lib/services/*` 를 하나도 안 탄다 — 난이도
 * 판정도, 기억 갱신도, 평가 저장도 실행되지 않는다. 그래서 「6개월 쓰면
 * 난이도가 달라지는가」를 랩으로 볼 수가 없었다. 그 판단을 하는 코드가
 * 애초에 안 돌기 때문이다.
 *
 * 제품 흐름을 그대로 타게 하려면 액션들이 「누구의 자리인가」를 알아야
 * 한다. `mission/_actions.ts` 는 그것을 `context()` 한 곳에서 정한다.
 * 여기서 그 자리를 하나 더 만든다.
 *
 * ## 학생 계정으로 로그인하지 않는다
 *
 * 로그인을 시키면 두 가지가 무너진다.
 *
 * - 운영자가 **아이 비밀번호를 알아야** 한다 (COM-007)
 * - 부모 계정이 학생 화면에 못 들어가게 막아 둔 경계(COM-003 §4.2)를
 *   우회하는 길이 생긴다
 *
 * 인증은 이미 돼 있다. 랩은 `admin_user` 로 문을 지킨다. 여기서는 **그
 * 운영자가 테스트 학생 자리에 앉는 것**만 허락한다.
 *
 * ## 두 조건을 모두 만족해야 앉는다
 *
 * ```text
 * 1  부르는 사람이 활성 운영자다          currentAdmin()
 * 2  앉으려는 학생이 test 상태다          student_status = 'test'
 * ```
 *
 * **진짜 아이 자리에는 앉을 수 없다.** 2번이 그것을 막는다. 쿠키를 손으로
 * 고쳐도 마찬가지다 — 상태는 DB 에 있다.
 */

import { cookies } from 'next/headers';

import { createAdminClient } from '@/lib/supabase/admin';
import { currentAdmin } from '@/lib/services/admin';
import { getStudent, type Student } from '@/lib/services/student';
import { findTodaySession, type LearningSession } from '@/lib/services/learning-session';

/** 랩이 어느 학생 자리에 앉아 있는지. 값은 `student_id` 다 */
export const LAB_SEAT_COOKIE = 'aipm_lab_seat';

/** COM-002 §4. 프롬프트 랩이 만든 학생 */
export const TEST_STATUS = 'test';

export type Seat = {
  supabase: ReturnType<typeof createAdminClient>;
  student: Student;
  session: LearningSession;
};

/**
 * 지금 랩 자리에 앉아 있나. 아니면 `null`.
 *
 * **조용히 `null` 을 돌려준다.** 여기서 던지면 제품 액션이 학생에게
 * 오류를 보이게 된다. 자리가 아니면 원래 경로로 가면 그만이다.
 *
 * 오늘 세션이 없으면 `null` 이다. 세션을 여는 것은 앉는 쪽
 * (`takeSeat`)이 한다 — 읽기만 해야 할 자리에서 행을 만들지 않는다.
 */
export async function labSeat(): Promise<Seat | null> {
  const jar = await cookies();
  const studentId = jar.get(LAB_SEAT_COOKIE)?.value ?? '';
  if (studentId === '') return null;

  // 1. 활성 운영자인가
  if ((await currentAdmin()) === null) return null;

  // 2. 테스트 학생인가. **진짜 아이면 여기서 막힌다**
  const supabase = createAdminClient();
  const student = await getStudent(supabase, studentId);
  if (student === null || student.student_status !== TEST_STATUS) return null;

  const session = await findTodaySession(supabase, student.student_id);
  if (session === null) return null;

  return { supabase, student, session };
}

/**
 * 앉을 수 있는 학생 목록.
 *
 * 운영자가 아니면 빈 배열이다. 「없다」와 「볼 권한이 없다」를 화면에서
 * 가르지 않는다 — 랩은 운영자만 여는 화면이라 구분할 이유가 없다.
 */
export async function seatCandidates(): Promise<Student[]> {
  if ((await currentAdmin()) === null) return [];

  const { data, error } = await createAdminClient()
    .from('student')
    .select('*')
    .eq('student_status', TEST_STATUS)
    .order('created_at', { ascending: true });

  if (error !== null) {
    console.error(`[lab] 테스트 학생을 읽지 못했습니다: ${error.message}`);
    return [];
  }
  return data ?? [];
}
