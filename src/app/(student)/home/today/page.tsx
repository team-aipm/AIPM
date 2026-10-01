/**
 * STU-005 오늘의 기록 · `/home/today` (DEV-002)
 *
 * Figma `03 · Daily Completion · 오늘의 미션 10개 완료 · 홈으로` 에 맞췄다.
 * 오늘 몫을 다 끝냈으면 그 화면 그대로, 아직이면 같은 부품으로 지금까지의
 * 기록을 보여 준다.
 *
 * **학생 화면이다.** 상세 평가점수와 Logic Gap 은 나가지 않는다(COM-003).
 * 여기 나오는 것은 무엇을 했는지와, 하루를 마쳤을 때 파트너가 건네는 한
 * 마디뿐이다.
 *
 * `needs_review` 를 "실패" 로 쓰지 않는다 — `copy.ts` 가 「한 번 더 도전」
 * 으로 옮긴다.
 *
 * **끝낸 아이의 주 행동은 「홈으로」 하나다.** 지난 미션을 권하지 않는다
 * (COM-001 §11-2 · FIGMA-MD-AUDIT P1-2).
 */

import Image from 'next/image';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireChild } from '@/lib/services/viewer';
import { getStudent } from '@/lib/services/student';
import { findTodaySession, today } from '@/lib/services/learning-session';
import { listTodayProblems } from '@/lib/services/problem-list';
import { stampedOn } from '@/lib/services/reward';
import { findDailyReport } from '@/lib/services/learning-report';
import { problemStatusLabel, learningModeLabel, PARTNER_NAME, TERMS } from '@/lib/constants/copy';
import { STUDENT_COOKIE } from '@/lib/constants/student-cookie';
import { BackBar } from '@/components/ui/BackBar';
import { PartnerFigure } from '@/components/student/PartnerFigure';

export const metadata = { title: '오늘의 기록 · 메티' };

