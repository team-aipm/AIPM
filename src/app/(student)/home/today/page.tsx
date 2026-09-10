/**
 * STU-005 오늘의 기록 · `/home/today` (DEV-002)
 *
 * **학생 화면이다.** 상세 평가점수와 Logic Gap 은 나가지 않는다(COM-003).
 * 여기 나오는 것은 무엇을 했는지와, 하루를 마쳤을 때 파트너가 건네는 한
 * 마디뿐이다.
 *
 * `needs_review` 를 "실패" 로 쓰지 않는다 — `copy.ts` 가 「한 번 더 도전」
 * 으로 옮긴다.
 */

import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getStudent } from '@/lib/services/student';
import { findTodaySession, today } from '@/lib/services/learning-session';
import { listTodayProblems } from '@/lib/services/problem-list';
import { findDailyReport } from '@/lib/services/learning-report';
import { problemStatusLabel, learningModeLabel, PARTNER_NAME } from '@/lib/constants/copy';
import { STUDENT_COOKIE } from '@/lib/constants/student-cookie';
import { PartnerFace } from '@/components/ui/PartnerFace';

export const metadata = { title: '오늘의 기록 · 메티' };

/** 06 이 낸 학생용 한 마디. 없으면 그 자리를 그리지 않는다 */
function endSummaryOf(summary: unknown): string | null {
  if (typeof summary !== 'object' || summary === null) return null;
  const value = (summary as Record<string, unknown>).student_end_summary;
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

export default async function TodayPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (auth.user === null) redirect('/login');

  const jar = await cookies();
  const studentId = jar.get(STUDENT_COOKIE)?.value ?? '';
  if (studentId === '') redirect('/students');

  const student = await getStudent(supabase, studentId);
  if (student === null) redirect('/students');

  const session = await findTodaySession(supabase, student.student_id);
  const problems = session === null ? [] : await listTodayProblems(supabase, session.session_id);
  const report = await findDailyReport(supabase, student.student_id, today());
  const endSummary = report === null ? null : endSummaryOf(report.summary_data);

  const partner = PARTNER_NAME[student.persona_type];
  // 진행 중인 문제는 아직 결과가 아니다. 세지 않는다.
  const done = problems.filter((item) => item.status !== 'active');

  return (
    <main className="flex flex-1 flex-col gap-5 bg-[#F7FAFB] px-6 py-8">
      <header className="flex flex-col gap-1">
        <Link href="/home" className="text-[13px] font-semibold text-meti-sub">
          ‹ 홈
        </Link>
        <h1 className="text-xl font-extrabold text-meti-ink">오늘의 기록</h1>
      </header>

      {endSummary !== null && (
        <section className="flex items-start gap-3 rounded-2xl border-[1.5px] border-meti-bg bg-white p-4 shadow-[0_2px_8px_rgba(18,52,59,.06)]">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-meti-bg ring-2 ring-white shadow-sm">
            <PartnerFace persona={student.persona_type} size={32} />
          </span>
          <p className="text-[14px] leading-relaxed text-meti-ink">{endSummary}</p>
        </section>
      )}

      <section className="rounded-2xl bg-white p-5 shadow-[0_2px_8px_rgba(18,52,59,.06)]">
        <p className="text-[13px] font-semibold text-meti-sub">오늘 해낸 미션</p>
        <p className="mt-1 text-[28px] font-extrabold leading-none text-meti">
          {done.length}
          <span className="ml-1 text-[15px] font-bold text-meti-sub">
            / {session?.target_problem_count ?? 10}
          </span>
        </p>
      </section>

      {done.length === 0 ? (
        <p className="rounded-2xl bg-white p-5 text-[14px] leading-relaxed text-meti-sub shadow-[0_2px_8px_rgba(18,52,59,.06)]">
          오늘은 아직 시작하지 않았어.
          <br />
          {partner}가 기다리고 있어!
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {done.map((item, index) => (
            <li
              key={item.problemId}
              className="rounded-2xl bg-white p-4 shadow-[0_2px_8px_rgba(18,52,59,.06)]"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-bold text-meti-sub">
                  {index + 1}번째 ·{' '}
                  {learningModeLabel(
                    item.learningMode === 'mode_b' ? 'mode_b' : 'mode_a',
                    'student',
                    partner,
                  )}
                </span>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                    item.status === 'completed'
                      ? 'bg-meti-bg text-meti'
                      : 'bg-amber-50 text-amber-700'
                  }`}
                >
                  {problemStatusLabel(item.status, 'student')}
                </span>
              </div>
              <p className="mt-2 text-[13px] leading-relaxed text-meti-ink">
                {item.problemText}
              </p>
            </li>
          ))}
        </ul>
      )}

      {session !== null && session.session_status !== 'completed' && (
        <Link
          href="/mission"
          className="rounded-xl bg-meti py-3 text-center text-[14px] font-bold text-white shadow-sm"
        >
          이어서 하기
        </Link>
      )}
    </main>
  );
}
