/**
 * MY-010 회원탈퇴 확인 · `/parent/my/account/withdraw/confirm` (DEV-002)
 *
 * **여기서 실제로 지우지 않는다.** 탈퇴는 `auth.users` 를 지우는 일이라
 * service_role 이 필요하고, 그건 사용자 요청 경로에서 쓰지 않기로 한
 * 규칙이다(DEV-001 §8 · COM-004 §8). 배치나 운영 절차로 처리해야 한다.
 *
 * 그래서 지금은 **요청을 접수하는 자리**까지만 만든다. 접수를 담을 칸이
 * COM-002 에 없어서 그것도 변경 제안이 먼저다 — 화면에 그대로 적는다.
 *
 * 생김새는 Figma `설정 · 05 회원 탈퇴 확인` 이다. 확인 체크박스와
 * 「탈퇴하기」 는 누를 곳이 없어서 두지 않았다.
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient, currentUser } from '@/lib/supabase/server';
import { MyTopBar } from '../../../_components/MyTopBar';

export const metadata = { title: '회원탈퇴 확인 · 메티' };

export default async function WithdrawConfirmPage() {
  const supabase = await createClient();
  const user = await currentUser();
  if (user === null) redirect('/login');

  const { data: account } = await supabase
    .from('account')
    .select('email')
    .eq('account_id', user.id)
    .maybeSingle();

  return (
    <main className="flex flex-1 flex-col">
      <MyTopBar title="회원 탈퇴" back="/parent/my/account/withdraw" backLabel="회원탈퇴 안내로" />

      <div className="flex flex-1 flex-col gap-3 px-5 pt-3">
        <h2 className="text-[20px] font-semibold leading-7 text-text-primary">마지막 확인</h2>

        <section className="flex flex-col gap-2 rounded-2xl border border-meti-line bg-surface-primary p-4">
          <p className="text-[14px] leading-5 text-text-primary">
            <strong className="font-semibold">{account?.email ?? ''}</strong> 계정을
            탈퇴합니다.
          </p>
          <p className="text-[14px] leading-5 text-text-secondary">
            탈퇴 처리는 <strong className="font-semibold text-text-primary">준비 중</strong>
            입니다. 지금은 고객센터로 요청해주세요.
          </p>
        </section>

        <p className="text-[12px] leading-[18px] text-meti-hint">
          계정 삭제는 로그인 수단까지 지우는 일이라 운영 절차를 거칩니다.
          자동으로 처리하는 경로는 아직 만들지 않았습니다.
        </p>
      </div>

      <div className="bg-background-primary px-5 pb-5 pt-3">
        <Link
          href="/parent/my"
          className="flex h-[52px] w-full items-center justify-center rounded-lg bg-button-primary text-[16px] font-semibold leading-6 text-white hover:bg-button-hover active:bg-button-pressed"
        >
          계속 이용하기
        </Link>
      </div>
    </main>
  );
}
