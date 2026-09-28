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

/** COM-002 §6 `current_difficulty`. **`learning_grade` 안에서의** 상대값이다 */
export const MIN_LEVEL = 1;
export const MAX_LEVEL = 5;
export const START_LEVEL = 3;

/**
 * 출제 범위 (COM-001 §9 · COM-002 §4).
 *
 * **제 학년 안에만 머물지 않는다.** 4학년 아이가 4학년 레벨 1 에서도
 * 계속 막히면 3학년으로 내려간다. 결손이 있는 아이에게 제 학년 문제만
 * 주면 아무것도 되지 않는다.
 *
 * ```text
 *   1학년 레벨 1   바닥. `1 + 1` 수준이다
 *   중1   레벨 5   천장. 7 = 중1
 * ```
 *
 * 천장을 중1 로 둔 것은 **6학년 레벨 5 를 뚫는 아이가 실제로 나오는지
 * 아직 모르기 때문**이다. 나오면 그때 다시 본다.
 *
 * `student.grade`(실제 학년)와 다른 값이다. 그쪽은 4~6 으로 묶여 있고
 * 부모가 고치기 전에는 안 움직인다.
 */
export const MIN_GRADE = 1;
export const MAX_GRADE = 7;

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

/** 지금 어디를 풀고 있나. 학년과 그 안에서의 수준이 함께 움직인다 */
export type Standing = {
  /** `student.learning_grade`. 1~7 (7 = 중1). **실제 학년과 다른 값이다** */
  grade: number;
  /** `student.current_difficulty`. 그 학년 안에서 1~5 */
  level: number;
};

export type DifficultyDecision = Standing & {
  move: Move;
  /** 학년이 함께 바뀌었나. 로그와 시뮬레이터가 읽는다 */
  gradeMoved: boolean;
  /** 로그로만 쓴다. 왜 그렇게 정했는지 */
  reason: string;
};

type Row = {
  initial_accuracy: boolean | null;
  final_accuracy: boolean;
  self_correction: boolean;
  support_level: number;
};

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));

/**
 * 한 칸 옮긴다. **레벨 끝에서는 학년이 넘어간다** (COM-001 §9).
 *
 * ```text
 *   레벨 1 에서 DOWN  →  학년 −1, 레벨 5
 *   레벨 5 에서 UP    →  학년 +1, 레벨 1
 * ```
 *
 * 바닥(1학년 레벨 1)과 천장(중1 레벨 5)에서는 움직이지 않는다. 바닥은
 * `1 + 1` 수준이라 그 아래가 없고, 천장은 그 위가 실제로 필요한지 아직
 * 모른다.
 */
function step(from: Standing, move: Exclude<Move, 'SAME'>): Standing | null {
  if (move === 'UP') {
    if (from.level < MAX_LEVEL) return { ...from, level: from.level + 1 };
    if (from.grade < MAX_GRADE) return { grade: from.grade + 1, level: MIN_LEVEL };
    return null; // 천장
  }
  if (from.level > MIN_LEVEL) return { ...from, level: from.level - 1 };
  if (from.grade > MIN_GRADE) return { grade: from.grade - 1, level: MAX_LEVEL };
  return null; // 바닥
}

const same = (at: Standing, reason: string): DifficultyDecision => ({
  ...at,
  move: 'SAME',
  gradeMoved: false,
  reason,
});

