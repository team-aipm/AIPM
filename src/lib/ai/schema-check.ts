/**
 * 프롬프트 출력이 COM-002 스키마에 그대로 들어갈 수 있는지 검사한다.
 *
 * enum 값은 손으로 적지 않고 `src/types/database.ts`의 `Constants`에서
 * 가져온다. migration으로 enum이 바뀌고 타입을 다시 생성하면 이 검사도
 * 따라 바뀐다. (COM-002 §19-6)
 *
 * "그럴듯한 JSON이지만 insert하면 터지는" 출력을 실행 즉시 드러내는 것이
 * 목적이다.
 */

import { Constants } from '@/types/database';

const ENUMS = Constants.public.Enums;

/**
 * 단계에 붙일 수 있는 검증 규칙.
 *
 * 도구 자체는 범용이다. 아래 규칙은 이 프로젝트(AIPM) 전용이며 단계마다
 * 선택해서 쓴다. 고르지 않으면 JSON 형식 검사만 한다.
 */
export const CHECK_RULES = [
  { id: 'aipm-ocr', label: 'AIPM · 사진 인식 (COM-002 §6)' },
  { id: 'aipm-problem', label: 'AIPM · Problem (COM-002 §6)' },
  { id: 'aipm-message', label: 'AIPM · Message (§7)' },
  { id: 'aipm-evaluation', label: 'AIPM · Evaluation + LogicGap (§8·§9)' },
  { id: 'aipm-student-memory', label: 'AIPM · StudentMemory (§10)' },
  { id: 'aipm-next-problem', label: 'AIPM · 다음 문제' },
] as const;

export type CheckRuleId = (typeof CHECK_RULES)[number]['id'];

/** 출력을 JSON으로 볼지, 그냥 텍스트로 볼지 */
export type OutputMode = 'json' | 'text';

export type CheckLevel = 'pass' | 'warn' | 'fail';

export type Check = {
  label: string;
  level: CheckLevel;
  detail?: string;
};

export type CheckReport = {
  /** 파싱에 성공한 경우의 값. 실패하면 null */
  parsed: unknown;
  checks: Check[];
};

const pass = (label: string, detail?: string): Check => ({
  label,
  level: 'pass',
  detail,
});
const warn = (label: string, detail?: string): Check => ({
  label,
  level: 'warn',
  detail,
});
const fail = (label: string, detail?: string): Check => ({
  label,
  level: 'fail',
  detail,
});

export function checkOutput(options: {
  outputMode: OutputMode;
  rule: CheckRuleId | null;
  raw: string;
}): CheckReport {
  const { outputMode, rule, raw } = options;
  const checks: Check[] = [];
  const trimmed = raw.trim();

  if (outputMode === 'text') {
    return {
      parsed: null,
      checks: [
        trimmed.length > 0
          ? pass('출력 있음', `${trimmed.length}자`)
          : fail('출력 비어 있음'),
      ],
    };
  }

  // 공통 규칙: "지정된 JSON 객체 하나만 출력한다. 코드펜스를 붙이지 않는다."
  if (trimmed.startsWith('```')) {
    checks.push(fail('JSON만 출력', '코드펜스(```)가 붙어 있습니다'));
  } else if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
    checks.push(
      fail('JSON만 출력', 'JSON 객체 앞뒤에 다른 텍스트가 붙어 있습니다'),
    );
  } else {
    checks.push(pass('JSON만 출력'));
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripFence(trimmed));
    checks.push(pass('JSON 파싱'));
  } catch (cause) {
    checks.push(fail('JSON 파싱', String(cause)));
    return { parsed: null, checks };
  }

  if (!isRecord(parsed)) {
    checks.push(fail('최상위가 객체', `${typeof parsed} 을 받았습니다`));
    return { parsed, checks };
  }

  checks.push(...checkByRule(rule, parsed));
  return { parsed, checks };
}

function checkByRule(
  rule: CheckRuleId | null,
  value: Record<string, unknown>,
): Check[] {
  switch (rule) {
    case 'aipm-ocr':
      return checkOcr(value);
    case 'aipm-problem':
      return checkProblemAnalysis(value);
    case 'aipm-message':
      return checkTutor(value);
    case 'aipm-evaluation':
      return checkEvaluator(value);
    case 'aipm-student-memory':
      return checkStudentMemory(value);
    case 'aipm-next-problem':
      return checkNextProblem(value);
    default:
      return [
        pass('검증 규칙 없음', 'JSON 형식만 확인했습니다'),
      ];
  }
}

