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
 * 모델 출력에서 **말풍선에 보여줄 부분만** 골라낸다.
 *
 * 출력 전체와 학생에게 보이는 문장은 다르다. Tutor 는 message 만 학생이
 * 보고 drilldown_stage·support_level·stage_status 는 내부 값이다.
 * Evaluator 처럼 학생에게 보여줄 문장이 아예 없는 단계도 있다.
 *
 * replyKey 를 비우면 "채팅에 표시하지 않음" 이다.
 */
export type ReplyPick =
  | { show: true; text: string }
  | { show: false; reason: string };

export function pickReply(
  raw: string,
  outputMode: 'json' | 'text',
  replyKey: string,
): ReplyPick {
  // 출력이 평문이면 고를 필드가 없다. 그대로 보여준다.
  if (outputMode === 'text') return { show: true, text: raw };

  const key = replyKey.trim();
  if (key === '') return { show: false, reason: '응답 필드가 비어 있어 표시하지 않습니다' };

  const parsed = safeParse(raw);
  // JSON 이어야 하는데 깨졌으면 원문을 보여준다. 디버깅에 필요하다.
  if (!isRecord(parsed)) return { show: true, text: raw };

  if (!(key in parsed)) {
    return { show: false, reason: `출력에 ${key} 가 없습니다` };
  }

  const value = parsed[key];
  return {
    show: true,
    text: typeof value === 'string' ? value : JSON.stringify(value, null, 2),
  };
}

/**
 * 모델 응답을 대화 배열에 붙이고, 다음 턴을 위한 상태를 옮긴다.
 *
 * `replyText` 가 null 이면 말풍선을 만들지 않는다. 데이터만 만드는
 * 단계에서 대화 기록을 오염시키지 않기 위해서다. 그래도 상태 이월은
 * 그대로 한다.
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
  replyText: string | null,
): string | null {
  const root = safeParse(inputJson);
  if (!isRecord(root)) return null;

  let next: Record<string, unknown> = { ...root };

  if (replyText !== null) {
    const history = Array.isArray(root[historyKey])
      ? [...(root[historyKey] as unknown[])]
      : [];
    history.push({
      speaker: 'ai',
      message_text: replyText,
      turn_number: history.length + 1,
    });
    next = { ...next, [historyKey]: history };
  }

  if (isRecord(output)) {
    for (const [key, value] of Object.entries(output)) {
      if (key !== replyKey && key in root) next[key] = value;
    }
  }

  const historyLength = Array.isArray(next[historyKey])
    ? (next[historyKey] as unknown[]).length
    : 0;
  next = syncTurnNumber(next, historyLength);
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
