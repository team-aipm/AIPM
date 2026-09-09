/**
 * 학생 어휘 ↔ 부모 어휘.
 *
 * **같은 상태를 두 사람에게 다르게 부른다.** `needs_review` 는 부모에게
 * "추가 학습 필요" 지만 학생에게는 "한 번 더 도전" 이다. 학생에게
 * "추가 학습 필요" 라고 쓰면 그건 실패 통보다.
 *
 * 변환은 여기 한 곳에서만 한다. 화면마다 문자열을 적으면 한쪽만 고치는
 * 사고가 난다 — 학생 화면 열 곳 중 아홉 곳만 고친 것은 눈으로 안 보인다.
 *
 * **여기 있는 말은 화면에 나가는 말이다.** DB 값도, 프롬프트가 읽는 값도
 * 아니다. 저장하거나 모델에 보낼 때는 언제나 내부 값(`mode_a` ·
 * `needs_review`)을 쓴다.
 *
 * 근거: COM-003 §7 · CLAUDE.md 「용어」
 */

import type { Database } from '@/types/database';

type Enums = Database['public']['Enums'];

/** 누구에게 보여 줄 말인가. 화면 폴더와 1:1 이다 — (student) · (parent) */
export type Audience = 'student' | 'parent';

/** 한 내부 값에 대한 두 벌의 말 */
type Pair = { student: string; parent: string };

const say = (pair: Pair, to: Audience): string => pair[to];

// ============================================================
// 파트너 (Persona)
// ============================================================

/**
 * Persona 의 화면 이름.
 *
 * DB 는 `friend` · `villain` 두 값만 안다. 화면에서는 이름을 가진 인물로
 * 나온다. **이름은 화면의 것이지 판단의 것이 아니다** — COM-001 §19,
 * Persona 는 말투와 연출만 담당하고 정답 · 평가 · 난이도 · 검증을 바꾸지
 * 않는다.
 *
 * 파트너를 늘리려면 COM-002 에 먼저 제안해야 한다. 지금 늘릴 수 없다.
 */
export const PARTNER_NAME: Record<Enums['persona_type'], string> = {
  friend: '메티',
  villain: '헷티',
};

// ============================================================
// 학습 모드
// ============================================================

/**
 * 모드 이름은 **파트너 이름을 안고 있다.**
 *
 * "메티 채점하기" 는 파트너가 헷티면 "헷티 채점하기" 가 되어야 한다.
 * 그래서 문자열이 아니라 함수다. 문자열로 박으면 파트너마다 한 벌씩
 * 복사하게 된다.
 *
 * **내부 이름은 mode_a · mode_b 그대로 둔다.** 화면 이름이 바뀔 때마다
 * DB enum 을 건드릴 수는 없다.
 *
 *   mode_a   AI 가 문제를 내고 학생이 푼다
 *   mode_b   학생이 문제를 가져오고 AI 가 푼다 (학생이 AI 를 검사한다)
 */
export function learningModeLabel(
  mode: Enums['learning_mode'],
  to: Audience,
  partner: string = PARTNER_NAME.friend,
): string {
  const table: Record<Enums['learning_mode'], Pair> = {
    mode_a: { student: `${partner}가 물어보기`, parent: 'AI 출제' },
    mode_b: { student: `${partner} 채점하기`, parent: '학생 출제' },
  };
  return say(table[mode], to);
}

/** 모드를 고를 때 밑에 붙는 한 줄. 무엇을 하는 시간인지 알려 준다 */
export function learningModeHint(
  mode: Enums['learning_mode'],
  partner: string = PARTNER_NAME.friend,
): string {
  return mode === 'mode_a'
    ? `질문에 답하다 보면 내가 뭘 아는지 보여`
    : `문제를 가져오면 ${partner}가 먼저 풀어`;
}

// ============================================================
// 문제 상태
// ============================================================

