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
import { findTodaySession, countCompleted } from '@/lib/services/learning-session';
import { createProblem, findActiveProblem, finishProblem } from '@/lib/services/problem';
import { appendMessage, listMessages } from '@/lib/services/message';
import { EVENT, record } from '@/lib/analytics/events';
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

  const input = buildModeAInput({
    studentId: student.student_id,
    grade: student.grade,
    persona: student.persona_type,
    sessionId: session.session_id,
    problemNumber: session.completed_problem_count + 1,
    totalProblems: session.target_problem_count,
    phase: 'INTERACT',
    problem: {
      text: problem.problem_text,
      verifiedAnswer: problem.verified_answer,
      locked: problem.answer_lock_status === 'locked',
    },
    studentTexts: [...studentTexts, said],
    supportLevel,
    latest: said,
  });

  const result = await runStage('02 MODE A', input, student.persona_type);
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
  const correct = status === 'CORRECT_COMPLETE';
  const errored = status === 'PROBLEM_ERROR';

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

  const who = { studentId: student.student_id, sessionId: session.session_id };
  await record(supabase, correct ? EVENT.problemCompleted : EVENT.problemNeedsReview, who);

  const { sessionCompleted } = await countCompleted(supabase, session);
  if (sessionCompleted) await record(supabase, EVENT.sessionCompleted, who);

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
