/**
 * PAR-002 부모 HOME · `/parent` (DEV-002)
 *
 * "등록 학생들의 현황 확인"(COM-003). 최근 7일을 센다.
 * 생김새는 Figma `보호자 홈 · 01 기본`(404:3365) · `05 자녀 계정 없음`(483:13778).
 *
 * **부모 어휘로 쓴다.** 학생 화면의 「미션」 이 여기서는 「학습」 이고,
 * 「한 번 더 도전」 이 「추가 학습 필요」 다 — 변환은 `copy.ts` 한 곳에서만
 * 한다.
 *
 * 상세 평가점수는 부모에게 보여도 된다(COM-003). 다만 **고칠 수는 없다** —
 * 난이도 · Logic Gap · Student Memory 를 사람이 손대면 다음 문제 선정이
 * 어긋난다(COM-003 §9 · COM-007 §8).
 *
 * 아이가 여럿이면 칩으로 한 명씩 본다(Figma `자녀 선택`). 한 화면에 카드를
 * 다 쌓으면 둘째부터는 스크롤 아래로 밀려 안 보인다.
 *
 * 보상 카드는 Figma 404:3365(진행) · 404:3495(보상 도착)다. 도착한 보상은
 * 부모가 할 일이 있으니 맨 위로 올리고, 진행 중이면 현황 카드 아래에 둔다.
 */

import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { createClient, currentUser } from '@/lib/supabase/server';
import { listStudents } from '@/lib/services/student';
import { summarize, type StudentSummary } from '@/lib/services/parent-summary';
import { rewardBoard, type RewardBoard } from '@/lib/services/reward';
import { GAP_DEFINITIONS } from '@/lib/ai/taxonomy';
import { TERMS, problemStatusLabel } from '@/lib/constants/copy';
import { PartnerFace } from '@/components/ui/PartnerFace';
import { ChildChips } from './_components/ChildChips';
import { HomeRewardCard } from './rewards/_components/RewardCards';

export const metadata = { title: '학습 현황 · 메티' };

/** 자녀는 한 계정에 최대 3명이다(COM-002 §3) */
const MAX_CHILDREN = 3;

const CARD = 'rounded-2xl border border-meti-line bg-surface-primary p-4';

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[12px] leading-[18px] text-text-secondary">{label}</span>
      <span className="text-[16px] leading-6 font-semibold text-text-primary">{value}</span>
    </div>
  );
}

/** 0~2 를 사람이 읽는 말로. 숫자만 두면 무엇에 대한 2 인지 알 수 없다 */
function level(value: number | null): string {
  if (value === null) return '—';
  if (value >= 1.6) return `잘함 (${value.toFixed(1)})`;
  if (value >= 0.8) return `보통 (${value.toFixed(1)})`;
  return `도움 필요 (${value.toFixed(1)})`;
}

function StudentOverview({ summary, reward }: { summary: StudentSummary; reward: ReactNode }) {
  return (
    <>
      <section className={`flex flex-col gap-3 ${CARD}`}>
        <header className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center overflow-hidden rounded-full bg-surface-brand">
            <PartnerFace persona={summary.persona} size={32} />
          </span>
          <div className="flex flex-col">
            <h2 className="text-[16px] leading-6 font-semibold text-text-primary">
              {summary.nickname}의 최근 7일
            </h2>
            <p className="text-[12px] leading-[18px] text-text-secondary">초등 {summary.grade}학년</p>
          </div>
        </header>

        {summary.solved === 0 ? (
          <p className="text-[14px] leading-5 text-text-secondary">
            최근 7일 동안 {TERMS.learning.parent} 기록이 없어요.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3 rounded-lg bg-background-primary p-3">
              <Stat label="학습한 문제" value={`${summary.solved}개`} />
              <Stat label={problemStatusLabel('completed', 'parent')} value={`${summary.completed}개`} />
              <Stat
                label={problemStatusLabel('needs_review', 'parent')}
                value={`${summary.needsReview}개`}
              />
            </div>
            <div className="grid grid-cols-3 gap-3 border-t border-meti-line pt-3">
              <Stat label="근거 설명" value={level(summary.reasoning)} />
              <Stat label="규칙 적용" value={level(summary.rule)} />
              <Stat label="스스로 고침" value={`${summary.selfCorrected}회`} />
            </div>
          </>
        )}

        {/* 아이 카드는 PAR-003 으로 간다. 학생 화면으로 넘어가지 않는다(COM-003) */}
        <Link
          href={`/parent/students/${summary.studentId}`}
          className="flex items-center justify-between border-t border-meti-line pt-3 text-[14px] leading-5 font-semibold text-button-primary"
        >
          학습 상세 · 성장 추이 보기
          <Image src="/icons/chevron-right.svg" alt="" width={20} height={20} />
        </Link>
      </section>

      {reward}

      {/*
        Figma 의 「이번 주 눈여겨볼 점」 자리. 주간 리포트 문장을 여기로
        끌어오지는 않는다 — 그건 지난주 것이고, 위 카드는 최근 7일이라 기간이
        어긋난다. 같은 7일에서 센 「자주 막힌 부분」 을 둔다.
      */}
      <section className="flex flex-col gap-2 rounded-2xl bg-surface-brand p-4">
        <h2 className="text-[14px] leading-5 font-semibold text-button-primary">
          {TERMS.logicGap.parent}
        </h2>
        {summary.gaps.length === 0 ? (
          <p className="text-[16px] leading-6 text-text-primary">최근 7일 동안 눈에 띄게 막힌 곳은 없었어요.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {summary.gaps.slice(0, 3).map((gap) => (
              <li key={gap.type} className="flex items-baseline justify-between gap-3">
                <span className="text-[16px] leading-6 text-text-primary">{GAP_DEFINITIONS[gap.type]}</span>
                <span className="shrink-0 text-[14px] leading-5 font-semibold text-button-primary">
                  {gap.count}회
                </span>
              </li>
            ))}
          </ul>
        )}
        <Link
          href={`/parent/reports?child=${summary.studentId}`}
          className="self-start py-3 text-[14px] leading-5 font-semibold text-button-primary"
        >
          주간 리포트 보기
        </Link>
      </section>
    </>
  );
}

