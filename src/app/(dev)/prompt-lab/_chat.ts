/**
 * 대화 턴 관리. 입력이 JSON 인 단계에서 쓴다.
 *
 * 대화 기록을 별도 상태로 두지 않는다. **입력 JSON 안의 배열이 곧 대화
 * 기록이다.** 그래서 화면의 대화창과 실제로 모델에 보내는 값이 절대
 * 어긋나지 않고, JSON을 직접 고치면 대화도 그대로 바뀐다.
 */

import { stripFence } from '@/lib/ai/schema-check';
import { getPath, parsePath, setPath } from './_paths';

/**
 * 대화 배열과 응답 필드는 **중첩 경로**를 받는다.
 *
 * `conversation` 처럼 최상위에 있는 경우가 흔하지만, 프롬프트에 따라
 * `payload.interaction.response_history` 처럼 깊이 들어가 있기도 하다.
 * 최상위만 보면 그런 프롬프트에서는 대화창이 영영 비어 있게 된다.
 */
function readAt(root: unknown, path: string): unknown {
  const segments = parsePath(path);
  if (segments === null) return undefined;
  const found = getPath(root, segments);
  return found.exists ? found.value : undefined;
}

function writeAt(root: unknown, path: string, value: unknown): unknown {
  const segments = parsePath(path);
  if (segments === null) return root;
  return setPath(root, segments, value);
}

/**
 * 대화를 입력 JSON 의 어디에 어떤 모양으로 쓸지.
 *
 * 프롬프트마다 대화를 담는 모양이 다르다. 어떤 프롬프트는
 * `{ speaker, message_text }` 를 기대하고, 어떤 프롬프트는
 * `{ response_role, response_type, content }` 를 기대한다. 마지막 발화를
 * 배열과 **별도 자리에** 한 번 더 두는 프롬프트도 있다.
 *
 * 도구가 한 모양으로 고정해 쓰면 그런 프롬프트에서는 모델이 학생의 말을
 * 자기가 읽는 자리에서 못 찾는다. 그래서 단계마다 정한다.
 */
export type ChatShape = {
  /** 대화가 쌓이는 배열. 중첩 경로를 쓴다 */
  historyKey: string;
  /** 학생 턴 JSON 템플릿 */
  studentTurn: string;
  /** 그 템플릿에서 학생의 말이 들어갈 자리 */
  studentField: string;
  /** AI 턴 JSON 템플릿. 비우면 AI 턴을 배열에 남기지 않는다 */
  aiTurn: string;
  aiField: string;
  /**
   * 마지막 **학생** 발화를 따로 두는 자리. 비우면 쓰지 않는다.
   *
   * 배열에 쌓는 것과 별개다. 프롬프트가 "직전에 뭐라고 했나" 를 한 곳에서
   * 읽게 하려고 두는 필드다.
   */
  latestKey: string;
  /** 학생 발화 수. 비우면 쓰지 않는다 */
  turnCountKey: string;
  /** 남은 횟수. turnCountKey 와 limitKey 가 함께 있어야 계산한다 */
  remainingKey: string;
  limitKey: string;
  /**
   * **문제가 바뀐 것을 알아보는 자리.** 비우면 쓰지 않는다.
   *
   * COM-001 §7 은 학생 응답 5회를 "한 문제에서" 로 정한다. 그런데
   * 도구는 배열에 쌓인 학생 턴을 전부 세고 있었다. 새 문제가 나와도
   * 숫자가 안 줄어서, 두 번째 문제는 시작부터 남은 횟수가 모자랐다.
   *
   * 결과의 이 값이 입력의 값과 다르면 새 문제로 본다. 그때 대화
   * 기록과 마지막 발화를 비우고 횟수를 0 부터 다시 센다. 화면의
   * 말풍선은 따로 쌓이므로 지워지지 않는다 — 모델에게 보내는 기록만
   * 새 문제부터 시작한다.
   */
  resetKey: string;
};

export const DEFAULT_CHAT_SHAPE: ChatShape = {
  historyKey: 'conversation',
  studentTurn: '{ "speaker": "student", "message_text": "" }',
  studentField: 'message_text',
  aiTurn: '{ "speaker": "ai", "message_text": "" }',
  aiField: 'message_text',
  latestKey: '',
  turnCountKey: '',
  remainingKey: '',
  limitKey: '',
  resetKey: '',
};

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

  const history = readAt(root, historyKey);
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

/**
 * 템플릿으로 턴 하나를 만든다.
 *
 * 템플릿이 JSON 이 아니거나 비어 있으면 null 을 돌려주고, 부르는 쪽이
 * 그 턴을 건너뛴다.
 */
