import 'server-only';

/**
 * MODE_A(학생이 직접 문제를 푸는) Drill-down 오케스트레이터.
 * DEV-001 §4 "drilldown.ts — 판단·근거·규칙·전이·성찰, 최대 5회".
 *
 * `lib/ai/prompts/stages.ts`(문서 `docs/prompts/logic-auditor.md`의 실행
 * 템플릿)를 그대로 호출한다. 프롬프트 문구를 여기서 다시 쓰지 않는다.
 *
 * ⚠️ 이번 구현 범위는 MODE_A(AI가 문제를 낸다) 한 가지다. MODE_B(학생이
 * 문제를 가져오고 AI가 의도오답을 낸다)는 사진 인식(OCR)이 먼저 있어야
 * 해서 뺐다. SESSION_HOST(모드 선택) · DAILY_ANALYZER · Student Memory
 * 갱신 · 다음 문제 자동 선정(EVALUATOR의 next_learning 활용)도 이번에는
 * 손대지 않았다 — 문제 1개를 실제 AI로 진행하고 평가까지 남기는 것이
 * 목표다.
 *
 * ⚠️ 알아낸 불일치 (코드를 고치는 대신 여기 남기고 팀에 보고해야 한다,
 * COM-005 §10):
 *   - EVALUATOR 프롬프트의 OUTPUT JSON에 `final_accuracy` 필드가 없다.
 *     그런데 COM-002 `Evaluation.final_accuracy`는 NOT NULL이다. 여기서는
 *     completion.status(CORRECT_COMPLETE만 정답)로 직접 계산했다 —
 *     모델에게 새로 묻지 않았다.
 *   - EVALUATOR가 내는 `self_correction`은 null을 허용하는데 컬럼은
 *     NOT NULL boolean이다. null이면 false로 둔다.
 *   - `primary_logic_gap`/`secondary_logic_gap`은 enum 값만 내고
 *     `logic_gap.description`(NOT NULL)에 채울 문장을 안 낸다. 그래서
 *     LogicGap row는 이번에 쓰지 않는다 (`services/evaluation.ts` 참고).
 */

import { callGemini } from '@/lib/gemini/client';
import { DEFAULT_GEMINI_MODEL } from '@/lib/gemini/models';
import { AIPM_PRESET } from '@/lib/ai/prompts/stages';
import { COMMON_RULES } from '@/lib/ai/prompts/common-rules';
import { VAR_SET_PRESET } from '@/lib/ai/prompts/variables';
import { stripFence } from '@/lib/ai/schema-check';
import { POLICY, turnsRemaining } from '@/lib/ai/policy';

const MODE_A_PROMPT = AIPM_PRESET.find((s) => s.name === '02 MODE A')!.prompt;
const EVALUATOR_PROMPT = AIPM_PRESET.find((s) => s.name === '05 EVALUATOR')!.prompt;

export type Persona = 'FRIEND' | 'VILLAIN';

function personaBlock(persona: Persona): string {
  const set = VAR_SET_PRESET.find((v) => v.name === persona);
  const block = set?.vars.find((v) => v.name === 'persona_block')?.value;
  if (!block) throw new Error(`persona_block을 찾지 못했습니다: ${persona}`);
  return block;
}

function buildSystem(modulePrompt: string, persona?: Persona): string {
  const withPersona = persona
    ? modulePrompt.replace('{{persona_block}}', personaBlock(persona))
    : modulePrompt;
  return `${COMMON_RULES}\n\n${withPersona}`;
}

export type ResponseRole = 'ANSWER' | 'REASONING' | 'RULE' | 'ERROR_CHECK' | 'RETRY';
export type ResponseTurn = {
  response_role: ResponseRole | null;
  response_type: 'CHOICE' | 'FREE_TEXT' | null;
  choice_id: string | null;
  content: string | null;
};

export type ModeAChoice = { id: string; label: string; value: string };

export type ModeAOutput = {
  mode_phase: 'PREPARE' | 'INTERACT';
  ui: {
    problem_text: string;
    message: string;
    choices: ModeAChoice[];
    allow_free_text: boolean;
    request_type: string;
  };
  problem_state: {
    problem_text: string;
    verified_answer: unknown;
    answer_lock: boolean;
  } | null;
  interaction_update: { support_level: number };
  completion: {
    status: 'CONTINUE' | 'CORRECT_COMPLETE' | 'TURN_LIMIT_COMPLETE' | 'PROBLEM_ERROR';
    action: 'WAIT_STUDENT' | 'COMPLETE';
  };
};

