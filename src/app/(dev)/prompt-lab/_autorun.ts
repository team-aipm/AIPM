/**
 * 자동 실행. **AI가 학생 자리에 앉아 끝까지 돌려 본다.**
 *
 * 손으로 하면 한 바퀴에 스무 번 넘게 눌러야 한다. 프롬프트를 한 줄
 * 고칠 때마다 그걸 다시 하면 마지막 결과까지 가 볼 엄두가 안 난다.
 * 그래서 학생 역할 모델을 하나 더 두고, 단계 프롬프트와 주고받게 한다.
 *
 * ```text
 * 단계 실행 → 학생에게 보일 말 → 학생 모델 → 학생 발화 → 다시 단계 실행
 *                                    ↓
 *                          분기 규칙이 정한 곳으로 이동 · 종료
 * ```
 *
 * **[분기] 표를 그대로 쓴다.** 손으로 누를 때 대상을 정해 주던 그 표다.
 * 자동 실행에서는 거기에 두 가지를 더 고를 수 있다.
 *
 * ```text
 * (계속)   같은 단계에서 학생이 한 번 더 말한다
 * (끝)     실행을 마친다
 * ```
 *
 * 맞는 줄이 없으면 `(계속)` 로 본다. 규칙을 안 적어 둔 단계는 학생 발화
 * 상한에 걸릴 때까지 대화를 이어간다.
 */

/** 분기 표에서 고를 수 있는 예약 대상. 단계 이름과 겹치지 않게 괄호를 쓴다 */
export const STAY = '(계속)';
export const FINISH = '(끝)';

export type AutoDecision =
  | { kind: 'stay' }
  | { kind: 'finish' }
  | { kind: 'move'; to: number };

/**
 * 왜 멈췄는가. 화면에 그대로 보여 준다.
 *
 * 상한에 걸려 멈춘 것과 규칙대로 끝난 것은 다른 일이다. 뭉뚱그리면
 * 프롬프트가 종료를 못 내는 건지, 그냥 길어진 건지 구분이 안 된다.
 */
export type StopReason =
  | 'finished'
  | 'student-limit'
  | 'move-limit'
  | 'call-limit'
  | 'stopped'
  | 'error';

export const STOP_TEXT: Record<StopReason, string> = {
  finished: '분기 규칙이 (끝)에 닿아 마쳤습니다.',
  'student-limit': '학생 발화 상한에 걸려 멈췄습니다. 종료 분기가 없는지 보세요.',
  'move-limit': '단계 이동 상한에 걸려 멈췄습니다. 분기가 돌고 있는지 보세요.',
  'call-limit': '호출 상한에 걸려 멈췄습니다.',
  stopped: '중지했습니다.',
  error: '오류로 멈췄습니다.',
};

export type AutoLimits = {
  /** 학생이 말할 수 있는 총 횟수 */
  students: number;
  /** 단계를 옮길 수 있는 총 횟수 */
  moves: number;
  /** 모델 호출 총 횟수. 단계와 학생을 합쳐서 센다 */
  calls: number;
};

export const DEFAULT_LIMITS: AutoLimits = { students: 20, moves: 12, calls: 60 };

/** 실행 기록 한 줄 */
export type AutoStep = {
  n: number;
  /** 어느 단계에서 일어난 일인가 */
  stage: number;
  kind: 'ai' | 'student' | 'move' | 'end' | 'error';
  text: string;
  /** 옮긴 이유, 검증 실패 같은 곁가지 */
  note?: string;
  /** 이 줄이 만든 결과 원문. 접어 두었다가 펼쳐 본다 */
  raw?: string;
};

/**
 * 학생 역할 프롬프트 기본값.
 *
 * **일부러 잘 못 푸는 학생으로 뒀다.** 술술 푸는 학생만 시험하면
 * Drill-down 이 한 번도 안 돈다. 우리가 보고 싶은 건 막혔을 때
 * 무슨 일이 일어나는가다.
 */
export const DEFAULT_STUDENT_PROMPT = `너는 초등학교 5학년 학생이다.
지금 학습 앱에서 AI 선생님과 대화하고 있다.

- 짧게 답한다. 한두 문장을 넘기지 않는다.
- 초등학생이 쓰는 말로 쓴다. 어려운 낱말을 쓰지 않는다.
- 계산을 자주 틀린다. 특히 순서를 헷갈린다.
- 왜 그렇게 풀었는지 물으면 잘 설명하지 못한다.
- 모르면 "잘 모르겠어" 라고 말한다. 아는 척하지 않는다.
- 보기가 주어지면 보기 중 하나를 그대로 골라 말해도 된다.
- 선생님이 문제를 안 냈으면 문제를 내 달라고 말한다.

너는 학생이다. 설명하거나 가르치지 않는다.
JSON 을 쓰지 않는다. 학생이 할 말만 그대로 쓴다.`;

/**
 * 학생 모델에게 줄 입력.
 *
 * 지금까지의 대화와 방금 선생님이 한 말을 그대로 준다. 단계 프롬프트가
 * 쓰는 JSON 을 그대로 주면 학생이 내부 상태를 읽어 버린다 —
 * `verified_answer` 를 보고 정답을 말하면 시험이 안 된다.
 */
export function studentInput(history: { who: string; text: string }[], latest: string): string {
  const lines = history
    .slice(-12)
    .map((turn) => `${turn.who === 'user' ? '나' : '선생님'}: ${turn.text}`);
  lines.push(`선생님: ${latest}`);
  lines.push('나:');
  return lines.join('\n');
}

/**
 * 학생 모델의 답을 다듬는다.
 *
 * 모델이 `나:` 를 다시 붙이거나 따옴표로 감싸는 일이 잦다. 그대로
 * 대화에 넣으면 다음 턴에 그게 또 예시가 되어 굳는다.
 */
export function cleanStudentReply(raw: string): string {
  let text = raw.trim();
  text = text.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/, '');
  text = text.replace(/^(나|학생)\s*[:：]\s*/, '');
  if (text.length > 1 && text.startsWith('"') && text.endsWith('"')) {
    text = text.slice(1, -1);
  }
  return text.trim();
}
