/**
 * 실행 점검. **문서가 금지한 걸 어겼는지 로그에서 찾는다.**
 *
 * 자동 실행은 구경만 하는 도구였다. 한 바퀴에 스무 걸음이 나오는데
 * 그걸 매번 눈으로 읽으면 놓친다. 실제로 붙여 받은 대화에서도 "같은
 * 말 반복" 과 "정답을 안 알려주고 끝남" 을 사람이 읽어서 찾았다.
 *
 * **모델에게 채점시키지 않는다.** 여기 있는 건 전부 코드로 판정된다.
 * 모델이 모델을 채점하면 틀렸을 때 잘못된 확신을 준다. 품질(되묻기가
 * 좋았나, 해설이 학생 수준인가)은 여기서 다루지 않는다.
 *
 * 규칙의 출처는 전부 우리 문서다. 새로 지어낸 기준이 없다.
 */

import { getPath, isRecord, parsePath, preview } from '@/lib/ai/pipeline/paths';

export type AuditLevel = 'fail' | 'warn';

export type AuditRule = {
  id: string;
  label: string;
  level: AuditLevel;
  /** 어느 문서 어느 조항인가. 화면에 그대로 보여 준다 */
  source: string;
};

export const AUDIT_RULES: AuditRule[] = [
  {
    id: 'unverified-problem',
    label: '검증 안 된 문제를 냈습니다',
    level: 'fail',
    source: 'COM-001 §19 · MODE A §4',
  },
  {
    id: 'turn-overrun',
    label: '학생 응답 횟수가 한도를 넘었습니다',
    level: 'fail',
    source: 'COM-001 §7',
  },
  {
    id: 'internal-leak',
    label: '내부 값 이름이 학생 말에 나왔습니다',
    level: 'fail',
    source: 'COM-002 §17 · COM-003',
  },
  {
    id: 'repeat',
    label: '직전과 같은 말을 했습니다',
    level: 'fail',
    source: '관찰된 결함',
  },
  { id: 'schema', label: '출력 검증에 실패했습니다', level: 'fail', source: '단계 검증 규칙' },
  {
    id: 'answer-leak',
    label: '진행 중에 정답이 보였을 수 있습니다',
    level: 'warn',
    source: 'COM-002 §17',
  },
  {
    id: 'no-closing',
    label: '문제를 끝내면서 정답을 안 알려줬습니다',
    level: 'warn',
    source: 'COM-001 §8 (PR #41 검토 중)',
  },
  {
    id: 'no-choices',
    label: '선택지가 비어 있습니다',
    level: 'warn',
    source: 'MODE A §4 · §7',
  },
  {
    id: 'answer-choice',
    label: '보기에 정답이 들어 있습니다',
    level: 'fail',
    source: 'FOUR CHOICES · MODE A §4',
  },
  {
    id: 'numeric-choices',
    label: '보기가 값 후보입니다',
    level: 'warn',
    source: 'FOUR CHOICES',
  },
];

export type Finding = {
  rule: string;
  /** 로그의 몇 번째 걸음인가 */
  step: number;
  stage: number;
  detail: string;
};

/** 점검이 읽어야 하는 단계별 자리 */
export type AuditShape = {
  name: string;
  turnCountKey: string;
  limitKey: string;
  /** 보기가 담긴 자리. 비우면 보기를 안 보는 단계다 */
  choicesKey: string;
};

/** 점검이 보는 한 걸음. `AutoStep` 에서 필요한 것만 추린 모양이다 */
export type AuditStep = {
  n: number;
  stage: number;
  kind: string;
  /** 학생에게 보인 말 */
  text: string;
  /** 모델이 낸 원문 */
  raw?: string;
  /** 그때 보낸 입력 JSON */
  input?: string;
  /** 검증 실패 건수 */
  failed?: number;
};

export type AuditResult = {
  findings: Finding[];
  /** 걸음 수 · 학생 발화 · 단계 이동 */
  steps: number;
  students: number;
  moves: number;
};

/**
 * 내부에서만 쓰는 이름들. 학생에게 보이는 말에 이게 나오면 안 된다.
 *
 * 값이 아니라 **이름**을 찾는다. 값으로 찾으면 오탐이 너무 많다 —
 * `support_level: 0` 의 `0` 은 어디에나 나온다.
 */
const INTERNAL_NAMES = [
  'verified_answer',
  'answer_lock',
  'logic_gap',
  'support_level',
  'reasoning_score',
  'transfer_score',
  'reflection_score',
  'needs_review',
  'system_interrupted',
  'problem_status',
];

/** 이 값이면 문제가 아직 안 끝났다 */
const CONTINUING = 'CONTINUE';

