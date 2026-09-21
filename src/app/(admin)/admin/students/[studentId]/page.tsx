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

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { currentAdmin, maskName, logAudit } from '@/lib/services/admin';
import { usageDepth, STAGE_LABEL, studentReports } from '@/lib/services/admin-metrics';
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
  searchParams,
}: {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<{ open?: string }>;
}) {
  const { studentId } = await params;
  const { open } = await searchParams;

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

  /**
   * 얼마나 오래 · 얼마나 도움받으며 했나.
   *
   * **새로 모으는 값이 없다.** 턴과 힌트는 `message` 가 이미 들고 있다 —
   * 학습을 굴리려고 어차피 남기는 것들이다(COM-002 §7).
   */
  const usage = await usageDepth(ctx.db, studentId);

  /**
   * 리포트 (COM-003 §4.8-1). **주간과 하루를 함께 본다.**
   *
   * 하루 총평은 어느 화면에도 안 나온다 — 학생 화면은 `student_end_summary`
   * 한 줄만 쓰고, 나머지는 07 의 재료로만 쓰인다. 07 이 이상할 때 재료가
   * 문제인지 프롬프트가 문제인지 가리려면 여기서 볼 수 있어야 한다.
   *
   * **목록은 늘 보이고 본문은 열어야 보인다.** 목록은 기간과 규격 점검
   * 결과라 집계지만, 본문은 한 아이에 대한 서술이다. 열면 흔적을 남긴다
   * (COM-007 §7-3).
   */
  const reports = await studentReports(ctx.db, studentId, open ?? null);

  if (open !== undefined && reports.some((row) => row.reportId === open)) {
    await logAudit(ctx, {
      action: 'view_report',
      targetType: 'learning_report',
      targetId: open,
    });
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

      {/*
        **이용 깊이.** 얼마나 붙들고 있었나, 얼마나 도움을 받았나.

        평균만 두지 않는다. 힌트 평균 0.7 회는 「다들 조금씩 쓴다」로 읽히는데
        실제로는 대부분 한 번도 안 쓰고 한 문제에서 일곱 번 쓴다 — 전혀 다른
        일이라 분포를 함께 둔다.
      */}
      <section className="flex flex-col gap-3 rounded-lg border border-black/10 bg-white p-4">
        <h2 className="text-[12px] font-bold text-neutral-500">이용 깊이</h2>

        {usage.problems === 0 ? (
          <p className="text-[13px] text-neutral-500">대화 기록 없음</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="대화한 문제" value={String(usage.problems)} />
              <Stat
                label="문제당 평균 턴"
                value={`${usage.avgTurns.toFixed(1)}`}
              />
              <Stat label="가장 긴 대화" value={`${usage.maxTurns}턴`} />
              <Stat
                label="힌트 쓴 문제"
                value={`${Math.round((usage.hintProblems / usage.problems) * 100)}%`}
              />
            </div>

            <div className="flex flex-col gap-1">
              <p className="text-[11px] font-semibold text-neutral-500">
                힌트 횟수 분포 · 힌트 총 {usage.hintTotal}회
              </p>
              <ul className="flex flex-col gap-1 text-[13px]">
                {(
                  [
                    ['한 번도 안 씀', usage.hintSpread.none],
                    ['1~2회', usage.hintSpread.few],
                    ['3회 이상', usage.hintSpread.many],
                  ] as const
                ).map(([label, count]) => (
                  <li key={label} className="flex items-baseline justify-between gap-4">
                    <span>{label}</span>
                    <span className="font-semibold">{count}문제</span>
                  </li>
                ))}
              </ul>
            </div>

            {usage.stages.length > 0 && (
              <div className="flex flex-col gap-1">
                <p className="text-[11px] font-semibold text-neutral-500">
                  Drill-down 단계별로 물은 횟수
                </p>
                <ul className="flex flex-col gap-1 text-[13px]">
                  {usage.stages.map((row) => (
                    <li key={row.stage} className="flex items-baseline justify-between gap-4">
                      <span>
                        {STAGE_LABEL[row.stage] ?? row.stage}{' '}
                        <code className="text-[11px] text-neutral-400">{row.stage}</code>
                      </span>
                      <span className="font-semibold">{row.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </section>

      {/*
        **주간 리포트.** 07 이 실제로 무엇을 냈는지 사람이 읽어 본다.

        규격 점검은 내용을 안 읽고 칸만 센다(COM-004 §6-2). 배열이 죄다
        비었거나 문장이 한 줄이면 모델이 성의 없이 낸 것인데, 그냥 늘어
        놓으면 그게 안 보인다.
      */}
      <section className="flex flex-col gap-3 rounded-lg border border-black/10 bg-white p-4">
        <h2 className="text-[12px] font-bold text-neutral-500">리포트</h2>

        {reports.length === 0 ? (
          <p className="text-[13px] text-neutral-500">
            아직 만들어진 리포트가 없습니다. 하루 총평은 아이가 하루 목표를
            마칠 때 06 이 만들고, 주간 리포트는 매주 일요일 19시 배치가
            만듭니다.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {reports.map((row) => (
              <li
                key={row.reportId}
                className="flex flex-col gap-2 rounded border border-black/10 p-3"
              >
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${
                      row.kind === 'weekly_parent'
                        ? 'bg-blue-50 text-blue-800'
                        : 'bg-neutral-100 text-neutral-600'
                    }`}
                  >
                    {row.kindLabel}
                  </span>
                  <span className="text-[13px] font-semibold">
                    {row.periodStart === row.periodEnd
                      ? row.periodStart
                      : `${row.periodStart} ~ ${row.periodEnd}`}
                  </span>
                  <span className="text-[11px] text-neutral-400">
                    생성 {new Date(row.generatedAt).toLocaleString('ko-KR')}
                  </span>

                  {row.missing.length === 0 && row.empty.length === 0 ? (
                    <span className="text-[11px] font-bold text-green-700">규격 통과</span>
                  ) : (
                    <span className="text-[11px] font-bold text-amber-700">
                      {row.missing.length > 0 && `빠진 칸 ${row.missing.length}`}
                      {row.missing.length > 0 && row.empty.length > 0 && ' · '}
                      {row.empty.length > 0 && `빈 칸 ${row.empty.length}`}
                    </span>
                  )}

                  <Link
                    href={
                      row.body === null
                        ? `?open=${row.reportId}`
                        : `/admin/students/${studentId}`
                    }
                    scroll={false}
                    className="ml-auto text-[12px] font-semibold text-blue-700 underline"
                  >
                    {row.body === null ? '본문 열기' : '접기'}
                  </Link>
                </div>

                {(row.missing.length > 0 || row.empty.length > 0) && (
                  <p className="text-[11px] text-amber-800">
                    {row.missing.length > 0 && `빠짐: ${row.missing.join(' · ')}`}
                    {row.missing.length > 0 && row.empty.length > 0 && ' / '}
                    {row.empty.length > 0 && `비어 있음: ${row.empty.join(' · ')}`}
                  </p>
                )}

                {row.body !== null && (
                  <dl className="flex flex-col gap-2 border-t border-black/5 pt-2">
                    {row.body.map((item) => (
                      <div key={item.field} className="flex flex-col gap-0.5">
                        <dt className="text-[11px] font-semibold text-neutral-500">
                          <code>{item.field}</code>
                        </dt>
                        <dd className="whitespace-pre-wrap text-[13px] leading-relaxed">
                          {Array.isArray(item.value) ? (
                            item.value.length === 0 ? (
                              <span className="text-neutral-400">(빈 배열)</span>
                            ) : (
                              <ul className="list-inside list-disc">
                                {item.value.map((one, index) => (
                                  <li key={index}>{String(one)}</li>
                                ))}
                              </ul>
                            )
                          ) : String(item.value ?? '').trim() === '' ? (
                            <span className="text-neutral-400">(비어 있음)</span>
                          ) : (
                            String(item.value)
                          )}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
              </li>
            ))}
          </ul>
        )}

        <p className="text-[11px] text-neutral-400">
          본문을 열면 누가 · 언제 · 무엇을 봤는지 감사 로그에 남습니다
          (COM-007 §7-3).
        </p>
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
