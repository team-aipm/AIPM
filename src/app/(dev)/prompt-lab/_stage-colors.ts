/**
 * 단계 색상.
 *
 * 단계 순서대로 돌려 쓴다. 단계를 추가해도 색이 붙고, 목록을 늘려도
 * 다른 코드를 고칠 필요가 없다.
 *
 * Tailwind 는 소스에 **문자열 그대로** 있는 클래스만 남긴다.
 * `bg-${color}-500` 같이 조합하면 빌드에서 사라지므로 전부 적어 둔다.
 */
export type StageColor = {
  /** 단계 탭의 세로 막대 */
  bar: string;
  /** 패널 왼쪽 테두리 */
  border: string;
  /** 단계 이름 글자 */
  text: string;
};

const PALETTE: StageColor[] = [
  { bar: 'bg-sky-500', border: 'border-l-sky-500', text: 'text-sky-700 dark:text-sky-400' },
  { bar: 'bg-emerald-500', border: 'border-l-emerald-500', text: 'text-emerald-700 dark:text-emerald-400' },
  { bar: 'bg-amber-500', border: 'border-l-amber-500', text: 'text-amber-700 dark:text-amber-400' },
  { bar: 'bg-violet-500', border: 'border-l-violet-500', text: 'text-violet-700 dark:text-violet-400' },
  { bar: 'bg-rose-500', border: 'border-l-rose-500', text: 'text-rose-700 dark:text-rose-400' },
  { bar: 'bg-teal-500', border: 'border-l-teal-500', text: 'text-teal-700 dark:text-teal-400' },
  { bar: 'bg-orange-500', border: 'border-l-orange-500', text: 'text-orange-700 dark:text-orange-400' },
  { bar: 'bg-fuchsia-500', border: 'border-l-fuchsia-500', text: 'text-fuchsia-700 dark:text-fuchsia-400' },
];

export function stageColor(index: number): StageColor {
  return PALETTE[index % PALETTE.length];
}
