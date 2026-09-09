/**
 * MY-010 회원탈퇴 확인 · `/parent/my/account/withdraw/confirm` (DEV-002)
 *
 * **여기서 실제로 지우지 않는다.** 탈퇴는 `auth.users` 를 지우는 일이라
 * service_role 이 필요하고, 그건 사용자 요청 경로에서 쓰지 않기로 한
 * 규칙이다(DEV-001 §8 · COM-004 §8). 배치나 운영 절차로 처리해야 한다.
 *
 * 그래서 지금은 **요청을 접수하는 자리**까지만 만든다. 접수를 담을 칸이
 * COM-002 에 없어서 그것도 변경 제안이 먼저다 — 화면에 그대로 적는다.
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: '회원탈퇴 확인 · 메티' };

export default async function WithdrawConfirmPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (auth.user === null) redirect('/login');

  const { data: account } = await supabase
    .from('account')
    .select('email')
    .eq('account_id', auth.user.id)
    .maybeSingle();

  return (
    <main className="flex flex-1 flex-col gap-4 px-5 py-8">
      <header className="flex flex-col gap-1">
        <Link
          href="/parent/my/account/withdraw"
          className="text-[13px] font-semibold text-meti-sub"
        >
          ‹ 회원탈퇴
        </Link>
        <h1 className="text-xl font-extrabold text-meti-ink">마지막 확인</h1>
      </header>

      <section className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm">
        <p className="text-[14px] leading-relaxed text-meti-ink">
          <strong className="font-bold">{account?.email ?? ''}</strong> 계정을
          탈퇴합니다.
        </p>
        <p className="text-[13px] leading-relaxed text-meti-sub">
          탈퇴 처리는 <strong className="font-bold text-meti-ink">준비 중</strong>
          입니다. 지금은 고객센터로 요청해주세요.
        </p>
      </section>

      <p className="text-[12px] leading-relaxed text-meti-sub">
        계정 삭제는 로그인 수단까지 지우는 일이라 운영 절차를 거칩니다.
        자동으로 처리하는 경로는 아직 만들지 않았습니다.
      </p>
    </main>
  );
}
