import Image from 'next/image';

/**
 * 보상 화면(RWD-001~003)과 부모 홈 보상 카드가 같이 쓰는 작은 조각.
 *
 * 보물상자는 Figma `Asset / Reward Icon` 의 `Name=Image 12`(9:3824) 다.
 */

export function ChestIcon({ size }: { size: number }) {
  return (
    <Image
      src="/icons/reward-chest.png"
      alt=""
      width={size}
      height={size}
      aria-hidden
      className="shrink-0"
    />
  );
}

/** Figma `진행 막대` — 높이 10 · r5 · 바탕 background-primary · 채움 button-primary */
export function ProgressBar({ value, max }: { value: number; max: number }) {
  const ratio = max <= 0 ? 0 : Math.min(1, Math.max(0, value / max));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className="h-2.5 w-full overflow-hidden rounded-[5px] bg-background-primary"
    >
      <div className="h-full rounded-[5px] bg-button-primary" style={{ width: `${ratio * 100}%` }} />
    </div>
  );
}

/** 「9월 12일 줌」. 저장은 UTC 라 한국 날짜로 바꿔 읽는다 */
export function givenOn(iso: string | null): string {
  if (iso === null) return '';
  const parts = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(new Date(iso));
  const month = parts.find((part) => part.type === 'month')?.value ?? '';
  const day = parts.find((part) => part.type === 'day')?.value ?? '';
  return `${month}월 ${day}일 줌`;
}

/**
 * 「치킨을」 · 「피자를」. 보상 이름은 부모가 아무렇게나 적으므로 받침을
 * 직접 본다. 한글로 끝나지 않으면(「LEGO」) 둘 다 적는다.
 */
export function withObject(name: string): string {
  const last = name.trim().charCodeAt(name.trim().length - 1);
  if (Number.isNaN(last) || last < 0xac00 || last > 0xd7a3) return `${name}을(를)`;
  return (last - 0xac00) % 28 === 0 ? `${name}를` : `${name}을`;
}
