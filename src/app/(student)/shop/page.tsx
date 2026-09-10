'use client';

/**
 * ⚠️ COM-003에 정의되지 않은 화면이다. `dex/page.tsx` 상단 주석과 동일한
 * 경고 적용 — 머지 전 COM-003 변경 제안 필요.
 *
 * Route: `/shop` (임시)
 */

import Image from 'next/image';

import { BottomTabs } from '../_components/BottomTabs';
import { CHARACTER_IMG, CHARACTERS, SHOP_ITEMS, type CharacterId } from '../_lib/mock-data';
import { useStudentState } from '../_lib/use-student-state';

export default function ShopPage() {
  const { state, update, hydrated } = useStudentState();
  if (!hydrated) return null;

  function buy(item: (typeof SHOP_ITEMS)[number]) {
    const owned = state.owned.includes(item.key as CharacterId);
    const can = state.points >= item.cost && !owned;
    if (!can) return;
    update((p) => ({ points: p.points - item.cost, owned: p.owned.concat(item.key as CharacterId) }));
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-5 pb-6 pt-10">
      <h1 className="mb-3.5 text-[22px] font-extrabold tracking-tight">생각 상점</h1>

      <div className="mb-4.5 flex items-center justify-between rounded-3xl bg-[#FFC857] p-4.5">
        <div>
          <div className="text-[13px] font-bold text-[#24333A]/75">내 포인트</div>
          <div className="text-[32px] font-extrabold leading-tight text-[#24333A]">{state.points} P</div>
          <div className="text-[13px] font-bold text-[#24333A]/75">이번 주에 90P 모았어</div>
        </div>
        <Image
          src={CHARACTER_IMG.poki.wave}
          alt="포키"
          width={92}
          height={92}
          className="h-[92px] w-auto animate-metty-float [--metty-float-duration:3.4s]"
        />
      </div>

      <div className="mb-2.5 text-sm font-extrabold">교환하기</div>
      <div className="flex flex-col gap-2.5">
        {SHOP_ITEMS.map((item) => {
          const isCharacter = item.icon === 'character';
          const owned = state.owned.includes(item.key as CharacterId);
          const can = state.points >= item.cost && !owned;
          return (
            <div
              key={item.key}
              className="flex items-center gap-3 rounded-2xl bg-white p-3.5 shadow-[0_2px_10px_rgba(32,107,124,.06)]"
            >
              <div className="flex h-12 w-12 flex-none items-center justify-center overflow-hidden rounded-2xl bg-[#F1F5F6]">
                {isCharacter ? (
                  <Image
                    src={CHARACTER_IMG[item.key as CharacterId].celebrate}
                    alt=""
                    width={42}
                    height={42}
                    className="h-[42px] w-auto object-contain"
                  />
                ) : (
                  <span className="text-xl">{item.icon === 'moon' ? '🌙' : '✦'}</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-base font-extrabold text-[#24333A]">
                  {isCharacter ? item.name : item.name}
                </div>
                <div className="mt-0.5 text-[13px] font-semibold text-[#718087]">
                  {isCharacter ? CHARACTERS[item.key as CharacterId].style : item.desc}
                </div>
              </div>
              <button
                onClick={() => buy(item)}
                disabled={!can}
                className="min-h-11 flex-none whitespace-nowrap rounded-full px-4 py-3 text-[13px] font-extrabold"
                style={{
                  background: owned ? '#E7EEF0' : can ? '#206B7C' : '#E7EEF0',
                  color: owned ? '#718087' : can ? '#FFFFFF' : '#9AA7AC',
                }}
              >
                {owned ? '보유' : `${item.cost}P`}
              </button>
            </div>
          );
        })}
      </div>
      </div>

      <BottomTabs />
    </div>
  );
}
