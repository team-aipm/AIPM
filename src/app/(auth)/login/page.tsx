/**
 * AUTH-001 로그인 · `/login` (DEV-002)
 *
 * 프로토타입(METI)의 로그인 화면을 옮긴 것이다. 캐릭터 그림은 아직
 * 파일이 없어서 자리만 잡아 뒀다.
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { LoginForm } from './_components/LoginForm';

export const metadata = { title: '로그인 · 메티' };

export default async function LoginPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  // 이미 들어와 있으면 로그인 화면을 보여 줄 이유가 없다.
  if (data.user !== null) redirect('/students');

  return (
    <main className="flex flex-1 flex-col justify-center gap-7 px-6 py-10">
      <header className="flex flex-col items-center gap-2">
        <h1 className="text-3xl font-extrabold tracking-tight text-meti">Meti</h1>
        <p className="text-[13px] font-semibold text-meti-sub">
          생각하는 힘을 키우는 학습 친구
        </p>
      </header>

      <p className="rounded-2xl bg-white px-4 py-3 text-center text-[14px] font-bold text-meti-ink shadow-sm">
        다시 만나서 반가워! 로그인하고 시작하자
      </p>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <LoginForm />
      </section>

      <p className="text-center text-[13px] text-meti-sub">
        계정이 없으면 부모님과 함께{' '}
        <Link href="/signup" className="font-semibold underline">
          회원가입
        </Link>
        해줘
      </p>
    </main>
  );
}