function makeTurn(
  template: string,
  field: string,
  text: string,
  extra?: Record<string, unknown>,
): unknown | null {
  const trimmed = template.trim();
  if (trimmed === '') return null;

  const shape = safeParse(trimmed);
  if (!isRecord(shape)) return null;

  const segments = parsePath(field);
  const filled = segments === null ? shape : setPath(shape, segments, text);
  return extra && Object.keys(extra).length > 0 && isRecord(filled)
    ? { ...filled, ...extra }
    : filled;
}

/** 학생 발화 수를 세고, 남은 횟수까지 맞춘다 */
function syncCounters(
  root: Record<string, unknown>,
  shape: ChatShape,
  studentTurns: number,
): Record<string, unknown> {
  let next = root;

  if (shape.turnCountKey.trim() !== '') {
    next = writeAt(next, shape.turnCountKey, studentTurns) as Record<string, unknown>;
  }

  // 남은 횟수는 한도에서 뺀다. 모델에게 숫자를 비교시키지 않으려고 둔
  // 필드이므로 도구가 계산해 준다.
  if (shape.remainingKey.trim() !== '' && shape.limitKey.trim() !== '') {
    const limit = readAt(next, shape.limitKey);
    if (typeof limit === 'number') {
      next = writeAt(
        next,
        shape.remainingKey,
        Math.max(0, limit - studentTurns),
      ) as Record<string, unknown>;
    }
  }

  return next;
}

/** 대화 배열에서 학생 턴만 센다. 템플릿이 무엇이든 위치로 세지 않는다 */
function countStudentTurns(history: unknown[], shape: ChatShape): number {
  const marker = safeParse(shape.studentTurn.trim() || '{}');
  const keys = isRecord(marker) ? Object.keys(marker) : [];
  if (keys.length === 0) return history.length;

  // 학생 템플릿에만 있고 AI 템플릿에는 없는 키를 표식으로 쓴다.
  const aiShape = safeParse(shape.aiTurn.trim() || '{}');
  const aiKeys = new Set(isRecord(aiShape) ? Object.keys(aiShape) : []);
  const mark = keys.find((key) => !aiKeys.has(key));

  if (mark === undefined) {
    // 두 템플릿의 키가 같으면 값으로 가른다 (speaker: student / ai 처럼)
    const studentValues = isRecord(marker) ? marker : {};
    return history.filter(
      (item) =>
        isRecord(item) &&
        keys.some(
          (key) =>
            key !== shape.studentField &&
            studentValues[key] !== undefined &&
            item[key] === studentValues[key],
        ),
    ).length;
  }
  return history.filter((item) => isRecord(item) && mark in item).length;
}

