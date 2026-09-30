import Image from 'next/image';
import Link from 'next/link';

/**
 * Figma `Top App Bar` — 56px · p8 · 44px 뒤로 · 제목 16/24 SemiBold 가운데.
 *
 * `components/ui/BackBar` 는 제목이 없는 바다. 설정 화면들은 모두 제목이
 * 가운데 붙어서 따로 둔다. 오른쪽에도 44px 빈칸을 둬야 제목이 화면
 * 가운데에 온다 — 왼쪽 화살표만 있으면 제목이 오른쪽으로 22px 밀린다.
 *
 * MY 화면 여럿이 같이 쓰므로 `my/_components/` 에 둔다.
 */
export function MyTopBar({
  title,
  back,
  backLabel = '뒤로',
}: {
  title?: string;
  back: string;
  backLabel?: string;
}) {
  return (
    <div className="flex h-[56px] items-center gap-2 bg-background-primary p-2">
      <Link
        href={back}
        aria-label={backLabel}
        className="flex size-[44px] shrink-0 items-center justify-center"
      >
        <Image src="/icons/chevron-left.svg" alt="" width={44} height={44} />
      </Link>
      <h1 className="flex-1 truncate text-center text-[16px] font-semibold leading-6 text-text-primary">
        {title}
      </h1>
      <span aria-hidden className="size-[44px] shrink-0" />
    </div>
  );
}
