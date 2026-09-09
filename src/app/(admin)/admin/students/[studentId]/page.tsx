/**
 * ADM-005 학생 관리 — 상세 · `/admin/students/[studentId]`
 *
 * **집계값만 보여준다.** 와이어프레임의 "학습 요약 — 모든 권한이 볼 수
 * 있음" 이 이 부분이다.
 *
 * 대화 원문은 **여기 없다**(COM-007 §7-1). CS 문의에 연결된 건에서만 사유를
 * 남기고 여는 것이 규칙인데 그 화면(ADM-008)이 아직 없다. 없는 길을 미리
 * 열어 두지 않는다.
 */

import { notFound } from 'next/navigation';
import { currentAdmin, maskName } from '@/lib/services/admin';
import { GAP_DEFINITIONS } from '@/lib/ai/taxonomy';

export const metadata = { title: 'AIPM 운영 · 학생 상세' };

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-black/10 bg-white p-4">
      <span className="text-[11px] font-semibold text-neutral-500">{label}</span>
      <span className="text-[20px] font-extrabold leading-none">{value}</span>
    </div>
  );
}

export default async function AdminStudentDetail({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;

  const ctx = await currentAdmin();
  if (ctx === null) notFound();

  const { data: student } = await ctx.db
    .from('student')
    .select('*')
    .eq('student_id', studentId)
    .maybeSingle();

  if (student === null) notFound();

  const { data: problems } = await ctx.db
    .from('problem')
    .select('problem_status, learning_mode, evaluation(support_level, self_correction)')
    .eq('student_id', studentId);

  const rows = problems ?? [];
  const evaluations = rows
    .map((row) => (Array.isArray(row.evaluation) ? row.evaluation[0] : row.evaluation))
    .filter((item): item is NonNullable<typeof item> => item !== null && item !== undefined);

  const supports = evaluations.map((item) => item.support_level);
  const avgSupport =
    supports.length === 0
      ? '—'
      : (supports.reduce((sum, value) => sum + value, 0) / supports.length).toFixed(1);

  const { count: sessions } = await ctx.db
    .from('learning_session')
    .select('*', { count: 'exact', head: true })
    .eq('student_id', studentId);

  const { data: gaps } = await ctx.db
    .from('logic_gap')
    .select('gap_type')
    .eq('student_id', studentId);

  const gapCount = new Map<string, number>();
  for (const gap of gaps ?? []) {
    gapCount.set(gap.gap_type, (gapCount.get(gap.gap_type) ?? 0) + 1);
  }

  const excluded = rows.filter(
    (row) =>
      row.problem_status === 'system_interrupted' ||
      row.problem_status === 'verification_failed',
  ).length;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-[18px] font-extrabold">
          {maskName(student.nickname)} · {student.grade}학년 · Persona {student.persona_type}
        </h1>
        <p className="text-[12px] text-neutral-500">
          {student.student_id} · 상태 {student.student_status}
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="총 세션" value={String(sessions ?? 0)} />
        <Stat
          label="완료 문제"
          value={String(rows.filter((row) => row.problem_status === 'completed').length)}
        />
        <Stat
          label="needs_review"
          value={String(rows.filter((row) => row.problem_status === 'needs_review').length)}
        />
        <Stat label="집계 제외" value={String(excluded)} />
        <Stat label="평균 support" value={avgSupport} />
      </section>

      <section className="flex flex-col gap-2 rounded-lg border border-black/10 bg-white p-4">
        <h2 className="text-[12px] font-bold text-neutral-500">Logic Gap</h2>
        {gapCount.size === 0 ? (
          <p className="text-[13px] text-neutral-500">기록 없음</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {[...gapCount.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([type, count]) => (
                <li key={type} className="flex justify-between gap-4 text-[13px]">
                  <span>
                    {type} · {GAP_DEFINITIONS[type as keyof typeof GAP_DEFINITIONS]}
                  </span>
                  <span className="font-semibold">{count}</span>
                </li>
              ))}
          </ul>
        )}
      </section>

      <p className="text-[12px] leading-relaxed text-neutral-500">
        대화 원문은 이 화면에 없습니다. CS 문의에 연결된 건에서만 사유를 남기고
        열 수 있으며(COM-007 §7-1), 그 화면(ADM-008)은 아직 없습니다.
      </p>
    </div>
  );
}
