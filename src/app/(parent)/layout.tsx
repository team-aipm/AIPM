/**
 * PAR · RPT · BIL · MY 영역 공통 껍데기.
 *
 * **부모 어휘를 쓰고 하단 Nav 4탭을 둔다**(CLAUDE.md · DEV-001). 학생
 * 영역과 정반대다 — 거기는 학생 어휘에 Nav 가 없다.
 *
 * 아직 없는 화면(구독 · 마이)도 탭에 둔다. 넷이 있어야 자리가 흔들리지
 * 않고, 무엇이 준비 중인지도 보인다. 없는 곳으로 보내지는 않는다.
 *
 * **아이 계정은 여기 못 들어온다.** 아이 화면에는 이곳으로 가는 링크가
 * 없지만 주소를 치면 그만이다. RLS 가 결제·리포트 행을 안 주므로 새는 것은
 * 없어도, 아이가 자기 평가를 찾아 헤매는 화면을 보여줄 이유가 없다.
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { studentIdOfViewer } from '@/lib/services/student-login';

const TABS = [
  { href: '/parent', label: '홈', ready: true },
  { href: '/parent/reports', label: '리포트', ready: true },
  { href: '/parent/billing', label: '구독', ready: false },
  { href: '/parent/my', label: '마이', ready: true },
] as const;

export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (auth.user === null) redirect('/login');
  if ((await studentIdOfViewer(supabase, auth.user.id)) !== null) redirect('/home');

  return (
    <div className="flex min-h-dvh justify-center bg-meti-bg">
      <div className="flex w-full max-w-[480px] flex-col pb-20">
        {children}

        <nav className="fixed bottom-0 w-full max-w-[480px] border-t border-black/5 bg-white">
          <ul className="flex">
            {TABS.map((tab) =>
              tab.ready ? (
                <li key={tab.href} className="flex-1">
                  <Link
                    href={tab.href}
                    className="flex flex-col items-center gap-1 py-3 text-[12px] font-bold text-meti-ink"
                  >
                    {tab.label}
                  </Link>
                </li>
              ) : (
                <li key={tab.href} className="flex-1">
                  <span
                    aria-disabled
                    title="준비 중입니다"
                    className="flex cursor-not-allowed flex-col items-center gap-1 py-3 text-[12px] font-semibold text-meti-sub/50"
                  >
                    {tab.label}
                  </span>
                </li>
              ),
            )}
          </ul>
        </nav>
      </div>
    </div>
  );
}
