/**
 * MY-004 학생 추가 · `/parent/my/students/new` (DEV-002)
 *
 * **보호자 화면 안에서 끝낸다.** 전에는 STU-001(`/onboarding/student`) 로
 * 넘겨 버렸는데, 그러면 부모가 학생 영역으로 튕겨 나가고 하단 Nav 도
 * 사라진다. 등록하러 들어갔다가 돌아올 길을 잃는다.
 *
 * DEV-002 §3 이 정한 대로다 — 두 화면은 Route 를 나누고 **폼만 같이 쓴다**.
 *
 * 부모 어휘로 쓴다(COM-003 §7). 「미션」 같은 학생 어휘를 쓰지 않는다.
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { listStudents } from '@/lib/services/student';
import { StudentForm } from '@/components/student/StudentForm';
import { addStudentFromParent, checkLoginId } from './_actions';

export const metadata = { title: '학생 추가 · 메티' };

export default async function AddStudentPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (auth.user === null) redirect('/login');

  // 첫 아이인지 둘째인지에 따라 안내가 달라진다. 이미 등록한 부모에게
  // "시작합니다" 라고 말하면 지금까지의 기록이 어떻게 되는지 걱정한다.
  const students = await listStudents(supabase);
  const first = students.length === 0;

  return (
    <main className="flex flex-1 flex-col gap-5 px-5 py-8">
      <header className="flex flex-col gap-1">
        <Link
          href={first ? '/parent' : '/parent/my/students'}
          className="text-[13px] font-semibold text-meti-sub"
        >
          ‹ {first ? '학습 현황' : '학생 관리'}
        </Link>
        <h1 className="text-xl font-extrabold text-meti-ink">학생 추가</h1>
        <p className="text-[13px] leading-relaxed text-meti-sub">
          {first
            ? '아이의 정보를 알려주세요. 학년에 맞는 문제와 말투로 시작합니다.'
            : '아이마다 학습 기록과 파트너를 따로 둡니다. 지금 등록한 아이의 기록은 그대로입니다.'}
        </p>
      </header>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <StudentForm
          action={addStudentFromParent}
          checkId={checkLoginId}
          submitLabel="등록"
        />
      </section>
    </main>
  );
}
