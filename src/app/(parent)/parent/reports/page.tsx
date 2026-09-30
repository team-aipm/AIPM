/**
 * RPT-001 주간 성장 리포트 · `/parent/reports` (DEV-002)
 *
 * 생김새는 Figma `주간 리포트 · 01 민준 선택`(416:4427) · `04 첫 리포트 전`
 * (416:4550). 아이를 칩으로 고르고, 그 아이의 지난 리포트를 줄로 보여준다.
 *
 * **없는 것을 그럴듯하게 채우지 않는다.** Figma 의 이번 주 도장 줄과
 * 「미션 23개 · 스스로 고친 미션 3개」 는 이번 주(월~일)만 센 값인데 그런
 * 집계가 아직 없다. 기간과 리포트가 나오는 날만 적는다.
 */

import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient, currentUser } from '@/lib/supabase/server';
import { listStudents } from '@/lib/services/student';
import { ChildChips } from '../_components/ChildChips';
import { formatMonday, formatPeriod, thisWeek } from './_components/period';

export const metadata = { title: '주간 리포트 · 메티' };

/** 목록 한 줄 설명. 07 이 쓴 `weekly_summary` 를 그대로 쓴다 */
function headline(summary: unknown): string | null {
  const report = (summary as { report?: { weekly_summary?: unknown } } | null)?.report;
  const value = report?.weekly_summary;
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ child?: string }>;
}) {
  const supabase = await createClient();
  const user = await currentUser();
  if (user === null) redirect('/login');

  const { child } = await searchParams;
  const students = await listStudents(supabase);
  const selected = students.find((item) => item.student_id === child) ?? students[0];

  if (selected === undefined) {
    return (
      <main className="flex flex-1 flex-col gap-4 px-5 pt-3 pb-5">
        <h1 className="text-[24px] leading-8 font-bold text-text-primary">주간 리포트</h1>
        <section className="flex flex-col gap-1.5 rounded-2xl border border-meti-line bg-surface-primary p-4">
          <h2 className="text-[14px] leading-5 font-semibold text-text-secondary">학습 현황과 리포트</h2>
          <p className="text-[14px] leading-5 text-meti-hint">자녀 계정을 만들면 여기에서 볼 수 있어요.</p>
          <Link href="/parent" className="self-start py-3 text-[14px] leading-5 font-semibold text-button-primary">
            홈으로 가기
          </Link>
        </section>
      </main>
    );
  }

  const { data: reports, error } = await supabase
    .from('learning_report')
    .select('report_id, period_start, period_end, summary_data')
    .eq('report_type', 'weekly_parent')
    .eq('student_id', selected.student_id)
    .order('period_end', { ascending: false })
    .limit(10);

  if (error !== null) throw new Error(`리포트를 불러오지 못했습니다: ${error.message}`);

  const rows = reports ?? [];
  const week = thisWeek();
  const name = selected.nickname;

  return (
    <main className="flex flex-1 flex-col gap-4 px-5 pt-3 pb-5">
      <h1 className="text-[24px] leading-8 font-bold text-text-primary">{name}의 리포트</h1>

      <ChildChips
        base="/parent/reports"
        items={students.map((item) => ({ id: item.student_id, name: item.nickname }))}
        selectedId={selected.student_id}
      />

      {rows.length === 0 ? (
        <>
          <section className="flex flex-col items-center gap-2.5 rounded-2xl border border-meti-line bg-surface-primary px-4 py-7 text-center">
            <Image src="/characters/meti-think.png" alt="" width={96} height={96} />
            <h2 className="text-[16px] leading-6 font-semibold text-text-primary">첫 리포트를 준비하고 있어요</h2>
            {/*
              Figma 의 「3일 이상 미션을 하면 더 정확하게」 는 적지 않는다.
              리포트 배치는 하루만 해도 만든다 — 기준이 없는 약속이 된다.
            */}
            <p className="text-[14px] leading-5 text-text-secondary">
              {name}의 첫 주간 리포트는 {formatMonday(week.nextMonday)} 아침에 나와요.
            </p>
          </section>
          <section className="flex flex-col gap-1.5 rounded-2xl bg-surface-brand p-4">
            <h2 className="text-[14px] leading-5 font-semibold text-button-primary">리포트에는 이런 내용이 담겨요</h2>
            {/* 상세 화면이 실제로 그리는 칸만 적는다. Figma 의 출석 · 4단계 · 힌트 수는 아직 데이터가 없다 */}
            <ul className="flex flex-col gap-1.5 text-[14px] leading-5 text-text-primary">
              <li>· AI가 정리한 잘한 점 · 어려워한 점 · 다음 주 추천</li>
              <li>· 학습량과 스스로 고친 과정</li>
              <li>· 도움을 받는 정도의 변화</li>
            </ul>
          </section>
        </>
      ) : (
        <>
          <section className="flex flex-col gap-2.5 rounded-2xl bg-surface-brand p-4">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-[16px] leading-6 font-semibold text-button-primary">이번 주 진행 중</h2>
              <span className="text-[12px] leading-[18px] text-text-secondary">
                {formatPeriod(week.start, week.end)}
              </span>
            </div>
            <p className="text-[14px] leading-5 text-text-secondary">
              전체 리포트는 {formatMonday(week.nextMonday)} 아침에 나와요.
            </p>
          </section>

          <h2 className="text-[16px] leading-6 font-semibold text-text-primary">지난 리포트</h2>
          <ul className="flex flex-col rounded-2xl border border-meti-line bg-surface-primary px-4 py-1">
            {rows.map((report) => {
              const line = headline(report.summary_data);
              return (
                <li key={report.report_id} className="border-meti-line [&+&]:border-t">
                  <Link
                    href={`/parent/reports/${report.report_id}`}
                    className="flex items-center gap-2 py-3"
                  >
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="text-[14px] leading-5 font-semibold text-text-primary">
                        {formatPeriod(report.period_start, report.period_end)}
                      </span>
                      {line !== null && (
                        <span className="truncate text-[12px] leading-[18px] text-text-secondary">{line}</span>
                      )}
                    </span>
                    <Image src="/icons/chevron-right.svg" alt="" width={24} height={24} />
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </main>
  );
}
