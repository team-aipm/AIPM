/**
 * RPT-001 주간 성장 리포트 · `/parent/reports` (DEV-002)
 *
 * COM-003 이 이 화면에 **「데이터 부족」 State** 를 정의해 뒀다 — "초기
 * 사용기간 안내". 지금이 정확히 그 상태다. 주간 리포트는 07 WEEKLY REPORT
 * 가 만드는데 아직 붙이지 않았고, 한 주치 데이터도 없다.
 *
 * **없는 것을 그럴듯하게 채우지 않는다.** 빈 표를 그리거나 숫자를 지어내면
 * 리포트가 도착했을 때 무엇이 진짜인지 알 수 없다.
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { listStudents } from '@/lib/services/student';

export const metadata = { title: '주간 리포트 · 메티' };

export default async function ReportsPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (auth.user === null) redirect('/login');

  const students = await listStudents(supabase);

  const { data: reports, error } = await supabase
    .from('learning_report')
    .select('report_id, student_id, period_start, period_end, generated_at')
    .eq('report_type', 'weekly_parent')
    .order('period_end', { ascending: false })
    .limit(10);

  if (error !== null) throw new Error(`리포트를 불러오지 못했습니다: ${error.message}`);

  const rows = reports ?? [];
  const nameOf = (studentId: string) =>
    students.find((item) => item.student_id === studentId)?.nickname ?? '학생';

  return (
    <main className="flex flex-1 flex-col gap-4 px-5 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-extrabold text-meti-ink">주간 리포트</h1>
        <p className="text-[13px] text-meti-sub">한 주 동안의 변화를 모아서 보여드립니다.</p>
      </header>

      {rows.length === 0 ? (
        <section className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-[15px] font-bold text-meti-ink">아직 리포트가 없습니다</p>
          <p className="text-[13px] leading-relaxed text-meti-sub">
            주간 리포트는 한 주 동안의 학습이 쌓여야 만들어집니다.
            <br />
            그동안은 <strong className="font-bold text-meti-ink">학습 현황</strong> 에서
            최근 7일을 보실 수 있습니다.
          </p>
          <Link
            href="/parent"
            className="rounded-xl bg-meti py-3 text-center text-[14px] font-bold text-white"
          >
            학습 현황 보기
          </Link>
        </section>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((report) => (
            <li key={report.report_id}>
              <Link
                href={`/parent/reports/${report.report_id}`}
                className="flex flex-col gap-1 rounded-2xl bg-white p-4 shadow-sm"
              >
                <span className="text-[14px] font-bold text-meti-ink">
                  {nameOf(report.student_id)}
                </span>
                <span className="text-[12px] text-meti-sub">
                  {report.period_start} ~ {report.period_end}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
