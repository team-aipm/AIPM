'use server';

/**
 * MIS-001 미션 진행 · 01 SESSION HOST 와 주고받는 부분.
 *
 * **이 파일은 상수를 내보내지 않는다.** `'use server'` 파일은 async 함수만
 * 내보낼 수 있고, 어기면 빌드는 통과한 채 실행할 때 500 이 난다.
 *
 * 대화는 화면이 들고 있다가 매 턴 통째로 보낸다. 01 의 주고받음은 아직
 * 저장할 자리가 없다 — `message` 는 `problem_id` 가 필수라(COM-002 §7)
 * 문제가 생기기 전의 말은 담을 곳이 없다. 새로고침하면 사라진다.
 */

import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getStudent } from '@/lib/services/student';
import { findTodaySession, countCompleted, today } from '@/lib/services/learning-session';
import { findDailyReport, saveDailyReport } from '@/lib/services/learning-report';
import { createProblem, findActiveProblem, finishProblem } from '@/lib/services/problem';
import { appendMessage, listMessages } from '@/lib/services/message';
import { EVENT, record } from '@/lib/analytics/events';
import { saveEvaluation, saveLogicGaps } from '@/lib/services/evaluation';
import { Constants, type Database } from '@/types/database';
import { STUDENT_COOKIE } from '@/lib/constants/student-cookie';
import { runStage, stageOf } from '@/lib/ai/pipeline/run';
import { getPath, parsePath, setPath } from '@/lib/ai/pipeline/paths';

export type Turn = { who: 'ai' | 'student'; text: string };
export type Choice = { label: string; value: string };

export type HostReply =
  | {
      ok: true;
      message: string;
      choices: Choice[];
      /** 'MODE_A' · 'MODE_B' · 'SESSION_HOST' · 'END' */
      nextModule: string;
    }
  | { ok: false; message: string };

const str = (value: unknown): string => (typeof value === 'string' ? value : '');

function write(json: unknown, path: string, value: unknown): unknown {
  const segments = parsePath(path);
  if (segments === null) return json;
  return setPath(json, segments, value);
}

function read(json: unknown, path: string): unknown {
  const segments = parsePath(path);
  if (segments === null) return undefined;
  return getPath(json, segments).value;
}

/**
 * 01 에 보낼 입력을 만든다.
 *
 * 예시(`sampleInput`)를 뼈대로 쓰고 **지금 아는 값만 덮는다.** 통째로 새로
 * 만들면 프롬프트가 읽는 칸을 하나 빠뜨렸을 때 조용히 다르게 굴고, 그게
 * 화면에서는 "AI 가 이상해졌다" 로만 보인다.
 */
function buildHostInput(args: {
  studentId: string;
  grade: number;
  persona: 'friend' | 'villain';
  sessionId: string;
  problemNumber: number;
  totalProblems: number;
  isFirstUse: boolean;
  turns: Turn[];
  latest: string | null;
}): string {
  const stage = stageOf('01 SESSION HOST');
  let input: unknown = JSON.parse(stage.sampleInput);

  input = write(input, 'student.student_id', args.studentId);
  input = write(input, 'student.grade', args.grade);
  // 프롬프트는 대문자 enum 을 읽는다. DB 는 소문자다(persona_type).
  input = write(input, 'student.selected_persona', args.persona.toUpperCase());

  input = write(input, 'session.session_id', args.sessionId);
  input = write(input, 'session.problem_number', args.problemNumber);
  input = write(input, 'session.total_problems', args.totalProblems);

  input = write(input, 'payload.session_phase', 'START');
  input = write(input, 'payload.is_first_use', args.isFirstUse);

  input = write(
    input,
    'conversation',
    args.turns.map((turn) => ({
      speaker: turn.who === 'ai' ? 'ai' : 'student',
      message_text: turn.text,
    })),
  );
  input = write(input, 'latest_response', args.latest);

  return JSON.stringify(input, null, 2);
}

/**
 * 01 을 한 번 돌린다.
 *
 * `text` 가 null 이면 세션의 첫 말(START)이고, 있으면 학생이 방금 한 말이다.
 * 01 은 학생이 고르기 전까지 `next_module = "SESSION_HOST"` 로 두고 기다린다.
 */
export async function talkToHost(text: string | null, turns: Turn[]): Promise<HostReply> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (auth.user === null) return { ok: false, message: '다시 로그인해줘.' };

  const jar = await cookies();
  const studentId = jar.get(STUDENT_COOKIE)?.value ?? '';
  const student = studentId === '' ? null : await getStudent(supabase, studentId);
  if (student === null) return { ok: false, message: '누구로 할지 먼저 골라줘.' };

  const session = await findTodaySession(supabase, student.student_id);
  if (session === null) return { ok: false, message: '오늘 미션을 먼저 시작해줘.' };

  const input = buildHostInput({
    studentId: student.student_id,
    grade: student.grade,
    persona: student.persona_type,
    sessionId: session.session_id,
    problemNumber: session.completed_problem_count + 1,
    totalProblems: session.target_problem_count,
    isFirstUse: session.completed_problem_count === 0 && turns.length === 0,
    turns,
    latest: text,
  });

  const result = await runStage('01 SESSION HOST', input, student.persona_type);

  if (!result.ok) {
    // **학생 잘못처럼 말하지 않는다**(CLAUDE.md UI). 무엇을 하면 되는지만
    // 알려준다.
    console.error(`[mission] 01 실패: ${result.error}`);
    return { ok: false, message: '잠깐 멈췄어. 다시 한 번 말해줄래?' };
  }

  const output = result.output;
  const rawChoices = read(output, 'mode_choices');
  const choices: Choice[] = Array.isArray(rawChoices)
    ? rawChoices
        .map((item) => ({ label: str(read(item, 'label')), value: str(read(item, 'value')) }))
        .filter((item) => item.label !== '')
    : [];

  return {
    ok: true,
    message: str(output.message),
    choices,
    nextModule: str(output.next_module),
  };
}

