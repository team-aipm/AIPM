/**
 * AUTH-002 회원가입 · `/signup` (DEV-002)
 *
 * 가입하는 사람은 **부모**다(COM-003). 그래서 이 화면만 학생 어휘를 쓰지
 * 않는다 — "보호자 이름", "회원가입" 그대로 쓴다.
 *
 * 약관·개인정보 동의(AUTH-003)와 휴대폰 인증(AUTH-004)은 별도 Screen 이라
 * 여기 넣지 않았다. COM-007(개인정보 · 아동 데이터)이 초안이라 동의 문구를
 * 지어낼 수도 없다.
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SignupForm } from './_components/SignupForm';

export const metadata = { title: '회원가입 · 메티' };

export default async function SignupPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user !== null) redirect('/students');

  return (
    <main className="flex flex-1 flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-extrabold text-meti">회원가입</h1>
        <p className="text-[13px] text-meti-sub">
          보호자 정보로 계정을 만들고, 학생은 그 안에 등록합니다.
        </p>
      </header>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <SignupForm />
      </section>

      <Link href="/login" className="text-center text-[13px] font-semibold text-meti-sub underline">
        이미 계정이 있어요
      </Link>
    </main>
  );
}
