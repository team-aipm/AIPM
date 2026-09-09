/**
 * RPT-002 리포트 상세 · `/parent/reports/[reportId]` (DEV-002)
 *
 * 07 이 만든 주간 리포트를 그대로 보여준다. **부모 어휘로 쓴다.**
 *
 * 남의 리포트를 열려 해도 RLS 가 행을 안 돌려주므로 "없음" 이 된다
 * (learning_report_select_own).
 */

import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: '주간 리포트 · 메티' };

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value : null;

const list = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

function Block({ title, body }: { title: string; body: string | null }) {
  if (body === null) return null;
  return (
    <section className="flex flex-col gap-1.5 rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="text-[12px] font-bold text-meti-sub">{title}</h2>
      <p className="text-[14px] leading-relaxed text-meti-ink">{body}</p>
    </section>
  );
}

function Bullets({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <section className="flex flex-col gap-2 rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="text-[12px] font-bold text-meti-sub">{title}</h2>
      <ul className="flex flex-col gap-1.5">
        {items.map((item, index) => (
          <li key={index} className="text-[14px] leading-relaxed text-meti-ink">
            · {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ reportId: string }>;
}) {
  const { reportId } = await params;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (auth.user === null) redirect('/login');

  const { data, error } = await supabase
    .from('learning_report')
    .select('*')
    .eq('report_id', reportId)
    .maybeSingle();

  if (error !== null) throw new Error(`리포트를 불러오지 못했습니다: ${error.message}`);
  if (data === null) notFound();

  const report = (data.summary_data as Record<string, unknown>)?.report ?? {};

  return (
    <main className="flex flex-1 flex-col gap-4 px-5 py-8">
      <header className="flex flex-col gap-1">
        <Link href="/parent/reports" className="text-[13px] font-semibold text-meti-sub">
          ‹ 주간 리포트
        </Link>
        <h1 className="text-xl font-extrabold text-meti-ink">
          {data.period_start} ~ {data.period_end}
        </h1>
      </header>

      <Block title="이번 주" body={text((report as Record<string, unknown>).weekly_summary)} />
      <Block title="학습량" body={text((report as Record<string, unknown>).learning_volume)} />
      <Bullets title="잘한 것" items={list((report as Record<string, unknown>).strengths)} />
      <Bullets title="나아진 것" items={list((report as Record<string, unknown>).improvements)} />
      <Bullets
        title="자주 막힌 부분"
        items={list((report as Record<string, unknown>).areas_to_watch)}
      />
      <Block
        title="스스로 고치기"
        body={text((report as Record<string, unknown>).self_correction)}
      />
      <Block
        title="도움의 변화"
        body={text((report as Record<string, unknown>).support_change)}
      />
      <Bullets
        title="다음 주에 볼 것"
        items={list((report as Record<string, unknown>).next_week_focus)}
      />
      <Block
        title="보호자님께"
        body={text((report as Record<string, unknown>).parent_message)}
      />
    </main>
  );
}