// ============================================================
// 02 MODE A · 문제를 내고 함께 푼다
// ============================================================

/** 한 문제에서 학생이 말할 수 있는 횟수. 02 예시가 5 다(COM-001 §8) */
const TURN_LIMIT = 5;

export type ProblemView = {
  ok: true;
  problemText: string;
  message: string;
  choices: Choice[];
  allowFreeText: boolean;
  turnsLeft: number;
  /** 이 문제가 끝났는가 */
  finished: boolean;
  /** 오늘 몫을 다 채웠는가 */
  sessionFinished: boolean;
};

export type ProblemReply = ProblemView | { ok: false; message: string };

const num = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

/**
 * 02 에 보낼 입력을 만든다.
 *
 * **DB 에서 다시 세운다.** 화면이 들고 있다가 돌려보내면 `verified_answer`
 * 가 브라우저로 나가고, 그건 문제 진행 중에 감춰야 하는 값이다
 * (COM-003 · CLAUDE.md). 대화가 `message` 에 남아 있으니 서버가 매번
 * 다시 만들면 된다 — 새로고침해도 이어진다.
 */
function buildModeAInput(args: {
  studentId: string;
  grade: number;
  persona: 'friend' | 'villain';
  sessionId: string;
  problemNumber: number;
  totalProblems: number;
  phase: 'PREPARE' | 'INTERACT';
  problem: { text: string; verifiedAnswer: unknown; locked: boolean } | null;
  studentTexts: string[];
  supportLevel: number;
  latest: string | null;
}): string {
  const stage = stageOf('02 MODE A');
  let input: unknown = JSON.parse(stage.sampleInput);

  input = write(input, 'student.student_id', args.studentId);
  input = write(input, 'student.grade', args.grade);
  input = write(input, 'student.selected_persona', args.persona.toUpperCase());

  input = write(input, 'session.session_id', args.sessionId);
  input = write(input, 'session.problem_number', args.problemNumber);
  input = write(input, 'session.total_problems', args.totalProblems);

  input = write(input, 'payload.learning_mode', 'A');
  input = write(input, 'payload.mode_phase', args.phase);

  // **개념 선정은 아직 없다.** COM-001 §9 는 취약 개념 4 · 현재 수준 4 ·
  // 복습 2 로 섞으라고 하는데, 그러려면 개념 목록과 학생 기록이 필요하다.
  // null 로 두면 모델이 학년에 맞는 문제를 고른다. 지어낸 개념명을 넣는
  // 것보다 낫다.
  input = write(input, 'payload.learning_target.concept', null);
  input = write(input, 'payload.learning_target.target_logic_gap', null);
  input = write(input, 'payload.learning_target.difficulty', 'SAME');

  input = write(input, 'payload.problem.problem_text', args.problem?.text ?? null);
  input = write(input, 'payload.problem.verified_answer', args.problem?.verifiedAnswer ?? null);
  input = write(input, 'payload.problem.answer_lock', args.problem?.locked ?? false);

  const used = args.studentTexts.length;
  input = write(input, 'payload.interaction.student_turn_count', used);
  input = write(input, 'payload.interaction.turn_limit', TURN_LIMIT);
  input = write(input, 'payload.interaction.turns_remaining', Math.max(0, TURN_LIMIT - used));
  input = write(input, 'payload.interaction.initial_answer', args.studentTexts[0] ?? null);
  input = write(
    input,
    'payload.interaction.latest_answer',
    args.studentTexts[used - 1] ?? null,
  );
  input = write(input, 'payload.interaction.latest_response', {
    response_role: null,
    response_type: 'FREE_TEXT',
    choice_id: null,
    content: args.latest,
  });
  input = write(
    input,
    'payload.interaction.response_history',
    args.studentTexts.map((text) => ({
      response_role: null,
      response_type: 'FREE_TEXT',
      choice_id: null,
      content: text,
    })),
  );
  input = write(input, 'payload.interaction.support_level', args.supportLevel);
  input = write(input, 'payload.interaction.hint_count', 0);
  input = write(input, 'payload.interaction.hint_history', []);

  return JSON.stringify(input, null, 2);
}

function readChoices(output: unknown): Choice[] {
  const raw = read(output, 'ui.choices');
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => ({ label: str(read(item, 'label')), value: str(read(item, 'value')) }))
    .filter((item) => item.label !== '');
}

/** 화면 · 서버가 함께 쓰는 준비물. 매 동작마다 같은 것을 확인한다 */
async function context() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (auth.user === null) return null;

  const jar = await cookies();
  const studentId = jar.get(STUDENT_COOKIE)?.value ?? '';
  const student = studentId === '' ? null : await getStudent(supabase, studentId);
  if (student === null) return null;

  const session = await findTodaySession(supabase, student.student_id);
  if (session === null) return null;

  return { supabase, student, session };
}

