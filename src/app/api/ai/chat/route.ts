import { NextRequest, NextResponse } from 'next/server';

/**
 * MIS-001 미션 진행의 Drill-down 대화 엔드포인트.
 * DEV-002 §9 `/api/ai/chat` — Server Action이 아니라 Route Handler로 두는
 * 이유는 DEV-001 §2 "AI 대화 등 스트리밍이 필요한 경우"에 해당해서다.
 *
 * ⚠️ 이번 구현은 MODE_A(AI가 문제를 낸다) 한 문제 진행만 다룬다.
 * `lib/ai/drilldown.ts` 상단 주석에 범위·불일치를 적어 뒀다.
 *
 * ⚠️ studentId는 요청 바디로 받는다 — STU-002(학생 프로필 선택) 세션이
 * 아직 없어서다. 실제로는 세션에서 읽어야 하며, 그 전까지는 요청을 보낸
 * 사람이 임의의 studentId를 주장할 수 있다는 뜻이다 (개발 단계 한정).
 */

import {
  runModeAPrepare,
  runModeAInteract,
  runEvaluator,
  type ResponseTurn,
  type Persona,
} from '@/lib/ai/drilldown';
import { toProblemStatus } from '@/lib/ai/taxonomy';
import { getStudent } from '@/lib/services/student';
import { getOrCreateTodaySession } from '@/lib/services/learning-session';
import { insertProblem, getProblem, updateProblemStatus } from '@/lib/services/problem';
import {
  insertMessage,
  countMessages,
  countStudentTurns,
  maxAiSupportLevel,
} from '@/lib/services/message';
import { insertEvaluation } from '@/lib/services/evaluation';

const CONCEPT_PLACEHOLDER =
  '4~6학년 수학 사칙연산·분수·소수 범위에서 AI가 자유롭게 선택';

type StartBody = { phase: 'start'; studentId: string };
type InteractBody = {
  phase: 'interact';
  studentId: string;
  problemId: string;
  interaction: {
    responseHistory: ResponseTurn[];
    initialAnswer: string | null;
    latestResponse: ResponseTurn;
  };
};

export async function POST(req: NextRequest) {
  let body: StartBody | InteractBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: '요청 본문이 JSON이 아닙니다.' }, { status: 400 });
  }

  try {
    if (body.phase === 'start') return await handleStart(body);
    if (body.phase === 'interact') return await handleInteract(body);
    return NextResponse.json({ ok: false, error: 'phase 값이 올바르지 않습니다.' }, { status: 400 });
  } catch (cause) {
    // COM-001 §19 "학생의 시스템 오류를 오답으로 평가하지 않는다" — 여기서
    // 실패해도 problem_status를 건드리지 않는다. 학생 화면은 재시도만 보여준다.
    console.error('[api/ai/chat]', cause);
    return NextResponse.json(
      { ok: false, error: '일시적인 오류가 발생했어요. 다시 시도해 주세요.' },
      { status: 502 },
    );
  }
}

async function handleStart(body: StartBody) {
  const student = await getStudent(body.studentId);
  const session = await getOrCreateTodaySession(student.student_id);
  const persona: Persona = student.persona_type === 'villain' ? 'VILLAIN' : 'FRIEND';

  // Answer Lock 없는 문제는 학생에게 보여주지 않는다 (COM-001 §6·§19) —
  // 실패하면 한 번만 다시 시도한다.
  let attempt = await runModeAPrepare({
    studentId: student.student_id,
    sessionId: session.session_id,
    grade: student.grade,
    persona,
  });
  if (attempt.ok && attempt.output.problem_state?.answer_lock !== true) {
    attempt = await runModeAPrepare({
      studentId: student.student_id,
      sessionId: session.session_id,
      grade: student.grade,
      persona,
    });
  }

  if (!attempt.ok) {
    return NextResponse.json({ ok: false, error: attempt.error }, { status: 502 });
  }
  const { output } = attempt;
  if (!output.problem_state || output.problem_state.answer_lock !== true) {
    return NextResponse.json(
      { ok: false, error: '문제를 확정하지 못했어요. 다시 시도해 주세요.' },
      { status: 502 },
    );
  }

  const problem = await insertProblem({
    session_id: session.session_id,
    student_id: student.student_id,
    problem_source: 'ai',
    learning_mode: 'mode_a',
    concept: CONCEPT_PLACEHOLDER,
    difficulty: student.current_difficulty,
    problem_text: output.problem_state.problem_text,
    verified_answer: output.problem_state.verified_answer as never,
    answer_lock_status: 'locked',
    problem_status: 'active',
  });

  await insertMessage({
    problem_id: problem.problem_id,
    session_id: session.session_id,
    student_id: student.student_id,
    speaker: 'ai',
    message_text: output.ui.message,
    turn_number: 1,
    support_level: 0,
  });

  return NextResponse.json({
    ok: true,
    sessionId: session.session_id,
    problemId: problem.problem_id,
    ui: {
      problemText: output.ui.problem_text,
      message: output.ui.message,
      choices: output.ui.choices,
      allowFreeText: output.ui.allow_free_text,
    },
  });
}