// ── 사진 인식 ────────────────────────────────────────────────────────────

/**
 * COM-002 §6 "사진 입력은 학생 확인 후 problem_text를 확정한다".
 * 인식 결과는 그대로 문제로 쓰지 않는다. 학생 확인 절차가 사이에 있다.
 */
function checkOcr(value: Record<string, unknown>): Check[] {
  const checks: Check[] = [checkNonEmptyString(value, 'problem_text')];

  const confidence = value.confidence;
  checks.push(
    typeof confidence === 'number' && confidence >= 0 && confidence <= 1
      ? pass(`confidence = ${confidence}`)
      : warn('confidence 0~1 없음', '인식 신뢰도를 내면 재촬영 안내에 쓸 수 있습니다'),
  );

  checks.push(
    value.needs_student_confirmation === true
      ? pass('needs_student_confirmation = true', 'COM-002 §6')
      : fail(
          'needs_student_confirmation 이 true 가 아님',
          '사진 인식 결과는 학생 확인 전에는 확정하지 않는다',
        ),
  );

  return checks;
}

// ── 02. Problem ──────────────────────────────────────────────────────────

function checkProblemAnalysis(value: Record<string, unknown>): Check[] {
  const checks: Check[] = [
    checkEnum(value, 'answer_lock_status', ENUMS.answer_lock_status),
    checkIntRange(value, 'difficulty', 1, 5),
    checkNonEmptyString(value, 'concept'),
    checkNonEmptyString(value, 'problem_text'),
  ];

  if (value.answer_lock_status === 'locked') {
    checks.push(checkNonEmptyString(value, 'verified_answer'));
    checks.push(checkNonEmptyString(value, 'verified_solution'));
  }

  const confidence = value.confidence;
  if (typeof confidence !== 'number') {
    checks.push(fail('confidence 숫자'));
  } else {
    const expected =
      confidence >= 0.95 ? 'locked' : confidence >= 0.7 ? 'recheck' : 'invalid_problem';
    checks.push(
      value.answer_lock_status === expected
        ? pass('confidence ↔ answer_lock_status 일치')
        : warn(
            'confidence ↔ answer_lock_status 불일치',
            `confidence ${confidence} 면 ${expected} 여야 합니다`,
          ),
    );
  }

  return checks;
}

// ── 03. Message ──────────────────────────────────────────────────────────

const TUTOR_ACTIONS = [
  'wait_student',
  'complete',
  'early_complete',
  'needs_review',
  'escalate',
] as const;

function checkTutor(value: Record<string, unknown>): Check[] {
  const checks: Check[] = [
    checkNonEmptyString(value, 'message'),
    checkEnum(value, 'action', TUTOR_ACTIONS),
    checkIntRange(value, 'support_level', 0, 4),
  ];

  // drilldown_stage 는 COM-002 §7에서 NULL 허용이다.
  if (value.drilldown_stage === null || value.drilldown_stage === undefined) {
    checks.push(pass('drilldown_stage (NULL 허용)'));
  } else {
    checks.push(checkEnum(value, 'drilldown_stage', ENUMS.drilldown_stage));
  }

  const message = value.message;
  if (typeof message === 'string') {
    checks.push(
      message.length <= 120
        ? pass('message 120자 이내', `${message.length}자`)
        : warn('message 120자 초과', `${message.length}자`),
    );
    checks.push(...checkStudentFacingText(message));
  }

  return checks;
}

/** 학생에게 그대로 보이는 문장에 노출 금지어가 섞였는지 본다. (CLAUDE.md · COM-003 §7) */
function checkStudentFacingText(text: string): Check[] {
  const banned = ['점수', '채점', '평가', '오답률', '실패', '감점'];
  const hit = banned.filter((word) => text.includes(word));
  return [
    hit.length === 0
      ? pass('학생 노출 금지어 없음')
      : fail('학생 노출 금지어 포함', hit.join(', ')),
  ];
}

// ── 04. Evaluation · LogicGap ────────────────────────────────────────────

const EVALUATION_KEYS = [
  'initial_accuracy',
  'reasoning_score',
  'rule_score',
  'self_correction',
  'transfer_score',
  'reflection_score',
  'support_level',
  'final_accuracy',
] as const;

