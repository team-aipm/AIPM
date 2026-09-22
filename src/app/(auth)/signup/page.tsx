/**
 * AUTH-002 회원가입 · `/signup` (DEV-002) · Figma `부모 / 회원가입`
 *
 * 가입하는 사람은 **부모**다(COM-003). 그래서 이 화면만 학생 어휘를 쓰지
 * 않는다 — 「부모님 회원가입」 그대로 쓴다.
 *
 * **약관 동의(AUTH-003)가 이 화면 안으로 들어왔다.** 전에는 별도 Screen 이라
 * 빼 뒀는데, Figma 는 동의 4줄을 가입 폼 안에 두고 본문만 바텀시트로 띄운다.
 * COM-003 §13-3 과도 맞는다 — 시트는 Route 가 아니다.
 *
 * DEV-002 §2 의 `AUTH-003 → /signup/terms` 줄은 이 구현과 맞지 않는다.
 * 문서 쪽을 고쳐야 한다.
 *
 * **휴대폰 인증(AUTH-004)은 없다.** Figma 에 프레임이 없고, 가입에서
 * 휴대폰을 받지 않기로 했다(COM-002 §3-1). 무엇으로 대신할지는 미정이다.
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { studentIdOfViewer } from '@/lib/services/student-login';
import { BackBar } from '@/components/ui/BackBar';
import { SignupForm } from './_components/SignupForm';

export const metadata = { title: '회원가입 · 메티' };

export default async function SignupPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  // 이미 들어와 있으면 가입 화면을 보여 줄 이유가 없다. 로그인 화면과
  // 같은 규칙으로 보낸다.
  if (data.user !== null) {
    const studentId = await studentIdOfViewer(supabase, data.user.id);
    redirect(studentId === null ? '/parent' : '/home');
  }

  return (
    <main className="flex flex-1 flex-col pb-[34px]">
      <BackBar />

      <div className="flex flex-col gap-3 px-5 pt-3">
        <h1 className="text-[24px] font-bold leading-8 text-meti-ink">부모님 회원가입</h1>

        <SignupForm />

        <p className="pt-1 text-center text-[14px] font-semibold leading-5 text-meti">
          <Link href="/login">이미 계정이 있어요? 로그인</Link>
        </p>
      </div>
    </main>
  );
}
