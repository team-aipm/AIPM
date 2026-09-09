/**
 * 프롬프트 변경 이력.
 *
 * 프롬프트를 고쳐서 결과가 나아지면, 나중에 **무엇을 왜 고쳤는지**
 * 말할 수 있어야 한다. 지금은 화면의 글자만 바뀌고 앞의 것은 사라진다.
 * "선택지를 첫 턴부터 주게 바꿨더니 통과율이 올랐다" 를 기록으로
 * 남기지 못하면, 다음 사람이 같은 자리를 다시 헤맨다.
 *
 * 한 줄에 **날짜 · 단계 · 이유 · 수정 전 · 수정 후**를 담는다.
 * 되돌리기 기능이 아니다 — 무엇을 했는지 적어 두는 장부다.
 */

export type Revision = {
  /** ISO. 화면과 파일에서는 사람이 읽는 꼴로 바꾼다 */
  at: string;
  /** 단계 이름. 이름을 바꿔도 기록은 그때 이름으로 남는다 */
  stage: string;
  reason: string;
  before: string;
  after: string;
};

/**
 * 한 줄 만든다. **안 바뀌었으면 만들지 않는다.**
 *
 * 이유만 적고 프롬프트는 그대로인 줄이 쌓이면 장부를 못 믿는다.
 */
export function newRevision(
  stage: string,
  reason: string,
  before: string,
  after: string,
): Revision | null {
  if (before === after) return null;
  return { at: new Date().toISOString(), stage, reason: reason.trim(), before, after };
}

export type LineChange = { added: number; removed: number };

/**
 * 몇 줄이 빠지고 몇 줄이 새로 생겼나.
 *
 * 진짜 diff 가 아니다. 줄을 꾸러미로 보고 양쪽에서 짝을 맞춘 뒤 남는
 * 것을 센다. 줄이 자리만 옮겼으면 안 바뀐 것으로 본다 — "얼마나
 * 바뀌었나" 를 묻는 것이므로 그게 맞다.
 */
export function lineChange(before: string, after: string): LineChange {
  const left = count(before);
  const right = count(after);

  let added = 0;
  let removed = 0;
  for (const [line, n] of left) {
    const other = right.get(line) ?? 0;
    if (n > other) removed += n - other;
  }
  for (const [line, n] of right) {
    const other = left.get(line) ?? 0;
    if (n > other) added += n - other;
  }
  return { added, removed };
}

function count(text: string): Map<string, number> {
  const map = new Map<string, number>();
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line === '') continue;
    map.set(line, (map.get(line) ?? 0) + 1);
  }
  return map;
}

/** 화면과 파일에 쓰는 날짜. ISO 는 사람이 못 읽는다 */
export function when(at: string): string {
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return at;
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/**
 * Excel 이 바로 여는 CSV.
 *
 * **xlsx 를 만들려면 라이브러리를 하나 더 들여야 한다.** 이건 개발용
 * 도구고 CLAUDE.md 는 스택을 임의로 늘리지 말라고 한다. CSV 면
 * Excel · Numbers · Sheets 가 다 연다.
 *
 * 두 가지를 조심한다.
 *
 * ```text
 * BOM     없으면 Excel 이 한글을 깨뜨린다. 맨 앞에 ﻿ 를 붙인다.
 * 줄바꿈  칸 안의 줄바꿈은 따옴표로 감싸면 살아 있다. CRLF 로 쓴다.
 * ```
 *
 * Excel 은 한 칸에 32,767자까지 넣는다. 프롬프트가 그보다 길면 잘라
 * 내고 잘렸다고 적는다. 조용히 자르면 전문이라고 믿게 된다.
 */
const CELL_LIMIT = 32000;

export function toHistoryCsv(revisions: Revision[]): string {
  const head = ['번호', '날짜', '단계', '변경 이유', '빠진 줄', '새 줄', '수정 전', '수정 후'];

  // 오래된 것이 위로. 장부는 시간 순으로 읽는다.
  const rows = [...revisions]
    .sort((a, b) => a.at.localeCompare(b.at))
    .map((item, index) => {
      const change = lineChange(item.before, item.after);
      return [
        String(index + 1),
        when(item.at),
        item.stage,
        item.reason,
        String(change.removed),
        String(change.added),
        clip(item.before),
        clip(item.after),
      ];
    });

  return `﻿${[head, ...rows].map(line).join('\r\n')}\r\n`;
}

function line(cells: string[]): string {
  return cells.map(cell).join(',');
}

function cell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function clip(text: string): string {
  if (text.length <= CELL_LIMIT) return text;
  return `${text.slice(0, CELL_LIMIT)}\n… (${text.length - CELL_LIMIT}자 잘림)`;
}
