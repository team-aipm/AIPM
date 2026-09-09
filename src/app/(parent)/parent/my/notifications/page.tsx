/**
 * MY-007 알림 설정 · `/parent/my/notifications` (DEV-002)
 *
 * **아직 켤 수 없다.** 알림을 보내는 경로(푸시 · 알림톡)가 COM-005 에
 * 정해져 있지 않고, 담을 칸도 COM-002 에 없다. 화면만 두고 무엇이
 * 없는지 적는다 — 스위치를 그려 두면 켜진 줄 안다.
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: '알림 설정 · 메티' };

export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user === null) redirect('/login');

  return (
    <main className="flex flex-1 flex-col gap-4 px-5 py-8">
      <header className="flex flex-col gap-1">
        <Link href="/parent/my" className="text-[13px] font-semibold text-meti-sub">
          ‹ 마이페이지
        </Link>
        <h1 className="text-xl font-extrabold text-meti-ink">알림 설정</h1>
      </header>

      <p className="rounded-2xl bg-white p-5 text-[13px] leading-relaxed text-meti-sub shadow-sm">
        준비 중입니다.
        <br />
        학습이 끝났을 때 · 리포트가 나왔을 때 알려드릴 예정입니다.
      </p>
    </main>
  );
}
