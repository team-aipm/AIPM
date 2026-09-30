/**
 * MY-005 부모 회원정보 · `/parent/my/profile` (DEV-002)
 *
 * **읽기만 한다.** 이름 · 연락처를 바꾸는 것은 본인 확인이 따르는 일이라
 * (COM-003 AUTH-004 휴대폰 인증) 그 화면이 생긴 뒤에 연다.
 *
 * 생김새는 Figma `설정 · 06 보호자 회원정보 · 이메일` · `07 · 소셜` 이다.
 * 이름 입력칸 · 「이름 저장」 · 「비밀번호 변경」 줄은 저장할 곳과 갈 곳
 * (MY-011)이 없어 두지 않았다.
 */

import { redirect } from 'next/navigation';
import { createClient, currentUser } from '@/lib/supabase/server';
import { MyTopBar } from '../_components/MyTopBar';

export const metadata = { title: '회원 정보 · 메티' };

/** 가입 방식. `app_metadata.provider` 는 Supabase Auth 가 채운다 */
const PROVIDER: Record<string, string> = {
  email: '이메일 · 비밀번호',
  google: 'Google',
  kakao: '카카오',
};

function Info({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[14px] leading-5 text-text-secondary">{label}</span>
      <span className="break-all text-[16px] leading-6 text-text-primary">{value}</span>
      {note !== undefined && (
        <span className="text-[12px] leading-[18px] text-text-secondary">{note}</span>
      )}
    </div>
  );
}

export default async function ProfilePage() {
  const supabase = await createClient();
  const user = await currentUser();
  if (user === null) redirect('/login');

  const { data: account } = await supabase
    .from('account')
    .select('account_name, email, phone_number, created_at')
    .eq('account_id', user.id)
    .maybeSingle();

  const provider = String(user.app_metadata.provider ?? '');

  return (
    <main className="flex flex-1 flex-col">
      <MyTopBar title="회원정보" back="/parent/my" backLabel="설정으로" />

      <div className="flex flex-col gap-4 px-5 pb-5 pt-4">
        <h2 className="text-[16px] font-semibold leading-6 text-text-primary">기본 정보</h2>
        <section className="flex flex-col gap-3 rounded-2xl border border-meti-line bg-surface-primary p-4">
          <Info label="이름" value={account?.account_name ?? '—'} />
          <Info
            label="가입일"
            value={
              account?.created_at === undefined
                ? '—'
                : new Date(account.created_at).toLocaleDateString('ko-KR')
            }
          />
        </section>

        <h2 className="text-[16px] font-semibold leading-6 text-text-primary">로그인 정보</h2>
        <section className="flex flex-col gap-3 rounded-2xl border border-meti-line bg-surface-primary p-4">
          <Info
            label="로그인 이메일"
            value={account?.email ?? '—'}
            note="로그인 이메일은 이 화면에서 변경할 수 없어요."
          />
          {PROVIDER[provider] !== undefined && (
            <Info label="로그인 방식" value={PROVIDER[provider]} />
          )}
          <Info label="휴대폰" value={account?.phone_number ?? '—'} />
        </section>

        <p className="text-[14px] leading-5 text-text-secondary">
          정보를 바꾸려면 본인 확인이 필요합니다. 준비 중입니다.
        </p>
      </div>
    </main>
  );
}
