/**
 * 조건부 다음 단계.
 *
 * **제품과 개발 도구가 함께 쓴다.** 원래 `(dev)/prompt-lab/_routing.ts`
 * 였다.
 *
 * 학습은 한 줄로 흐르지 않는다. 01 SESSION HOST 는 `recommended_mode` 로
 * A 인지 B 인지를 내놓고, 그에 따라 02 로 갈지 03 으로 갈지가 갈린다.
 * 손으로 매번 대상을 고르면 시험할 때마다 틀린 단계로 보내게 된다.
 *
 * **결과의 어떤 값을 읽어서 [보내기] 의 기본 대상을 정한다.** 정하기만
 * 한다 — 보내지는 않는다. 자동으로 넘어가 버리면 결과를 보기도 전에
 * 화면이 바뀐다. 무엇을 보고 어디로 정했는지 한 줄로 알려 주고, 사용자가
 * 그대로 눌러 보내거나 다른 단계로 바꾼다.
 *
 * ```text
 * 읽을 값   recommended_mode
 *   A  →  02 MODE A
 *   B  →  03 MODE B
 *   (빈칸) →  01 SESSION HOST      ← 그밖의 모든 값
 * ```
 *
 * 대상은 자리(index)가 아니라 **단계 이름**으로 적는다. 단계를 넣거나
 * 옮겨도 따라간다.
 */

import { getPath, parsePath, preview } from '@/lib/ai/pipeline/paths';

export type RouteRow = {
  /** 읽은 값이 이것과 같으면. 비우면 "그밖의 모든 값" */
  equals: string;
  /** 보낼 단계 이름 */
  to: string;
};

export type Routing = {
  /** 결과에서 읽을 경로. 비우면 조건부 대상을 쓰지 않는다 */
  from: string;
  rows: RouteRow[];
};

/**
 * 분기 표에서 고를 수 있는 예약 대상. 단계 이름과 겹치지 않게 괄호를 쓴다.
 *
 * 자동 실행이 쓰던 값인데 **분기의 뜻**이라 여기에 둔다. `(계속)` 은 같은
 * 단계에서 한 번 더 주고받는다는 뜻이고, `(끝)` 은 한 바퀴를 마친다는
 * 뜻이다. 둘 다 단계 이름이 아니라서 이름으로 찾으면 안 나온다.
 */
export const STAY = '(계속)';
export const FINISH = '(끝)';

export const EMPTY_ROUTING: Routing = { from: '', rows: [] };
export const BLANK_ROUTE_ROW: RouteRow = { equals: '', to: '' };

/** 쓸 만한 줄이 하나라도 있는지. 읽을 경로가 없으면 아무것도 아니다 */
export function hasRouting(routing: Routing): boolean {
  return routing.from.trim() !== '' && routing.rows.some((row) => row.to.trim() !== '');
}

export type RoutePick = {
  /** 고른 단계의 자리. 못 골랐으면 null — 부르는 쪽이 기본값을 쓴다 */
  index: number | null;
  /** 화면에 그대로 보여줄 한 줄. 왜 그렇게 정했는지가 들어 있다 */
  note: string;
};

/**
 * 결과를 보고 보낼 단계를 고른다. 규칙을 안 쓰면 null.
 *
 * 못 고른 경우에도 `note` 는 채운다. 조용히 기본값으로 돌아가면
 * 규칙을 잘못 적은 걸 알아챌 수 없다.
 */
export function pickRoute(
  routing: Routing,
  output: unknown,
  names: string[],
  self: number,
): RoutePick | null {
  const matched = matchRoute(routing, output);
  if (matched === null) return null;
  // 손으로 보낼 때는 못 고르면 기본 대상으로 간다. 그 사실까지 알려 준다.
  if (matched.to === null) {
    return { index: null, note: `${matched.note} 기본 대상으로 둡니다.` };
  }

  const to = matched.to;
  const index = names.findIndex((name) => name === to);
  if (index === -1) {
    return { index: null, note: `${matched.shown} → "${to}" 라는 단계가 없습니다.` };
  }
  if (index === self) {
    return { index: null, note: `${matched.shown} → 자기 자신이라 보낼 수 없습니다.` };
  }

  return { index, note: matched.note };
}

/** 규칙이 고른 대상 이름. 단계 이름일 수도, 예약 대상일 수도 있다 */
export type RouteMatch = {
  /** 고른 대상. 못 골랐으면 null */
  to: string | null;
  /** 읽은 값을 보기 좋게 줄인 것 */
  shown: string;
  note: string;
};

/**
 * 결과에서 값을 읽어 맞는 줄을 찾는다. **이름 해석은 하지 않는다.**
 *
 * 손으로 보낼 때는 대상이 반드시 단계여야 하지만, 자동 실행에서는
 * `(계속)` · `(끝)` 같은 예약 대상도 나온다. 그래서 이름을 자리로
 * 바꾸는 일은 부르는 쪽에 맡긴다.
 */
