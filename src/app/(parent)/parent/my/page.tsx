/**
 * MY-001 마이페이지 · `/parent/my` (DEV-002)
 *
 * 부모가 보는 설정 목록이다. 여기서 갈라지는 화면들이 MY-002~010 이다.
 * 생김새는 Figma `설정 · 01 설정 (스크롤)` 이다.
 *
 * **Figma 에 있어도 갈 곳이 없는 줄은 두지 않는다.** 보상 관리(RWD) ·
 * 구독 관리(BIL, COM-005 §13) · 비밀번호 변경(MY-011) · 도움말·문의는
 * 아직 Route 가 없다. 눌러서 404 가 나느니 없는 편이 낫다.
 *
 * 마케팅 수신 설정은 Figma 대로 알림 설정(MY-007) 안으로 옮겼다.
 * 계정 관리(MY-008)의 두 가지 — 로그아웃 · 회원탈퇴 — 는 이 화면에서
 * 바로 연다.
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient, currentUser } from '@/lib/supabase/server';
import { listStudents } from '@/lib/services/student';
import { GroupLabel, SettingsCard, SettingsLinkRow } from './_components/SettingsGroup';
import { LogoutRow } from './_components/LogoutRow';

export const metadata = { title: '마이페이지 · 메티' };

export default async function MyPage() {
  const supabase = await createClient();
  const user = await currentUser();
  if (user === null) redirect('/login');

  const { data: account } = await supabase
    .from('account')
    .select('account_name, email')
    .eq('account_id', user.id)
    .maybeSingle();

  const students = await listStudents(supabase);
  const name = account?.account_name ?? '보호자';

  return (
    <main className="flex flex-1 flex-col gap-3 px-5 pb-5 pt-3">
      <h1 className="text-[24px] font-bold leading-8 text-text-primary">설정</h1>

      <section className="flex items-center gap-3 rounded-2xl border border-meti-line bg-surface-primary p-4">
        <span
          aria-hidden
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-brand text-[16px] font-semibold leading-6 text-button-primary"
        >
          {name.slice(0, 1)}
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[16px] font-semibold leading-6 text-text-primary">{name}</span>
          <span className="truncate text-[12px] leading-[18px] text-text-secondary">
            {account?.email ?? ''}
          </span>
        </span>
      </section>

      <GroupLabel>자녀</GroupLabel>
      <SettingsCard>
        <SettingsLinkRow
          href="/parent/my/students"
          label="자녀 계정 관리"
          value={`${students.length}명`}
        />
      </SettingsCard>

      <GroupLabel>알림과 계정</GroupLabel>
      <SettingsCard>
        <SettingsLinkRow href="/parent/my/profile" label="회원정보" />
        <SettingsLinkRow href="/parent/my/notifications" label="알림 설정" />
        <LogoutRow />
      </SettingsCard>

      <GroupLabel>도움</GroupLabel>
      <SettingsCard>
        <SettingsLinkRow href="/terms" label="이용약관 · 개인정보" />
      </SettingsCard>

      <div className="flex justify-end">
        <Link
          href="/parent/my/account/withdraw"
          className="py-3 text-[14px] leading-5 text-text-secondary"
        >
          회원 탈퇴
        </Link>
      </div>
    </main>
  );
}