/** 06 이 낸 학생용 한 마디. 없으면 그 자리를 그리지 않는다 */
function endSummaryOf(summary: unknown): string | null {
  if (typeof summary !== 'object' || summary === null) return null;
  const value = (summary as Record<string, unknown>).student_end_summary;
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

const BUTTON =
  'flex h-[52px] w-full items-center justify-center rounded-lg bg-button-primary px-5 text-[16px] leading-6 font-semibold text-white hover:bg-button-hover active:bg-button-pressed';

export default async function TodayPage() {
  const me = await requireChild();

  const supabase = await createClient();
  const jar = await cookies();
  /**
   * 쿠키가 없으면 **자기 자신으로 본다.**
   *
   * 「지금 공부하는 아이」 쿠키는 30일짜리다. 만료되거나 지워지면 로그인은
   * 돼 있는데 홈에 못 들어가고 `/students` 로 튕겼다 — 아이 계정에는 고를
   * 다른 학생이 없으므로 물어볼 이유가 없다.
   */
  const studentId = jar.get(STUDENT_COOKIE)?.value ?? me.studentId;
  if (studentId === '') redirect('/students');

  // 서로 기다릴 필요가 없는 셋은 한꺼번에 보낸다(학생 HOME 과 같은 이유).
  // 남의 학생 id 면 RLS 가 모두 비워 돌려주고 `student` 가 null 이 된다.
  const date = today();
  const [student, session, report, stampedToday] = await Promise.all([
    getStudent(supabase, studentId),
    findTodaySession(supabase, studentId),
    findDailyReport(supabase, studentId, date),
    stampedOn(supabase, studentId, date),
  ]);
  if (student === null) redirect('/students');

  const problems = session === null ? [] : await listTodayProblems(supabase, session.session_id);
  const endSummary = report === null ? null : endSummaryOf(report.summary_data);

  const partner = PARTNER_NAME[student.persona_type];
  // 진행 중인 문제는 아직 결과가 아니다. 목록에 넣지 않는다.
  const done = problems.filter((item) => item.status !== 'active');

  /**
   * 「끝낸 미션」 은 세션의 완료 수다. `system_interrupted` 처럼 우리 쪽이
   * 끊긴 문제는 여기 들어가지 않는다(COM-001 §19) — 목록 길이로 세면 들어간다.
   * 코인은 그 수에 10 씩, 하루 최대 100 이다(COM-001 §11-A).
   */
  const target = session?.target_problem_count ?? 10;
  const finishedCount = session?.completed_problem_count ?? 0;
  const coins = Math.min(finishedCount, target) * 10;
  const finished = session?.session_status === 'completed';
  /*
    「도장 1개」 는 **실제로 받았을 때만** 보여 준다. 주말이거나 지급이 아직
    안 됐으면 숨긴다 — 받지 않은 도장을 받았다고 말하지 않는다(COM-002 §22-1).
  */
  const stamped = finished && stampedToday;

  return (
    <main className="flex flex-1 flex-col bg-surface-primary">
      {!finished && <BackBar href="/home" label="홈으로 돌아가기" />}

      <div className="flex flex-1 flex-col gap-4 px-5 pb-6">
        {finished ? (
          <>
            {/* 축하 캐릭터 · Figma 240×220, 원 200, 캐릭터 180 */}
            <div className="relative mx-auto mt-14 h-[220px] w-[240px]">
              <span className="absolute top-2.5 left-5 size-[200px] rounded-full bg-surface-brand" />
              <PartnerFigure
                persona={student.persona_type}
                pose="celebrate"
                size={180}
                className="absolute top-5 left-[30px]"
              />
              <Image src="/icons/star-candy.png" alt="" width={36} height={36} className="absolute top-[30px] left-0" />
              <Image src="/icons/star-candy.png" alt="" width={32} height={32} className="absolute top-1 left-[196px]" />
              <Image src="/icons/star-candy.png" alt="" width={26} height={26} className="absolute top-[150px] left-[210px]" />
              <Image src="/icons/star-candy.png" alt="" width={22} height={22} className="absolute top-[170px] left-3.5" />
            </div>
            <h1 className="text-center text-[28px] leading-9 font-bold text-text-primary">
              오늘의 미션 완료!
            </h1>

            {/* 도장과 코인은 따로 보여 준다 — 쓰임이 다르다(COM-003 §4.9 문구) */}
            <div className="grid grid-cols-2 gap-3">
              {stamped && (
                <p className="flex h-16 items-center justify-center gap-2 rounded-2xl bg-background-primary p-3 text-[18px] leading-7 text-text-secondary">
                  <Image src="/icons/mission-stamp.png" alt="" width={32} height={32} />
                  도장 1개
                </p>
              )}
              <p
                className={`flex h-16 items-center justify-center gap-2 rounded-2xl bg-background-primary p-3 text-[18px] leading-7 text-text-secondary ${
                  stamped ? '' : 'col-span-2'
                }`}
              >
                <Image src="/icons/reward-coin.png" alt="" width={32} height={32} />
                코인 {coins}개
              </p>
            </div>
          </>
        ) : (
          <h1 className="pt-2 text-[24px] leading-8 font-bold text-text-primary">
            {TERMS.learningResult.student}
          </h1>
        )}

        {/*
          Figma 의 두 번째 칸 「내가 설명한 미션」 은 셀 기준이 COM 문서에 없다.
          끝낸 뒤에는 한 칸만, 하는 중에는 모은 코인을 옆에 둔다.
        */}
        <div className="grid grid-cols-2 gap-3">
          <div
            className={`flex flex-col items-center gap-1 rounded-2xl bg-background-primary py-4 ${
              finished ? 'col-span-2' : ''
            }`}
          >
            <p className="text-[24px] leading-8 font-bold text-button-primary">{finishedCount}개</p>
            <p className="text-[14px] leading-5 text-text-secondary">끝낸 미션</p>
          </div>
          {!finished && (
            <div className="flex flex-col items-center gap-1 rounded-2xl bg-background-primary py-4">
              <p className="text-[24px] leading-8 font-bold text-button-primary">{coins}개</p>
              <p className="text-[14px] leading-5 text-text-secondary">오늘 모은 코인</p>
            </div>
          )}
        </div>

        {endSummary !== null && (
          <section className="flex flex-col gap-1 rounded-2xl bg-background-primary px-4 py-3.5">
            <p className="text-[14px] leading-5 font-semibold text-button-primary">오늘의 성취</p>
            <p className="text-[16px] leading-6 font-semibold text-text-primary">{endSummary}</p>
          </section>
        )}

        {done.length === 0 ? (
          <p className="rounded-2xl bg-background-primary p-5 text-[14px] leading-5 text-text-secondary">
            오늘은 아직 시작하지 않았어.
            <br />
            {partner}가 기다리고 있어!
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {done.map((item, index) => (
              <li
                key={item.problemId}
                className="rounded-2xl border border-meti-line bg-surface-primary p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[12px] leading-[18px] font-semibold text-text-secondary">
                    {index + 1}번째 ·{' '}
                    {learningModeLabel(
                      item.learningMode === 'mode_b' ? 'mode_b' : 'mode_a',
                      'student',
                      partner,
                    )}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[12px] leading-[18px] font-semibold ${
                      item.status === 'completed'
                        ? 'bg-surface-brand text-button-primary'
                        : 'bg-background-primary text-text-secondary'
                    }`}
                  >
                    {problemStatusLabel(item.status, 'student')}
                  </span>
                </div>
                <p className="mt-2 text-[14px] leading-5 text-text-primary">{item.problemText}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/*
        아래 버튼은 붙어 있고 기록 목록은 그 밑으로 지나간다. 경계가 없으면
        카드가 버튼에 잘려 겹친 것처럼 보여서, 위쪽 24px 을 바탕색으로
        스며들게 한다. 내용이 짧으면 흰 바탕 위라 보이지 않는다.
      */}
      <div className="sticky bottom-0 bg-surface-primary px-5 pt-4 pb-[max(34px,env(safe-area-inset-bottom))] before:pointer-events-none before:absolute before:inset-x-0 before:-top-6 before:h-6 before:bg-linear-to-t before:from-surface-primary before:to-transparent">
        {finished ? (
          <Link href="/home" className={BUTTON}>
            홈으로
          </Link>
        ) : session !== null ? (
          <Link href="/mission" className={BUTTON}>
            {TERMS.resumeLearning.student}
          </Link>
        ) : (
          <Link href="/home" className={BUTTON}>
            홈으로
          </Link>
        )}
      </div>
    </main>
  );
}
