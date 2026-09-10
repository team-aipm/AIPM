'use client';

/**
 * ⚠️ COM-003에 정의되지 않은 화면이다 (Screen ID 없음).
 *
 * DEV-002 §1.4는 "새 화면이 필요하면 Route를 먼저 만들지 말고 COM-003
 * 변경을 제안한다"고 명시한다. 이 페이지는 그 순서를 건너뛴 프로토타입
 * 이식본이다 — 팀 합의로 "일단 같이 만들고 나중에 문서화"하기로 했다.
 * 머지 전 COM-003에 Screen ID(예: `STU-006` 캐릭터 도감)를 제안해야 한다.
 *
 * Route: `/dex` (임시)
 */

import Image from 'next/image';

import { BottomTabs } from '../_components/BottomTabs';
import { CHARACTER_IMG, CHARACTERS, type CharacterId } from '../_lib/mock-data';
import { useStudentState } from '../_lib/use-student-state';

const ORDER: CharacterId[] = ['meti', 'heti', 'quri', 'poki', 'mono', 'tori'];

export default function DexPage() {
  const { state, hydrated } = useStudentState();
  if (!hydrated) return null;

  const ownedCount = ORDER.filter((id) => state.owned.includes(id)).length;

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-5 pb-6 pt-10">
      <h1 className="mb-1 text-[22px] font-extrabold tracking-tight">메티 프렌즈 도감</h1>
      <p className="mb-4 text-[13px] font-semibold text-[#718087]">
        생각을 나눌수록 친구가 늘어나 · {ownedCount}/{ORDER.length}
      </p>

      <div className="grid grid-cols-2 gap-3">
        {ORDER.map((id) => {
          const c = CHARACTERS[id];
          const owned = state.owned.includes(id);
          return (
            <div
              key={id}
              className={`rounded-3xl border-[1.5px] border-[#E7EEF0] p-3.5 text-center ${owned ? 'bg-white' : 'bg-[#F2F5F6]'}`}
            >
              <Image
                src={CHARACTER_IMG[id].celebrate}
                alt={c.ko}
                width={78}
                height={78}
                className={`mx-auto h-[78px] w-auto object-contain ${owned ? '' : 'grayscale opacity-30'}`}
              />
              <div className={`mt-1.5 text-base font-extrabold ${owned ? 'text-[#24333A]' : 'text-[#718087]'}`}>
                {c.ko}
              </div>
              <div className={`text-xs font-bold tracking-wider ${owned ? 'text-[#718087]' : 'text-[#9AA7AC]'}`}>
                {c.en}
              </div>
              <div
                className={`mt-1.5 min-h-8 text-pretty text-[13px] font-semibold leading-snug ${
                  owned ? 'text-[#546269]' : 'text-[#9AA7AC]'
                }`}
              >
                {owned ? c.style : '아직 만나지 못한 친구'}
              </div>
              <div
                className={`mt-2 inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-extrabold ${
                  owned ? 'bg-[#DDF4F6] text-[#206B7C]' : 'bg-[#E7EEF0] text-[#718087]'
                }`}
              >
                {owned ? '함께하는 중' : `🔒 ${c.unlockCost}P`}
              </div>
            </div>
          );
        })}
      </div>
      </div>

      <BottomTabs />
    </div>
  );
}
