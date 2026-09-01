import type { StageId } from '@/lib/ai/prompts/stages';

/**
 * 한 단계의 출력을 다음 단계의 입력으로 옮긴다.
 *
 * docs/prompts/logic-auditor.md "실행 순서"를 화면에서 그대로 따라갈 수
 * 있게 하는 것이 목적이다. 다음 단계 입력을 통째로 갈아치우지 않고,
 * 이어져야 하는 필드만 덮어쓴다. 나머지는 화면에서 편집한 값을 유지한다.
 *
 * 실패하면 null을 돌려주고 화면은 "직접 옮기세요"로 안내한다.
 */
export function bridge(
  from: StageId,
  output: unknown,
  nextInputJson: string,
): string | null {
  if (!isRecord(output)) return null;

  let next: unknown;
  try {
    next = JSON.parse(nextInputJson);
  } catch {
    return null;
  }
  if (!isRecord(next)) return null;

  switch (from) {
    case '02':
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

    case '03': {
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

    case '04': {
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

    case '05':
      return stringify({
        ...next,
        student_memory: output,
        next_learning_focus: output.next_learning_focus ?? null,
      });

    case '06':
      // 생성된 문제는 반드시 02의 검증을 다시 거친다.
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
