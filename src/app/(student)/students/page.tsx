/**
 * STU-002 학생 선택 · `/students` (DEV-002)
 *
 * 한 계정에 학생이 여럿일 수 있다(COM-002 §4). 누구로 들어갈지 먼저 고른다.
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { listStudents } from '@/lib/services/student';
import { PARTNER_NAME } from '@/lib/constants/copy';
import { PartnerFace } from '@/components/ui/PartnerFace';
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
        <div className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-[14px] leading-relaxed text-meti-sub">
            아직 등록된 학생이 없어요.
            <br />
            아이를 먼저 등록해주세요.
          </p>
          <Link
            href="/onboarding/student"
            className="rounded-xl bg-meti py-3 text-center text-[14px] font-bold text-white"
          >
            학생 등록하기
          </Link>
        </div>
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
                  <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-meti-bg">
                    <PartnerFace persona={student.persona_type} size={40} />
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

      {students.length > 0 && (
        <Link
          href="/onboarding/student"
          className="text-center text-[13px] font-semibold text-meti-sub underline"
        >
          학생 한 명 더 등록하기
        </Link>
      )}
    </main>
  );
}
