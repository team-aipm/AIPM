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
import { findTodaySession } from '@/lib/services/learning-session';
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

  const result = await runStage('01 SESSION HOST', input);

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
