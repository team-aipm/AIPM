/**
 * 점 표기 경로로 JSON 안의 값을 읽고 쓴다.
 *
 * **제품과 개발 도구가 함께 쓴다.** 원래 `(dev)/prompt-lab/_paths.ts`
 * 였다.
 *
 * 검증 규칙표와 단계 연결 매핑이 둘 다 이걸 쓴다. 사용자가 화면에서
 * 손으로 적는 문자열이므로 **틀린 경로를 던지지 않고 "없음"으로 돌려준다.**
 *
 * ```text
 * evaluation.reasoning_score   객체 안으로 들어간다
 * logic_gaps[0].gap_type       배열의 n번째
 * logic_gaps[].gap_type        배열 전체. 읽기에서만 쓴다
 * ```
 */

export type Segment =
  | { kind: 'key'; key: string }
  | { kind: 'index'; index: number }
  | { kind: 'each' };

/** 경로 문자열을 조각으로 나눈다. 형식이 틀리면 null. */
export function parsePath(path: string): Segment[] | null {
  const text = path.trim();
  if (text === '') return null;

  const out: Segment[] = [];
  for (const part of text.split('.')) {
    // "logic_gaps[0]" 처럼 키 뒤에 대괄호가 붙을 수 있다.
    const match = /^([^[\]]*)((?:\[\d*\])*)$/.exec(part);
    if (match === null) return null;

    const [, key, brackets] = match;
    if (key !== '') out.push({ kind: 'key', key });
    else if (brackets === '') return null;

    for (const bracket of brackets.match(/\[\d*\]/g) ?? []) {
      const inner = bracket.slice(1, -1);
      out.push(inner === '' ? { kind: 'each' } : { kind: 'index', index: Number(inner) });
    }
  }
  return out.length === 0 ? null : out;
}

export type Found = {
  /** 경로가 실제로 존재했는지. `undefined` 와 `null` 을 구분하려고 둔다 */
  exists: boolean;
  value: unknown;
};

/**
 * 값을 읽는다.
 *
 * `[]` 가 들어 있으면 배열 전체를 훑어 **결과를 배열로** 돌려준다.
 * 하나라도 있으면 `exists` 는 true 다.
 */
export function getPath(root: unknown, segments: Segment[]): Found {
  let current: Found = { exists: true, value: root };

  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i];
    if (!current.exists) return { exists: false, value: undefined };

    if (segment.kind === 'each') {
      if (!Array.isArray(current.value)) return { exists: false, value: undefined };
      const rest = segments.slice(i + 1);
      const values: unknown[] = [];
      for (const item of current.value) {
        const found = rest.length === 0 ? { exists: true, value: item } : getPath(item, rest);
        if (found.exists) values.push(found.value);
      }
      return { exists: values.length > 0, value: values };
    }

    if (segment.kind === 'index') {
      if (!Array.isArray(current.value) || !(segment.index in current.value)) {
        return { exists: false, value: undefined };
      }
      current = { exists: true, value: current.value[segment.index] };
      continue;
    }

    if (!isRecord(current.value) || !(segment.key in current.value)) {
      return { exists: false, value: undefined };
    }
    current = { exists: true, value: current.value[segment.key] };
  }

  return current;
}

/**
 * 값을 쓴다. **원본을 고치지 않고 새 값을 돌려준다.**
 *
 * 중간 경로가 없으면 만든다. 다음 조각이 숫자면 배열을, 아니면 객체를
 * 만든다. `[]` 는 쓰기에서 지원하지 않는다.
 */
export function setPath(root: unknown, segments: Segment[], value: unknown): unknown {
  if (segments.length === 0) return value;

  const [segment, ...rest] = segments;
  if (segment.kind === 'each') return root;

  if (segment.kind === 'index') {
    const base = Array.isArray(root) ? [...root] : [];
    while (base.length <= segment.index) base.push(null);
    base[segment.index] = setPath(base[segment.index], rest, value);
    return base;
  }

  const base = isRecord(root) ? { ...root } : {};
  base[segment.key] = setPath(base[segment.key], rest, value);
  return base;
}

/** 화면에 값을 짧게 보여줄 때 쓴다. */
export function preview(value: unknown, limit = 40): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  if (text === undefined) return String(value);
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