/**
 * 문제를 하나 낸다 (02 PREPARE).
 *
 * 01 이 `next_module = "MODE_A"` 를 냈을 때 부른다. 여기서 `problem` 행이
 * 생기고, 그때부터 대화가 `message` 에 남는다.
 */
export async function startProblem(): Promise<ProblemReply> {
  const ctx = await context();
  if (ctx === null) return { ok: false, message: '다시 들어와줄래?' };
  const { supabase, student, session } = ctx;

  const input = buildModeAInput({
    studentId: student.student_id,
    grade: student.grade,
    persona: student.persona_type,
    sessionId: session.session_id,
    problemNumber: session.completed_problem_count + 1,
    totalProblems: session.target_problem_count,
    phase: 'PREPARE',
    problem: null,
    studentTexts: [],
    supportLevel: 0,
    latest: null,
  });

  const result = await runStage('02 MODE A', input, student.persona_type);
  if (!result.ok) {
    console.error(`[mission] 02 PREPARE 실패: ${result.error}`);
    return { ok: false, message: '문제를 고르다가 잠깐 멈췄어. 다시 해볼래?' };
  }

  const output = result.output;
  const problemText = str(read(output, 'problem_state.problem_text'));
  const message = str(read(output, 'ui.message'));
  const verified = read(output, 'problem_state.verified_answer');

  if (problemText === '') {
    console.error('[mission] 02 가 문제를 내지 않았습니다');
    return { ok: false, message: '문제를 고르다가 잠깐 멈췄어. 다시 해볼래?' };
  }

  const problem = await createProblem(supabase, {
    sessionId: session.session_id,
    studentId: student.student_id,
    problemSource: 'ai',
    problemText,
    // 개념 선정(COM-001 §9)이 아직 없다. 지어낸 이름을 넣지 않는다.
    concept: '미지정',
    difficulty: student.current_difficulty,
    learningMode: 'mode_a',
    verifiedAnswer: verified ?? null,
    answerLock: read(output, 'problem_state.answer_lock') === true,
  });

  await appendMessage(supabase, {
    problemId: problem.problem_id,
    sessionId: session.session_id,
    studentId: student.student_id,
    speaker: 'ai',
    text: message === '' ? problemText : message,
    turnNumber: 1,
    supportLevel: num(read(output, 'interaction_update.support_level'), 0),
  });

  await record(supabase, EVENT.problemStarted, {
    studentId: student.student_id,
    sessionId: session.session_id,
  });

  return {
    ok: true,
    problemText,
    message,
    choices: readChoices(output),
    allowFreeText: read(output, 'ui.allow_free_text') !== false,
    turnsLeft: TURN_LIMIT,
    finished: false,
    sessionFinished: false,
  };
}

/**
 * 학생이 답한다 (02 INTERACT).
 *
 * 대화는 DB 에서 다시 세운다. 화면이 보내는 것은 **방금 한 말 한 줄**뿐이다.
 */
