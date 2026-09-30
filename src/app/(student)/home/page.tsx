/**
 * STU-004 학생 HOME · `/home` (DEV-002)
 *
 * Figma `홈 · 01 첫 사용자` · `02 진행 중` · `03 보상 미등록` · `04 오늘 미션
 * 완료` 에 맞췄다. **지금 값을 채울 수 있는 것만** 그린다.
 *
 * 연속 학습 칩 · 이번 주 참여 도장 · 약속한 보상의 진척은 뺐다. 도장 ·
 * 보상은 COM-002 §22 에 있지만 아직 테이블도 service 도 없다. 숫자를
 * 지어내 보여 주면 되는 것처럼 보이고, 나중에 그걸 지우는 일이 더 크다.
 * 보상 카드는 지금 사실인 「보상 미등록」 상태로만 둔다.
 *
 * 주말(「오늘은 자유롭게 학습해요」)과 지난 미션 링크도 아직 없다 —
 * 평일 · 주말 분기와 지난 미션 목록(STU-006)이 먼저다(COM-001 §11-1 · §11-2).
 */

import Image from 'next/image';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireChild } from '@/lib/services/viewer';
import { getStudent } from '@/lib/services/student';
import { findTodaySession, hasEarlierSession } from '@/lib/services/learning-session';
import { PARTNER_NAME, TERMS } from '@/lib/constants/copy';
import { STUDENT_COOKIE } from '@/lib/constants/student-cookie';
import { PartnerFace } from '@/components/ui/PartnerFace';
import { BrandButton } from '@/components/ui/BrandButton';
import { PartnerFigure } from '@/components/student/PartnerFigure';
import { StudentBottomNav } from './_components/StudentBottomNav';
import { startMission, leaveApp } from './_actions';

export const metadata = { title: '오늘의 미션 · 메티' };