export function auditRun(steps: AuditStep[], shapes: AuditShape[]): AuditResult {
  const findings: Finding[] = [];
  const add = (rule: string, step: AuditStep, detail: string) =>
    findings.push({ rule, step: step.n, stage: step.stage, detail });

  let students = 0;
  let moves = 0;
  /** 단계별 직전 AI 말. 반복을 잡으려면 단계마다 따로 기억해야 한다 */
  const lastSaid = new Map<number, string>();

  for (const step of steps) {
    if (step.kind === 'student') students += 1;
    if (step.kind === 'move') moves += 1;
    if (step.kind !== 'ai') continue;

    if ((step.failed ?? 0) > 0) {
      add('schema', step, `${step.failed}건`);
    }

    // ── 같은 말 반복 ─────────────────────────────────────────────
    const said = step.text.replace(/\s+/g, ' ').trim();
    if (said !== '' && lastSaid.get(step.stage) === said) {
      add('repeat', step, cut(said));
    }
    lastSaid.set(step.stage, said);

    // ── 내부 값 이름 노출 ────────────────────────────────────────
    const leaked = INTERNAL_NAMES.filter((name) => step.text.includes(name));
    if (leaked.length > 0) {
      add('internal-leak', step, leaked.join(' · '));
    }

    // ── 한도 초과 ────────────────────────────────────────────────
    const shape = shapes[step.stage];
    if (shape !== undefined && step.input !== undefined) {
      const count = readNumber(step.input, shape.turnCountKey);
      const limit = readNumber(step.input, shape.limitKey);
      if (count !== null && limit !== null && count > limit) {
        add('turn-overrun', step, `${count} / ${limit}`);
      }
    }

    // ── 출력을 봐야 하는 것들 ────────────────────────────────────
    const output = step.raw === undefined ? null : parse(step.raw);
    if (!isRecord(output)) continue;

    const problem = read(output, 'ui.problem_text');
    const answer = read(output, 'problem_state.verified_answer');
    const locked = read(output, 'problem_state.answer_lock');
    const status = read(output, 'completion.status');
    const choicesKey = shape?.choicesKey?.trim() ?? '';
    const choices = choicesKey === '' ? undefined : read(output, choicesKey);
    const going = typeof status === 'string' && status === CONTINUING;

    // 문제를 냈는데 검증이 안 됐다.
    if (typeof problem === 'string' && problem.trim() !== '') {
      if (locked !== true || answer === undefined || answer === null) {
        add('unverified-problem', step, `answer_lock=${preview(locked)}`);
      }
      // 문제를 낼 때는 보기가 있어야 한다.
      if (Array.isArray(choices) && choices.length === 0) {
        add('no-choices', step, '문제를 내면서 ui.choices 가 비었습니다');
      }
    }

    // ── 보기가 답을 알려주는가 ───────────────────────────────────
    const labels = choiceLabels(choices);
    if (labels.length > 0) {
      // 정답이 보기에 있으면 고르기만 하면 된다.
      const leaks = labels.filter((label) => answerInText(answer, label));
      if (leaks.length > 0) {
        add('answer-choice', step, leaks.join(' · '));
      }

      // 값 후보를 늘어놓은 것. 정답이 아니어도 "찍기" 가 된다 —
      // 중간 계산의 답을 보기로 주는 경우가 여기 걸린다.
      const numeric = labels.filter((label) => /^[^0-9]*-?[0-9]+([.,][0-9]+)?[^0-9]*$/.test(label));
      if (numeric.length >= 2) {
        add('numeric-choices', step, numeric.join(' · '));
      }
    }

    // ── 정답을 언제 보였나 ───────────────────────────────────────
    const shown = answerInText(answer, step.text);
    if (going && shown) {
      add('answer-leak', step, `${preview(answer)} 가 말에 보입니다`);
    }
    // 문제를 끝내면서 정답을 안 알려줬다.
    if (
      typeof status === 'string' &&
      !going &&
      answer !== undefined &&
      answer !== null &&
      !shown
    ) {
      add('no-closing', step, `${status} 인데 ${preview(answer)} 가 없습니다`);
    }
  }

  return { findings, steps: steps.length, students, moves };
}

/**
 * 정답이 말 안에 있는가.
 *
 * **경고로만 쓴다.** 정답이 `2` 면 "128 ÷ 8 = 16" 의 어디에도 안
 * 걸리게 경계를 두지만, 짧은 답은 여전히 우연히 걸린다. 그래서
 * `answer-leak` 은 위반이 아니라 "확인해 보라" 다.
 */
function answerInText(answer: unknown, text: string): boolean {
  if (answer === undefined || answer === null) return false;
  const value = typeof answer === 'string' ? answer.trim() : String(answer);
  if (value === '') return false;

  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // 경계는 정답이 무엇이냐에 따라 다르다.
  //
  // 숫자면 숫자만 경계로 본다. "답은 2야" 처럼 한글 조사가 바로 붙는 게
  // 우리말에서는 정상이라, 한글까지 경계로 잡으면 하나도 못 찾는다.
  // 대신 12 가 128 안에서 걸리는 일은 막는다.
  //
  // 글자면 글자와 숫자를 모두 경계로 본다.
  const numeric = /^-?[0-9]+(\.[0-9]+)?$/.test(value);
  const edge = numeric ? '[^0-9]' : '[^0-9A-Za-z가-힣]';
  return new RegExp(`(^|${edge})${escaped}(${edge}|$)`).test(text);
}

