import Image from 'next/image';
import Link from 'next/link';

/**
 * Figma `Top App Bar` (56px · 44px 뒤로 · 가운데 제목 16/24 SemiBold).
 * 공통 `BackBar` 에는 제목이 없어 이 화면에서만 쓴다.
 */
export function PastTopBar() {
  return (
    <div className="grid h-14 shrink-0 grid-cols-[44px_1fr_44px] items-center bg-background-primary p-2">
      <Link href="/home" aria-label="홈으로 돌아가기" className="flex size-11 items-center justify-center">
        <Image src="/icons/chevron-left.svg" alt="" width={44} height={44} />
      </Link>
      <p className="text-center text-[16px] leading-6 font-semibold text-text-primary">지난 미션</p>
    </div>
  );
}
