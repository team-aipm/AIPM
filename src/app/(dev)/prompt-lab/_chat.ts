/**
 * 대화 턴 관리. 입력이 JSON 인 단계에서 쓴다.
 *
 * 대화 기록을 별도 상태로 두지 않는다. **입력 JSON 안의 배열이 곧 대화
 * 기록이다.** 그래서 화면의 대화창과 실제로 모델에 보내는 값이 절대
 * 어긋나지 않고, JSON을 직접 고치면 대화도 그대로 바뀐다.
 */

export type Turn = {
  who: 'user' | 'ai' | 'other';
  text: string;
  /** 그 턴에 함께 보낸 이미지 파일명 */
  attachments: string[];
};

/** 말한 사람을 담는 키 후보. 앞에서부터 찾는다. */
const SPEAKER_KEYS = ['speaker', 'role', 'from', 'author'];
/** 내용을 담는 키 후보 */
const TEXT_KEYS = ['message_text', 'message', 'text', 'content'];

const USER_WORDS = ['student', 'user', 'human', '학생', '사용자'];
const AI_WORDS = ['ai', 'assistant', 'model', 'bot', 'tutor'];

/** 입력 JSON에서 대화 배열을 읽어 화면에 그릴 턴 목록으로 바꾼다. */
export function readTurns(inputJson: string, historyKey: string): Turn[] {
  const root = safeParse(inputJson);
  if (!isRecord(root)) return [];

  const history = root[historyKey];
  if (!Array.isArray(history)) return [];

  return history.map((item) => {
    if (typeof item === 'string') {
      return { who: 'other' as const, text: item, attachments: [] };
    }
    if (!isRecord(item)) {
      return { who: 'other' as const, text: JSON.stringify(item), attachments: [] };
    }

    const speaker = pick(item, SPEAKER_KEYS);
    const text = pick(item, TEXT_KEYS) ?? JSON.stringify(item);
    const lowered = (speaker ?? '').toLowerCase();

    const who = USER_WORDS.some((word) => lowered.includes(word))
      ? ('user' as const)
      : AI_WORDS.some((word) => lowered.includes(word))
        ? ('ai' as const)
        : ('other' as const);

    const attachments = Array.isArray(item.attachments)
      ? item.attachments.filter((name): name is string => typeof name === 'string')
      : [];

    return { who, text, attachments };
  });
}

/** 사용자 발화를 대화 배열 끝에 붙인 입력 JSON을 만든다. */
export function appendUserTurn(
  inputJson: string,
  historyKey: string,
  text: string,
  attachmentNames: string[] = [],
): string | null {
  const root = safeParse(inputJson);
  if (!isRecord(root)) return null;

  const history = Array.isArray(root[historyKey]) ? [...(root[historyKey] as unknown[])] : [];
  // 이미지 본문(base64)은 대화 기록에 넣지 않는다. 파일명만 남긴다.
  // 넣으면 입력 JSON 이 수십 KB 로 부풀어 화면에서 읽을 수 없게 된다.
  history.push({
    speaker: 'student',
    message_text: text,
    turn_number: history.length + 1,
    ...(attachmentNames.length > 0 ? { attachments: attachmentNames } : {}),
  });

  return stringify(syncTurnNumber({ ...root, [historyKey]: history }, history.length));
}

/**
 * 모델 응답을 대화 배열에 붙이고, 다음 턴을 위한 상태를 옮긴다.
 *
 * 상태를 옮기는 규칙은 하나다.
 * **출력의 최상위 키 중 입력에도 같은 이름이 있으면 덮어쓴다.**
 * (예: `stage_status`)
 * 이름이 다른 값은 옮기지 않는다. 규칙을 하나로 두어야 화면을 보고
 * 무슨 일이 일어났는지 예측할 수 있다.
 */
export function appendAiTurn(
  inputJson: string,
  historyKey: string,
  replyKey: string,
  output: unknown,
): string | null {
  const root = safeParse(inputJson);
  if (!isRecord(root)) return null;

  const reply = isRecord(output)
    ? typeof output[replyKey] === 'string'
      ? (output[replyKey] as string)
      : JSON.stringify(output[replyKey] ?? output)
    : String(output);

  const history = Array.isArray(root[historyKey]) ? [...(root[historyKey] as unknown[])] : [];
  history.push({
    speaker: 'ai',
    message_text: reply,
    turn_number: history.length + 1,
  });

  let next: Record<string, unknown> = { ...root, [historyKey]: history };

  if (isRecord(output)) {
    for (const [key, value] of Object.entries(output)) {
      if (key !== replyKey && key in root) next[key] = value;
    }
  }

  next = syncTurnNumber(next, history.length);
  return stringify(next);
}

/** 입력에 turn_number 가 있으면 대화 길이에 맞춘다. 없으면 만들지 않는다. */
function syncTurnNumber(
  root: Record<string, unknown>,
  historyLength: number,
): Record<string, unknown> {
  if (typeof root.turn_number !== 'number') return root;
  return { ...root, turn_number: historyLength + 1 };
}

function pick(item: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === 'string') return value;
  }
  return null;
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
