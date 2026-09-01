import type { CheckRuleId } from '@/lib/ai/schema-check';

/**
 * 한 단계의 결과를 다음 단계의 입력으로 옮긴다.
 *
 * **출력만으로는 부족하다.** 대화 기록은 그 단계의 *입력* JSON 안에 있고,
 * 문제·Answer Lock 같은 맥락도 마찬가지다. 그래서 `fromInputJson` 을 함께
 * 받는다.
 *
 * 다음 단계 입력을 통째로 갈아치우지 않고, 이어져야 하는 필드만 덮어쓴다.
 * 나머지는 화면에서 편집한 값을 유지한다.
 *
 * 규칙이 없는(범용) 단계는 매핑할 근거가 없으므로 null 을 돌려준다.
 * 화면은 그때 출력 원문을 그대로 다음 입력에 넣는다.
 */
export function bridge(
  fromRule: CheckRuleId | null,
  output: unknown,
  fromInputJson: string,
  nextInputJson: string,
): string | null {
  if (fromRule === null || !isRecord(output)) return null;

  const next = safeParse(nextInputJson);
  if (!isRecord(next)) return null;

  const from = isRecord(safeParse(fromInputJson)) ? (safeParse(fromInputJson) as Record<string, unknown>) : {};

  switch (fromRule) {
    // 00 → 02. 인식 결과를 문제 검증으로.
    // 학생 확인은 사람이 화면에서 텍스트를 보고 하는 절차이므로 확인
    // 플래그는 false 로 둔다. (COM-002 §6)
    case 'aipm-ocr':
      return stringify({
        ...next,
        problem_source: 'photo',
        problem_text: output.problem_text,
        ocr_text: output.problem_text,
        ocr_confirmed_by_student: false,
      });

    // 02 → 03. 새 문제로 대화를 시작한다.
    // **이전 문제의 대화를 비운다.** 문제가 바뀌었는데 앞 대화가 남아
    // 있으면 Tutor 가 엉뚱한 맥락을 이어받는다.
    case 'aipm-problem':
      return stringify({
        ...next,
        problem: {
          problem_text: output.problem_text,
          concept: output.concept,
          difficulty: output.difficulty,
        },
        answer_lock: {
          verified_answer: output.verified_answer,
          verified_solution: output.verified_solution,
          required_rules: output.required_rules,
        },
        conversation: [],
        turn_number: 1,
        current_support_level: 0,
        drilldown_question_count: 0,
        stage_status: {
          judgment: 'missing',
          reasoning: 'missing',
          rule: 'missing',
          transfer: 'missing',
          reflection: 'missing',
        },
      });

    // 03 → 04. **실제로 나눈 대화 전체**를 평가로 넘긴다.
    // 03 의 입력 JSON 이 대화 기록이므로 거기서 통째로 가져온다.
    case 'aipm-message': {
      const conversation = asArray(from.conversation);
      const answers = studentAnswers(conversation);

      return stringify({
        ...next,
        problem: from.problem ?? next.problem,
        answer_lock: from.answer_lock ?? next.answer_lock,
        conversation,
        // COM-001 은 최초 답변과 최종 답변을 구분한다. 대화에서 뽑는다.
        initial_answer: answers.first,
        final_answer: answers.last,
        highest_support_level:
          typeof output.support_level === 'number'
            ? Math.max(output.support_level, numberOr(from.current_support_level, 0))
            : (next.highest_support_level ?? null),
      });
    }

    // 04 → 05. 평가 결과를 오늘 문제 목록의 첫 항목에 채운다.
    case 'aipm-evaluation': {
      const problems = asArray(next.today_problems);
      const first = isRecord(problems[0]) ? problems[0] : {};
      const problem = isRecord(from.problem) ? from.problem : {};

      return stringify({
        ...next,
        today_problems: [
          {
            ...first,
            concept: problem.concept ?? first.concept,
            problem_status: problem.problem_status ?? first.problem_status,
            evaluation: output.evaluation,
            logic_gaps: output.logic_gaps,
          },
          ...problems.slice(1),
        ],
      });
    }

    // 05 → 06. 갱신된 기억을 다음 문제 결정으로.
    case 'aipm-student-memory':
      return stringify({
        ...next,
        student_memory: output,
        next_learning_focus: output.next_learning_focus ?? null,
        current_concept:
          firstConcept(output.weak_concepts) ?? next.current_concept ?? null,
      });

    // 06 → 02. 생성된 문제는 반드시 검증 단계를 다시 거친다.
    case 'aipm-next-problem':
      return stringify({
        ...next,
        problem_text: output.problem_text,
        problem_source: 'ai',
        ocr_text: null,
        ocr_confirmed_by_student: null,
      });

    default:
      return null;
  }
}

/** 대화에서 학생의 첫 발화와 마지막 발화를 뽑는다. */
function studentAnswers(conversation: unknown[]): {
  first: string | null;
  last: string | null;
} {
  const texts = conversation
    .filter(isRecord)
    .filter((turn) => String(turn.speaker ?? '').toLowerCase().includes('student'))
    .map((turn) => turn.message_text)
    .filter((text): text is string => typeof text === 'string');

  return {
    first: texts[0] ?? null,
    last: texts[texts.length - 1] ?? null,
  };
}

function firstConcept(value: unknown): string | null {
  const list = asArray(value);
  const head = list.find(isRecord);
  return typeof head?.concept === 'string' ? head.concept : null;
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' ? value : fallback;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function stringify(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