async function callModeA(
  system: string,
  input: unknown,
): Promise<{ raw: string } & ({ ok: true; output: ModeAOutput } | { ok: false; error: string })> {
  const result = await callGemini({
    model: DEFAULT_GEMINI_MODEL,
    system,
    input: JSON.stringify(input),
    forceJsonMimeType: true,
  });

  if (!result.ok) return { ok: false, error: result.error, raw: '' };

  try {
    const parsed = JSON.parse(stripFence(result.text)) as Record<string, unknown>;
    const output = validateModeAOutput(parsed);
    return { ok: true, output, raw: result.text };
  } catch (cause) {
    return { ok: false, error: `MODE_A 출력 파싱 실패: ${String(cause)}`, raw: result.text };
  }
}

function validateModeAOutput(value: Record<string, unknown>): ModeAOutput {
  const ui = value.ui;
  const completion = value.completion;
  if (typeof ui !== 'object' || ui === null) throw new Error('ui 없음');
  if (typeof completion !== 'object' || completion === null) throw new Error('completion 없음');

  const u = ui as Record<string, unknown>;
  const c = completion as Record<string, unknown>;
  if (typeof u.message !== 'string') throw new Error('ui.message 없음');
  if (typeof c.status !== 'string') throw new Error('completion.status 없음');

  return {
    mode_phase: value.mode_phase === 'PREPARE' ? 'PREPARE' : 'INTERACT',
    ui: {
      problem_text: typeof u.problem_text === 'string' ? u.problem_text : '',
      message: u.message,
      choices: Array.isArray(u.choices) ? (u.choices as ModeAChoice[]) : [],
      allow_free_text: u.allow_free_text !== false,
      request_type: typeof u.request_type === 'string' ? u.request_type : 'NONE',
    },
    problem_state: isProblemState(value.problem_state) ? value.problem_state : null,
    interaction_update: {
      support_level: readIntRange((value.interaction_update as Record<string, unknown>)?.support_level, 0, 4, 0),
    },
    completion: {
      status: (['CONTINUE', 'CORRECT_COMPLETE', 'TURN_LIMIT_COMPLETE', 'PROBLEM_ERROR'] as const).includes(
        c.status as never,
      )
        ? (c.status as ModeAOutput['completion']['status'])
        : 'PROBLEM_ERROR',
      action: c.action === 'COMPLETE' ? 'COMPLETE' : 'WAIT_STUDENT',
    },
  };
}

function isProblemState(value: unknown): value is ModeAOutput['problem_state'] {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).problem_text === 'string'
  );
}

function readIntRange(value: unknown, min: number, max: number, fallback: number): number {
  return Number.isInteger(value) && (value as number) >= min && (value as number) <= max
    ? (value as number)
    : fallback;
}

// ── PREPARE ────────────────────────────────────────────────────────────

export async function runModeAPrepare(params: {
  studentId: string;
  sessionId: string;
  grade: number;
  persona: Persona;
}) {
  const input = {
    module: 'MODE_A',
    student: { student_id: params.studentId, grade: params.grade, selected_persona: params.persona },
    session: { session_id: params.sessionId, problem_number: 1, total_problems: POLICY.dailyProblemLimit },
    payload: {
      mode_phase: 'PREPARE',
      learning_target: {
        // Student Memory · EVALUATOR 연동 전이라 취약 개념을 지정할 근거가
        // 없다. 임의로 특정 개념을 정하는 대신 AI가 학년 범위에서 스스로
        // 고르게 한다.
        concept: '4~6학년 수학 사칙연산·분수·소수 범위에서 AI가 자유롭게 선택',
        target_logic_gap: null,
        difficulty: 'SAME',
      },
      problem: { problem_text: null, verified_answer: null, answer_lock: false },
      interaction: {
        student_turn_count: 0,
        turn_limit: POLICY.turnLimit,
        turns_remaining: POLICY.turnLimit,
        initial_answer: null,
        latest_answer: null,
        latest_response: { response_role: null, response_type: null, choice_id: null, content: null },
        response_history: [],
        support_level: 0,
        hint_count: 0,
        hint_history: [],
      },
    },
  };

  return callModeA(buildSystem(MODE_A_PROMPT, params.persona), input);
}

// ── INTERACT ───────────────────────────────────────────────────────────

export async function runModeAInteract(params: {
  studentId: string;
  sessionId: string;
  grade: number;
  persona: Persona;
  problemText: string;
  verifiedAnswer: unknown;
  studentTurnCount: number;
  supportLevel: number;
  initialAnswer: string | null;
  responseHistory: ResponseTurn[];
  latestResponse: ResponseTurn;
}) {
  const input = {
    module: 'MODE_A',
    student: { student_id: params.studentId, grade: params.grade, selected_persona: params.persona },
    session: { session_id: params.sessionId, problem_number: 1, total_problems: POLICY.dailyProblemLimit },
    payload: {
      mode_phase: 'INTERACT',
      learning_target: {
        concept: '4~6학년 수학 사칙연산·분수·소수 범위에서 AI가 자유롭게 선택',
        target_logic_gap: null,
        difficulty: 'SAME',
      },
      problem: {
        problem_text: params.problemText,
        // Answer Lock 데이터는 서버 → 모델 호출에만 쓰고 학생 화면(API
        // 응답)에는 절대 돌려주지 않는다 (CLAUDE.md "Answer Lock 데이터는
        // 어느 시점에도 학생에게 노출하지 않는다").
        verified_answer: params.verifiedAnswer,
        answer_lock: true,
      },
      interaction: {
        student_turn_count: params.studentTurnCount,
        turn_limit: POLICY.turnLimit,
        turns_remaining: turnsRemaining(params.studentTurnCount),
        initial_answer: params.initialAnswer,
        latest_answer: params.latestResponse.content,
        latest_response: params.latestResponse,
        response_history: params.responseHistory,
        support_level: params.supportLevel,
        hint_count: 0,
        hint_history: [],
      },
    },
  };

  return callModeA(buildSystem(MODE_A_PROMPT, params.persona), input);
}

