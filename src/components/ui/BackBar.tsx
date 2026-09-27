import Image from 'next/image';
import Link from 'next/link';

/**
 * 화살표 하나뿐인 상단 바. Figma `Top App Bar` (56px, 44px 액션).
 *
 * **입력 화면에만 붙는다.** 「메일을 보냈어요」 · 「가입이 끝났어요」 같은
 * 마친 화면에는 디자인에도 없다 — 뒤로 갈 곳이 없기 때문이다. 그 화면들은
 * 아래 버튼이 갈 곳을 정해 준다.
 *
 * `/password` 와 `/signup` 두 곳에서 쓴다. 한 화면에서만 쓰는 것이 아니므로
 * route 의 `_components/` 가 아니라 여기 둔다(DEV-001).
 *
 * 화살표는 Figma 에서 받은 파일이다(`public/icons/chevron-left.svg`).
 */
export function BackBar({
  href = '/login',
  label = '로그인으로 돌아가기',
}: {
  href?: string;
  label?: string;
}) {
  return (
    <div className="flex h-[56px] items-center p-2">
      <Link
        href={href}
        aria-label={label}
        className="flex size-[44px] items-center justify-center"
      >
        <Image src="/icons/chevron-left.svg" alt="" width={44} height={44} />
      </Link>
    </div>
  );
}
