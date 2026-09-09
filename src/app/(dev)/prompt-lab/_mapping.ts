/**
 * 단계 연결 매핑. **이 단계의 결과 중 무엇을 다음 단계 입력의 어디에
 * 넣을지**를 사용자가 직접 정한다.
 *
 * `_bridge.ts` 가 하는 일과 같지만, 그쪽은 AIPM 규칙에 맞춰 코드에
 * 박아 둔 것이다. 다른 프로젝트에서는 쓸 수 없다. 이 파일은 화면에서
 * 표로 받는다.
 *
 * 우선순위는 화면에서 이렇게 잡는다.
 *
 * ```text
 * 1. 사용자가 적은 매핑            있으면 이걸 쓴다
 * 2. AIPM 규칙(_bridge.ts)         검증 규칙을 골랐을 때
 * 3. 출력 원문을 그대로 붙여넣기     둘 다 없을 때
 * ```
 *
 * **다음 입력을 통째로 갈아치우지 않는다.** 적어 둔 칸만 덮어쓰고
 * 나머지는 화면에서 편집한 값을 그대로 둔다.
 */

import { getPath, isRecord, parsePath, setPath } from './_paths';

export type MapSource = 'output' | 'input' | 'literal';

export const MAP_SOURCES: { id: MapSource; label: string; hint: string }[] = [
  { id: 'output', label: '이 단계 결과', hint: '예: evaluation.reasoning_score' },
  { id: 'input', label: '이 단계 입력', hint: '예: conversation' },
  { id: 'literal', label: '직접 적기', hint: '예: photo · 0 · [] · null' },
];

export type MapRow = {
  source: MapSource;
  /** 가져올 경로. `직접 적기` 면 값 자체 */
  from: string;
  /** 다음 단계 입력의 어디에 넣을지 */
  to: string;
};

export const BLANK_MAP_ROW: MapRow = { source: 'output', from: '', to: '' };

export function hasMapping(rows: MapRow[]): boolean {
  return rows.some((row) => row.to.trim() !== '' && row.from.trim() !== '');
}

export type MappingResult = {
  /** 덮어쓴 다음 단계 입력 */
  json: string;
  /** 옮긴 칸 수 */
  applied: number;
  /** 못 옮긴 이유. 화면에 그대로 보여준다 */
  notes: string[];
};

export function applyMapping(
  rows: MapRow[],
  output: unknown,
  fromInputJson: string,
  nextInputJson: string,
): MappingResult | null {
  if (!hasMapping(rows)) return null;

  let next: unknown = safeParse(nextInputJson);
  // 다음 입력이 비어 있거나 JSON 이 아니면 빈 객체에서 시작한다.
  if (!isRecord(next)) next = {};

  const fromInput = safeParse(fromInputJson);
  const notes: string[] = [];
  let applied = 0;

  for (const row of rows) {
    const to = row.to.trim();
    const from = row.from.trim();
    if (to === '' || from === '') continue;

    const target = parsePath(to);
    if (target === null || to.includes('[]')) {
      notes.push(`${to} → 넣을 위치의 경로가 올바르지 않습니다. ([] 는 넣을 때 쓸 수 없습니다)`);
      continue;
    }

    if (row.source === 'literal') {
      next = setPath(next, target, parseLiteral(from));
      applied += 1;
      continue;
    }

    const root = row.source === 'output' ? output : fromInput;
    const source = parsePath(from);
    if (source === null) {
      notes.push(`${from} → 가져올 경로가 올바르지 않습니다.`);
      continue;
    }

    const found = getPath(root, source);
    if (!found.exists) {
      const where = row.source === 'output' ? '결과' : '입력';
      notes.push(`${from} → ${where}에 그 값이 없어서 건너뛰었습니다.`);
      continue;
    }

    next = setPath(next, target, found.value);
    applied += 1;
  }

  return { json: JSON.stringify(next, null, 2), applied, notes };
}

/**
 * `직접 적기` 값을 읽는다.
 *
 * JSON 으로 읽어 보고 안 되면 문자열로 본다. `photo` 는 문자열,
 * `0` 은 숫자, `[]` 는 빈 목록, `null` 은 null 이 된다. 따옴표를 치는지
 * 마는지 사용자가 신경 쓰지 않아도 되게 하려는 것이다.
 */
export function parseLiteral(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * 매핑도 규칙도 없을 때 쓴다. **결과에 있는 값만 덮고 나머지는 둔다.**
 *
 * 예전에는 결과 원문으로 다음 입력을 통째로 갈아치웠다. 그래서 01 →
 * 02 로 보내면 02 입력에 있던 `student_id` · `grade` · `turn_limit` ·
 * `problem_state` 가 전부 사라졌다. `turn_limit` 이 없으니
 * `turns_remaining` 도 계산되지 않았고, "남은 횟수는 입력으로 주어진다.
 * 직접 세지 않는다" 던 프롬프트가 읽을 값이 없어 모델이 직접 셌다.
 *
 * 객체는 한 단계씩 파고들며 합치고, 배열과 원시값은 결과 쪽으로
 * 바꾼다. 배열을 합치면 대화가 두 배로 늘어난다.
 *
 * 둘 중 하나라도 객체가 아니면 null 을 준다. 부르는 쪽이 예전처럼
 * 원문을 넣는다.
 */
export function mergeOutput(nextInputJson: string, output: unknown): string | null {
  const next = safeParse(nextInputJson);
  if (!isRecord(next) || !isRecord(output)) return null;
  return JSON.stringify(deepMerge(next, output), null, 2);
}

function deepMerge(
  base: Record<string, unknown>,
  over: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(over)) {
    const current = out[key];
    out[key] =
      isRecord(current) && isRecord(value) ? deepMerge(current, value) : value;
  }
  return out;
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
