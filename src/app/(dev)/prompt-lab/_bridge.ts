import type { CheckRuleId } from '@/lib/ai/schema-check';

/**
 * 한 단계의 출력을 다음 단계의 입력으로 옮긴다.
 *
 * 검증 규칙이 붙은 단계에는 그 규칙에 맞는 매핑을 쓴다. 다음 단계 입력을
 * 통째로 갈아치우지 않고, 이어져야 하는 필드만 덮어쓴다. 나머지는 화면에서
 * 편집한 값을 유지한다.
 *
 * 규칙이 없는(범용) 단계는 매핑할 근거가 없으므로 null을 돌려준다.
 * 화면은 그때 출력 원문을 그대로 다음 입력에 넣는다.
 */
export function bridge(
  fromRule: CheckRuleId | null,
  output: unknown,
  nextInputJson: string,
): string | null {
  if (fromRule === null || !isRecord(output)) return null;

  let next: unknown;
  try {
    next = JSON.parse(nextInputJson);
  } catch {
    return null;
  }
  if (!isRecord(next)) return null;

  switch (fromRule) {
    // 인식 결과를 02 의 입력으로 옮긴다. 학생 확인은 사람이 화면에서
    // 텍스트를 보고 하는 절차이므로, 확인 플래그는 false 로 둔다.
    // (COM-002 §6)
    case 'aipm-ocr':
      return stringify({
        ...next,
        problem_source: 'photo',
        problem_text: output.problem_text,
        ocr_text: output.problem_text,
        ocr_confirmed_by_student: false,
      });

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
      });

    case 'aipm-message': {
      // Tutor의 이번 턴을 대화에 덧붙인다. Evaluator는 전체 대화를 본다.
      const conversation = Array.isArray(next.conversation) ? next.conversation : [];
      return stringify({
        ...next,
        conversation: [
          ...conversation,
          {
            speaker: 'ai',
            message_text: output.message,
            turn_number: conversation.length + 1,
          },
        ],
        highest_support_level: output.support_level,
      });
    }

    case 'aipm-evaluation': {
      const problems = Array.isArray(next.today_problems) ? next.today_problems : [];
      const first = isRecord(problems[0]) ? problems[0] : {};
      return stringify({
        ...next,
        today_problems: [
          { ...first, evaluation: output.evaluation, logic_gaps: output.logic_gaps },
          ...problems.slice(1),
        ],
      });
    }

    case 'aipm-student-memory':
      return stringify({
        ...next,
        student_memory: output,
        next_learning_focus: output.next_learning_focus ?? null,
      });

    case 'aipm-next-problem':
      // 생성된 문제는 반드시 검증 단계를 다시 거친다.
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

function stringify(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
