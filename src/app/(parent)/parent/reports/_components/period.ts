/**
 * 주간 리포트 기간 표기. Figma `9월 22일 – 28일` · `9월 29일 – 10월 5일`.
 *
 * 리포트는 월~일을 모으고 다음 월요일 아침에 나온다(COM-003 §4.9).
 * 날짜는 한국 시간으로 센다 — 서버가 UTC 로 돌면 월요일 새벽이 일요일이 된다.
 */

const parse = (ymd: string): Date => new Date(`${ymd}T00:00:00Z`);
const ymdOf = (date: Date): string => date.toISOString().slice(0, 10);
const addDays = (date: Date, days: number): Date =>
  new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

export function formatPeriod(start: string, end: string): string {
  const a = parse(start);
  const b = parse(end);
  const head = `${a.getUTCMonth() + 1}월 ${a.getUTCDate()}일`;
  const tail =
    a.getUTCMonth() === b.getUTCMonth()
      ? `${b.getUTCDate()}일`
      : `${b.getUTCMonth() + 1}월 ${b.getUTCDate()}일`;
  return `${head} – ${tail}`;
}

/** 오늘(한국 시간)이 든 주의 월요일 · 일요일 · 리포트가 나올 다음 월요일 */
export function thisWeek(now = new Date()): { start: string; end: string; nextMonday: string } {
  const today = parse(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(now));
  const monday = addDays(today, -((today.getUTCDay() + 6) % 7));
  return {
    start: ymdOf(monday),
    end: ymdOf(addDays(monday, 6)),
    nextMonday: ymdOf(addDays(monday, 7)),
  };
}

/** `10월 6일 월요일` */
export function formatMonday(ymd: string): string {
  const date = parse(ymd);
  return `${date.getUTCMonth() + 1}월 ${date.getUTCDate()}일 월요일`;
}