async function handleInteract(body: InteractBody) {
  const student = await getStudent(body.studentId);
  const problem = await getProblem(body.problemId, student.student_id);
  const persona: Persona = student.persona_type === 'villain' ? 'VILLAIN' : 'FRIEND';

  const priorSupportLevel = await maxAiSupportLevel(problem.problem_id);
  const studentTurnCount = (await countStudentTurns(problem.problem_id)) + 1;
  const messageSeq = await countMessages(problem.problem_id);

  await insertMessage({
    problem_id: problem.problem_id,
    session_id: problem.session_id,
    student_id: student.student_id,
    speaker: 'student',
    message_text: body.interaction.latestResponse.content ?? '',
    turn_number: messageSeq + 1,
    support_level: priorSupportLevel,
  });

  const result = await runModeAInteract({
    studentId: student.student_id,
    sessionId: problem.session_id,
    grade: student.grade,
    persona,
    problemText: problem.problem_text,
    verifiedAnswer: problem.verified_answer,
    studentTurnCount,
    supportLevel: priorSupportLevel,
    initialAnswer: body.interaction.initialAnswer,
    responseHistory: body.interaction.responseHistory,
    latestResponse: body.interaction.latestResponse,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }
  const { output } = result;

  await insertMessage({
    problem_id: problem.problem_id,
    session_id: problem.session_id,
    student_id: student.student_id,
    speaker: 'ai',
    message_text: output.ui.message,
    turn_number: messageSeq + 2,
    support_level: output.interaction_update.support_level,
  });

  if (output.completion.status === 'CONTINUE') {
    return NextResponse.json({
      ok: true,
      problemId: problem.problem_id,
      ui: {
        message: output.ui.message,
        choices: output.ui.choices,
        allowFreeText: output.ui.allow_free_text,
      },
      completion: { status: 'CONTINUE' },
    });
  }

  // ── 문제 종료 ──────────────────────────────────────────────────────
  const dbStatus = toProblemStatus(output.completion.status) ?? 'verification_failed';
  await updateProblemStatus(problem.problem_id, dbStatus);

  if (dbStatus === 'completed' || dbStatus === 'needs_review') {
    const finalSupportLevel = await maxAiSupportLevel(problem.problem_id);
    const finalStudentTurnCount = await countStudentTurns(problem.problem_id);

    const evaluatorResult = await runEvaluator({
      grade: student.grade,
      problemText: problem.problem_text,
      verifiedAnswer: problem.verified_answer,
      initialAnswer: body.interaction.initialAnswer,
      finalAnswer: body.interaction.latestResponse.content,
      completionStatus: output.completion.status as 'CORRECT_COMPLETE' | 'TURN_LIMIT_COMPLETE',
      responseHistory: [...body.interaction.responseHistory, body.interaction.latestResponse],
      studentTurnCount: finalStudentTurnCount,
      supportLevel: finalSupportLevel,
    });

    if (evaluatorResult.ok) {
      await insertEvaluation({
        problem_id: problem.problem_id,
        student_id: student.student_id,
        initial_accuracy: evaluatorResult.evaluation.initial_accuracy,
        reasoning_score: evaluatorResult.evaluation.reasoning_score,
        rule_score: evaluatorResult.evaluation.rule_score,
        self_correction: evaluatorResult.evaluation.self_correction,
        transfer_score: evaluatorResult.evaluation.transfer_score,
        reflection_score: evaluatorResult.evaluation.reflection_score,
        support_level: evaluatorResult.evaluation.support_level,
        final_accuracy: evaluatorResult.finalAccuracy,
      });
    } else {
      // 평가 실패는 학생에게 보여주지 않는다 — 문제 진행 자체는 끝났고
      // 종료 안내(정답·해설)는 이미 output.ui.message에 들어 있다.
      console.error('[api/ai/chat] evaluator 실패', evaluatorResult.error);
    }
  }

  return NextResponse.json({
    ok: true,
    problemId: problem.problem_id,
    ui: { message: output.ui.message, choices: [], allowFreeText: false },
    completion: { status: output.completion.status },
  });
}