function checkEvaluator(value: Record<string, unknown>): Check[] {
  if (value.skipped === true) {
    return [
      value.evaluation === null && Array.isArray(value.logic_gaps) && value.logic_gaps.length === 0
        ? pass('system_interrupted 건너뜀', 'evaluation null · logic_gaps 빈 배열')
        : fail(
            'system_interrupted 처리 오류',
            'skipped 이면 evaluation 은 null, logic_gaps 는 빈 배열이어야 합니다',
          ),
    ];
  }

  const checks: Check[] = [];
  const evaluation = value.evaluation;

  if (!isRecord(evaluation)) {
    checks.push(fail('evaluation 객체 존재'));
  } else {
    checks.push(
      checkBoolean(evaluation, 'initial_accuracy'),
      checkBoolean(evaluation, 'self_correction'),
      checkBoolean(evaluation, 'final_accuracy'),
      checkIntRange(evaluation, 'reasoning_score', 0, 2),
      checkIntRange(evaluation, 'rule_score', 0, 2),
      checkIntRange(evaluation, 'support_level', 0, 4),
      // COM-002 v1.1 §8 · 묻지 않았으면 NULL. 0 으로 치환 금지
      checkNullableIntRange(evaluation, 'transfer_score', 0, 2),
      checkNullableIntRange(evaluation, 'reflection_score', 0, 2),
      checkExactKeys(evaluation, EVALUATION_KEYS, 'evaluation'),
    );
  }

  const gaps = value.logic_gaps;
  if (!Array.isArray(gaps)) {
    checks.push(fail('logic_gaps 배열 존재'));
    return checks;
  }

  checks.push(
    gaps.length <= 3
      ? pass('logic_gaps 3개 이하', `${gaps.length}개`)
      : warn('logic_gaps 3개 초과', `${gaps.length}개`),
  );

  gaps.forEach((gap, index) => {
    const where = `logic_gaps[${index}]`;
    if (!isRecord(gap)) {
      checks.push(fail(`${where} 객체`));
      return;
    }
    checks.push(
      renameCheck(checkEnum(gap, 'gap_type', ENUMS.gap_type), where),
      renameCheck(checkNonEmptyString(gap, 'concept'), where),
      renameCheck(checkNonEmptyString(gap, 'description'), where),
      renameCheck(checkBoolean(gap, 'resolved'), where),
    );
  });

  return checks;
}

// ── 05. StudentMemory ────────────────────────────────────────────────────

const MASTERY = ['not_started', 'developing', 'proficient'] as const;

function checkStudentMemory(value: Record<string, unknown>): Check[] {
  const checks: Check[] = [
    checkIntRange(value, 'current_level', 1, 5),
    checkIntRange(value, 'reasoning_level', 1, 5),
    checkIntRange(value, 'transfer_level', 1, 5),
  ];

  const support = value.average_support_level;
  checks.push(
    typeof support === 'number' && support >= 0 && support <= 4
      ? pass('average_support_level 0~4')
      : fail('average_support_level 0~4', String(support)),
  );

  for (const key of ['weak_concepts', 'review_concepts', 'recurring_logic_gaps'] as const) {
    const list = value[key];
    if (!Array.isArray(list)) {
      checks.push(fail(`${key} 배열`));
      continue;
    }
    checks.push(pass(`${key} 배열`, `${list.length}개`));
  }

  for (const item of asArray(value.weak_concepts)) {
    if (!isRecord(item)) continue;
    checks.push(renameCheck(checkEnum(item, 'mastery', MASTERY), 'weak_concepts'));
  }

  for (const item of asArray(value.recurring_logic_gaps)) {
    if (!isRecord(item)) continue;
    checks.push(
      renameCheck(checkEnum(item, 'gap_type', ENUMS.gap_type), 'recurring_logic_gaps'),
    );
  }

  return checks;
}

// ── 06. Next Problem ─────────────────────────────────────────────────────

const NEXT_ACTIONS = ['next_problem', 'session_complete'] as const;
const LEARNING_PURPOSES = [
  'reinforcement',
  'misconception_check',
  'transfer',
  'difficulty_up',
  'review',
] as const;
const DIFFICULTY_DECISIONS = ['level_up', 'maintain', 'level_down'] as const;
const SELECTION_SOURCES = ['weak', 'current', 'review'] as const;

