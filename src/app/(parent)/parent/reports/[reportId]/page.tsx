/**
 * RPT-002 리포트 상세 · `/parent/reports/[reportId]` (DEV-002)
 *
 * 07 이 만든 주간 리포트를 그대로 보여준다. **부모 어휘로 쓴다.**
 * 생김새는 Figma `주간 리포트 · 03 리포트 전체`(415:4345).
 *
 * Figma 의 숫자 카드(출석 · 완료한 미션 · 메티를 가르친 횟수 · 힌트 사용 ·
 * 하루 평균 학습)와 4단계 능력 막대는 그리지 않는다. 07 이 내는 것은 문장뿐이고,
 * 숫자를 여기서 지어내면 리포트 문장과 어긋난다.
 *
 * 남의 리포트를 열려 해도 RLS 가 행을 안 돌려주므로 "없음" 이 된다
 * (learning_report_select_own).
 */

import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient, currentUser } from '@/lib/supabase/server';
import { TERMS } from '@/lib/constants/copy';
import { getStudent } from '@/lib/services/student';
import { BackBar } from '@/components/ui/BackBar';
import { formatPeriod } from '../_components/period';

export const metadata = { title: '주간 리포트 · 메티' };

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value : null;

const list = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

/** Figma `AI 요약` 안의 `요약 / 잘한 점` 한 칸 */
function Summary({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <h3 className="text-[14px] leading-5 font-semibold text-text-primary">{title}</h3>
      {items.map((item, index) => (
        <p key={index} className="text-[14px] leading-5 text-text-secondary">
          {item}
        </p>
      ))}
    </div>
  );
}

/** 섹션 제목 + 흰 카드 */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[16px] leading-6 font-semibold text-text-primary">{title}</h2>
      <div className="flex flex-col gap-2 rounded-2xl border border-meti-line bg-surface-primary p-4">
        {children}
      </div>
    </section>
  );
}

