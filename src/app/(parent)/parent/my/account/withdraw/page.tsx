/**
 * MY-009 회원탈퇴 안내 · `/parent/my/account/withdraw` (DEV-002)
 *
 * **무엇이 사라지고 무엇이 남는지 먼저 말한다**(COM-007 §5-2). 누르고 나서
 * 알게 되면 늦다.
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { listStudents } from '@/lib/services/student';

export const metadata = { title: '회원탈퇴 · 메티' };

export default async function WithdrawPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (auth.user === null) redirect('/login');

  const students = await listStudents(supabase);

  return (
    <main className="flex flex-1 flex-col gap-4 px-5 py-8">
      <header className="flex flex-col gap-1">
        <Link href="/parent/my/account" className="text-[13px] font-semibold text-meti-sub">
          ‹ 계정 관리
        </Link>
        <h1 className="text-xl font-extrabold text-meti-ink">회원탈퇴</h1>
      </header>

      <section className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-[14px] font-bold text-meti-ink">함께 삭제됩니다</h2>
        <ul className="flex flex-col gap-1.5 text-[13px] leading-relaxed text-meti-sub">
          <li>· 로그인 계정</li>
          <li>· 등록된 학생 {students.length}명의 프로필</li>
          <li>· 학습 기록 · 대화 · 평가 (1년 뒤 완전 삭제)</li>
          <li>· 문제 사진 (즉시 삭제)</li>
        </ul>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-[14px] font-bold text-meti-ink">남습니다</h2>
        <p className="text-[13px] leading-relaxed text-meti-sub">
          결제 기록은 법에 따라 보관합니다.
          <br />
          대금 결제 · 재화 공급 5년 · 소비자 불만 처리 3년.
        </p>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-[14px] font-bold text-meti-ink">30일 안에는 되돌릴 수 있습니다</h2>
        <p className="text-[13px] leading-relaxed text-meti-sub">
          같은 이메일로 복구를 요청하시면 됩니다. 30일이 지나면 새로 가입하는
          것이며 이전 기록은 이어지지 않습니다.
        </p>
      </section>

      <Link
        href="/parent/my/account/withdraw/confirm"
        className="rounded-xl border border-red-200 bg-white py-3 text-center text-[14px] font-semibold text-red-600"
      >
        이해했습니다. 계속하기
      </Link>
    </main>
  );
}