function checkNextProblem(value: Record<string, unknown>): Check[] {
  const checks: Check[] = [checkEnum(value, 'action', NEXT_ACTIONS)];

  if (value.action === 'session_complete') {
    checks.push(pass('세션 종료', '다음 문제를 만들지 않았습니다'));
    return checks;
  }

  checks.push(
    checkEnum(value, 'learning_mode', ENUMS.learning_mode),
    checkEnum(value, 'learning_purpose', LEARNING_PURPOSES),
    checkEnum(value, 'difficulty_decision', DIFFICULTY_DECISIONS),
    checkEnum(value, 'selection_source', SELECTION_SOURCES),
    checkIntRange(value, 'next_difficulty', 1, 5),
    checkNonEmptyString(value, 'concept'),
    checkNonEmptyString(value, 'problem_text'),
  );

  return checks;
}

// ── 공통 검사기 ──────────────────────────────────────────────────────────

function checkEnum(
  value: Record<string, unknown>,
  key: string,
  allowed: readonly string[],
): Check {
  const actual = value[key];
  if (typeof actual !== 'string') {
    return fail(`${key} 문자열`, `${JSON.stringify(actual)} 을 받았습니다`);
  }
  if (allowed.includes(actual)) return pass(`${key} = ${actual}`);

  const lower = actual.toLowerCase();
  const hint = allowed.includes(lower)
    ? `대문자로 냈습니다. ${lower} 여야 합니다`
    : `허용값: ${allowed.join(' · ')}`;
  return fail(`${key} 값 오류`, `${actual} — ${hint}`);
}

function checkIntRange(
  value: Record<string, unknown>,
  key: string,
  min: number,
  max: number,
): Check {
  const actual = value[key];
  if (!Number.isInteger(actual)) {
    return fail(`${key} 정수`, `${JSON.stringify(actual)} 을 받았습니다`);
  }
  const num = actual as number;
  return num >= min && num <= max
    ? pass(`${key} = ${num}`)
    : fail(`${key} 범위 ${min}~${max}`, String(num));
}

function checkNullableIntRange(
  value: Record<string, unknown>,
  key: string,
  min: number,
  max: number,
): Check {
  if (value[key] === null) return pass(`${key} = null (묻지 않음)`);
  if (!(key in value)) return fail(`${key} 누락`, 'null 이라도 넣어야 합니다');
  return checkIntRange(value, key, min, max);
}

function checkBoolean(value: Record<string, unknown>, key: string): Check {
  return typeof value[key] === 'boolean'
    ? pass(`${key} = ${value[key]}`)
    : fail(`${key} boolean`, `${JSON.stringify(value[key])} 을 받았습니다`);
}

function checkNonEmptyString(value: Record<string, unknown>, key: string): Check {
  const actual = value[key];
  return typeof actual === 'string' && actual.trim().length > 0
    ? pass(`${key} 존재`)
    : fail(`${key} 비어 있음`, JSON.stringify(actual));
}

function checkExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  where: string,
): Check {
  const extra = Object.keys(value).filter((key) => !expected.includes(key));
  const missing = expected.filter((key) => !(key in value));

  if (extra.length === 0 && missing.length === 0) {
    return pass(`${where} 키 일치`);
  }
  const detail = [
    missing.length > 0 ? `없음: ${missing.join(', ')}` : null,
    extra.length > 0 ? `추가됨: ${extra.join(', ')}` : null,
  ]
    .filter(Boolean)
    .join(' / ');

  return missing.length > 0
    ? fail(`${where} 키 불일치`, detail)
    : warn(`${where} 키 추가됨`, detail);
}

function renameCheck(check: Check, where: string): Check {
  return { ...check, label: `${where}.${check.label}` };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/**
 * 모델이 ```json 으로 감싼 출력에서 울타리를 벗긴다.
 *
 * **여기 말고 다른 데서 다시 만들지 말 것.** 한동안 이 함수가 이 파일
 * 안에만 있어서, 검증 패널은 JSON 파싱에 성공하는데 대화창·상태 이월·
 * 단계 매핑은 조용히 실패하는 일이 있었다. 모델 출력을 파싱하는 곳은
 * 전부 이걸 거친다.
 */
export function stripFence(text: string): string {
  if (!text.startsWith('```')) return text;
  return text
    .replace(/^```[a-zA-Z]*\n?/, '')
    .replace(/```$/, '')
    .trim();
}