export async function answerProblem(text: string): Promise<ProblemReply> {
  const said = text.trim();
  if (said === '') return { ok: false, message: '무슨 생각을 했는지 말해줄래?' };

  const ctx = await context();
  if (ctx === null) return { ok: false, message: '다시 들어와줄래?' };
  const { supabase, student, session } = ctx;

  const problem = await findActiveProblem(supabase, session.session_id);
  if (problem === null) return { ok: false, message: '풀던 문제를 찾지 못했어.' };

  const before = await listMessages(supabase, problem.problem_id);
  const studentTexts = before
    .filter((m) => m.speaker === 'student')
    .map((m) => m.message_text);
  const supportLevel = before.reduce((max, m) => Math.max(max, m.support_level), 0);

  await appendMessage(supabase, {
    problemId: problem.problem_id,
    sessionId: session.session_id,
    studentId: student.student_id,
    speaker: 'student',
    text: said,
    turnNumber: before.length + 1,
    supportLevel,
  });

  // 같은 화면에서 두 모드가 이어진다. 어느 단계를 부를지는 문제가 안다.
  const isModeB = problem.learning_mode === 'mode_b';
  const common = {
    studentId: student.student_id,
    grade: student.grade,
    persona: student.persona_type,
    sessionId: session.session_id,
    problemNumber: session.completed_problem_count + 1,
    totalProblems: session.target_problem_count,
    studentTexts: [...studentTexts, said],
    supportLevel,
    latest: said,
  };

  const input = isModeB
    ? buildModeBInput({
        ...common,
        phase: 'INTERACT',
        rawText: problem.problem_text,
        recognized: problem.problem_text,
        confirmed: true,
        problem: {
          verifiedAnswer: problem.verified_answer,
          locked: problem.answer_lock_status === 'locked',
          // **어제 잃어버렸던 값이다.** 이게 없으면 AI 가 자기 오답을 잊는다.
          wrongAnswer: problem.ai_wrong_answer,
          wrongReasoning: problem.ai_wrong_reasoning,
          misconception: problem.target_misconception,
        },
      })
    : buildModeAInput({
        ...common,
        phase: 'INTERACT',
        problem: {
          text: problem.problem_text,
          verifiedAnswer: problem.verified_answer,
          locked: problem.answer_lock_status === 'locked',
        },
      });

  const result = await runStage(
    isModeB ? '03 MODE B' : '02 MODE A',
    input,
    student.persona_type,
  );
  if (!result.ok) {
    console.error(`[mission] 02 INTERACT 실패: ${result.error}`);
    return { ok: false, message: '잠깐 멈췄어. 다시 한 번 말해줄래?' };
  }

  const output = result.output;
  const message = str(read(output, 'ui.message'));
  const status = str(read(output, 'completion.status'));
  const nextSupport = num(read(output, 'interaction_update.support_level'), supportLevel);

  await appendMessage(supabase, {
    problemId: problem.problem_id,
    sessionId: session.session_id,
    studentId: student.student_id,
    speaker: 'ai',
    text: message,
    turnNumber: before.length + 2,
    supportLevel: nextSupport,
  });

  // CONTINUE 가 아니면 이 문제는 끝이다. 5턴에 닿았는데 CONTINUE 를 내도
  // 여기서 끊는다 — 안 그러면 같은 문제가 계속된다(02 프롬프트 §5).
  const usedTurns = studentTexts.length + 1;
  const finished = status !== 'CONTINUE' || usedTurns >= TURN_LIMIT;

  if (!finished) {
    return {
      ok: true,
      problemText: problem.problem_text,
      message,
      choices: readChoices(output),
      allowFreeText: read(output, 'ui.allow_free_text') !== false,
      turnsLeft: Math.max(0, TURN_LIMIT - usedTurns),
      finished: false,
      sessionFinished: false,
    };
  }

  // 맞혀서 끝난 것과 횟수에 걸려 끝난 것을 구분한다. 뒤엣것은 "실패" 가
  // 아니라 **한 번 더 도전**이다(COM-003 · copy.ts).
  // MODE B 는 "AI 의 오류를 학생이 잡아냈다" 가 성공이다.
  const correct = status === 'CORRECT_COMPLETE' || status === 'ERROR_CORRECTED_COMPLETE';
  const errored = status === 'PROBLEM_ERROR' || status === 'RECOGNITION_ERROR';

  await finishProblem(
    supabase,
    problem.problem_id,
    errored ? 'verification_failed' : correct ? 'completed' : 'needs_review',
  );

  // 검증 실패는 학생이 못 푼 게 아니다. 집계에 넣지 않는다(COM-001 §19).
  if (errored) {
    return {
      ok: true,
      problemText: problem.problem_text,
      message: message === '' ? '이 문제는 잠깐 접어두자. 다음 걸로 갈까?' : message,
      choices: [],
      allowFreeText: false,
      turnsLeft: 0,
      finished: true,
      sessionFinished: false,
    };
  }

  await evaluateProblem(supabase, {
    student: {
      student_id: student.student_id,
      grade: student.grade,
      persona_type: student.persona_type,
    },
    session: {
      session_id: session.session_id,
      completed_problem_count: session.completed_problem_count,
      target_problem_count: session.target_problem_count,
    },
    problem: {
      problem_id: problem.problem_id,
      problem_text: problem.problem_text,
      verified_answer: problem.verified_answer,
      concept: problem.concept,
      learning_mode: problem.learning_mode,
    },
    studentTexts: [...studentTexts, said],
    supportLevel: nextSupport,
    completionStatus: status,
    correct,
  });

  const who = { studentId: student.student_id, sessionId: session.session_id };
  await record(supabase, correct ? EVENT.problemCompleted : EVENT.problemNeedsReview, who);

  const { sessionCompleted } = await countCompleted(supabase, session);
  if (sessionCompleted) {
    await record(supabase, EVENT.sessionCompleted, who);
    await summarizeDay(supabase, {
      student: {
        student_id: student.student_id,
        grade: student.grade,
        persona_type: student.persona_type,
      },
      session: {
        session_id: session.session_id,
        target_problem_count: session.target_problem_count,
      },
    });
  }

  return {
    ok: true,
    problemText: problem.problem_text,
    message,
    choices: [],
    allowFreeText: false,
    turnsLeft: 0,
    finished: true,
    sessionFinished: sessionCompleted,
  };
}

// ============================================================
// 05 EVALUATOR · 문제 하나를 평가한다
// ============================================================

const GAP_TYPES = Constants.public.Enums.gap_type;

const gapOf = (value: unknown): Database['public']['Enums']['gap_type'] | null => {
  const name = str(value);
  return (GAP_TYPES as readonly string[]).includes(name)
    ? (name as Database['public']['Enums']['gap_type'])
    : null;
};

const score = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

/** 물어보지 않고 끝난 항목은 0 이 아니라 없음이다 */
const scoreOrNull = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const boolOrNull = (value: unknown): boolean | null =>
  typeof value === 'boolean' ? value : null;

/**
 * 문제가 끝나면 평가를 남긴다 (05 EVALUATOR).
 *
 * **학생을 기다리게 하지만 여기서 해야 한다.** 다음 문제가 시작되면 이
 * 문제의 대화가 입력에서 밀려나고, 나중에 다시 모으려면 같은 것을 두 번
 * 짓게 된다.
 *
 * 평가가 실패해도 학습은 이미 끝난 것이다. 던지지 않고 로그만 남긴다 —
 * 문제를 다 풀었는데 화면이 오류로 바뀌면 그게 더 큰 손해다.
 */
