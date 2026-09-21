/**
 * STU-001 첫 학생 등록 · `/onboarding/student` (DEV-002)
 *
 * 부모가 보는 화면이다. 학생 어휘를 쓰지 않는다.
 */

import { requireParent } from '@/lib/services/viewer';
import { StudentForm } from '@/components/student/StudentForm';
import { addStudent, checkLoginId } from './_actions';

export const metadata = { title: '학생 등록 · 메티' };

export default async function NewStudentPage() {
  // **여기만 부모가 쓴다.** 폴더는 (student) 지만 COM-003 §4.2 의 사용자
  // 칸이 「부모」다. 아이는 자기 홈으로 돌아간다.
  await requireParent();

  return (
    <main className="flex flex-1 flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-extrabold text-meti">학생 등록</h1>
        <p className="text-[13px] leading-relaxed text-meti-sub">
          아이의 정보를 알려주세요.
          <br />
          학년에 맞는 문제와 말투로 시작합니다.
        </p>
      </header>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <StudentForm action={addStudent} checkId={checkLoginId} submitLabel="등록" />
      </section>
    </main>
  );
}
