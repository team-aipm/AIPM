/**
 * 화면의 단계가 프리셋과 어디가 다른가.
 *
 * **프리셋을 고쳐도 이미 저장한 사람에게는 안 갑니다.** 화면은
 * 저장본을 읽고, 저장본에는 그때 값이 들어 있다. 손으로 고친 값을
 * 함부로 덮을 수 없으니 그 자체는 맞다 — 문제는 **다르다는 사실조차
 * 안 보였다** 는 것이다.
 *
 * 그래서 같은 신고가 세 번 왔다.
 *
 * ```text
 * 대화창에 퀴즈가 안 나온다      응답 필드가 옛 값이었다
 * 질문이 안 나온다               대화 모양이 옛 값이었다
 * 모드 A 만 계속된다             분기와 프롬프트가 옛 값이었다
 * ```
 *
 * `단계 초기화` 는 있지만 **전부** 되돌린다. 고쳐 둔 프롬프트까지
 * 날아가므로 못 누른다. 여기서는 **무엇이 다른지 보여 주고 골라서
 * 받아오게** 한다.
 */

import type { OutputMode, CheckRuleId } from '@/lib/ai/schema-check';

import type { MapRow } from './_mapping';
import type { Routing } from './_routing';

/**
 * 견줄 수 있는 만큼.
 *
 * 모델·키·대화·입력은 뺀다. 프리셋에 없거나(모델·키), 대화하면서 늘
 * 바뀌는 값(입력)이다. **늘 켜져 있는 경고는 아무도 안 본다.**
 */
export type Comparable = {
  prompt: string;
  inputMode: OutputMode;
  outputMode: OutputMode;
  checkRule: CheckRuleId | null;
  historyKey: string;
  replyKey: string;
  recordKey: string;
  choicesKey: string;
  studentTurn: string;
  studentField: string;
  aiTurn: string;
  aiField: string;
  latestKey: string;
  turnCountKey: string;
  remainingKey: string;
  limitKey: string;
  resetKey: string;
  routing: Routing;
  mapping: MapRow[];
  carry: MapRow[];
};

export type FieldId = keyof Comparable;

/** 묶어서 보여 준다. 칸 이름 열일곱 개를 늘어놓으면 안 읽힌다 */
export type Group = { id: string; label: string; fields: FieldId[] };

export const GROUPS: Group[] = [
  { id: 'prompt', label: '프롬프트', fields: ['prompt'] },
  { id: 'routing', label: '분기', fields: ['routing'] },
  { id: 'mapping', label: '다음 단계로 보낼 값', fields: ['mapping'] },
  { id: 'carry', label: '이어지는 값', fields: ['carry'] },
  {
    id: 'chat',
    label: '대화 모양',
    fields: [
      'historyKey',
      'studentTurn',
      'studentField',
      'aiTurn',
      'aiField',
      'latestKey',
      'turnCountKey',
      'remainingKey',
      'limitKey',
      'resetKey',
    ],
  },
  {
    id: 'reply',
    label: '응답·기록·보기 필드',
    fields: ['replyKey', 'recordKey', 'choicesKey'],
  },
  { id: 'io', label: '입출력 형식', fields: ['inputMode', 'outputMode', 'checkRule'] },
];

export type Diff = {
  group: Group;
  /** 실제로 다른 칸만 */
  fields: FieldId[];
};

/**
 * 다른 묶음만 준다. 같으면 빈 배열이다.
 *
 * 양쪽 다 "화면에 있는 그대로" 를 받는다. 프리셋 쪽 `routing` 은
 * `stages.ts` 가 아니라 `_routing.ts` 의 표에 있으므로, 부르는 쪽이
 * 두 값을 합쳐 넘긴다.
 */
export function diffAgainst(stage: Comparable, base: Comparable): Diff[] {
  const out: Diff[] = [];
  for (const group of GROUPS) {
    const fields = group.fields.filter((field) => !same(stage[field], base[field]));
    if (fields.length > 0) out.push({ group, fields });
  }
  return out;
}

/** 고른 묶음의 칸만 프리셋 값으로 바꾼다. 나머지는 손대지 않는다 */
export function pull(
  stage: Comparable,
  base: Comparable,
  groupIds: string[],
): Partial<Comparable> {
  const patch: Record<string, unknown> = {};
  for (const group of GROUPS) {
    if (!groupIds.includes(group.id)) continue;
    for (const field of group.fields) {
      if (!same(stage[field], base[field])) patch[field] = base[field];
    }
  }
  return patch as Partial<Comparable>;
}

function same(a: unknown, b: unknown): boolean {
  if (typeof a === 'string' && typeof b === 'string') return a === b;
  return JSON.stringify(a) === JSON.stringify(b);
}
