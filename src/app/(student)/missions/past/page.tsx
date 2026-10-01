/**
 * STU-006 지난 미션 · `/missions/past` (DEV-002 · COM-001 §11-2)
 *
 * 못 끝낸 평일 미션을 **7일 안에** 이어서 한다. Figma `지난 미션` 다섯 상태
 * (559:3395 기본 · 559:3450 불러오는 중 · 559:3504 빈 목록 · 559:3563 오류 ·
 * 559:3616 만료). 불러오는 중 · 오류는 옆의 `loading.tsx` · `error.tsx` 다.
 *
 * - **가장 최근에 못 끝낸 미션 하나**를 큰 카드로 먼저 둔다. 나머지는 줄이다.
 *   아이가 어디부터 할지 고민하게 만들지 않는다(COM-003 STU-006).
 * - 「오늘의 도장과 코인에 포함되지 않아」를 적는다. 안 적으면 도장을 기대한다.
 * - 만료를 실패처럼 그리지 않는다. 흐리게 두고 「진행 기간이 끝났어」.
 * - Figma 줄의 「· 분수의 덧셈」 같은 개념 이름은 쓰지 않는다 — 학생 화면에
 *   수학 개념명을 내보이지 않는다.
 *
 * 들어오는 길은 홈의 「○월 ○일 미션도 남아 있어」 하나다. 아이가 직접 누를
 * 때만 온다 — 오늘 미션을 끝낸 아이에게는 홈이 이 줄을 보여주지 않는다.
 */

import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireChild } from '@/lib/services/viewer';
import { listPastSessions, PAST_DAYS, type PastSession } from '@/lib/services/learning-session';
import { STUDENT_COOKIE } from '@/lib/constants/student-cookie';
import { BrandButton } from '@/components/ui/BrandButton';
import { PartnerFigure } from '@/components/student/PartnerFigure';
import { getStudent } from '@/lib/services/student';
import { continuePastMission } from '../../home/_actions';
import { PastTopBar } from './_components/PastTopBar';

export const metadata = { title: '지난 미션 · 메티' };

function dayLabel(date: string): string {
  return `${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일`;
}

/** 「내일까지 할 수 있어」 · 「3일 뒤 만료」 · 「오늘까지만 할 수 있어」 */
function untilLabel(daysLeft: number): string {
  if (daysLeft <= 0) return '오늘까지만 할 수 있어';
  if (daysLeft === 1) return '내일까지 할 수 있어';
  return `${daysLeft}일 뒤 만료`;
}

const left = (session: PastSession) => session.target_problem_count - session.completed_problem_count;

