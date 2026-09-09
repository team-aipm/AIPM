/**
 * MY-006 마케팅 수신설정 · `/parent/my/marketing` (DEV-002)
 *
 * **3종을 각각 받는다**(COM-002 §3 · COM-007 §9). 한 번에 묶지 않는다.
 * 대상은 부모뿐이며 학생에게는 어떤 마케팅도 보내지 않는다.
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { saveMarketing } from '../_actions';

export const metadata = { title: '소식 받기 · 메티' };

const ITEMS = [
  { name: 'marketing_email_opt_in', label: '이메일' },
  { name: 'marketing_sms_opt_in', label: '문자' },
  { name: 'marketing_alimtalk_opt_in', label: '알림톡' },
] as const;

export default async function MarketingPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (auth.user === null) redirect('/login');

  const { data: account } = await supabase
    .from('account')
    .select(
      'marketing_email_opt_in, marketing_sms_opt_in, marketing_alimtalk_opt_in, marketing_consent_updated_at',
    )
    .eq('account_id', auth.user.id)
    .maybeSingle();

  return (
    <main className="flex flex-1 flex-col gap-4 px-5 py-8">
      <header className="flex flex-col gap-1">
        <Link href="/parent/my" className="text-[13px] font-semibold text-meti-sub">
          ‹ 마이페이지
        </Link>
        <h1 className="text-xl font-extrabold text-meti-ink">소식 받기</h1>
        <p className="text-[13px] text-meti-sub">
          동의하지 않아도 서비스를 쓰는 데 제한이 없습니다.
        </p>
      </header>

      <form action={saveMarketing} className="flex flex-col gap-3">
        <section className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm">
          {ITEMS.map((item) => (
            <label key={item.name} className="flex items-center gap-3 text-[14px] text-meti-ink">
              <input
                type="checkbox"
                name={item.name}
                defaultChecked={account?.[item.name] === true}
                className="h-5 w-5 accent-meti"
              />
              {item.label}
            </label>
          ))}
        </section>

        <button
          type="submit"
          className="rounded-xl bg-meti py-3 text-[14px] font-bold text-white"
        >
          저장
        </button>
      </form>

      {account?.marketing_consent_updated_at !== undefined && (
        <p className="text-[12px] text-meti-sub">
          마지막 변경{' '}
          {new Date(account.marketing_consent_updated_at).toLocaleDateString('ko-KR')}
        </p>
      )}
    </main>
  );
}
