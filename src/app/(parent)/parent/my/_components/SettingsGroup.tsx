import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * Figma `설정` 의 묶음 — 회색 소제목 + 흰 카드 + 줄들.
 *
 * ```text
 *   소제목   14/20 SemiBold  secondary
 *   카드     흰색 · border #E2E8EB · r16 · p[4,16]
 *   줄       py14 · 16/24 Regular · 오른쪽 값 14/20 · 20px ChevronRight
 *            줄 사이는 1px 선
 * ```
 *
 * MY-001 · MY-006 · MY-007 이 같이 쓴다.
 */

export function GroupLabel({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-[14px] font-semibold leading-5 text-text-secondary">{children}</h2>
  );
}

export function SettingsCard({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col divide-y divide-meti-line rounded-2xl border border-meti-line bg-surface-primary px-4 py-1">
      {children}
    </div>
  );
}

/** Figma `Icon / Meti / ChevronRight` 20px (`public/icons/chevron-right.svg`) */
export function ChevronRight({ size = 20 }: { size?: number }) {
  return (
    <Image
      src="/icons/chevron-right.svg"
      alt=""
      width={size}
      height={size}
      aria-hidden
      className="shrink-0"
    />
  );
}

export const ROW_CLASS =
  'flex w-full items-center gap-2 py-3.5 text-left text-[16px] leading-6 text-text-primary';

export function SettingsLinkRow({
  href,
  label,
  value,
}: {
  href: string;
  label: string;
  /** 오른쪽에 붙는 짧은 값(「2명」 등) */
  value?: string;
}) {
  return (
    <Link href={href} className={ROW_CLASS}>
      <span className="flex-1">{label}</span>
      {value !== undefined && (
        <span className="text-[14px] leading-5 text-text-secondary">{value}</span>
      )}
      <ChevronRight />
    </Link>
  );
}