async function evaluateProblem(
  supabase: Awaited<ReturnType<typeof createClient>>,
  args: {
    student: { student_id: string; grade: number; persona_type: 'friend' | 'villain' };
    session: { session_id: string; completed_problem_count: number; target_problem_count: number };
    problem: {
      problem_id: string;
      problem_text: string;
      verified_answer: unknown;
      concept: string;
      learning_mode: string;
    };
    studentTexts: string[];
    supportLevel: number;
    completionStatus: string;
    correct: boolean;
  },
): Promise<void> {
  const stage = stageOf('05 EVALUATOR');
  let input: unknown = JSON.parse(stage.sampleInput);

  input = write(input, 'student.student_id', args.student.student_id);
  input = write(input, 'student.grade', args.student.grade);
  input = write(input, 'session.problem_number', args.session.completed_problem_count + 1);
  input = write(input, 'session.total_problems', args.session.target_problem_count);

  input = write(input, 'payload.learning_mode', args.problem.learning_mode === 'mode_b' ? 'B' : 'A');
  input = write(input, 'payload.problem_result.problem_text', args.problem.problem_text);
  input = write(input, 'payload.problem_result.verified_answer', args.problem.verified_answer);
  input = write(input, 'payload.problem_result.initial_answer', args.studentTexts[0] ?? null);
  input = write(
    input,
    'payload.problem_result.final_answer',
    args.studentTexts[args.studentTexts.length - 1] ?? null,
  );
  input = write(input, 'payload.problem_result.completion_status', args.completionStatus);
  input = write(
    input,
    'payload.problem_result.response_history',
    args.studentTexts.map((text) => ({
      response_role: null,
      response_type: 'FREE_TEXT',
      choice_id: null,
      content: text,
    })),
  );
  input = write(input, 'payload.problem_result.student_turn_count', args.studentTexts.length);
  input = write(input, 'payload.problem_result.turn_limit', TURN_LIMIT);
  input = write(
    input,
    'payload.problem_result.turns_remaining',
    Math.max(0, TURN_LIMIT - args.studentTexts.length),
  );
  input = write(input, 'payload.problem_result.support_level', args.supportLevel);
  input = write(input, 'payload.problem_result.hint_count', 0);

  const result = await runStage('05 EVALUATOR', JSON.stringify(input, null, 2), args.student.persona_type);
  if (!result.ok) {
    console.error(`[mission] 05 실패: ${result.error}`);
    return;
  }

  const evaluation = read(result.output, 'evaluation');
  if (evaluation === undefined || evaluation === null) {
    console.error('[mission] 05 가 evaluation 을 내지 않았습니다');
    return;
  }

  try {
    await saveEvaluation(supabase, {
      problemId: args.problem.problem_id,
      studentId: args.student.student_id,
      initialAccuracy: boolOrNull(read(evaluation, 'initial_accuracy')),
      reasoningScore: score(read(evaluation, 'reasoning_score'), 0),
      ruleScore: score(read(evaluation, 'rule_score'), 0),
      selfCorrection: read(evaluation, 'self_correction') === true,
      transferScore: scoreOrNull(read(evaluation, 'transfer_score')),
      reflectionScore: scoreOrNull(read(evaluation, 'reflection_score')),
      supportLevel: score(read(evaluation, 'support_level'), args.supportLevel),
      // 05 는 이 값을 내지 않는다. 맞혀서 끝났는지는 완료 상태가 안다.
      finalAccuracy: args.correct,
    });

    await saveLogicGaps(supabase, {
      problemId: args.problem.problem_id,
      studentId: args.student.student_id,
      concept: str(read(result.output, 'next_learning.target_concept')) || args.problem.concept,
      gaps: [
        gapOf(read(evaluation, 'primary_logic_gap')),
        gapOf(read(evaluation, 'secondary_logic_gap')),
      ],
    });
  } catch (error) {
    console.error(`[mission] 평가 저장 실패: ${String(error)}`);
  }
}

// ============================================================
// 06 DAILY ANALYZER · 하루를 마무리한다
// ============================================================

/**
 * 오늘 몫을 다 채웠을 때 하루 총평을 만든다.
 *
 * **한 번만 만든다.** 화면을 열 때마다 부르면 새로고침마다 돈이 나가고,
 * 같은 하루의 총평이 매번 다른 말로 바뀐다. `learning_report` 에 남기고
 * 오늘의 기록 화면은 그걸 읽는다.
 *
 * 실패해도 던지지 않는다. 총평이 없으면 화면이 그 자리를 안 그릴 뿐이다.
 */
