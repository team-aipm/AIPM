/**
 * 학생 목록 · `/admin/students`
 *
 * 와이어프레임에는 ADM-005 상세만 있지만 들어갈 길이 필요하다.
 * **집계만 보여준다** — 이름은 마스킹하고 대화는 없다(COM-007 §7-1).
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { currentAdmin, maskName } from '@/lib/services/admin';

export const metadata = { title: 'AIPM 운영 · 학생' };

export default async function AdminStudentsPage() {
  const ctx = await currentAdmin();
  if (ctx === null) notFound();

  const { data: students } = await ctx.db
    .from('student')
    .select('student_id, nickname, grade, persona_type, student_status, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  const rows = students ?? [];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-[18px] font-extrabold">학생</h1>

      <div className="overflow-x-auto rounded-lg border border-black/10 bg-white">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-black/10 bg-neutral-50 text-[11px] text-neutral-500">
            <tr>
              <th className="px-4 py-2 font-semibold">닉네임</th>
              <th className="px-4 py-2 font-semibold">학년</th>
              <th className="px-4 py-2 font-semibold">Persona</th>
              <th className="px-4 py-2 font-semibold">상태</th>
              <th className="px-4 py-2 font-semibold" />
            </tr>
          </thead>
          <tbody>
            {rows.map((student) => (
              <tr key={student.student_id} className="border-b border-black/5 last:border-0">
                <td className="px-4 py-2.5">{maskName(student.nickname)}</td>
                <td className="px-4 py-2.5">{student.grade}</td>
                <td className="px-4 py-2.5">{student.persona_type}</td>
                <td className="px-4 py-2.5 text-neutral-500">{student.student_status}</td>
                <td className="px-4 py-2.5">
                  <Link
                    href={`/admin/students/${student.student_id}`}
                    className="text-[12px] font-semibold underline"
                  >
                    상세
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length === 0 && <p className="text-[13px] text-neutral-500">학생이 없습니다.</p>}
    </div>
  );
}
