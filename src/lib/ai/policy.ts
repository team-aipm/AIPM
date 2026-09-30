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
  /**
   * 미션을 고르기 전 **세션 시작 대화**에서 아이가 말할 수 있는 횟수.
   *
   * 01 SESSION HOST 는 "짧은 Coffee Chat 후 첫 Learning Mode를 추천" 하는
   * 자리다. 그런데 여기엔 지금까지 **제한이 없었다.** 문제 풀이에는 5턴
   * 제한이 있는데(`turnLimit`) 시작 대화는 끝없이 이어질 수 있었다.
   *
   * 막는 이유가 둘이다.
   *
   * ```text
   * 1  아이가 미션을 시작하지 않는다. 떠드는 것이 더 재미있으면 그렇게 된다
   * 2  한 마디마다 4,500 토큰이 나간다. 대화 길이에 상한이 없으면 비용에도 없다
   * ```
   *
   * 여섯으로 둔 것은 인사 · 근황 한두 마디 · 고르기까지면 넉넉하기
   * 때문이다. 닿으면 나무라지 않고 **고를 것 두 개만 내민다.**
   */
  hostTurnLimit: 6,
  /**
   * 모델에게 넘길 대화 최대 길이 (학생 + AI 합쳐서).
   *
   * **`turns` 는 클라이언트가 보낸다.** 서버가 길이를 안 보면 조작된
   * 요청이 프롬프트를 얼마든지 부풀릴 수 있다. `hostTurnLimit` 의 두 배에
   * 조금 더 둔다 — 정상 대화는 여기 닿지 않는다.
   */
  hostHistoryLimit: 16,
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