/** 사용자 발화를 대화 배열 끝에 붙인 입력 JSON을 만든다. */
export function appendUserTurn(
  inputJson: string,
  shape: ChatShape,
  text: string,
  attachmentNames: string[] = [],
): string | null {
  const root = safeParse(inputJson);
  if (!isRecord(root)) return null;

  const current = readAt(root, shape.historyKey);
  const history = Array.isArray(current) ? [...current] : [];

  // 이미지 본문(base64)은 대화 기록에 넣지 않는다. 파일명만 남긴다.
  // 넣으면 입력 JSON 이 수십 KB 로 부풀어 화면에서 읽을 수 없게 된다.
  const turn = makeTurn(shape.studentTurn, shape.studentField, text, {
    ...(attachmentNames.length > 0 ? { attachments: attachmentNames } : {}),
  });
  if (turn === null) return null;
  history.push(turn);

  let next = writeAt(root, shape.historyKey, history) as Record<string, unknown>;

  // 마지막 발화를 따로 두는 프롬프트가 있다. 배열과 별개다.
  if (shape.latestKey.trim() !== '') {
    next = writeAt(next, shape.latestKey, turn) as Record<string, unknown>;
  }

  next = syncCounters(next, shape, countStudentTurns(history, shape));
  return stringify(syncTurnNumber(next, history.length));
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

  // 쉼표로 여러 경로를 적을 수 있다. 문제와 말풍선이 다른 필드에 나오는
  // 프롬프트가 있어서, 하나만 보면 문제가 화면에 안 나온다.
  const keys = replyKey
    .split(',')
    .map((one) => one.trim())
    .filter((one) => one !== '');
  if (keys.length === 0) {
    return { show: false, reason: '응답 필드가 비어 있어 표시하지 않습니다' };
  }

  const parsed = parseOutput(raw);
  // JSON 이어야 하는데 깨졌으면 원문을 보여준다. 디버깅에 필요하다.
  if (!isRecord(parsed)) return { show: true, text: raw };

  const parts: string[] = [];
  const missing: string[] = [];
  for (const key of keys) {
    const segments = parsePath(key);
    const found =
      segments === null ? { exists: false, value: undefined } : getPath(parsed, segments);
    if (!found.exists || found.value === null || found.value === '') {
      missing.push(key);
      continue;
    }
    const value = found.value;
    parts.push(typeof value === 'string' ? value : JSON.stringify(value, null, 2));
  }

  if (parts.length === 0) {
    return { show: false, reason: `출력에 ${missing.join(' · ')} 가 없습니다` };
  }
  return { show: true, text: parts.join('\n\n') };
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
  shape: ChatShape,
  replyKey: string,
  output: unknown,
  replyText: string | null,
): string | null {
  const root = safeParse(inputJson);
  if (!isRecord(root)) return null;

  let next: Record<string, unknown> = { ...root };

  // 새 문제면 기록을 비우고 시작한다. 앞 문제의 턴이 남아 있으면
  // 이번 문제의 남은 횟수가 그만큼 깎인다.
  const restarted = startsNewProblem(root, output, shape.resetKey);
  if (restarted) {
    next = writeAt(next, shape.historyKey, []) as Record<string, unknown>;
    if (shape.latestKey.trim() !== '') {
      next = writeAt(next, shape.latestKey, null) as Record<string, unknown>;
    }
  }

  if (replyText !== null) {
    const current = readAt(next, shape.historyKey);
    const history = Array.isArray(current) ? [...current] : [];
    const turn = makeTurn(shape.aiTurn, shape.aiField, replyText);
    // AI 턴 템플릿을 비우면 배열에 남기지 않는다. 학생 응답만 기록하는
    // 프롬프트가 있다.
    if (turn !== null) {
      history.push(turn);
      next = writeAt(next, shape.historyKey, history) as Record<string, unknown>;
    }
  }

  if (isRecord(output)) {
    // 응답 필드가 여러 개일 수 있다. 그 최상위 조각들과 비교한다.
    const replyTops = new Set(
      replyKey
        .split(',')
        .map((one) => one.trim().split('.')[0]?.split('[')[0] ?? '')
        .filter((one) => one !== ''),
    );
    for (const [key, value] of Object.entries(output)) {
      // ui.message 가 응답 필드일 때 ui 를 통째로 이월하면 말풍선이
      // 두 번 들어간다.
      if (!replyTops.has(key) && key in root) next[key] = value;
    }
  }

  const written = readAt(next, shape.historyKey);
  const history = Array.isArray(written) ? written : [];
  next = syncCounters(next, shape, countStudentTurns(history, shape));
  return stringify(syncTurnNumber(next, history.length));
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

/**
 * 입력 JSON 을 읽는다. 여긴 우리가 만든 값이라 울타리가 붙을 일이 없다.
 */
function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * **모델 출력**을 읽는다. ```json 울타리를 벗기고 파싱한다.
 *
 * 입력과 나눠 둔 이유는, 울타리는 모델이 붙이는 것이지 우리가 만든
 * 입력에는 없기 때문이다. 같은 함수로 두면 어디서 벗겨야 하는지가
 * 흐려진다.
 */
export function parseOutput(raw: string): unknown {
  try {
    return JSON.parse(stripFence(raw.trim()));
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

/**
 * 결과가 앞과 다른 문제를 내놓았는가.
 *
 * 양쪽에 값이 다 있고 서로 다를 때만 참이다. 결과에 그 칸이 없으면
 * (같은 문제를 이어가는 턴) 건드리지 않는다. 입력에 없으면 첫 문제라
 * 비울 것도 없다.
 */
function startsNewProblem(
  root: Record<string, unknown>,
  output: unknown,
  resetKey: string,
): boolean {
  const path = resetKey.trim();
  if (path === '' || !isRecord(output)) return false;

  const before = readAt(root, path);
  const after = readAt(output, path);
  if (before === undefined || after === undefined) return false;
  if (before === null || after === null) return false;

  return JSON.stringify(before) !== JSON.stringify(after);
}

/**
 * 대화를 지우고 처음 상태로 되돌린다. **자동 실행이 시작할 때 쓴다.**
 *
 * 손으로 대화하던 입력이나 앞 회차의 끝 상태에서 시작하면, 학생이
 * 이미 다섯 번 말한 자리에서 출발한다. 모델은 예전 대화를 이어받아
 * 없던 문제를 다시 꺼내고, 남은 횟수는 처음부터 0 이다.
 *
 * **대화만 지운다.** student_id · grade · turn_limit 같은 설정은
 * 그대로 둔다. 그건 실행에 필요한 값이지 대화가 아니다.
 */
export function resetConversation(inputJson: string, shape: ChatShape): string {
  const root = safeParse(inputJson);
  if (!isRecord(root)) return inputJson;

  let next: Record<string, unknown> = { ...root };
  next = writeAt(next, shape.historyKey, []) as Record<string, unknown>;
  if (shape.latestKey.trim() !== '') {
    next = writeAt(next, shape.latestKey, null) as Record<string, unknown>;
  }
  return stringify(syncCounters(next, shape, 0));
}
