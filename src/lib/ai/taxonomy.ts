/**
 * 모듈이 공유하는 분류 체계. **한 곳에서만 정의한다.**
 *
 * Logic Gap 6개가 네 곳(MODE A INPUT · MODE B INPUT · EVALUATOR ·
 * DAILY ANALYZER)에 흩어져 있었고 **뜻은 어디에도 없었다.** 이름만 있으면
 * 같은 상황을 `rule_gap` 으로도 `inference_gap` 으로도 분류한다. 그러면
 * Tutor → Evaluator → StudentMemory → Daily → Weekly 가 서로 다른 기준을
 * 쓰게 된다.
 *
 * enum 값은 손으로 적지 않고 `types/database.ts` 의 `Constants` 에서
 * 가져온다. migration 으로 enum 이 바뀌고 타입을 다시 생성하면 여기도
 * 따라 바뀐다. (COM-002 §19-6)
 */

import { Constants } from '@/types/database';

const ENUMS = Constants.public.Enums;

// ══════════════════════════════════════════════════════════════════════
// Logic Gap
// ══════════════════════════════════════════════════════════════════════

export type GapType = (typeof ENUMS.gap_type)[number];

/**
 * 각 Logic Gap 의 뜻. **프롬프트에 이 정의를 함께 넣는다.**
 *
 * 이름만 주면 모델이 제 나름대로 분류한다. 분류 기준이 모듈마다 달라지면
 * 누적 데이터가 어긋나고, 그게 부모 리포트까지 그대로 간다.
 */
export const GAP_DEFINITIONS: Record<GapType, string> = {
  knowledge_gap: '필요한 개념 또는 지식이 부족함',
  evidence_gap: '판단이나 답은 있으나 근거를 설명하지 못함',
  rule_gap: '규칙을 잘못 이해하거나 적용함',
  inference_gap: '근거에서 결론으로 가는 추론이 잘못됨',
  transfer_gap: '이해한 내용을 다른 문제에 적용하지 못함',
  monitoring_gap: '자신의 오류나 불확실성을 점검하지 못함',
};

/** 프롬프트에 넣을 블록. 이름과 뜻을 함께 준다 */
export function gapTypesBlock(): string {
  return ENUMS.gap_type
    .map((type) => `- ${type}: ${GAP_DEFINITIONS[type]}`)
    .join('\n');
}

// ══════════════════════════════════════════════════════════════════════
// Support Level
// ══════════════════════════════════════════════════════════════════════

/**
 * 도움 수준 0~4.
 *
 * v3.0 문서에 정의된 것은 HINT 모듈의 Hint Level 1~4 뿐이었다. 그걸
 * 그대로 쓰고 `0` 만 더했다. 새로 쓴 "질문만 / 약한 힌트 / 강한 힌트"
 * 보다 판정 기준이 분명하다 — **"약한"과 "강한"은 사람마다 다르게 읽는다.**
 *
 * `hint_level` 은 없앴다. 같은 사다리의 두 번째 이름이었고 DB 에 컬럼도
 * 없다. `hint_count`(몇 번 눌렀나)는 남는다. **세기와 횟수는 다르다.**
 */
export const SUPPORT_LEVELS = [
  '도움 없이 스스로 해결',
  '생각할 방향만 제시',
  '관련 개념 또는 규칙 일부 제시',
  '다음 행동을 할 수 있는 구체적 방향',
  '정답 직전 수준의 강한 도움',
] as const;

export function supportLevelsBlock(): string {
  return SUPPORT_LEVELS.map((text, level) => `${level} = ${text}`).join('\n');
}

// ══════════════════════════════════════════════════════════════════════
// 완료 상태
// ══════════════════════════════════════════════════════════════════════

export type ProblemStatus = (typeof ENUMS.problem_status)[number];

/**
 * 프롬프트가 내는 완료 상태 → DB `problem_status`.
 *
 * **축이 다르다.** 프롬프트는 "어떻게 끝났나", DB 는 "지금 어떤 상태인가"
 * 다. 그래서 프롬프트에 DB enum 을 그대로 주지 않고 여기서 옮긴다.
 *
 * `system_interrupted`(AI·네트워크 오류)와 `abandoned`(학생 중간 종료)는
 * **모델이 알 수 없는 상태**라 이 표에 없다. 프롬프트에 DB enum 전체를
 * 주면 모델이 그걸 낼 수 있게 되고, COM-001 §19 의 "학생의 시스템 오류를
 * 오답으로 평가하지 않는다" 가 깨진다.
 */
export const COMPLETION_STATUS = {
  CONTINUE: 'active',
  CORRECT_COMPLETE: 'completed',
  ERROR_CORRECTED_COMPLETE: 'completed',
  TURN_LIMIT_COMPLETE: 'needs_review',
  PROBLEM_ERROR: 'verification_failed',
  RECOGNITION_ERROR: 'verification_failed',
} as const satisfies Record<string, ProblemStatus>;

export type CompletionStatus = keyof typeof COMPLETION_STATUS;