export default async function HomePage() {
  // **아이만 들어온다.** 부모는 부모 홈으로 돌아간다(COM-003 §4.2 의
  // 사용자 칸이 「학생」이다).
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

  /**
   * 세 조회를 **한꺼번에** 보낸다. 하나씩 기다리면 Supabase 왕복(약 0.15초)이
   * 세 번 쌓인다. 「한 번이라도 한 적 있나」 는 오늘 기록이 있으면 버려지지만,
   * 같이 보내면 시간은 들지 않는다.
   *
   * 쿠키에 남의 학생 id 가 들어 있으면 RLS 가 세 조회 모두 비워 돌려주고,
   * `student` 가 null 이 된다. 고르는 화면으로 돌려보내는 것으로 충분하다 —
   * 무엇이 잘못됐는지 알려 줄 필요가 없다.
   */
  const [student, session, hasEarlier] = await Promise.all([
    getStudent(supabase, studentId),
    findTodaySession(supabase, studentId),
    hasEarlierSession(supabase, studentId),
  ]);
  if (student === null) redirect('/students');

  const done = session?.completed_problem_count ?? 0;
  const target = session?.target_problem_count ?? 10;
  const partner = PARTNER_NAME[student.persona_type];

  const finished = session?.session_status === 'completed';
  // 「첫 미션」 은 오늘뿐 아니라 **한 번도** 시작한 적이 없을 때다(COM-003 §4.2).
  const firstEver = session === null && !hasEarlier;

  const greeting = firstEver
    ? '첫 미션을 시작해 볼까?'
    : finished
      ? '오늘 미션 다 끝냈어!'
      : `오늘도 ${partner}랑 생각해 보자`;

  const startLabel = firstEver
    ? `첫 ${TERMS.startLearning.student}`
    : session === null
      ? TERMS.startLearning.student
      : TERMS.resumeLearning.student;

  return (
    <main className="flex flex-1 flex-col gap-5 px-5 pt-4 pb-[120px]">
      <header className="flex items-center gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-brand">
          <PartnerFace persona={student.persona_type} size={44} />
        </span>
        <div className="flex flex-col gap-0.5">
          <h1 className="text-[20px] leading-7 font-semibold text-text-primary">
            반가워, {student.nickname}!
          </h1>
          <p className="text-[14px] leading-5 text-text-secondary">{greeting}</p>
        </div>
      </header>

      <section className="relative flex flex-col gap-3.5 rounded-3xl bg-surface-brand px-5 pt-5 pb-4">
        <PartnerFigure
          persona={student.persona_type}
          size={80}
          className="pointer-events-none absolute top-3 right-4"
        />

        <h2 className="text-[14px] leading-5 font-semibold text-button-primary">오늘의 미션</h2>

        <p className="flex items-baseline gap-1.5">
          <span className="text-[32px] leading-10 font-bold text-text-primary">{done}</span>
          <span className="text-[20px] leading-7 font-semibold text-meti-hint">/ {target}</span>
        </p>

        {/* 미션 10칸. 끝낸 칸 · 지금 칸 · 남은 칸 */}
        <ol className="flex justify-between" aria-label={`오늘의 미션 ${target}개 중 ${done}개`}>
          {Array.from({ length: target }, (_, idx) => {
            const step = idx + 1;
            const isDone = step <= done;
            const isCurrent = !finished && step === done + 1;
            return (
              <li
                key={step}
                className={`flex size-6 items-center justify-center rounded-full text-[12px] leading-[18px] ${
                  isDone
                    ? 'bg-button-primary text-white'
                    : isCurrent
                      ? 'border-2 border-button-primary bg-surface-primary text-button-primary'
                      : 'bg-surface-primary'
                }`}
              >
                {isDone ? '✓' : isCurrent ? step : null}
              </li>
            );
          })}
        </ol>

        {/* 코인은 미션마다 10개, 도장은 10개를 다 했을 때만(COM-001 §11-A) */}
        {finished ? (
          <p className="text-[14px] leading-5 text-text-secondary">
            오늘 미션 완료! 내일 새로운 미션이 기다리고 있어
          </p>
        ) : session !== null ? (
          <p className="text-[14px] leading-5 text-text-secondary">
            완료한 {done}개는 {done * 10}코인 · {target}/{target}이면 도장 1개
          </p>
        ) : null}

        {/*
          **끝낸 아이에게 더 하라고 권하지 않는다**(COM-001 §11-2). 오늘 몫을
          마치면 주 행동은 「오늘의 기록 보기」 로 바뀐다(COM-003 §4.2).
        */}
        {finished ? (
          <Link
            href="/home/today"
            className="flex h-[52px] w-full items-center justify-center rounded-lg bg-button-primary px-5 text-[16px] leading-6 font-semibold text-white hover:bg-button-hover active:bg-button-pressed"
          >
            {TERMS.learningResult.student} 보기
          </Link>
        ) : (
          <form action={startMission}>
            <BrandButton>{startLabel}</BrandButton>
          </form>
        )}

        {/* Figma 에서 「지난 미션」 줄이 있는 자리. 지난 미션 목록이 생기기 전까지 오늘의 기록으로 간다 */}
        {!finished && session !== null && (
          <Link
            href="/home/today"
            className="flex items-center gap-2 rounded-xl bg-surface-primary py-3 pr-2.5 pl-3.5"
          >
            <span className="flex-1 text-[14px] leading-5 text-text-primary">
              {TERMS.learningResult.student} 보기
            </span>
            <Image src="/icons/chevron-right.svg" alt="" width={20} height={20} />
          </Link>
        )}
      </section>

      {/* 보상 · Figma `03 보상 미등록`. 진척 숫자는 보상 테이블이 생긴 뒤에 */}
      <section className="rounded-3xl border border-meti-line bg-surface-primary p-5">
        <div className="flex items-center gap-3 rounded-xl bg-background-primary p-3">
          <Image src="/icons/reward-diamond.png" alt="" width={28} height={28} />
          <div className="flex flex-col gap-0.5">
            <p className="text-[14px] leading-5 font-semibold text-text-primary">
              부모님과 보상을 정해 봐
            </p>
            <p className="text-[12px] leading-[18px] text-text-secondary">
              오늘 미션 {target}개를 모두 끝내면 보상이 가까워져
            </p>
          </div>
        </div>
      </section>

      {/*
        **파트너는 아이가 고른다**(COM-003 §4.2 「학생 HOME … Persona 변경」).
        아이 계정에는 나가는 문이 여기뿐이다 — 부모 영역의 「계정 관리」 에
        못 들어간다.
      */}
      <div className="flex items-center justify-between px-1">
        <Link
          href="/onboarding/persona"
          className="text-[14px] leading-5 font-semibold text-text-secondary underline"
        >
          파트너 바꾸기
        </Link>
        <form action={leaveApp}>
          <button
            type="submit"
            className="text-[14px] leading-5 font-semibold text-text-secondary underline"
          >
            나가기
          </button>
        </form>
      </div>

      <StudentBottomNav persona={student.persona_type} />
    </main>
  );
}
