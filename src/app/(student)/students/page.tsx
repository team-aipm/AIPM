/**
 * STU-002 학생 선택 · `/students` (DEV-002)
 *
 * 한 계정에 학생이 여럿일 수 있다(COM-002 §4). 누구로 들어갈지 먼저 고른다.
 */

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { listStudents } from '@/lib/services/student';
import { PARTNER_NAME } from '@/lib/constants/copy';
import { selectStudent } from './_actions';

export const metadata = { title: '누구로 시작할까 · 메티' };

export default async function StudentsPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user === null) redirect('/login');

  const students = await listStudents(supabase);

  return (
    <main className="flex flex-1 flex-col gap-5 px-6 py-10">
      <h1 className="text-xl font-extrabold text-meti-ink">누구로 시작할까?</h1>

      {students.length === 0 ? (
        // 온보딩(STU-001 첫 학생 등록)은 아직 없다. 빈 화면에 아무 말도 없이
        // 두면 고장으로 보이므로, 무엇이 없는지 그대로 적는다.
        <p className="rounded-2xl bg-white p-5 text-[14px] leading-relaxed text-meti-sub shadow-sm">
          아직 등록된 학생이 없어요.
          <br />
          학생 등록 화면은 준비 중입니다.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {students.map((student) => (
            <li key={student.student_id}>
              <form action={selectStudent}>
                <input type="hidden" name="student_id" value={student.student_id} />
                <button
                  type="submit"
                  className="flex w-full items-center gap-4 rounded-2xl bg-white p-4 text-left shadow-sm"
                >
                  <span
                    aria-hidden
                    className="flex h-12 w-12 items-center justify-center rounded-full bg-meti-bg text-xl"
                  >
                    🐣
                  </span>
                  <span className="flex flex-col">
                    <span className="text-[15px] font-bold text-meti-ink">
                      {student.nickname}
                    </span>
                    <span className="text-[12px] font-semibold text-meti-sub">
                      초등 {student.grade}학년 · {PARTNER_NAME[student.persona_type]}와 함께
                    </span>
                  </span>
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
