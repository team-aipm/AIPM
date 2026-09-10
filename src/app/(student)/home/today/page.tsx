'use client';

/**
 * STU-005 · 오늘의 기록 (`docs/COM-003-screen-ui.md` §4.2)
 * Route: `/home/today` (`docs/DEV-002-routes.md`)
 */

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { CHARACTER_IMG, GROUP_IMG } from '../../_lib/mock-data';
import { useStudentState } from '../../_lib/use-student-state';

const TODAY_TASKS = ['오늘 알고 싶은 것 정하기', '헤티 실수 찾아내기', '배운 걸 한 문장으로 쓰기'];

export default function TodayRecordPage() {
  const router = useRouter();
  const { state, hydrated } = useStudentState();
  if (!hydrated) return null;

  return (
    <div className="flex h-full flex-col bg-[#DDF4F6]">
      <div className="flex-1 overflow-y-auto px-5 pb-7">
      <div className="pt-10 text-center">
        <div className="inline-block rounded-full bg-[#206B7C] px-3.5 py-1.5 text-[13px] font-extrabold tracking-wide text-white">
          오늘 미션 완료
        </div>
        <div className="mt-3.5 text-[26px] font-extrabold leading-snug tracking-tight text-pretty">
          {state.missionsDoneToday}개 다 끝냈어!
          <br />
          오늘 진짜 잘했다
        </div>
        <div className="mt-2 text-[13px] font-semibold text-[#3E5057]">생각한 시간 14분</div>
        <Image
          src={GROUP_IMG}
          alt="메티 프렌즈"
          width={300}
          height={200}
          className="mx-auto -mb-1 mt-1.5 w-full max-w-[300px] animate-metty-float [--metty-float-duration:4.5s]"
        />
      </div>

      <div className="mt-3 rounded-3xl bg-white p-4.5 shadow-[0_4px_16px_rgba(32,107,124,.1)]">
        <div className="mb-3.5 flex items-center gap-2">
          <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#57C7B6] text-[13px] font-extrabold text-white">
            ✓
          </span>
          <span className="text-sm font-extrabold text-[#24333A]">오늘 한 일</span>
        </div>
        {TODAY_TASKS.map((task, i) => (
          <div
            key={task}
            className={`flex items-center gap-2.5 py-2.5 ${i < TODAY_TASKS.length - 1 ? 'border-b border-[#F0F4F5]' : ''}`}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-lg bg-[#DDF4F6] text-xs font-extrabold text-[#206B7C]">
              {i + 1}
            </span>
            <span className="flex-1 text-sm font-bold text-[#24333A]">{task}</span>
            <span className="text-[13px] font-extrabold text-[#57C7B6]">완료</span>
          </div>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl bg-[#FFC857] p-4">
          <div className="text-[13px] font-extrabold text-[#24333A]/75">오늘 모은 포인트</div>
          <div className="mt-1 text-2xl font-extrabold text-[#24333A]">+45 P</div>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-[0_2px_10px_rgba(32,107,124,.07)]">
          <div className="text-[13px] font-extrabold text-[#718087]">연속 학습</div>
          <div className="mt-1 text-2xl font-extrabold text-[#24333A]">
            {state.streakDays + 1}
            <span className="ml-0.5 text-sm">일째</span>
          </div>
        </div>
      </div>

      <div className="mt-3 flex gap-3 rounded-3xl bg-white p-4 shadow-[0_2px_10px_rgba(32,107,124,.07)]">
        <Image src={CHARACTER_IMG.hetty.think} alt="헤티" width={64} height={64} className="h-16 w-auto flex-none" />
        <div className="min-w-0 flex-1">
          <div className="mb-1 text-[13px] font-extrabold text-[#206B7C]">헤티의 한마디</div>
          <div className="text-sm font-bold leading-snug text-[#24333A] text-pretty">
            &ldquo;나의 속임수를 네가 먼저 찾았어. 내일은 더 어려운 걸로 속여볼게&rdquo;
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2.5">
        <Link
          href="/my"
          className="rounded-2xl bg-[#206B7C] py-3.5 text-center text-base font-extrabold text-white"
        >
          마이페이지에서 리포트 보기
        </Link>
        <button
          onClick={() => router.push('/home')}
          className="rounded-2xl border-[1.5px] border-[#206B7C] bg-transparent py-3.5 text-base font-extrabold text-[#206B7C]"
        >
          오늘은 여기까지
        </button>
      </div>
      </div>
    </div>
  );
}
