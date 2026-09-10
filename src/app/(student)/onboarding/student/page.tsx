/**
 * STU-001 첫 학생 등록 · `/onboarding/student` (DEV-002)
 *
 * 부모가 보는 화면이다. 학생 어휘를 쓰지 않는다.
 */

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { StudentForm } from './_components/StudentForm';

export const metadata = { title: '학생 등록 · 메티' };

export default async function NewStudentPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user === null) redirect('/login');

  return (
    <main className="flex flex-1 flex-col gap-6 bg-[#F7FAFB] px-6 py-10">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-extrabold text-meti">학생 등록</h1>
        <p className="text-[13px] leading-relaxed text-meti-sub">
          아이의 정보를 알려주세요.
          <br />
          학년에 맞는 문제와 말투로 시작합니다.
        </p>
      </header>

      <section className="rounded-2xl bg-white p-5 shadow-[0_2px_8px_rgba(18,52,59,.06)]">
        <StudentForm />
      </section>
    </main>
  );
}