/**
 * **여기가 가장 조심할 자리다.**
 *
 * `system_interrupted` 는 학생이 못 푼 게 아니라 우리 쪽이 끊긴 것이다.
 * 정답률에도 완료 문제 수에도 넣지 않는다(COM-001 §19). 화면에서도
 * 학생 잘못처럼 보이면 안 된다.
 *
 * `needs_review` 를 학생 화면에서 "실패" 로 표현하지 않는다.
 */
export function problemStatusLabel(
  status: Enums['problem_status'],
  to: Audience,
): string {
  const table: Record<Enums['problem_status'], Pair> = {
    active: { student: '도전 중', parent: '진행 중' },
    completed: { student: '해냈어', parent: '완료' },
    needs_review: { student: '한 번 더 도전', parent: '추가 학습 필요' },
    // 우리 쪽 오류다. 학생에게는 사과하고, 부모에게는 집계에서 빠졌다고 알린다.
    system_interrupted: {
      student: '잠깐 멈췄어. 다시 해보자',
      parent: '시스템 중단 · 집계 제외',
    },
    // 정답을 확신하지 못한 문제다. 억지로 진행하지 않는다(COM-001 §19).
    verification_failed: {
      student: '이 문제는 잠깐 접어두자',
      parent: '문제 검증 실패 · 집계 제외',
    },
    abandoned: { student: '다음에 이어서', parent: '중단' },
  };
  return say(table[status], to);
}

export function sessionStatusLabel(
  status: Enums['session_status'],
  to: Audience,
): string {
  const table: Record<Enums['session_status'], Pair> = {
    active: { student: '하는 중', parent: '진행 중' },
    completed: { student: '오늘 미션 끝', parent: '완료' },
    incomplete: { student: '하다 남음', parent: '미완료' },
  };
  return say(table[status], to);
}

// ============================================================
// 낱말
// ============================================================

/**
 * 화면에 자주 나오는 낱말. COM-003 §7 의 표 그대로다.
 *
 * 학생 화면에서는 `학습` 을 쓰지 않는다.
 */
export const TERMS = {
  learning: { student: '미션', parent: '학습' },
  startLearning: { student: '미션 시작하기', parent: '학습 시작' },
  resumeLearning: { student: '미션 이어하기', parent: '학습 이어서' },
  learningResult: { student: '오늘의 기록', parent: '학습 결과' },
  nextProblem: { student: '다음 미션', parent: '다음 문제' },
  evaluation: { student: null, parent: '사고능력' },
  logicGap: { student: null, parent: '자주 막힌 부분' },
} as const satisfies Record<string, { student: string | null; parent: string }>;

/**
 * 낱말 하나를 꺼낸다.
 *
 * **학생에게 보여 주면 안 되는 것은 `null` 이다.** `Evaluation` 과
 * `LogicGap` 이 그렇다 — 상세 평가점수와 Logic Gap 은 학생 화면에
 * 노출하지 않는다(COM-003). 부르는 쪽이 `null` 을 받으면 그 자리를
 * 통째로 그리지 않는다는 뜻이다. 빈 문자열로 대신하면 빈 카드가 남는다.
 */
export function term(key: keyof typeof TERMS, to: Audience): string | null {
  return TERMS[key][to];
}

/**
 * 학생 화면에 절대 나가지 않는 값.
 *
 * 글로만 적어 두면 지켜지지 않는다. 학생 화면을 만들 때 이 목록을 보고
 * 확인한다. 나중에 검사로 바꿀 자리이기도 하다.
 *
 *   evaluation      상세 평가점수
 *   logic_gap       사고 오류 분류
 *   answer_lock     어느 시점에도 노출하지 않는다
 *   verified_answer **문제 진행 중에만** 감춘다. 문제를 종료할 때는
 *                   정답과 해설을 보여준다(COM-001 §8 · COM-002 §17)
 */
export const HIDDEN_FROM_STUDENT = [
  'evaluation',
  'logic_gap',
  'answer_lock',
  'verified_answer',
] as const;
