'use client';

/**
 * STU-003 · Persona 선택 (`docs/COM-003-screen-ui.md` §4.2)
 * Route: `/onboarding/persona` (`docs/DEV-002-routes.md`)
 *
 * ⚠️ 소유 알림: DEV-001 §6에 따르면 `app/(student)/onboarding/**`는
 * "회원 및 유입 PM" 소유 경로다. AI 코어 트랙에서 먼저 만들었으니,
 * 머지 전에 회원·유입 PM 리뷰를 받아야 한다.
 *
 * ⚠️ 스키마 알림: 캐릭터 6종은 `_lib/mock-data.ts` 상단 주석 참고 —
 * 현재 `persona_type`은 friend/villain 2종뿐이라 COM-002 변경 제안이 필요하다.
 */

import Image from 'next/image';
import { useRouter } from 'next/navigation';

import { CHARACTERS, CHARACTER_IMG, type CharacterId } from '../../_lib/mock-data';
import { useStudentState } from '../../_lib/use-student-state';

const PICKABLE: CharacterId[] = ['metty', 'hetty', 'quri', 'poki'];
const LOCKED: CharacterId[] = ['mono', 'tori'];

export default function PersonaSelectPage() {
  const router = useRouter();
  const { state, update, hydrated } = useStudentState();
  const picked = CHARACTERS[state.partner];

  if (!hydrated) return null;

  return (
    <div className="flex h-full flex-col bg-[#F7FAFB]">
      <div className="flex flex-none items-center gap-2.5 px-5 pt-10">
        <button
          onClick={() => router.back()}
          className="-ml-2.5 flex h-11 w-11 items-center justify-center text-[22px] text-[#24333A]"
        >
          ‹
        </button>
        <span className="text-[13px] font-bold text-[#718087]">학습 파트너 고르기</span>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-6">

      <h1 className="text-[23px] font-extrabold leading-snug tracking-tight text-pretty">
        메티와 함께 할지
        <br />
        헤티와 승부할지 선택해봐!
      </h1>
      <p className="mt-1.5 text-[13px] font-semibold text-[#718087]">
        선택하는 파트너에 따라 미션 진행 방식이 달라.
      </p>

      <div className="mt-4 flex items-center gap-3 rounded-3xl bg-[#DDF4F6] p-4">
        <Image
          src={CHARACTER_IMG[picked.id].celebrate}
          alt={picked.ko}
          width={86}
          height={86}
          className="h-[86px] w-auto flex-none animate-metty-float object-contain"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-extrabold text-[#24333A]">{picked.ko}</span>
            <span className="text-xs font-extrabold tracking-wider text-[#206B7C]">{picked.en}</span>
          </div>
          <div className="mt-1 text-[13px] font-bold text-[#206B7C]">{picked.style}</div>
          <div className="mt-2 rounded-2xl rounded-bl-sm bg-white px-3 py-2.5 text-[13px] font-bold leading-snug text-[#24333A] text-pretty">
            {picked.line}
          </div>
        </div>
      </div>

      <div className="mt-5 mb-2.5 text-sm font-extrabold">함께할 수 있는 친구</div>
      <div className="grid grid-cols-3 gap-2.5">
        {PICKABLE.map((id) => {
          const c = CHARACTERS[id];
          const active = state.partner === id;
          return (
            <button
              key={id}
              onClick={() => update({ partner: id })}
              className={`flex flex-col items-center gap-1 rounded-2xl border-2 px-1.5 pb-2.5 pt-3 ${
                active ? 'border-[#206B7C] bg-[#DDF4F6]' : 'border-[#EDF2F3] bg-white'
              }`}
            >
              <Image src={CHARACTER_IMG[id].celebrate} alt={c.ko} width={56} height={56} className="h-14 w-auto" />
              <span className="text-[13px] font-extrabold text-[#24333A]">{c.ko}</span>
              <span className={`text-xs font-extrabold ${active ? 'text-[#206B7C]' : 'text-[#9AA7AC]'}`}>
                {active ? '✓ 선택됨' : c.style.split(' · ')[0]}
              </span>
            </button>
          );
        })}
        {LOCKED.map((id) => {
          const c = CHARACTERS[id];
          return (
            <div
              key={id}
              className="flex flex-col items-center gap-1 rounded-2xl border-2 border-[#E7EEF0] bg-[#F2F5F6] px-1.5 pb-2.5 pt-3"
            >
              <Image
                src={CHARACTER_IMG[id].front}
                alt={c.ko}
                width={56}
                height={56}
                className="h-14 w-auto grayscale opacity-30"
              />
              <span className="text-[13px] font-extrabold text-[#718087]">{c.ko}</span>
              <span className="whitespace-nowrap text-xs font-extrabold text-[#718087]">🔒 {c.unlockCost}P</span>
            </div>
          );
        })}
      </div>

      <div className="mt-3.5 rounded-2xl bg-white p-3.5 shadow-[0_2px_10px_rgba(32,107,124,.06)]">
        <div className="mb-2 text-[13px] font-extrabold text-[#718087]">이 파트너랑 하면</div>
        {picked.perks.map((perk) => (
          <div key={perk} className="mb-1.5 flex items-center gap-2 last:mb-0">
            <span className="flex h-[18px] w-[18px] items-center justify-center rounded-md bg-[#DDF4F6] text-xs font-extrabold text-[#206B7C]">
              ✓
            </span>
            <span className="text-[13px] font-bold text-[#24333A]">{perk}</span>
          </div>
        ))}
      </div>

      <button
        onClick={() => router.push('/home')}
        className="mt-4 w-full rounded-2xl bg-[#206B7C] py-4 text-base font-extrabold text-white"
      >
        {picked.ko}랑 시작하기
      </button>
      </div>
    </div>
  );
}
