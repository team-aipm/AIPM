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

export type MapSource = 'output' | 'input' | 'literal' | 'increment';

export const MAP_SOURCES: { id: MapSource; label: string; hint: string }[] = [
  { id: 'output', label: '이 단계 결과', hint: '예: evaluation.reasoning_score' },
  { id: 'input', label: '이 단계 입력', hint: '예: conversation' },
  { id: 'literal', label: '직접 적기', hint: '예: photo · 0 · [] · null' },
  {
    id: 'increment',
    label: '1 더하기',
    hint: '예: payload.mode_status.mode_a_count',
  },
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

    // 세는 값은 도구가 늘려 준다.
    //
    // 모델에게 "지금까지 몇 번 했는지 세어라" 를 시키면 틀린다. 그리고
    // 안 세면 "덜 해 본 쪽" 을 고를 수가 없다 — mode_a_count 가 0 에
    // 머물러 매번 같은 판단이 반복된다.
    if (row.source === 'increment') {
      const source = parsePath(from);
      if (source === null) {
        notes.push(`${from} → 셀 경로가 올바르지 않습니다.`);
        continue;
      }
      const found = getPath(fromInput, source);
      // 없으면 0 에서 시작한다. 첫 문제에는 아직 아무 값도 없다.
      const before = typeof found.value === 'number' ? found.value : 0;
      next = setPath(next, target, before + 1);
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

/**
 * AIPM 기본 매핑.
 *
 * `_bridge.ts` · `AIPM_ROUTES` 와 같은 성격이다 — 도구는 범용이지만
 * 이 저장소에서 처음 열었을 때 AIPM 흐름은 그냥 돌아가야 한다.
 *
 * **없어서 생긴 일:** 05 는 `next_learning.recommended_mode` 로 다음
 * 모드를 내고 `action = NEXT_MODE_SELECTION` 으로 "학생에게 물어봐라"
 * 까지 말한다. 01 에는 그걸 받는 `## CONTINUE` 절이 있다. 그런데 두
 * 값을 옮기는 줄이 없어서, 01 은 매번 `session_phase = "START"` 로
 * 돌았다. **첫 인사만 다시 하고 모드는 늘 A 였다.**
 *
 * 여기 적는 것은 "이 값을 저기에 넣어라" 뿐이다. 판단은 프롬프트가 한다.
 */
export const AIPM_MAPS: Record<string, MapRow[]> = {
  // 고른 모드와 지금까지의 균형을 문제 단계로 들려 보낸다. 이게 한
  // 바퀴 돌아 01 로 돌아와야 "이번엔 B 어때?" 를 말할 수 있다.
  '01 SESSION HOST': [
    { source: 'output', from: 'selected_mode', to: 'payload.learning_mode' },
    { source: 'input', from: 'payload.mode_status', to: 'payload.mode_status' },
    { source: 'input', from: 'student', to: 'student' },
    { source: 'input', from: 'session', to: 'session' },
  ],
  // 문제 하나가 끝났다. 결과를 평가 단계가 읽는 자리에 옮긴다.
  '02 MODE A': [
    { source: 'literal', from: 'A', to: 'payload.learning_mode' },
    { source: 'input', from: 'payload.mode_status', to: 'payload.mode_status' },
    // 도구가 센다. 모델에게 세라고 하면 틀리고, 안 세면 "덜 해 본 쪽"
    // 을 고를 수가 없다.
    {
      source: 'increment',
      from: 'payload.mode_status.mode_a_count',
      to: 'payload.mode_status.mode_a_count',
    },
    { source: 'output', from: 'problem_state.problem_text', to: 'payload.problem_result.problem_text' },
    { source: 'output', from: 'problem_state.verified_answer', to: 'payload.problem_result.verified_answer' },
    { source: 'output', from: 'completion.status', to: 'payload.problem_result.completion_status' },
    { source: 'output', from: 'interaction_update.support_level', to: 'payload.problem_result.support_level' },
    { source: 'input', from: 'payload.interaction.response_history', to: 'payload.problem_result.response_history' },
    { source: 'input', from: 'payload.interaction.student_turn_count', to: 'payload.problem_result.student_turn_count' },
    { source: 'input', from: 'payload.interaction.turn_limit', to: 'payload.problem_result.turn_limit' },
    { source: 'input', from: 'student', to: 'student' },
    { source: 'input', from: 'session', to: 'session' },
  ],
  '03 MODE B': [
    { source: 'literal', from: 'B', to: 'payload.learning_mode' },
    { source: 'input', from: 'payload.mode_status', to: 'payload.mode_status' },
    {
      source: 'increment',
      from: 'payload.mode_status.mode_b_count',
      to: 'payload.mode_status.mode_b_count',
    },
    { source: 'output', from: 'problem_state.problem_text', to: 'payload.problem_result.problem_text' },
    { source: 'output', from: 'problem_state.verified_answer', to: 'payload.problem_result.verified_answer' },
    { source: 'output', from: 'completion.status', to: 'payload.problem_result.completion_status' },
    { source: 'output', from: 'interaction_update.support_level', to: 'payload.problem_result.support_level' },
    { source: 'input', from: 'payload.interaction.response_history', to: 'payload.problem_result.response_history' },
    { source: 'input', from: 'payload.interaction.student_turn_count', to: 'payload.problem_result.student_turn_count' },
    { source: 'input', from: 'payload.interaction.turn_limit', to: 'payload.problem_result.turn_limit' },
    { source: 'input', from: 'student', to: 'student' },
    { source: 'input', from: 'session', to: 'session' },
  ],
  // 평가가 끝났다. 01 이 "이번엔 어떤 방식으로 할래?" 를 물을 수 있게
  // 세션 단계를 CONTINUE 로 바꾸고 다음 모드 추천을 넘긴다.
  '05 EVALUATOR': [
    { source: 'literal', from: 'CONTINUE', to: 'payload.session_phase' },
    // **순서가 중요하다.** 통째로 옮기는 줄을 먼저 두어야 한다. 뒤에
    // 두면 방금 채운 preferred_mode · last_mode 를 도로 덮는다.
    { source: 'input', from: 'payload.mode_status', to: 'payload.mode_status' },
    { source: 'output', from: 'next_learning.recommended_mode', to: 'payload.mode_status.preferred_mode' },
    { source: 'input', from: 'payload.learning_mode', to: 'payload.mode_status.last_mode' },
    { source: 'input', from: 'student', to: 'student' },
    { source: 'input', from: 'session', to: 'session' },
    // 새 문제로 가므로 앞 문제의 대화는 안 넘긴다.
    { source: 'literal', from: '[]', to: 'conversation' },
  ],
};

export function defaultMapping(name: string): MapRow[] {
  // 얕은 복사. 화면에서 고친 값이 프리셋에 스며들면 안 된다.
  return (AIPM_MAPS[name] ?? []).map((row) => ({ ...row }));
}
