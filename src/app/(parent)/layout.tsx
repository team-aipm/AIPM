/**
 * PAR · RPT · BIL · MY 영역 공통 껍데기.
 *
 * **부모 어휘를 쓰고 하단 Nav 3탭(`홈 / 리포트 / 설정`)을 둔다**(CLAUDE.md ·
 * COM-003 §11). 학생 영역과 달리 탭 수가 적은 대신 구독 · 보상 · 회원정보를
 * 설정 안에 모았다 — 한 번 정하면 거의 안 들어가는 화면이 아이 학습 현황과
 * 같은 높이에 있을 이유가 없다.
 *
 * **아이 계정은 여기 못 들어온다.** 아이 화면에는 이곳으로 가는 링크가
 * 없지만 주소를 치면 그만이다. RLS 가 결제·리포트 행을 안 주므로 새는 것은
 * 없어도, 아이가 자기 평가를 찾아 헤매는 화면을 보여줄 이유가 없다.
 */

import { redirect } from 'next/navigation';
import { createClient, currentUser } from '@/lib/supabase/server';
import { studentIdOfViewer } from '@/lib/services/student-login';
import { ParentNav } from './_components/ParentNav';

export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const user = await currentUser();
  if (user === null) redirect('/login');
  if ((await studentIdOfViewer(supabase, user.id)) !== null) redirect('/home');

  return (
    <div className="flex min-h-dvh justify-center bg-background-primary">
      {/* 하단 Nav 높이(탭 48 + 위아래 여백 + 홈 인디케이터)만큼 비운다 */}
      <div className="flex w-full max-w-[480px] flex-col pb-[calc(env(safe-area-inset-bottom)+72px)]">
        {children}
        <ParentNav />
      </div>
    </div>
  );
}
