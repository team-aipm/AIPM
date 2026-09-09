/**
 * 학습 정책값. **한 곳에서만 정의한다.**
 *
 * 지금까지 `5` 라는 숫자가 프롬프트 네 곳에 박혀 있었다. COMMON RULES ·
 * MODE A §5 · MODE A §9 · MODE B §8. 6턴으로 바꾸려면 네 곳을 고쳐야 하고
 * 한 곳을 놓치면 모듈끼리 다르게 동작한다.
 *
 * 프롬프트에도 들어가고 `turnsRemaining()` 을 계산하는 코드에도 들어가므로
 * JSON 이 아니라 TypeScript 상수로 둔다. 같은 파일에서 import 하면 어긋날
 * 수 없다.
 */

export const POLICY = {
  /**
   * 한 문제에서 허용하는 **학생 응답** 횟수.
   *
   * Drill-down 질문 횟수가 아니라 학생이 답하는 횟수다. AI 가 문제를
   * 제시한 뒤 학생이 다섯 번 답하면 끝난다. (COM-001 §7)
   */
  turnLimit: 5,
  /** 하루 기본 목표 문제 수. 강제 조건이 아니다 (COM-001 §11) */
  dailyProblemLimit: 10,
} as const;

/**
 * 남은 응답 횟수. **서버가 계산해서 프롬프트에 넣는다.**
 *
 * 프롬프트에 `student_turn_count >= 5 이면 종료` 라고 쓰면 모델이 숫자를
 * 비교해서 판단하게 된다. 문제 종료는 되돌릴 수 없는 분기라, 모델이 한 번
 * 잘못 세면 학생이 6턴을 하거나 4턴에 끊긴다.
 *
 * 비교를 여기서 끝내고 프롬프트는 `turns_remaining 이 0 이면 종료` 만
 * 읽게 한다.
 */
export function turnsRemaining(studentTurnCount: number): number {
  return Math.max(0, POLICY.turnLimit - studentTurnCount);
}

/**
 * 한 문제의 최종 support_level. **그 문제에서 나온 값의 최대값이다.**
 *
 * `hint_level` 을 없애면서 HINT 모듈과 MODE A/B 가 같은 값을 쓰게 됐다.
 * 둘 다 support 를 올릴 수 있으므로(학생이 힌트 버튼을 누르거나, AI 가
 * 막혔다고 판단해 먼저 돕거나 — COM-001 §10) 누가 정하는지가 모호해진다.
 *
 * 프롬프트에 "이전보다 낮추지 마라" 라고 쓰지 않는다. 모델에게 부탁하는
 * 것보다 서버가 계산하는 게 안전하다. turnLimit 과 같은 이유다.
 *
 * 턴별 값(`Message.support_level`)은 오르내릴 수 있다. 문제 단위
 * 값(`Evaluation.support_level`)만 단조다.
 */
export function finalSupportLevel(turnLevels: number[]): number {
  return turnLevels.reduce((max, level) => Math.max(max, level), 0);
}