async function summarizeDay(
  supabase: Awaited<ReturnType<typeof createClient>>,
  args: {
    student: { student_id: string; grade: number; persona_type: 'friend' | 'villain' };
    session: { session_id: string; target_problem_count: number };
  },
): Promise<void> {
  const date = today();

  try {
    const already = await findDailyReport(supabase, args.student.student_id, date);
    if (already !== null) return;
  } catch (error) {
    console.error(`[mission] 06 중복 확인 실패: ${String(error)}`);
    return;
  }

  // 오늘 푼 문제와 그 평가를 모은다. 06 은 이것만 보고 하루를 읽는다.
  const { data: rows, error } = await supabase
    .from('problem')
    .select('problem_id, learning_mode, problem_status, evaluation(*)')
    .eq('session_id', args.session.session_id);

  if (error !== null) {
    console.error(`[mission] 06 입력 수집 실패: ${error.message}`);
    return;
  }

  const problems = rows ?? [];
  const evaluations = problems
    .map((row) => (Array.isArray(row.evaluation) ? row.evaluation[0] : row.evaluation))
    .filter((item): item is NonNullable<typeof item> => item !== null && item !== undefined);

  const stage = stageOf('06 DAILY ANALYZER');
  let input: unknown = JSON.parse(stage.sampleInput);
  input = write(input, 'student.student_id', args.student.student_id);
  input = write(input, 'student.grade', args.student.grade);
  input = write(input, 'session.session_id', args.session.session_id);
  input = write(input, 'session.total_problems', args.session.target_problem_count);
  input = write(input, 'payload.problem_evaluations', evaluations);
  input = write(
    input,
    'payload.mode_status.mode_a_count',
    problems.filter((row) => row.learning_mode === 'mode_a').length,
  );
  input = write(
    input,
    'payload.mode_status.mode_b_count',
    problems.filter((row) => row.learning_mode === 'mode_b').length,
  );

  const result = await runStage(
    '06 DAILY ANALYZER',
    JSON.stringify(input, null, 2),
    args.student.persona_type,
  );
  if (!result.ok) {
    console.error(`[mission] 06 실패: ${result.error}`);
    return;
  }

  try {
    await saveDailyReport(supabase, {
      studentId: args.student.student_id,
      date,
      summary: result.output,
    });
    // 이벤트는 남기지 않는다. COM-002 §14 의 16개에 하루 리포트에
    // 해당하는 이름이 없다 — `weekly_report_generated` 를 갖다 쓰면
    // 주간 리포트 수가 부풀려진다. 이름이 필요하면 문서를 먼저 고친다.
  } catch (saveError) {
    console.error(`[mission] 06 저장 실패: ${String(saveError)}`);
  }
}

// ============================================================
// 03 MODE B · 학생이 문제를 가져오고 AI 가 푼다
// ============================================================

/**
 * MODE B 는 세 마당이다.
 *
 *   RECOGNIZE   학생이 가져온 문제를 읽고 "이거 맞아?" 를 묻는다
 *   PREPARE     정답을 검증하고 **일부러 틀린 풀이**를 만든다
 *   INTERACT    학생이 그 틀린 곳을 찾아낸다
 *
 * 가운데 마당이 이 서비스의 핵심이다. AI 가 만든 오답은 다음 턴에도 있어야
 * 하므로 `problem` 에 남긴다(COM-002 §20-A). **학생 화면에는 나가지 않는다** —
 * 나가는 것은 `ui.ai_wrong_solution`(보여줄 풀이)뿐이다.
 */

export type SourceStep =
  /** 이렇게 읽었는데 맞아? */
  | { ok: true; kind: 'confirm'; recognized: string; message: string; choices: Choice[] }
  /** 확인 끝. 문제가 시작됐다 */
  | { ok: true; kind: 'started'; problemText: string; message: string; choices: Choice[] }
  | { ok: false; message: string };

function buildModeBInput(args: {
  studentId: string;
  grade: number;
  persona: 'friend' | 'villain';
  sessionId: string;
  problemNumber: number;
  totalProblems: number;
  phase: 'RECOGNIZE' | 'PREPARE' | 'INTERACT';
  rawText: string | null;
  recognized: string | null;
  confirmed: boolean;
  problem: {
    verifiedAnswer: unknown;
    locked: boolean;
    wrongAnswer: unknown;
    wrongReasoning: string | null;
    misconception: string | null;
  } | null;
  studentTexts: string[];
  supportLevel: number;
  latest: string | null;
  /** 사진으로 가져왔는지. 기본은 글이다 */
  inputType?: 'TEXT' | 'IMAGE';
  /** 버킷 안의 경로. 사진일 때만 */
  imageReference?: string | null;
}): string {
  const stage = stageOf('03 MODE B');
  let input: unknown = JSON.parse(stage.sampleInput);

  input = write(input, 'student.student_id', args.studentId);
  input = write(input, 'student.grade', args.grade);
  input = write(input, 'student.selected_persona', args.persona.toUpperCase());

  input = write(input, 'session.session_id', args.sessionId);
  input = write(input, 'session.problem_number', args.problemNumber);
  input = write(input, 'session.total_problems', args.totalProblems);

  input = write(input, 'payload.learning_mode', 'B');
  input = write(input, 'payload.mode_phase', args.phase);
  input = write(input, 'payload.learning_target.concept', null);
  input = write(input, 'payload.learning_target.target_logic_gap', null);
  input = write(input, 'payload.learning_target.difficulty', 'SAME');

  input = write(input, 'payload.source_problem.input_type', args.inputType ?? 'TEXT');
  input = write(input, 'payload.source_problem.raw_text', args.rawText);
  input = write(input, 'payload.source_problem.image_reference', args.imageReference ?? null);
  input = write(
    input,
    'payload.source_problem.recognized_problem.problem_text',
    args.recognized,
  );
  input = write(input, 'payload.source_problem.recognized_problem.choices', []);
  input = write(
    input,
    'payload.source_problem.recognized_problem.visual_information',
    null,
  );
  input = write(
    input,
    'payload.source_problem.recognition_status',
    args.recognized === null ? 'NOT_STARTED' : args.confirmed ? 'CONFIRMED' : 'NEEDS_CONFIRMATION',
  );
  input = write(input, 'payload.source_problem.student_confirmed', args.confirmed);

  input = write(input, 'payload.problem.verified_answer', args.problem?.verifiedAnswer ?? null);
  input = write(input, 'payload.problem.answer_lock', args.problem?.locked ?? false);
  input = write(input, 'payload.problem.ai_wrong_answer', args.problem?.wrongAnswer ?? null);
  input = write(input, 'payload.problem.ai_wrong_reasoning', args.problem?.wrongReasoning ?? null);
  input = write(
    input,
    'payload.problem.target_misconception',
    args.problem?.misconception ?? null,
  );

  const used = args.studentTexts.length;
  input = write(input, 'payload.interaction.student_turn_count', used);
  input = write(input, 'payload.interaction.turn_limit', TURN_LIMIT);
  input = write(input, 'payload.interaction.turns_remaining', Math.max(0, TURN_LIMIT - used));
  input = write(input, 'payload.interaction.latest_response', {
    response_role: null,
    response_type: 'FREE_TEXT',
    choice_id: null,
    content: args.latest,
  });
  input = write(
    input,
    'payload.interaction.response_history',
    args.studentTexts.map((text) => ({
      response_role: null,
      response_type: 'FREE_TEXT',
      choice_id: null,
      content: text,
    })),
  );
  input = write(input, 'payload.interaction.support_level', args.supportLevel);
  input = write(input, 'payload.interaction.hint_count', 0);
  input = write(input, 'payload.interaction.hint_history', []);

  return JSON.stringify(input, null, 2);
}