/**
 * 보기의 글자만 뽑는다.
 *
 * `_chat.ts` 의 `readChoices` 와 같은 일이지만 여기서는 이미 파싱된
 * 값을 받는다. 두 벌을 두는 대신 모양을 넓게 받는 규칙만 맞춘다.
 */
function choiceLabels(choices: unknown): string[] {
  if (!Array.isArray(choices)) return [];
  const out: string[] = [];
  for (const item of choices) {
    if (typeof item === 'string') {
      if (item.trim() !== '') out.push(item);
      continue;
    }
    if (!isRecord(item)) continue;
    for (const key of ['label', 'text', 'value'] as const) {
      const value = item[key];
      if (typeof value === 'string' && value.trim() !== '') {
        out.push(value);
        break;
      }
    }
  }
  return out;
}

function read(root: unknown, path: string): unknown {
  const segments = parsePath(path);
  if (segments === null) return undefined;
  const found = getPath(root, segments);
  return found.exists ? found.value : undefined;
}

function readNumber(json: string, path: string): number | null {
  if (path.trim() === '') return null;
  const value = read(parse(json), path);
  return typeof value === 'number' ? value : null;
}

function parse(text: string): unknown {
  const trimmed = text.trim().replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/, '');
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function cut(text: string, limit = 40): string {
  return text.length <= limit ? text : `${text.slice(0, limit)}…`;
}

/**
 * 여러 번 돌린 결과를 모은다.
 *
 * **한 번 돌린 걸로는 판정이 안 된다.** 모델은 매번 다르게 답한다.
 * 한 번 통과했다고 괜찮은 게 아니고, 한 번 실패했다고 망가진 것도
 * 아니다. 프롬프트를 고쳤을 때 나아졌는지 말하려면 통과율이 있어야
 * 한다.
 */
export type Trial = {
  n: number;
  /** 어느 학생으로 돌렸나 */
  profile: string;
  reason: string;
  steps: number;
  students: number;
  findings: Finding[];
  /** 이 회차가 지나간 단계 이름. 중복 없이 */
  visited: string[];
};

export type RuleTally = {
  rule: AuditRule;
  /** 이 규칙이 걸린 회차 수 */
  trials: number;
  /** 총 몇 건 */
  total: number;
};

export type Tally = {
  runs: number;
  /** 위반이 하나도 없던 회차 수 */
  clean: number;
  avgSteps: number;
  avgStudents: number;
  /** 규칙 전부. 안 걸린 것도 0 으로 넣는다 — 무엇이 통과했는지 보여야 한다 */
  rules: RuleTally[];
  /** 어떻게 끝났나 */
  reasons: { reason: string; count: number }[];
  /**
   * 단계마다 몇 회차가 지나갔나.
   *
   * **한 번도 안 지난 단계가 있으면 시험이 절반만 된 것이다.** 아홉
   * 회차를 돌려도 03 MODE B 를 0회 지났으면 통과율은 멀쩡해 보이지만
   * MODE B 는 한 줄도 확인 못 했다.
   */
  coverage: { stage: string; trials: number }[];
};

export function tally(trials: Trial[], stageNames: string[] = []): Tally {
  const runs = trials.length;
  const rules = AUDIT_RULES.map((rule) => {
    const hit = trials.filter((trial) =>
      trial.findings.some((found) => found.rule === rule.id),
    );
    const total = trials.reduce(
      (sum, trial) => sum + trial.findings.filter((f) => f.rule === rule.id).length,
      0,
    );
    return { rule, trials: hit.length, total };
  });

  const counts = new Map<string, number>();
  for (const trial of trials) {
    counts.set(trial.reason, (counts.get(trial.reason) ?? 0) + 1);
  }

  // 화면에 있는 단계 전부를 줄로 만든다. 안 지난 단계가 0 으로 보여야
  // 한다. 지나간 것만 세면 빠진 게 안 보인다.
  const known = stageNames.length > 0
    ? stageNames
    : [...new Set(trials.flatMap((trial) => trial.visited))];

  return {
    runs,
    clean: trials.filter((trial) => trial.findings.length === 0).length,
    coverage: known.map((stage) => ({
      stage,
      trials: trials.filter((trial) => trial.visited.includes(stage)).length,
    })),
    avgSteps: mean(trials.map((trial) => trial.steps)),
    avgStudents: mean(trials.map((trial) => trial.students)),
    // 자주 걸린 것부터. 통과한 규칙은 아래로 모인다.
    rules: rules.sort((a, b) => b.trials - a.trials || b.total - a.total),
    reasons: [...counts.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count),
  };
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  const sum = values.reduce((a, b) => a + b, 0);
  return Math.round((sum / values.length) * 10) / 10;
}
