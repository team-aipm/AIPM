/**
 * MY-002 학생 관리 · `/parent/my/students` (DEV-002)
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { listStudents } from '@/lib/services/student';
import { PARTNER_NAME } from '@/lib/constants/copy';
import { PartnerFace } from '@/components/ui/PartnerFace';

export const metadata = { title: '학생 관리 · 메티' };

export default async function MyStudentsPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (auth.user === null) redirect('/login');

  const students = await listStudents(supabase);

  return (
    <main className="flex flex-1 flex-col gap-4 px-5 py-8">
      <header className="flex flex-col gap-1">
        <Link href="/parent/my" className="text-[13px] font-semibold text-meti-sub">
          ‹ 마이페이지
        </Link>
        <h1 className="text-xl font-extrabold text-meti-ink">학생 관리</h1>
      </header>

      <ul className="flex flex-col gap-2">
        {students.map((student) => (
          <li key={student.student_id}>
            <Link
              href={`/parent/my/students/${student.student_id}`}
              className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm"
            >
              <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-meti-bg">
                <PartnerFace persona={student.persona_type} size={36} />
              </span>
              <span className="flex flex-1 flex-col">
                <span className="text-[15px] font-bold text-meti-ink">{student.nickname}</span>
                <span className="text-[12px] text-meti-sub">
                  초등 {student.grade}학년 · {PARTNER_NAME[student.persona_type]}
                </span>
              </span>
              <span aria-hidden className="text-meti-sub">
                ›
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <Link
        href="/parent/my/students/new"
        className="rounded-xl bg-meti py-3 text-center text-[14px] font-bold text-white"
      >
        학생 추가
      </Link>
    </main>
  );
}
