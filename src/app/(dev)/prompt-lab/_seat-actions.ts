'use server';

/**
 * 랩이 테스트 학생 자리에 앉고 일어난다.
 *
 * 앉으면 `mission/_actions.ts` 의 제품 액션들이 그 학생에게 쓴다. 랩이
 * 프롬프트만 돌리던 것과 달리 `lib/services/*` 가 전부 실행된다 — 난이도
 * 판정 · 기억 갱신 · 평가 저장이 제품과 같은 길로 간다.
 *
 * ## 학생과 계정은 여기서 만들지 않는다
 *
 * `admin_user` 를 SQL 로만 추가하는 것과 같은 이유다(CLAUDE.md). 계정을
 * 만드는 길을 화면에 두면, 그 길로 진짜 계정도 만들 수 있게 된다.
 * 테스트 학생은 SQL 로 심는다 — 쓸 구문은 `_components/LabSeat.tsx` 가
 * 앉을 학생이 없을 때 화면에 보여 준다.
 *
 * 그래서 이 파일이 하는 일은 **고르기 · 앉기 · 일어나기 · 상태 심기**
 * 넷뿐이다.
 */

import { cookies } from 'next/headers';

import { createAdminClient } from '@/lib/supabase/admin';
import { currentAdmin } from '@/lib/services/admin';
import { getStudent } from '@/lib/services/student';
import { openTodaySession } from '@/lib/services/learning-session';
import { MIN_LEVEL, MAX_LEVEL } from '@/lib/services/difficulty';
import { LAB_SEAT_COOKIE, TEST_STATUS, seatCandidates, labSeat } from '@/lib/lab/seat';

export type SeatInfo = {
  studentId: string;
  nickname: string;
  grade: number;
  /** 지금 내보낼 문제의 수준 */
  difficulty: number;
  /** 요즘 어디쯤인가. 기억이 없으면 `null` */
  level: number | null;
  sessionId: string;
  completed: number;
  target: number;
};

export type SeatState = {
  /** 앉을 수 있는 학생들 */
  candidates: { studentId: string; nickname: string; grade: number }[];
  /** 지금 앉아 있는 자리. 없으면 `null` */
  seated: SeatInfo | null;
};

/** 30일. 「지금 공부하는 아이」 쿠키와 같은 길이로 둔다 */
const SEAT_MAX_AGE = 60 * 60 * 24 * 30;

async function describe(): Promise<SeatInfo | null> {
  const seat = await labSeat();
  if (seat === null) return null;

  const { data } = await seat.supabase
    .from('student_memory')
    .select('current_level')
    .eq('student_id', seat.student.student_id)
    .maybeSingle();

  return {
    studentId: seat.student.student_id,
    nickname: seat.student.nickname,
    grade: seat.student.grade,
    difficulty: seat.student.current_difficulty,
    level: data?.current_level ?? null,
    sessionId: seat.session.session_id,
    completed: seat.session.completed_problem_count,
    target: seat.session.target_problem_count,
  };
}

export async function seatState(): Promise<SeatState> {
  const candidates = await seatCandidates();
  return {
    candidates: candidates.map((student) => ({
      studentId: student.student_id,
      nickname: student.nickname,
      grade: student.grade,
    })),
    seated: await describe(),
  };
}

/**
 * 앉는다. 오늘 세션이 없으면 만든다.
 *
 * **여기서만 세션을 만든다.** `labSeat()` 는 읽기만 한다 — 자리를 확인할
 * 때마다 행이 생기면 안 된다.
 */
export async function takeSeat(studentId: string): Promise<{ ok: boolean; message: string }> {
  if ((await currentAdmin()) === null) return { ok: false, message: '운영자만 앉을 수 있습니다.' };

  const supabase = createAdminClient();
  const student = await getStudent(supabase, studentId);
  if (student === null) return { ok: false, message: '그런 학생이 없습니다.' };

  // **진짜 아이 자리에는 앉을 수 없다.** `labSeat()` 도 같은 것을 보지만,
  // 쿠키를 심기 전에 막는 편이 낫다.
  if (student.student_status !== TEST_STATUS) {
    return { ok: false, message: '테스트 학생이 아닙니다. student_status 가 test 여야 합니다.' };
  }

  const { session } = await openTodaySession(supabase, studentId);

  const jar = await cookies();
  jar.set(LAB_SEAT_COOKIE, studentId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SEAT_MAX_AGE,
  });

  return { ok: true, message: `${student.nickname} 자리에 앉았습니다 (세션 ${session.session_id.slice(0, 8)})` };
}

export async function leaveSeat(): Promise<void> {
  const jar = await cookies();
  jar.delete(LAB_SEAT_COOKIE);
}

/**
 * 수준을 심는다.
 *
 * 「레벨 5 인 아이에게 어떤 문제를 내는가」를 보려면 레벨 5 인 아이가
 * 있어야 한다. 6개월을 기다릴 수는 없다.
 *
 * **두 값을 함께 심는다.** `current_difficulty` 는 다음 문제의 수준이고
 * `current_level` 은 프롬프트에 실리는 「요즘 어디쯤인가」다(COM-001 §9).
 * 하나만 심으면 둘이 어긋난 상태를 시험하게 된다.
 */
export async function setSeatLevel(level: number): Promise<{ ok: boolean; message: string }> {
  const seat = await labSeat();
  if (seat === null) return { ok: false, message: '앉아 있지 않습니다.' };

  const value = Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, Math.round(level)));

  const { error } = await seat.supabase
    .from('student')
    .update({ current_difficulty: value })
    .eq('student_id', seat.student.student_id);

  if (error !== null) return { ok: false, message: `난이도 저장 실패: ${error.message}` };

  // 기억이 없으면 만든다. `refreshMemory` 는 평가가 한 건이라도 있어야
  // 행을 만들므로, 아직 아무것도 안 푼 학생에게는 여기가 유일한 자리다.
  const { error: memoryError } = await seat.supabase.from('student_memory').upsert(
    {
      student_id: seat.student.student_id,
      current_level: value,
      reasoning_level: value,
      transfer_level: value,
      average_support_level: 0,
    },
    { onConflict: 'student_id' },
  );

  if (memoryError !== null) return { ok: false, message: `기억 저장 실패: ${memoryError.message}` };

  return { ok: true, message: `수준 ${value} 로 심었습니다.` };
}