export default async function PastMissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ expired?: string }>;
}) {
  const me = await requireChild();
  const supabase = await createClient();
  const jar = await cookies();
  const studentId = jar.get(STUDENT_COOKIE)?.value ?? me.studentId;

  const [student, { open, expired }, { expired: tapped }] = await Promise.all([
    getStudent(supabase, studentId),
    listPastSessions(supabase, studentId),
    searchParams,
  ]);
  if (student === null) redirect('/students');

  // 이어하기를 눌렀는데 그 사이 기한이 지났다(`continuePastMission`). 그 하나를 만료로 보여준다.
  const gone = tapped === undefined ? null : (expired.find((session) => session.session_id === tapped) ?? null);

  if (gone !== null) {
    return (
      <main className="flex flex-1 flex-col">
        <PastTopBar />
        <div className="flex flex-col gap-3 px-5 py-6">
          <h1 className="text-[24px] leading-8 font-bold text-text-primary">기간이 지난 미션</h1>
          <p className="text-[14px] leading-5 text-text-secondary">
            지난 미션은 생성된 날부터 {PAST_DAYS}일 동안 이어서 할 수 있어.
          </p>
          <div className="flex flex-col gap-1.5 rounded-2xl border border-meti-line bg-surface-primary/60 p-4">
            <p className="text-[20px] leading-7 font-semibold text-meti-hint">
              {dayLabel(gone.session_date)} · {left(gone)}개 남음
            </p>
            <p className="text-[14px] leading-5 text-meti-hint">진행 기간이 끝났어</p>
            <p className="text-[12px] leading-[18px] text-meti-off">더 이상 시작할 수 없어</p>
          </div>
          <Link
            href="/home"
            className="mx-auto mt-1 flex h-[52px] w-[162px] items-center justify-center rounded-lg border border-meti-line bg-surface-primary text-[16px] leading-6 font-semibold text-text-primary"
          >
            홈으로
          </Link>
        </div>
      </main>
    );
  }

  if (open.length === 0) {
    return (
      <main className="flex flex-1 flex-col">
        <PastTopBar />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-5 pb-24 text-center">
          <PartnerFigure persona={student.persona_type} size={72} />
          <h1 className="mt-2 text-[20px] leading-7 font-bold text-text-primary">지금 이어서 할 지난 미션이 없어</h1>
          <p className="text-[14px] leading-5 text-text-secondary">오늘의 미션이나 새 미션을 시작할 수 있어.</p>
          <Link
            href="/home"
            className="mt-2 flex h-[52px] w-[162px] items-center justify-center rounded-lg border border-meti-line bg-surface-primary text-[16px] leading-6 font-semibold text-text-primary"
          >
            홈으로
          </Link>
        </div>
      </main>
    );
  }

  const [first, ...rest] = open;
  const firstDone = Math.round((first.completed_problem_count / first.target_problem_count) * 100);

  return (
    <main className="flex flex-1 flex-col">
      <PastTopBar />
      <div className="flex flex-col gap-3 px-5 py-6">
        <h1 className="text-[24px] leading-8 font-bold text-text-primary">남은 지난 미션</h1>
        <p className="text-[14px] leading-5 text-text-secondary">최근 {PAST_DAYS}일 안에 남은 미션만 모았어.</p>
        <p className="text-[12px] leading-[18px] text-meti-hint">지난 미션은 오늘의 도장과 코인에 포함되지 않아.</p>

        <p className="mt-1 text-[14px] leading-5 font-semibold text-meti-hint">먼저 이어갈 미션</p>
        <form
          action={continuePastMission}
          className="flex flex-col gap-2.5 rounded-2xl border border-meti-line bg-surface-primary p-4"
        >
          <input type="hidden" name="session_id" value={first.session_id} />
          <p className="text-[20px] leading-7 font-semibold text-text-primary">
            {dayLabel(first.session_date)} · {left(first)}개 남음
          </p>
          <p className="text-[14px] leading-5 text-text-secondary">{untilLabel(first.daysLeft)}</p>
          <p className="text-[12px] leading-[18px] text-meti-hint">
            {first.completed_problem_count}/{first.target_problem_count} 완료
          </p>
          <div
            className="h-2 overflow-hidden rounded bg-meti-line"
            role="progressbar"
            aria-valuenow={firstDone}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="h-full rounded bg-button-primary" style={{ width: `${firstDone}%` }} />
          </div>
          <BrandButton>{left(first)}개 이어하기</BrandButton>
        </form>

        {rest.length > 0 && (
          <>
            <p className="mt-1 text-[14px] leading-5 font-semibold text-meti-hint">다른 지난 미션</p>
            {rest.map((session) => (
              <form
                key={session.session_id}
                action={continuePastMission}
                className="flex items-center justify-between gap-3 rounded-2xl border border-meti-line bg-surface-primary px-4 py-3.5"
              >
                <input type="hidden" name="session_id" value={session.session_id} />
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="text-[20px] leading-7 font-semibold text-text-primary">
                    {dayLabel(session.session_date)} · {left(session)}개 남음
                  </p>
                  <p className="text-[14px] leading-5 text-text-secondary">{untilLabel(session.daysLeft)}</p>
                  <p className="text-[12px] leading-[18px] text-meti-hint">
                    {session.completed_problem_count}/{session.target_problem_count} 완료
                    {session.daysLeft <= 0 ? ' · 만료 임박' : ''}
                  </p>
                </div>
                <div className="w-[84px] shrink-0">
                  <BrandButton tone="neutral" size="sm">
                    이어하기
                  </BrandButton>
                </div>
              </form>
            ))}
          </>
        )}
      </div>
    </main>
  );
}