/**
 * 학생이 가져온 문제를 읽는다 (03 RECOGNIZE).
 *
 * 아직 `problem` 행을 만들지 않는다. **정답 검증 전이기 때문**이다 — 검증에
 * 실패한 문제로 학습을 진행하지 않는다(COM-001 §19).
 */
export async function offerSourceProblem(text: string): Promise<SourceStep> {
  const said = text.trim();
  if (said === '') return { ok: false, message: '어떤 문제인지 적어줄래?' };

  const ctx = await context();
  if (ctx === null) return { ok: false, message: '다시 들어와줄래?' };
  const { student, session } = ctx;

  const input = buildModeBInput({
    studentId: student.student_id,
    grade: student.grade,
    persona: student.persona_type,
    sessionId: session.session_id,
    problemNumber: session.completed_problem_count + 1,
    totalProblems: session.target_problem_count,
    phase: 'RECOGNIZE',
    rawText: said,
    recognized: null,
    confirmed: false,
    problem: null,
    studentTexts: [],
    supportLevel: 0,
    latest: said,
  });

  const result = await runStage('03 MODE B', input, student.persona_type);
  if (!result.ok) {
    console.error(`[mission] 03 RECOGNIZE 실패: ${result.error}`);
    return { ok: false, message: '문제를 읽다가 잠깐 멈췄어. 다시 적어줄래?' };
  }

  const status = str(read(result.output, 'source_problem_update.recognition_status'));
  const recognized = str(
    read(result.output, 'source_problem_update.recognized_problem.problem_text'),
  );
  const message = str(read(result.output, 'ui.message'));

  if (status === 'FAILED' || recognized === '') {
    return {
      ok: false,
      message: message === '' ? '문제를 잘 읽지 못했어. 다시 적어줄래?' : message,
    };
  }

  return {
    ok: true,
    kind: 'confirm',
    recognized,
    message,
    choices: readChoices(result.output),
  };
}

/**
 * 학생이 "맞아" 라고 했다 (03 PREPARE).
 *
 * 여기서 정답을 검증하고 **일부러 틀린 풀이**를 만든다. `problem` 행은 이
 * 시점에 생긴다 — 검증된 정답이 있어야 만들 수 있기 때문이다.
 */