/** 모델이 낸 완료 상태를 DB 값으로 옮긴다. 모르는 값은 null */
export function toProblemStatus(status: string): ProblemStatus | null {
  return status in COMPLETION_STATUS
    ? COMPLETION_STATUS[status as CompletionStatus]
    : null;
}

// ══════════════════════════════════════════════════════════════════════
// action
// ══════════════════════════════════════════════════════════════════════

/**
 * 모듈이 낼 수 있는 다음 행동. **프론트가 이 값으로 화면을 정한다.**
 *
 * 모듈마다 따로 두면 새 값이 조용히 늘어나고 화면이 깨진다. 전체 목록을
 * 여기 두고 각 모듈은 그중 부분집합만 쓴다.
 */
export const ACTIONS = [
  'WAIT_STUDENT',
  'WAIT_CONFIRMATION',
  'WAIT_MODE_SELECTION',
  'COMPLETE',
  'REQUEST_NEW_PROBLEM',
  'RETURN_TO_MODE',
  'NEXT_MODE_SELECTION',
  'DAILY_ANALYSIS',
  'END_SESSION',
] as const;

export type Action = (typeof ACTIONS)[number];

/** 모듈별로 낼 수 있는 action. 이 밖의 값이 오면 검증에서 잡는다 */
export const MODULE_ACTIONS: Record<string, readonly Action[]> = {
  SESSION_HOST: ['WAIT_MODE_SELECTION', 'END_SESSION'],
  MODE_A: ['WAIT_STUDENT', 'COMPLETE'],
  MODE_B: ['WAIT_CONFIRMATION', 'WAIT_STUDENT', 'COMPLETE', 'REQUEST_NEW_PROBLEM'],
  HINT: ['RETURN_TO_MODE'],
  EVALUATOR: ['NEXT_MODE_SELECTION', 'DAILY_ANALYSIS'],
};

// ══════════════════════════════════════════════════════════════════════
// 학습 개념
// ══════════════════════════════════════════════════════════════════════

/**
 * 학년별 개념 목록 (COM-001 §9).
 *
 * **이름을 고정하지 않으면 셀 수가 없다.** 05 가 `target_concept` 을 매번
 * 자유롭게 쓰던 때, 한 학생의 취약 개념이 이렇게 쪼개졌다.
 *
 * ```text
 * 역연산의 이해                      2
 * 역연산 관계 이해                    2
 * 곱셈과 나눗셈의 역연산 관계           2
 * 역연산 관계와 문제 상황의 올바른 해석   2
 * 역연산을 이용한 미지수 구하기         2
 * ```
 *
 * 다섯이 같은 개념인데 전부 count 2 라, 무엇이 진짜 취약한지 알 수 없다.
 * Logic Gap 을 여섯 개로 묶어 둔 것과 같은 이유로 여기도 묶는다.
 *
 * 이 목록이 곧 **부모 화면의 「자주 막힌 부분」에 나가는 말**이다
 * (COM-003 §7). 아이에게는 보이지 않는다 — 학생 화면에 수학 개념명을
 * 쓰지 않는다.
 *
 * 교육과정 taxonomy 는 COM-002 §20 이 미확정으로 둔 항목이다. 여기 목록은
 * 그것을 대신 정하는 것이 아니라, **정해질 때까지 이름이 흩어지지 않게
 * 하는 임시 어휘**다. 확정되면 이 파일만 바꾼다.
 */
export const CONCEPTS: Record<4 | 5 | 6, readonly string[]> = {
  4: [
    '큰 수', '각도', '곱셈과 나눗셈', '분수의 덧셈과 뺄셈',
    '소수의 덧셈과 뺄셈', '삼각형', '사각형',
    '막대그래프', '꺾은선그래프', '규칙 찾기',
  ],
  5: [
    '자연수의 혼합 계산', '약수와 배수', '약분과 통분',
    '분수의 덧셈과 뺄셈', '다각형의 둘레와 넓이', '평균과 가능성',
    '분수의 곱셈', '소수의 곱셈', '합동과 대칭', '직육면체',
  ],
  6: [
    '분수의 나눗셈', '소수의 나눗셈', '비와 비율', '여러 가지 그래프',
    '직육면체의 부피와 겉넓이', '각기둥과 각뿔',
    '비례식과 비례배분', '원의 넓이', '원기둥과 원뿔',
  ],
};

/** 프롬프트에 넣을 목록. 학년을 모르면 셋 다 보여 준다 */
export function conceptsBlock(): string {
  return ([4, 5, 6] as const)
    .map((grade) => `${grade}학년\n  ${CONCEPTS[grade].join(' · ')}`)
    .join('\n');
}

/** 목록에 있는 이름인가. 없는 이름이 들어와도 막지는 않는다 — 기록은 남긴다 */
export function isKnownConcept(name: string): boolean {
  const trimmed = name.trim();
  return ([4, 5, 6] as const).some((g) => CONCEPTS[g].includes(trimmed));
}