function Body({ value }: { value: string }) {
  return <p className="text-[14px] leading-5 text-text-primary">{value}</p>;
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((item, index) => (
        <li key={index} className="text-[14px] leading-5 text-text-primary">
          · {item}
        </li>
      ))}
    </ul>
  );
}

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ reportId: string }>;
}) {
  const { reportId } = await params;

  const supabase = await createClient();
  const user = await currentUser();
  if (user === null) redirect('/login');

  const { data, error } = await supabase
    .from('learning_report')
    .select('*')
    .eq('report_id', reportId)
    .maybeSingle();

  if (error !== null) throw new Error(`리포트를 불러오지 못했습니다: ${error.message}`);
  if (data === null) notFound();

  const student = await getStudent(supabase, data.student_id);

  /**
   * 미션이 0개인 주 (COM-003 §4.9). 배치가 모델을 부르지 않고 사실만 남겼다.
   * 학습일 0일과 도장 미획득만 보여주고, 안 한 것을 나무라지 않는다.
   */
  if ((data.summary_data as Record<string, unknown> | null)?.empty_week === true) {
    return (
      <>
        <BackBar href={`/parent/reports?child=${data.student_id}`} label="주간 리포트로 돌아가기" />
        <main className="flex flex-1 flex-col gap-6 px-5 pt-2 pb-8">
          <header className="flex flex-col gap-1">
            <p className="text-[12px] leading-[18px] text-text-secondary">
              {formatPeriod(data.period_start, data.period_end)}
            </p>
            <h1 className="text-[24px] leading-8 font-bold text-text-primary">
              {student === null ? '주간 리포트' : `${student.nickname}의 주간 리포트`}
            </h1>
          </header>

          <section className="flex flex-col gap-4 rounded-2xl border border-meti-line bg-surface-primary p-5 shadow-card">
            <p className="text-[16px] leading-6 font-semibold text-text-primary">
              이번 주는 {TERMS.learning.parent}한 날이 없어요
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col items-center gap-1 rounded-2xl bg-background-primary py-4">
                <p className="text-[24px] leading-8 font-bold text-button-primary">0일</p>
                <p className="text-[14px] leading-5 text-text-secondary">{TERMS.learning.parent}일</p>
              </div>
              <div className="flex flex-col items-center gap-1 rounded-2xl bg-background-primary py-4">
                <p className="text-[24px] leading-8 font-bold text-button-primary">0개</p>
                <p className="text-[14px] leading-5 text-text-secondary">참여 도장</p>
              </div>
            </div>
            <p className="text-[14px] leading-5 text-text-secondary">
              알림을 켜 두면 {TERMS.learning.parent}할 시간을 함께 챙길 수 있어요.
            </p>
          </section>

          <Link
            href="/parent/my/notifications"
            className="flex h-[52px] items-center justify-center rounded-lg bg-button-primary px-5 text-[16px] leading-6 font-semibold text-white transition-colors hover:bg-button-hover active:bg-button-pressed"
          >
            알림 설정 확인하기
          </Link>
        </main>
      </>
    );
  }

  const report = ((data.summary_data as Record<string, unknown>)?.report ?? {}) as Record<
    string,
    unknown
  >;

  const summary = text(report.weekly_summary);
  const strengths = list(report.strengths);
  const watch = list(report.areas_to_watch);
  const next = list(report.next_week_focus);
  const volume = text(report.learning_volume);
  const improvements = list(report.improvements);
  const selfCorrection = text(report.self_correction);
  const support = text(report.support_change);
  const message = text(report.parent_message);

  return (
    <>
      {/* Figma `Top App Bar` 는 가운데 제목이 있다. BackBar 는 화살표뿐이라 제목은 아래 본문 제목이 맡는다 */}
      <BackBar href={`/parent/reports?child=${data.student_id}`} label="주간 리포트로 돌아가기" />

      <main className="flex flex-1 flex-col gap-6 px-5 pt-2 pb-8">
        <header className="flex flex-col gap-1">
          <p className="text-[12px] leading-[18px] text-text-secondary">
            {formatPeriod(data.period_start, data.period_end)}
          </p>
          <h1 className="text-[24px] leading-8 font-bold text-text-primary">
            {student === null ? '주간 리포트' : `${student.nickname}의 주간 리포트`}
          </h1>
        </header>

        {(summary !== null || strengths.length + watch.length + next.length > 0) && (
          <section className="flex flex-col gap-3 rounded-2xl bg-surface-brand p-4">
            <div className="flex items-center gap-1.5">
              <h2 className="text-[16px] leading-6 font-semibold text-button-primary">이번 주 한눈에</h2>
              <span className="rounded-xl p-2 text-[14px] leading-5 font-semibold text-button-primary">
                AI 분석
              </span>
            </div>
            {summary !== null && <p className="text-[14px] leading-5 text-text-primary">{summary}</p>}
            <Summary title="잘한 점" items={strengths} />
            <Summary title="어려워한 점" items={watch} />
            <Summary title="다음 주 추천" items={next} />
          </section>
        )}

        {volume !== null && (
          <Section title="학습량">
            <Body value={volume} />
          </Section>
        )}

        {improvements.length > 0 && (
          <Section title="나아진 것">
            <Bullets items={improvements} />
          </Section>
        )}

        {selfCorrection !== null && (
          <Section title="스스로 고치기">
            <Body value={selfCorrection} />
          </Section>
        )}

        {support !== null && (
          <Section title="도움의 변화">
            <Body value={support} />
          </Section>
        )}

        {message !== null && (
          <Section title="보호자님께">
            <Body value={message} />
            <p className="text-[12px] leading-[18px] text-meti-hint">
              이 내용은 아이 화면에 보이지 않아요. 아이에게 부담을 주지 않도록 칭찬 위주로
              이야기해 주세요.
            </p>
          </Section>
        )}
      </main>
    </>
  );
}