export async function confirmSourceProblem(
  recognized: string,
  reply: string,
  fromPhoto = false,
): Promise<SourceStep> {
  const ctx = await context();
  if (ctx === null) return { ok: false, message: '다시 들어와줄래?' };
  const { supabase, student, session } = ctx;

  const input = buildModeBInput({
    studentId: student.student_id,
    grade: student.grade,
    persona: student.persona_type,
    sessionId: session.session_id,
    problemNumber: session.completed_problem_count + 1,
    totalProblems: session.target_problem_count,
    phase: 'PREPARE',
    rawText: recognized,
    recognized,
    confirmed: true,
    problem: null,
    studentTexts: [],
    supportLevel: 0,
    latest: reply,
  });

  const result = await runStage('03 MODE B', input, student.persona_type);
  if (!result.ok) {
    console.error(`[mission] 03 PREPARE 실패: ${result.error}`);
    return { ok: false, message: '문제를 풀어보다가 잠깐 멈췄어. 다시 해볼래?' };
  }

  const output = result.output;
  const verified = read(output, 'problem_state.verified_answer');

  // **정답을 확신하지 못하면 진행하지 않는다**(COM-001 §19). 지어낸 정답으로
  // 학습을 이어가는 것이 가장 나쁘다.
  if (verified === null || verified === undefined) {
    return {
      ok: false,
      message: '이 문제는 내가 확실하게 못 풀겠어. 다른 문제로 해볼까?',
    };
  }

  const problemText = str(read(output, 'ui.problem_text')) || recognized;
  const wrongSolution = str(read(output, 'ui.ai_wrong_solution'));
  const message = str(read(output, 'ui.message'));

  const problem = await createProblem(supabase, {
    sessionId: session.session_id,
    studentId: student.student_id,
    problemSource: fromPhoto ? 'photo' : 'text',
    problemText,
    concept: '미지정',
    difficulty: student.current_difficulty,
    learningMode: 'mode_b',
    verifiedAnswer: verified,
    answerLock: read(output, 'problem_state.answer_lock') === true,
    wrongAnswer: read(output, 'problem_state.ai_wrong_answer') ?? null,
    wrongReasoning: str(read(output, 'problem_state.ai_wrong_reasoning')) || null,
    misconception: str(read(output, 'problem_state.target_misconception')) || null,
  });

  // 학생이 봐야 하는 것은 **틀린 풀이**다. 그걸 놓치면 잡아낼 것이 없다.
  const shown = [wrongSolution, message].filter((part) => part !== '').join('\n\n');
  await appendMessage(supabase, {
    problemId: problem.problem_id,
    sessionId: session.session_id,
    studentId: student.student_id,
    speaker: 'ai',
    text: shown === '' ? problemText : shown,
    turnNumber: 1,
    supportLevel: num(read(output, 'interaction_update.support_level'), 0),
  });

  await record(supabase, EVENT.problemStarted, {
    studentId: student.student_id,
    sessionId: session.session_id,
  });

  return {
    ok: true,
    kind: 'started',
    problemText,
    message: shown,
    choices: readChoices(output),
  };
}

// ============================================================
// 사진으로 문제 가져오기 (MIS-003)
// ============================================================

/** 버킷 이름. 마이그레이션 20260910023000 이 만든다 */
const PHOTO_BUCKET = 'problem-photos';

/** 5MB. 버킷도 같은 값으로 막는다 — 한쪽만 막으면 다른 경로로 들어온다 */
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

const extOf = (mediaType: string): string =>
  mediaType === 'image/png'
    ? 'png'
    : mediaType === 'image/webp'
      ? 'webp'
      : mediaType === 'image/heic'
        ? 'heic'
        : 'jpg';

/**
 * 사진을 올리고 문제를 읽는다 (03 RECOGNIZE · 사진).
 *
 * 사진은 **학습 자료**로 분류하지만 아무나 열어보게 두지 않는다
 * (COM-007 §3-1). 비공개 버킷의 `<student_id>/` 아래에만 넣고, 정책이
 * 자기 학생 폴더만 허용한다.
 *
 * **인식에 실패하면 그 자리에서 지운다**(§4-3). 남길 이유가 없다.
 */
export async function readPhotoProblem(formData: FormData): Promise<SourceStep> {
  const file = formData.get('photo');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: '사진을 못 받았어. 다시 골라줄래?' };
  }
  if (!PHOTO_TYPES.includes(file.type)) {
    return { ok: false, message: '사진 파일만 올릴 수 있어.' };
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return { ok: false, message: '사진이 너무 커. 조금 작게 찍어줄래?' };
  }

  const ctx = await context();
  if (ctx === null) return { ok: false, message: '다시 들어와줄래?' };
  const { supabase, student, session } = ctx;

  const path = `${student.student_id}/${crypto.randomUUID()}.${extOf(file.type)}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const upload = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, bytes, { contentType: file.type, upsert: false });

  if (upload.error !== null) {
    console.error(`[mission] 사진 저장 실패: ${upload.error.message}`);
    return { ok: false, message: '사진을 저장하지 못했어. 다시 해볼래?' };
  }

  const input = buildModeBInput({
    studentId: student.student_id,
    grade: student.grade,
    persona: student.persona_type,
    sessionId: session.session_id,
    problemNumber: session.completed_problem_count + 1,
    totalProblems: session.target_problem_count,
    phase: 'RECOGNIZE',
    rawText: null,
    recognized: null,
    confirmed: false,
    problem: null,
    studentTexts: [],
    supportLevel: 0,
    latest: null,
    inputType: 'IMAGE',
    imageReference: path,
  });

  const result = await runStage('03 MODE B', input, student.persona_type, [
    { mediaType: file.type, data: Buffer.from(bytes).toString('base64') },
  ]);

  const drop = async () => {
    const { error } = await supabase.storage.from(PHOTO_BUCKET).remove([path]);
    if (error !== null) console.error(`[mission] 사진 삭제 실패: ${error.message}`);
  };

  if (!result.ok) {
    console.error(`[mission] 03 RECOGNIZE(사진) 실패: ${result.error}`);
    await drop();
    return { ok: false, message: '사진을 읽다가 잠깐 멈췄어. 다시 찍어줄래?' };
  }

  const status = str(read(result.output, 'source_problem_update.recognition_status'));
  const recognized = str(
    read(result.output, 'source_problem_update.recognized_problem.problem_text'),
  );
  const message = str(read(result.output, 'ui.message'));

  if (status === 'FAILED' || recognized === '') {
    await drop();
    return {
      ok: false,
      message: message === '' ? '사진이 잘 안 읽혔어. 다시 찍거나 직접 적어줄래?' : message,
    };
  }

  return {
    ok: true,
    kind: 'confirm',
    recognized,
    message,
    choices: readChoices(result.output),
  };
}
