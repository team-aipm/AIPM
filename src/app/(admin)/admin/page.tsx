/**
 * ADM-001 대시보드 · `/admin`
 *
 * **집계만 본다.** 개인정보도 대화 원문도 없다(COM-007 §7-1).
 */

import { notFound } from 'next/navigation';
import { currentAdmin } from '@/lib/services/admin';

export const metadata = { title: 'AIPM 운영 · 대시보드' };

function Card({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-black/10 bg-white p-4">
      <span className="text-[12px] font-semibold text-neutral-500">{label}</span>
      <span className="text-[24px] font-extrabold leading-none">{value}</span>
      {sub !== undefined && <span className="text-[11px] text-neutral-400">{sub}</span>}
    </div>
  );
}

export default async function AdminDashboard() {
  const ctx = await currentAdmin();
  if (ctx === null) notFound();

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
  const count = async (table: 'account' | 'student' | 'learning_session' | 'problem') => {
    const { count: n } = await ctx.db.from(table).select('*', { count: 'exact', head: true });
    return n ?? 0;
  };

  const [accounts, students] = await Promise.all([count('account'), count('student')]);

  const { count: todaySessions } = await ctx.db
    .from('learning_session')
    .select('*', { count: 'exact', head: true })
    .eq('session_date', today);

  const { count: todayProblems } = await ctx.db
    .from('problem')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', `${today}T00:00:00+09:00`);

  const { count: needsReview } = await ctx.db
    .from('problem')
    .select('*', { count: 'exact', head: true })
    .eq('problem_status', 'needs_review');

  const { count: interrupted } = await ctx.db
    .from('problem')
    .select('*', { count: 'exact', head: true })
    .in('problem_status', ['system_interrupted', 'verification_failed']);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-[18px] font-extrabold">대시보드</h1>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card label="회원(부모)" value={String(accounts)} />
        <Card label="학생" value={String(students)} />
        <Card label="오늘 세션" value={String(todaySessions ?? 0)} sub={today} />
        <Card label="오늘 문제" value={String(todayProblems ?? 0)} />
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card label="needs_review" value={String(needsReview ?? 0)} sub="누적" />
        <Card
          label="집계 제외"
          value={String(interrupted ?? 0)}
          sub="system_interrupted · verification_failed"
        />
      </section>

      <p className="text-[12px] leading-relaxed text-neutral-500">
        여기 있는 값은 모두 집계입니다. 개인정보와 대화 원문은 이 화면에
        나오지 않습니다(COM-007 §7-1).
      </p>
    </div>
  );
}
