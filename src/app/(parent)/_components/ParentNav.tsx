'use client';

/**
 * Figma `Pattern / Parent / Bottom Navigation` (403:13055) · `홈 / 리포트 / 설정`.
 *
 * 지금 어느 탭인지는 주소로 정한다. 그래서 client 다 — layout 은 server 라
 * 주소를 모른다.
 *
 * 아이콘은 Figma 에서 받은 파일(`public/icons/home|growth|settings.svg`)을
 * **mask 로 쓴다.** 파일에는 선 색이 박혀 있어 `<img>` 로 두면 선택 여부에
 * 따라 색을 못 바꾼다. mask 로 두면 모양은 Figma 그대로, 색은 글자색을 따른다.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/parent', label: '홈', icon: '/icons/home.svg', match: (p: string) => p === '/parent' },
  {
    href: '/parent/reports',
    label: '리포트',
    icon: '/icons/growth.svg',
    match: (p: string) => p.startsWith('/parent/reports'),
  },
  // 구독 · 보상 · 회원정보는 모두 설정에서 들어간다(COM-003 §11). 그 화면들도 설정 탭이다.
  {
    href: '/parent/my',
    label: '설정',
    icon: '/icons/settings.svg',
    match: (p: string) => p.startsWith('/parent/my') || p.startsWith('/parent/billing'),
  },
] as const;

export function ParentNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 z-50 w-full max-w-[480px] bg-surface-primary pt-2 pb-[calc(env(safe-area-inset-bottom)+8px)] shadow-nav">
      <ul className="flex">
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={`flex h-12 flex-col items-center justify-center gap-1 ${
                  active
                    ? 'text-[14px] leading-5 font-semibold text-button-primary'
                    : 'text-[12px] leading-[18px] text-meti-hint'
                }`}
              >
                <span
                  aria-hidden
                  className="size-6 bg-current"
                  style={{
                    mask: `url(${tab.icon}) center / contain no-repeat`,
                    WebkitMask: `url(${tab.icon}) center / contain no-repeat`,
                  }}
                />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