/** 순수 함수로 떼어 둔다. DB 없이 시험할 수 있어야 한다 */
export function decide(recent: Row[], current: Standing): DifficultyDecision {
  const at: Standing = {
    grade: clamp(current.grade, MIN_GRADE, MAX_GRADE),
    level: clamp(current.level, MIN_LEVEL, MAX_LEVEL),
  };

  // **근거가 모자라면 움직이지 않는다.** 첫날 앞부분이 여기 걸린다.
  if (recent.length < WINDOW) {
    return same(at, `평가 ${recent.length}건 · ${WINDOW}건 필요`);
  }

  const window = recent.slice(0, WINDOW);

  // 올린다: 셋 다 처음부터 맞혔고, 도움도 거의 안 받았다.
  const easy = window.every(
    (e) => e.initial_accuracy === true && e.final_accuracy && e.support_level <= SOLO_SUPPORT,
  );

  // 내린다: 셋 중 둘 이상이 끝내 못 맞혔거나 많이 도와줘야 했다.
  //
  // **스스로 고쳐낸 것은 버거웠다고 보지 않는다.** 틀렸다가 자기 힘으로
  // 바로잡는 것이 이 서비스가 보려는 바로 그 장면이다(COM-001 §1).
  const struggled = window.filter(
    (e) => (!e.final_accuracy && !e.self_correction) || e.support_level >= HEAVY_SUPPORT,
  ).length;

  if (easy) {
    const next = step(at, 'UP');
    if (next === null) return same(at, '이미 가장 높은 수준');
    return {
      ...next,
      move: 'UP',
      gradeMoved: next.grade !== at.grade,
      reason: '3연속 첫 시도 정답 · 도움 거의 없음',
    };
  }

  if (struggled >= 2) {
    const next = step(at, 'DOWN');
    if (next === null) return same(at, '이미 가장 낮은 수준');
    return {
      ...next,
      move: 'DOWN',
      gradeMoved: next.grade !== at.grade,
      reason: `최근 ${WINDOW}문제 중 ${struggled}문제가 버거움`,
    };
  }

  return same(at, '올리거나 내릴 근거 없음');
}

/**
 * 최근 평가를 읽어 정하고, 바뀌었으면 학생에게 남긴다.
 *
 * **현재 수준에서 푼 문제만 본다** (COM-001 §9 판정 시점).
 *
 * 수준을 옮기면 그 전 평가는 다른 수준에서 푼 것이다. 그것을 계속 세면
 * 같은 기록으로 연달아 움직인다. 하루 10문제에 창이 3문제라 하루에도
 * 레벨이 여러 번 바뀌고, 그러면 아이의 수준이 아니라 **그날의 운**을
 * 따라간다.
 *
 * 창을 비우는 데 별도 칸이 필요하지 않다. `problem` 에 문제를 낼 때의
 * **학년과 수준**이 이미 남아 있으므로, 지금과 같은 자리에서 푼 것만
 * 고르면 된다. 학년까지 보는 이유는 **4학년 레벨 5 와 5학년 레벨 5 가
 * 다른 자리**이기 때문이다.
 *
 * **던지지 않는다.** 난이도를 못 옮겼다고 학습을 멈출 이유가 없다.
 * 다음 문제가 같은 수준으로 나갈 뿐이다.
 */
export async function updateDifficulty(
  client: Client,
  studentId: string,
  current: Standing,
): Promise<DifficultyDecision> {
  const { data, error } = await client
    .from('evaluation')
    .select(
      'initial_accuracy, final_accuracy, self_correction, support_level, problem!inner(difficulty, learning_grade)',
    )
    .eq('student_id', studentId)
    .eq('problem.difficulty', current.level)
    .eq('problem.learning_grade', current.grade)
    .order('evaluated_at', { ascending: false })
    .limit(WINDOW);

  if (error !== null) {
    console.error(`[difficulty] 평가를 읽지 못했습니다: ${error.message}`);
    return same(current, '평가 조회 실패');
  }

  const decision = decide(data ?? [], current);
  if (decision.move === 'SAME') return decision;

  const { error: saveError } = await client
    .from('student')
    .update({ current_difficulty: decision.level, learning_grade: decision.grade })
    .eq('student_id', studentId);

  if (saveError !== null) {
    console.error(`[difficulty] 저장하지 못했습니다: ${saveError.message}`);
    return same(current, '저장 실패');
  }

  return decision;
}

/**
 * 다음 문제를 지난 문제와 견줘 어느 쪽인지.
 *
 * 02 · 03 의 `learning_target.difficulty` 는 `DOWN | SAME | UP` 을 받는다.
 * 절대 수준이 아니라 **지난 문제보다 어떤지**를 말하는 칸이다.
 *
 * **학년을 먼저 본다.** 레벨만 견주면 4학년 레벨 5 → 5학년 레벨 1 이
 * `DOWN` 으로 읽힌다. 올라간 것인데 내려갔다고 말하게 된다.
 */
export function moveFrom(previous: Standing | null, next: Standing): Move {
  if (previous === null) return 'SAME';
  if (previous.grade !== next.grade) return next.grade > previous.grade ? 'UP' : 'DOWN';
  if (previous.level === next.level) return 'SAME';
  return next.level > previous.level ? 'UP' : 'DOWN';
}
