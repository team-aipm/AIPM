'use client';

/**
 * STU-004 · 학생 HOME (`docs/COM-003-screen-ui.md` §4.2)
 * Route: `/home` (`docs/DEV-002-routes.md`)
 *
 * State 표(COM-003 §5)의 "최초 방문 / 오늘 시작 전 / 미션 진행 중 / 오늘 완료 /
 * 구독 만료"는 아직 이 목업에서 전부 구현하지 않았다 — 여기서는 "오늘 시작
 * 전 ~ 진행 중"에 해당하는 기본 레이아웃만 이식했다.
 */

import Image from 'next/image';
import Link from 'next/link';

import { BottomTabs } from '../_components/BottomTabs';
import { CHARACTERS, CHARACTER_IMG } from '../_lib/mock-data';
import { useStudentState } from '../_lib/use-student-state';

export default function StudentHomePage() {
  const { state, hydrated } = useStudentState();
  if (!hydrated) return null;

  const partner = CHARACTERS[state.partner];
  const owned = (['metty', 'hetty', 'quri', 'poki'] as const).filter((id) => state.owned.includes(id));

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-5 pb-6 pt-10">
      <div className="mb-5 flex h-[30px] items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-11 w-11 flex-none items-end justify-center overflow-hidden rounded-full bg-white p-px">
            <Image src={CHARACTER_IMG.metty.celebrate} alt="메티" width={43} height={43} className="h-[43px] w-auto" />
          </div>
          <div>
            <div className="text-xl font-bold leading-tight tracking-tight text-[#206B7C]">반가워! 민준</div>
            <div className="mt-1 text-[13px] font-medium text-[#718087]">초등 4학년</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-[#FFC857] py-1.5 pl-2 pr-3">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#24333A] text-xs font-extrabold text-[#FFC857]">
            P
          </span>
          <span className="text-sm font-extrabold text-[#24333A]">{state.points}</span>
        </div>
      </div>

      <div className="relative mb-3.5 overflow-hidden rounded-3xl bg-[#DDF4F6] p-5 pt-5">
        <div className="relative z-10 max-w-[196px]">
          <div className="mb-1.5 text-[13px] font-bold text-[#206B7C]">오늘의 목표</div>
          <div className="text-xl font-extrabold leading-snug tracking-tight text-pretty">
            오늘도 같이
            <br />
            생각해볼까?
          </div>
          <div className="mt-3.5 flex items-center gap-2">
            <div className="h-[9px] flex-1 overflow-hidden rounded-full bg-[#24333A1F]">
              <div
                className="h-full rounded-full bg-[#57C7B6]"
                style={{ width: `${(state.missionsDoneToday / state.missionsGoalToday) * 100}%` }}
              />
            </div>
            <span className="text-xs font-extrabold text-[#24333A]">
              {state.missionsDoneToday}/{state.missionsGoalToday}
            </span>
          </div>
          <div className="mt-2 text-xs font-extrabold text-[#206B7C]">일일 미션 완료까지 얼마 안남았어!</div>
        </div>
        <Image
          src={CHARACTER_IMG.metty.wave}
          alt="메티"
          width={111}
          height={110}
          className="absolute right-4 top-6 h-[110px] w-auto animate-metty-float"
        />
      </div>

      <div className="mb-2.5 mt-5 text-sm font-extrabold">미션 시작</div>
      <Link
        href="/mission"
        className="mb-2.5 block rounded-3xl bg-white p-4 text-left shadow-[0_2px_10px_rgba(32,107,124,.07)]"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-[46px] w-[46px] flex-none items-center justify-center overflow-hidden rounded-2xl bg-[#DDF4F6]">
            <Image src={CHARACTER_IMG[partner.id].think} alt={partner.ko} width={30} height={30} className="h-[30px] w-auto" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1 text-base font-extrabold text-[#24333A]">새로운 미션을 시작할래</div>
            <div className="text-[13px] font-medium leading-snug text-[#718087]">
              {partner.ko}와 함께 새로운 미션을 시작하고
              <br />
              친구들을 모아보자!
            </div>
          </div>
        </div>
        <div className="mt-3.5 flex items-center justify-between">
          <span className="text-xs font-bold text-[#206B7C]">약 8분 · 분수 나눗셈</span>
          <span className="rounded-full bg-[#206B7C] px-3.5 py-2.5 text-[13px] font-bold text-white">새로 시작하기</span>
        </div>
      </Link>

      <Link href="/calendar" className="block rounded-3xl bg-white p-4 text-left shadow-[0_2px_10px_rgba(32,107,124,.07)]">
        <div className="flex items-center gap-3">
          <div className="flex h-[46px] w-[46px] flex-none items-center justify-center overflow-hidden rounded-2xl bg-[#F1F5F6]">
            <Image src={CHARACTER_IMG.poki.wave} alt="포키" width={30} height={30} className="h-[30px] w-auto" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1 text-base font-extrabold text-[#24333A]">남아 있는 미션을 시작할래</div>
            <div className="text-[13px] font-medium leading-snug text-[#718087]">
              이전에 남아있던 미션을 찾아
              <br />
              함께 해결해보자!
            </div>
          </div>
        </div>
        <div className="mt-3.5 flex items-center justify-between">
          <span className="text-xs font-bold text-[#718087]">약 8분 · 분수 나눗셈</span>
          <span className="rounded-full border border-[#206B7C] px-3.5 py-2 text-[13px] font-bold text-[#206B7C]">
            이어서 하기
          </span>
        </div>
      </Link>

      <div className="mb-2.5 mt-6 grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl bg-white p-4 shadow-[0_2px_10px_rgba(32,107,124,.06)]">
          <div className="text-[13px] font-bold text-[#718087]">연속 학습</div>
          <div className="mt-1 text-2xl font-extrabold text-[#24333A]">
            {state.streakDays}
            <span className="ml-0.5 text-sm">일</span>
          </div>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-[0_2px_10px_rgba(32,107,124,.06)]">
          <div className="text-xs font-bold text-[#718087]">스스로 설명</div>
          <div className="mt-1 text-2xl font-extrabold text-[#24333A]">
            12<span className="ml-0.5 text-sm">번</span>
          </div>
        </div>
      </div>

      <div className="mb-2.5 mt-5 flex items-center justify-between">
        <span className="text-sm font-extrabold text-[#24333A]">메티 프렌즈</span>
        <Link href="/onboarding/persona" className="text-[13px] font-bold text-[#206B7C]">
          파트너 고르기 ›
        </Link>
      </div>
      <div className="flex gap-2.5 overflow-x-auto pb-1">
        {owned.map((id) => (
          <div
            key={id}
            className="flex h-[78px] w-[70px] flex-none flex-col items-center justify-end gap-0.5 overflow-hidden rounded-2xl bg-white pb-1.5 shadow-[0_2px_10px_rgba(32,107,124,.06)]"
          >
            <Image src={CHARACTER_IMG[id].front} alt={CHARACTERS[id].ko} width={48} height={48} className="h-12 w-auto object-contain" />
            <span className="text-xs font-bold text-[#24333A]">{CHARACTERS[id].ko}</span>
          </div>
        ))}
      </div>
      </div>

      <BottomTabs />
    </div>
  );
}
