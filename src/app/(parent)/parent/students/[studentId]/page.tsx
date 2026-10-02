/**
 * PAR-003 자녀 학습 상세 · `/parent/students/[studentId]` (DEV-002 · COM-003)
 *
 * Figma `보호자 홈 · 06 자녀 학습 상세`(587:6653): 오늘의 학습 · 오늘의 이해 상태
 * · 최근 7일. 그 아래 「성장 추이」(COM-003 PAR-003 · 2026-10-02)를 둔다.
 *
 * - 부모 HOME 의 아이 카드는 여기로 온다. 학생 화면으로 넘어가지 않는다.
 * - AI 대화 원문과 찍은 사진은 보여주지 않는다(COM-007).
 * - 계정 수정 · 비밀번호 · 삭제는 여기가 아니라 MY-003 이다.
 * - 부모 화면이라 「학습」이라 부른다. 다만 미션 · 도장 · 코인은 Figma 보호자
 *   화면도 그 말을 그대로 쓴다.
 */

import { notFound, redirect } from 'next/navigation';
import { createClient, currentUser } from '@/lib/supabase/server';
import { getStudent } from '@/lib/services/student';
import { childGrowth, childToday, type DayRow } from '@/lib/services/child-progress';
import { MyTopBar } from '../../my/_components/MyTopBar';
import { GrowthCard } from './_components/GrowthCard';

export const metadata = { title: '자녀 학습 상세 · 메티' };

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];

function short(date: string): string {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))} ${WEEKDAY[day]}`;
}

function stampWord(day: DayRow, isToday: boolean): string {
  if (day.stamped) return '도장';
  if (day.weekend) return '주말';
  if (isToday) return day.done >= day.target ? '도장 확인 중' : '도장 전';
  return '-';
}

export default async function ChildDetailPage({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;
  const supabase = await createClient();
  const user = await currentUser();
  if (user === null) redirect('/login');

  // 남의 아이면 RLS 가 비워 돌려준다. 있는 척하지 않는다.
  const student = await getStudent(supabase, studentId);
  if (student === null || student.account_id !== user.id) notFound();

  const [todayDetail, growth] = await Promise.all([
    childToday(supabase, studentId),
    childGrowth(supabase, studentId),
  ]);
  const { day } = todayDetail;
  const percent = Math.round((day.done / day.target) * 100);

  return (
    <main className="flex flex-1 flex-col">
      <MyTopBar title={`${student.nickname} 학습 상세`} back="/parent" backLabel="홈으로" />

      <div className="flex flex-col gap-3 px-5 pt-3 pb-8">
        <header className="flex flex-col gap-1">
          <h1 className="text-[24px] leading-8 font-bold text-text-primary">
            {student.nickname} · 초등 {student.grade}학년
          </h1>
          <p className="text-[12px] leading-[18px] text-text-secondary">
            오늘 {Number(todayDetail.date.slice(5, 7))}월 {Number(todayDetail.date.slice(8, 10))}일 · 최근 학습 기준
          </p>
        </header>

        {/* 오늘의 학습 */}
        <section className="flex flex-col gap-2 rounded-2xl border border-meti-line bg-surface-primary p-4">
          <div className="flex items-center gap-2">
            <h2 className="flex-1 text-[16px] leading-6 font-semibold text-text-primary">오늘의 학습</h2>
            <span className="text-[14px] leading-5 text-button-primary">
              {todayDetail.state === 'done' ? '완료' : todayDetail.state === 'progress' ? '진행 중' : '시작 전'}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: '미션', value: `${day.done}/${day.target}` },
              { label: '획득 코인', value: `${day.coins}` },
              { label: '도장', value: day.stamped ? '1개' : day.weekend ? '주말' : '미지급' },
            ].map((item) => (
              <div key={item.label} className="flex flex-col gap-0.5 rounded-xl bg-background-primary px-2 py-1.5">
                <span className="text-[12px] leading-[18px] text-text-secondary">{item.label}</span>
                <span className="text-[16px] leading-6 font-semibold text-text-primary">{item.value}</span>
              </div>
            ))}
          </div>
          <div className="h-2 overflow-hidden rounded-lg bg-background-primary" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-lg bg-button-primary" style={{ width: `${percent}%` }} />
          </div>
          <p className="text-[14px] leading-5 text-text-secondary">10개를 모두 완료하면 평일 도장 1개를 받아요.</p>
        </section>

        {/* 오늘의 이해 상태 · 개념 이름은 부모 화면에만 보인다 */}
        <section className="flex flex-col gap-2 rounded-2xl border border-meti-line bg-surface-primary p-4">
          <h2 className="text-[16px] leading-6 font-semibold text-text-primary">오늘의 이해 상태</h2>
          {todayDetail.state === 'idle' ? (
            <p className="text-[14px] leading-5 text-text-secondary">오늘은 아직 학습을 시작하지 않았어요.</p>
          ) : (
            <dl className="grid grid-cols-[103px_1fr] gap-x-2 gap-y-2">
              {[
                { label: '잘 이해한 개념', value: todayDetail.understood.join(', ') || '—' },
                { label: '헷갈린 개념', value: todayDetail.confused.join(', ') || '—' },
                { label: '스스로 고친 미션', value: `${todayDetail.selfCorrected}개` },
                { label: '다음에 다시 보기', value: todayDetail.reviewNext ?? '—' },
              ].map((row) => (
                <div key={row.label} className="contents">
                  <dt className="py-0.5 text-[14px] leading-5 text-text-secondary">{row.label}</dt>
                  <dd className="text-[16px] leading-6 text-text-primary">{row.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>

        {/* 최근 7일 */}
        <section className="flex flex-col gap-2 rounded-2xl border border-meti-line bg-surface-primary p-4">
          <div className="flex items-center gap-2">
            <h2 className="flex-1 text-[16px] leading-6 font-semibold text-text-primary">최근 7일</h2>
            <span className="text-[12px] leading-[18px] text-text-secondary">오늘부터</span>
          </div>
          <ul className="flex flex-col">
            {todayDetail.recent.map((row, idx) => (
              <li key={row.date} className="grid grid-cols-3 gap-2 py-1 text-[14px] leading-5 text-text-secondary">
                <span>{short(row.date)}</span>
                <span>
                  {row.done}/{row.target} · {row.coins}코인
                </span>
                <span className={row.stamped ? 'font-semibold text-button-primary' : ''}>{stampWord(row, idx === 0)}</span>
              </li>
            ))}
          </ul>
        </section>

        <GrowthCard weeks={growth} />
      </div>
    </main>
  );
}