export default async function ParentHomePage({
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
  const summary =
    selected === undefined
      ? null
      : await summarize(supabase, {
          student_id: selected.student_id,
          nickname: selected.nickname,
          grade: selected.grade,
          persona_type: selected.persona_type,
        });

  /*
    **보상을 못 불러와도 홈은 뜬다.** 보상은 곁들이는 카드다 — 이것 하나
    때문에 학습 현황까지 오류 화면이 되면 안 된다.
  */
  let board: RewardBoard | null = null;
  if (selected !== undefined) {
    try {
      board = await rewardBoard(supabase, selected.student_id);
    } catch (error) {
      console.error(error);
    }
  }
  const rewardCard =
    board === null || selected === undefined ? null : (
      <HomeRewardCard board={board} studentId={selected.student_id} />
    );
  const arrived = board !== null && board.achieved.length > 0;

  return (
    <main className="flex flex-1 flex-col gap-4 px-5 pt-3 pb-5">
      {/*
        Figma 에는 오른쪽에 알림 종이 있다. 알림 센터(PAR-004) 화면이 아직
        없어 누를 곳이 없으므로 두지 않는다.
      */}
      <h1 className="text-[20px] leading-7 font-semibold text-text-primary">안녕하세요, 보호자님</h1>

      {selected === undefined || summary === null ? (
        /*
          **막다른 곳으로 두지 않는다.** 로그인하면 바로 여기로 오므로,
          아직 아이를 등록하지 않은 부모가 처음 보는 화면이 이것이다.
          "없습니다" 만 적혀 있으면 어디서 등록하는지 알 수 없다.
        */
        <>
          <section className="flex flex-col gap-2 rounded-2xl bg-surface-brand p-4">
            <h2 className="text-[16px] leading-6 font-semibold text-text-primary">
              아이의 학습 계정을 만들어 주세요
            </h2>
            <p className="text-[14px] leading-5 text-text-secondary">
              {/* Figma 는 「미션」 이지만 부모 화면은 「학습」 이다(COM-003 §7) */}
              아이가 쓰는 이메일로 계정을 만들면 바로 {TERMS.learning.parent}을 시작할 수 있어요.
            </p>
            <Link
              href="/parent/my/students/new"
              className="flex h-[52px] items-center justify-center rounded-lg bg-button-primary px-5 text-[16px] leading-6 font-semibold text-white transition-colors hover:bg-button-hover active:bg-button-pressed"
            >
              자녀 계정 만들기
            </Link>
          </section>
          <section className={`flex flex-col gap-1.5 ${CARD}`}>
            <h2 className="text-[14px] leading-5 font-semibold text-text-secondary">학습 현황과 리포트</h2>
            <p className="text-[14px] leading-5 text-meti-hint">자녀 계정을 만들면 여기에서 볼 수 있어요.</p>
          </section>
        </>
      ) : (
        <>
          <ChildChips
            base="/parent"
            items={students.map((item) => ({ id: item.student_id, name: item.nickname }))}
            selectedId={selected.student_id}
          />

          {arrived && rewardCard}

          <StudentOverview summary={summary} reward={arrived ? null : rewardCard} />

          {/*
            **아이가 이미 있어도 등록할 자리를 둔다.** 로그인하면 바로 여기로
            오는데, 둘째를 더하려면 설정 → 학생 관리 → 학생 추가로 세 번을
            들어가야 했다. 현황을 보다가 "한 명 더" 는 흔한 일이다.
            3명이 차면 길을 두지 않고 이유만 적는다(COM-003 §4.9 문구).
          */}
          {students.length < MAX_CHILDREN ? (
            <Link
              href="/parent/my/students/new"
              className="flex h-[52px] items-center justify-center rounded-lg border border-meti-line bg-surface-primary px-5 text-[16px] leading-6 font-semibold text-text-primary transition-colors hover:bg-background-primary"
            >
              자녀 계정 추가
            </Link>
          ) : (
            <p className="text-center text-[12px] leading-[18px] text-text-secondary">
              자녀는 최대 3명까지 등록할 수 있어요
            </p>
          )}
        </>
      )}
    </main>
  );
}
