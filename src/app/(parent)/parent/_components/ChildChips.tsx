/**
 * Figma 보호자 홈 · 주간 리포트의 `자녀 선택` 칩.
 *
 * 고른 아이는 주소(`?child=`)에 둔다. 새로고침하거나 리포트에서 돌아와도
 * 같은 아이가 그대로 보이고, 화면이 server 로 남는다.
 */

import Link from 'next/link';

export function ChildChips({
  base,
  items,
  selectedId,
}: {
  base: string;
  items: { id: string; name: string }[];
  selectedId: string;
}) {
  return (
    <nav aria-label="자녀 선택" className="flex flex-wrap gap-2">
      {items.map((item) => {
        const selected = item.id === selectedId;
        return (
          <Link
            key={item.id}
            href={`${base}?child=${item.id}`}
            aria-current={selected ? 'true' : undefined}
            className={`rounded-full px-4 py-2 text-[14px] leading-5 font-semibold ${
              selected
                ? 'bg-button-primary text-white'
                : 'border border-meti-line bg-surface-primary text-text-secondary'
            }`}
          >
            {item.name}
          </Link>
        );
      })}
    </nav>
  );
}
