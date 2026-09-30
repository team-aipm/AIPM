/**
 * MY-007 알림 설정 · `/parent/my/notifications` (DEV-002)
 *
 * **아직 켤 수 없다.** 알림을 보내는 경로(푸시 · 알림톡)가 COM-005 에
 * 정해져 있지 않고, 담을 칸도 COM-002 에 없다. 화면만 두고 무엇이
 * 없는지 적는다 — 스위치를 그려 두면 켜진 줄 안다.
 *
 * 생김새는 Figma `설정 · 02 알림 설정` 이다. 스위치 다섯 줄은 위 이유로
 * 그리지 않고, 맨 아래 「마케팅 수신 설정」 줄만 Figma 대로 둔다 —
 * 그쪽은 저장할 칸(`marketing_*_opt_in`)이 있다.
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/supabase/server';
import { MyTopBar } from '../_components/MyTopBar';
import { ChevronRight, GroupLabel, SettingsCard } from '../_components/SettingsGroup';

export const metadata = { title: '알림 설정 · 메티' };

export default async function NotificationsPage() {
  const user = await currentUser();
  if (user === null) redirect('/login');

  return (
    <main className="flex flex-1 flex-col">
      <MyTopBar title="알림 설정" back="/parent/my" backLabel="설정으로" />

      <div className="flex flex-col gap-3 px-5 pb-5 pt-3">
        <GroupLabel>학습</GroupLabel>
        <p className="rounded-2xl border border-meti-line bg-surface-primary p-4 text-[14px] leading-5 text-text-secondary">
          준비 중입니다.
          <br />
          학습이 끝났을 때 · 리포트가 나왔을 때 알려드릴 예정입니다.
        </p>

        <GroupLabel>마케팅</GroupLabel>
        <SettingsCard>
          <Link href="/parent/my/marketing" className="flex items-center gap-3 py-3">
            <span className="flex flex-1 flex-col gap-0.5">
              <span className="text-[16px] leading-6 text-text-primary">마케팅 수신 설정</span>
              <span className="text-[12px] leading-[18px] text-text-secondary">
                이메일 · 문자 · 알림톡
              </span>
            </span>
            <ChevronRight />
          </Link>
        </SettingsCard>
      </div>
    </main>
  );
}