export function matchRoute(routing: Routing, output: unknown): RouteMatch | null {
  if (!hasRouting(routing)) return null;

  const from = routing.from.trim();
  const segments = parsePath(from);
  if (segments === null) {
    return { to: null, shown: '', note: `${from} → 읽을 경로가 올바르지 않습니다.` };
  }

  const found = getPath(output, segments);
  if (!found.exists) {
    return { to: null, shown: '', note: `결과에 ${from} 가 없습니다.` };
  }

  const value = asText(found.value);
  const shown = preview(found.value);
  const row = routing.rows.find((candidate) => {
    if (candidate.to.trim() === '') return false;
    const want = candidate.equals.trim();
    // 빈 칸은 "그밖의 모든 값". 마지막 줄에 두고 쓰라고 만든 자리다.
    if (want === '') return true;
    return want.toLowerCase() === value.toLowerCase();
  });

  if (row === undefined) {
    return { to: null, shown, note: `${from} 가 ${shown} 인데 맞는 줄이 없습니다.` };
  }

  const to = row.to.trim();
  return { to, shown, note: `${from} 가 ${shown} 이라 ${to} 로 정했습니다.` };
}

/**
 * 읽은 값을 비교할 글자로 바꾼다.
 *
 * `"A"` 와 `A` 를 따로 적게 하지 않으려는 것이다. 숫자·참거짓·null 도
 * 눈에 보이는 대로 적으면 맞는다. 객체나 배열은 비교 대상이 아니지만
 * JSON 으로 바꿔 두면 적어도 무엇이 왔는지 화면에서 보인다.
 */
function asText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === null) return 'null';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value) ?? '';
  } catch {
    return '';
  }
}

/**
 * AIPM 기본 분기.
 *
 * `_bridge.ts` 와 같은 성격이다 — 이 도구는 범용이지만, 이 저장소에서
 * 처음 열었을 때 AIPM 흐름이 그냥 돌아가야 한다. 프리셋 단계 이름으로
 * 찾으며, 이름을 바꾸거나 단계를 새로 만들면 빈 값에서 시작한다.
 *
 * 01 만 넣는다. 나머지는 다음 단계로 곧게 흐른다. 05 EVALUATOR 뒤가
 * 06 인지 다시 01 인지는 하루치 문제를 다 풀었는지에 달렸는데, 그건
 * 결과가 아니라 서버가 세는 값이라 여기서 읽을 수 없다.
 */
export const AIPM_ROUTES: Record<string, Routing> = {
  // recommended_mode 는 AI 의 **추천**이다. 그걸 보고 옮기면 학생이
  // 고를 기회가 없다 — 01 이 WAIT_MODE_SELECTION 을 내는데 도구가 안
  // 기다리고 넘어가 버렸다. 추천은 대개 A 라 늘 A 로만 돌았다.
  //
  // next_module 은 01 이 "다음에 무엇을 할지" 하나로 말해 주는 값이다.
  '01 SESSION HOST': {
    from: 'next_module',
    rows: [
      { equals: 'MODE_A', to: '02 MODE A' },
      { equals: 'MODE_B', to: '03 MODE B' },
      // 하루가 끝나면 종합으로 간다. 거기서 끝난다.
      { equals: 'END', to: '06 DAILY ANALYZER' },
      // SESSION_HOST — 아직 안 골랐다. 학생이 말할 차례다.
      { equals: '', to: STAY },
    ],
  },
  // 자동 실행이 어디서 멈출지를 정한다. 손으로 누를 때는 (계속)·(끝)이
  // 못 고른 것으로 읽히므로 예전과 똑같이 다음 단계가 기본이다.
  '02 MODE A': {
    from: 'completion.status',
    rows: [
      { equals: 'CONTINUE', to: '(계속)' },
      { equals: '', to: '05 EVALUATOR' },
    ],
  },
  '03 MODE B': {
    from: 'completion.status',
    rows: [
      { equals: 'CONTINUE', to: '(계속)' },
      { equals: '', to: '05 EVALUATOR' },
    ],
  },
  // 평가가 끝나면 01 로 돌아간다. COM-001 §5 "첫 문제 완료 후 AI가
  // 자연스럽게 다음 행동을 제안한다" 가 거기서 일어난다. 한 문제만
  // 돌고 끝내면 MODE B 를 한 번도 안 지난다.
  '05 EVALUATOR': {
    from: 'module',
    rows: [{ equals: '', to: '01 SESSION HOST' }],
  },
  '06 DAILY ANALYZER': {
    from: 'module',
    rows: [{ equals: '', to: FINISH }],
  },
};

export function defaultRouting(name: string): Routing {
  const found = AIPM_ROUTES[name];
  // 얕은 복사로 넘긴다. 화면에서 고친 값이 프리셋에 스며들면 안 된다.
  return found === undefined
    ? EMPTY_ROUTING
    : { from: found.from, rows: found.rows.map((row) => ({ ...row })) };
}
