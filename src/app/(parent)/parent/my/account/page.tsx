/**
 * MY-008 계정 관리 · `/parent/my/account` (DEV-002)
 *
 * Figma 에는 따로 없는 화면이다 — 로그아웃 · 회원 탈퇴가 설정(MY-001)
 * 목록에 바로 붙어 있다. 주소로 들어오는 사람을 위해 남겨 두고, 생김새만
 * 설정 목록과 맞춘다.
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/supabase/server';
import { MyTopBar } from '../_components/MyTopBar';
import { SettingsCard } from '../_components/SettingsGroup';
import { LogoutRow } from '../_components/LogoutRow';

export const metadata = { title: '계정 관리 · 메티' };

export default async function AccountPage() {
  const user = await currentUser();
  if (user === null) redirect('/login');

  return (
    <main className="flex flex-1 flex-col">
      <MyTopBar title="계정 관리" back="/parent/my" backLabel="설정으로" />

      <div className="flex flex-col gap-3 px-5 pb-5 pt-3">
        <SettingsCard>
          <LogoutRow />
        </SettingsCard>

        <div className="flex justify-end">
          <Link
            href="/parent/my/account/withdraw"
            className="py-3 text-[14px] leading-5 text-text-secondary"
          >
            회원 탈퇴
          </Link>
        </div>
      </div>
    </main>
  );
}
