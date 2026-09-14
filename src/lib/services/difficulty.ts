/**
 * 난이도를 올릴지 내릴지 정한다 (COM-001 §9).
 *
 * > 난이도 조절은 **한 문제의 정오만으로 결정하지 않는다.** 다음 데이터를
 * > 누적하여 판단한다 — Initial Accuracy · Reasoning Score · Rule Score ·
 * > Self-Correction · Transfer Score · Support Level · 반복 Logic Gap
 *
 * 그래서 05 가 문제마다 내놓는 `next_learning.difficulty` 를 **그대로 쓰지
 * 않는다.** 그것은 한 문제짜리 신호다. 한 번 틀렸다고 쉬워지고 한 번
 * 맞혔다고 어려워지면, 아이는 자기 수준이 아니라 그날의 운을 따라간다.
 *
 * 서버가 최근 평가를 모아서 정한다. Support Level 의 최종값을 서버가
 * 계산하는 것과 같은 이유다(COM-001 §10) — **같은 기록이면 언제나 같은
 * 결과**여야 하고, 그래야 이상할 때 재현해 볼 수 있다.
 *
 * `student.current_difficulty` 는 COM-002 §4 에 이미 있는 칸이다. 만들
 * 때 3 으로 두고 그 뒤 아무도 고치지 않고 있었다.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

type Client = SupabaseClient<Database>;

/** COM-002 §4 `current_difficulty`. 학년 안에서의 상대적 수준이다 */
export const MIN_LEVEL = 1;
export const MAX_LEVEL = 5;
export const START_LEVEL = 3;

/**
 * 몇 문제를 보고 정할지.
 *
 * 셋이다. 둘이면 연달아 두 번 맞힌 것만으로 올라가 「한 문제의 정오」에
 * 가깝고, 넷이면 하루 10문제에서 좀처럼 안 움직인다.
 */
const WINDOW = 3;

/** 이 정도면 혼자 푼 것으로 본다 (COM-001 §10 Support Level 0~1) */
const SOLO_SUPPORT = 1;

/** 이 정도 도움을 받았으면 버거웠던 것으로 본다 */
const HEAVY_SUPPORT = 3;

export type Move = 'DOWN' | 'SAME' | 'UP';

export type DifficultyDecision = {
  move: Move;
  /** 옮긴 뒤의 수준. 화면에 쓰지 않는다 — 학생에게 숨긴다(COM-003 §9) */
  level: number;
  /** 로그로만 쓴다. 왜 그렇게 정했는지 */
  reason: string;
};

type Row = {
  initial_accuracy: boolean | null;
  final_accuracy: boolean;
  self_correction: boolean;
  support_level: number;
};

/** 순수 함수로 떼어 둔다. DB 없이 시험할 수 있어야 한다 */
export function decide(recent: Row[], current: number): DifficultyDecision {
  const level = Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, current));

  // **근거가 모자라면 움직이지 않는다.** 첫날 앞부분이 여기 걸린다.
  if (recent.length < WINDOW) {
    return { move: 'SAME', level, reason: `평가 ${recent.length}건 · ${WINDOW}건 필요` };
  }

  const window = recent.slice(0, WINDOW);

  // 올린다: 셋 다 처음부터 맞혔고, 도움도 거의 안 받았다.
  const easy = window.every(
    (e) => e.initial_accuracy === true && e.final_accuracy && e.support_level <= SOLO_SUPPORT,
  );
  if (easy && level < MAX_LEVEL) {
    return { move: 'UP', level: level + 1, reason: '3연속 첫 시도 정답 · 도움 거의 없음' };
  }

  // 내린다: 셋 중 둘 이상이 끝내 못 맞혔거나 많이 도와줘야 했다.
  //
  // **스스로 고쳐낸 것은 버거웠다고 보지 않는다.** 틀렸다가 자기 힘으로
  // 바로잡는 것이 이 서비스가 보려는 바로 그 장면이다(COM-001 §1).
  const struggled = window.filter(
    (e) => (!e.final_accuracy && !e.self_correction) || e.support_level >= HEAVY_SUPPORT,
  ).length;
  if (struggled >= 2 && level > MIN_LEVEL) {
    return { move: 'DOWN', level: level - 1, reason: `최근 ${WINDOW}문제 중 ${struggled}문제가 버거움` };
  }

  if (easy) return { move: 'SAME', level, reason: '이미 가장 높은 수준' };
  if (struggled >= 2) return { move: 'SAME', level, reason: '이미 가장 낮은 수준' };
  return { move: 'SAME', level, reason: '올리거나 내릴 근거 없음' };
}

/**
 * 최근 평가를 읽어 정하고, 바뀌었으면 학생에게 남긴다.
 *
 * **던지지 않는다.** 난이도를 못 옮겼다고 학습을 멈출 이유가 없다.
 * 다음 문제가 같은 수준으로 나갈 뿐이다.
 */
export async function updateDifficulty(
  client: Client,
  studentId: string,
  current: number,
): Promise<DifficultyDecision> {
  const { data, error } = await client
    .from('evaluation')
    .select('initial_accuracy, final_accuracy, self_correction, support_level')
    .eq('student_id', studentId)
    .order('evaluated_at', { ascending: false })
    .limit(WINDOW);

  if (error !== null) {
    console.error(`[difficulty] 평가를 읽지 못했습니다: ${error.message}`);
    return { move: 'SAME', level: current, reason: '평가 조회 실패' };
  }

  const decision = decide(data ?? [], current);
  if (decision.move === 'SAME') return decision;

  const { error: saveError } = await client
    .from('student')
    .update({ current_difficulty: decision.level })
    .eq('student_id', studentId);

  if (saveError !== null) {
    console.error(`[difficulty] 저장하지 못했습니다: ${saveError.message}`);
    return { move: 'SAME', level: current, reason: '저장 실패' };
  }

  return decision;
}

/**
 * 다음 문제를 지난 문제와 견줘 어느 쪽인지.
 *
 * 02 · 03 의 `learning_target.difficulty` 는 `DOWN | SAME | UP` 을 받는다.
 * 절대 수준이 아니라 **지난 문제보다 어떤지**를 말하는 칸이다.
 */
export function moveFrom(previousLevel: number | null, nextLevel: number): Move {
  if (previousLevel === null || previousLevel === nextLevel) return 'SAME';
  return nextLevel > previousLevel ? 'UP' : 'DOWN';
}
