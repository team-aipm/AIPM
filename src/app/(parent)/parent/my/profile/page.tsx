/**
 * MY-005 부모 회원정보 · `/parent/my/profile` (DEV-002)
 *
 * **읽기만 한다.** 이름 · 연락처를 바꾸는 것은 본인 확인이 따르는 일이라
 * (COM-003 AUTH-004 휴대폰 인증) 그 화면이 생긴 뒤에 연다.
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: '회원 정보 · 메티' };

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-black/5 py-3 last:border-0">
      <span className="text-[13px] text-meti-sub">{label}</span>
      <span className="text-[14px] font-semibold text-meti-ink">{value}</span>
    </div>
  );
}

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (auth.user === null) redirect('/login');

  const { data: account } = await supabase
    .from('account')
    .select('account_name, email, phone_number, created_at')
    .eq('account_id', auth.user.id)
    .maybeSingle();

  return (
    <main className="flex flex-1 flex-col gap-4 px-5 py-8">
      <header className="flex flex-col gap-1">
        <Link href="/parent/my" className="text-[13px] font-semibold text-meti-sub">
          ‹ 마이페이지
        </Link>
        <h1 className="text-xl font-extrabold text-meti-ink">회원 정보</h1>
      </header>

      <section className="rounded-2xl bg-white px-5 py-2 shadow-sm">
        <Row label="이름" value={account?.account_name ?? '—'} />
        <Row label="이메일" value={account?.email ?? '—'} />
        <Row label="휴대폰" value={account?.phone_number ?? '—'} />
        <Row
          label="가입일"
          value={
            account?.created_at === undefined
              ? '—'
              : new Date(account.created_at).toLocaleDateString('ko-KR')
          }
        />
      </section>

      <p className="text-[12px] leading-relaxed text-meti-sub">
        정보를 바꾸려면 본인 확인이 필요합니다. 준비 중입니다.
      </p>
    </main>
  );
}
