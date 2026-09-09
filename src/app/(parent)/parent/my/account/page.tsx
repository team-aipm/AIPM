/**
 * MY-008 계정 관리 · `/parent/my/account` (DEV-002)
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { signOutAccount } from '../_actions';

export const metadata = { title: '계정 관리 · 메티' };

export default async function AccountPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user === null) redirect('/login');

  return (
    <main className="flex flex-1 flex-col gap-4 px-5 py-8">
      <header className="flex flex-col gap-1">
        <Link href="/parent/my" className="text-[13px] font-semibold text-meti-sub">
          ‹ 마이페이지
        </Link>
        <h1 className="text-xl font-extrabold text-meti-ink">계정 관리</h1>
      </header>

      <form action={signOutAccount}>
        <button
          type="submit"
          className="w-full rounded-2xl bg-white p-4 text-left text-[15px] font-bold text-meti-ink shadow-sm"
        >
          로그아웃
        </button>
      </form>

      <Link
        href="/parent/my/account/withdraw"
        className="text-center text-[13px] font-semibold text-meti-sub underline"
      >
        회원탈퇴
      </Link>
    </main>
  );
}