// ── EVALUATOR ──────────────────────────────────────────────────────────

export type EvaluatorOutput = {
  initial_accuracy: boolean | null;
  reasoning_score: number;
  rule_score: number;
  self_correction: boolean;
  transfer_score: number | null;
  reflection_score: number | null;
  support_level: number;
};

export async function runEvaluator(params: {
  grade: number;
  problemText: string;
  verifiedAnswer: unknown;
  initialAnswer: string | null;
  finalAnswer: string | null;
  /** MODE_A completion.status 원문 (CORRECT_COMPLETE | TURN_LIMIT_COMPLETE) */
  completionStatus: 'CORRECT_COMPLETE' | 'TURN_LIMIT_COMPLETE';
  responseHistory: ResponseTurn[];
  studentTurnCount: number;
  /** 서버가 message 로그에서 직접 센 최댓값 (policy.ts 원칙) */
  supportLevel: number;
}): Promise<{ ok: true; evaluation: EvaluatorOutput; finalAccuracy: boolean } | { ok: false; error: string }> {
  const input = {
    module: 'EVALUATOR',
    student: { student_id: '', grade: params.grade },
    session: { problem_number: 1, total_problems: POLICY.dailyProblemLimit },
    payload: {
      learning_mode: 'A',
      problem_result: {
        problem_text: params.problemText,
        verified_answer: params.verifiedAnswer,
        initial_answer: params.initialAnswer,
        final_answer: params.finalAnswer,
        completion_status: params.completionStatus,
        response_history: params.responseHistory,
        student_turn_count: params.studentTurnCount,
        turn_limit: POLICY.turnLimit,
        turns_remaining: turnsRemaining(params.studentTurnCount),
        support_level: params.supportLevel,
        hint_count: 0,
      },
      student_memory: null,
      mode_status: {
        mode_a_count: 0,
        mode_b_count: 0,
        target_mode_a: 5,
        target_mode_b: 5,
        preferred_mode: null,
        balance_policy: 'SOFT',
      },
    },
  };

  const result = await callGemini({
    model: DEFAULT_GEMINI_MODEL,
    system: buildSystem(EVALUATOR_PROMPT),
    input: JSON.stringify(input),
    forceJsonMimeType: true,
  });

  if (!result.ok) return { ok: false, error: result.error };

  try {
    const parsed = JSON.parse(stripFence(result.text)) as Record<string, unknown>;
    const evaluationRaw = parsed.evaluation as Record<string, unknown>;
    if (!evaluationRaw) throw new Error('evaluation 없음');

    const evaluation: EvaluatorOutput = {
      initial_accuracy: typeof evaluationRaw.initial_accuracy === 'boolean' ? evaluationRaw.initial_accuracy : null,
      reasoning_score: readIntRange(evaluationRaw.reasoning_score, 0, 2, 0),
      rule_score: readIntRange(evaluationRaw.rule_score, 0, 2, 0),
      // 프롬프트는 null을 허용하지만 컬럼은 NOT NULL이다 (상단 주석 참고).
      self_correction: evaluationRaw.self_correction === true,
      transfer_score:
        evaluationRaw.transfer_score === null ? null : readIntRange(evaluationRaw.transfer_score, 0, 2, 0),
      reflection_score:
        evaluationRaw.reflection_score === null ? null : readIntRange(evaluationRaw.reflection_score, 0, 2, 0),
      // support_level은 모델 출력이 아니라 서버가 message 로그로 계산한 값을 그대로 쓴다.
      support_level: params.supportLevel,
    };

    // final_accuracy는 EVALUATOR 출력에 없는 필드다 (상단 주석 참고). 완료
    // 상태 자체가 이미 "정답 도달"과 "5턴 소진"을 구분하므로 그걸로 정한다.
    const finalAccuracy = params.completionStatus === 'CORRECT_COMPLETE';

    return { ok: true, evaluation, finalAccuracy };
  } catch (cause) {
    return { ok: false, error: `EVALUATOR 출력 파싱 실패: ${String(cause)}` };
  }
}
