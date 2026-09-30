/**
 * MY-006 마케팅 수신설정 · `/parent/my/marketing` (DEV-002)
 *
 * **3종을 각각 받는다**(COM-002 §3 · COM-007 §9). 한 번에 묶지 않는다.
 * 대상은 부모뿐이며 학생에게는 어떤 마케팅도 보내지 않는다.
 *
 * 생김새는 Figma `설정 · 10 마케팅 수신 설정` 이다. Figma 는 이메일 · SMS
 * 둘에 「카카오 채널은 나중에」 인데, 저장하는 칸이 셋이라 알림톡 줄도
 * 둔다. 스위치는 누르는 즉시 저장하지 않는다 — 저장 버튼을 누를 때
 * 한 번에 보낸다(동의 이력이 한 번에 한 줄 남는다).
 */

import { redirect } from 'next/navigation';
import { createClient, currentUser } from '@/lib/supabase/server';
import { BrandButton } from '@/components/ui/BrandButton';
import { saveMarketing } from '../_actions';
import { MyTopBar } from '../_components/MyTopBar';
import { GroupLabel, SettingsCard } from '../_components/SettingsGroup';

export const metadata = { title: '소식 받기 · 메티' };

const ITEMS = [
  { name: 'marketing_email_opt_in', label: '이메일' },
  { name: 'marketing_sms_opt_in', label: '문자' },
  { name: 'marketing_alimtalk_opt_in', label: '알림톡' },
] as const;

export default async function MarketingPage() {
  const supabase = await createClient();
  const user = await currentUser();
  if (user === null) redirect('/login');

  const { data: account } = await supabase
    .from('account')
    .select(
      'marketing_email_opt_in, marketing_sms_opt_in, marketing_alimtalk_opt_in, marketing_consent_updated_at',
    )
    .eq('account_id', user.id)
    .maybeSingle();

  return (
    <main className="flex flex-1 flex-col">
      <MyTopBar title="마케팅 수신 설정" back="/parent/my/notifications" backLabel="알림 설정으로" />

      <form action={saveMarketing} className="flex flex-col gap-3 px-5 pb-5 pt-3">
        <GroupLabel>채널별 수신 동의</GroupLabel>
        <SettingsCard>
          {ITEMS.map((item) => (
            <label key={item.name} className="flex cursor-pointer items-center gap-3 py-3">
              <span className="flex-1 text-[16px] leading-6 text-text-primary">{item.label}</span>
              {/*
                Figma `Switch` — 48x28 트랙 · 20px 손잡이 · 켜짐 #206B7C.
                진짜 체크박스를 숨겨 두고 모양만 바꾼다. 그래야 폼이 그대로
                `on` 을 보내고 키보드 · 보조 기술도 그대로 쓴다.
              */}
              <input
                type="checkbox"
                role="switch"
                name={item.name}
                defaultChecked={account?.[item.name] === true}
                className="peer sr-only"
              />
              <span
                aria-hidden
                className="relative h-7 w-12 shrink-0 rounded-full bg-meti-off transition-colors after:absolute after:left-1 after:top-1 after:size-5 after:rounded-full after:bg-surface-primary after:transition-transform peer-checked:bg-button-primary peer-checked:after:translate-x-5 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-button-primary"
              />
            </label>
          ))}
        </SettingsCard>

        <p className="text-[12px] leading-[18px] text-text-secondary">
          동의하지 않아도 서비스를 쓰는 데 제한이 없습니다.
        </p>

        {account?.marketing_consent_updated_at !== undefined && (
          <p className="text-[12px] leading-[18px] text-text-secondary">
            마지막 변경{' '}
            {new Date(account.marketing_consent_updated_at).toLocaleDateString('ko-KR')}
          </p>
        )}

        <div className="pt-2">
          <BrandButton>저장</BrandButton>
        </div>
      </form>
    </main>
  );
}
