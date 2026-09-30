'use client';

/**
 * Figma `캐릭터 선택 / 선택 전 · 메티 선택됨 · 헤티 선택됨`.
 *
 * 카드를 눌러 고르고, 아래 버튼으로 정한다. 전에는 카드를 누르는 순간
 * 저장됐다 — 한 줄 설명을 읽기도 전에 넘어갔다. 저장은 여전히
 * `choosePersona` 하나다.
 *
 * **지금 파트너를 미리 골라 둔다.** 등록 때 기본값이 메티라(COM-003 §4.2)
 * 「선택 전」 상태는 파트너 값이 없을 때만 나온다.
 */

import { useState } from 'react';
import type { Database } from '@/types/database';
import { PARTNER_NAME } from '@/lib/constants/copy';
import { BrandButton } from '@/components/ui/BrandButton';
import { PartnerFigure } from '@/components/student/PartnerFigure';
import { choosePersona } from '../_actions';

type Persona = Database['public']['Enums']['persona_type'];

/** 말투만 다르다(COM-001 §19). 한 줄은 쉬워진다 · 어려워진다를 말하지 않는다 */
const PARTNERS: { value: Persona; tag: string; line: string }[] = [
  { value: 'friend', tag: '생각 탐험가', line: '틀려도 괜찮아! 같이 찾아보자' },
  { value: 'villain', tag: '생각 도전자', line: '내 답이 맞을걸? 한번 증명해 봐' },
];

export function PersonaPicker({ current }: { current: Persona | null }) {
  const [picked, setPicked] = useState<Persona | null>(current);

  return (
    <form action={choosePersona} className="flex flex-1 flex-col">
      <input type="hidden" name="persona" value={picked ?? ''} />

      <div className="grid grid-cols-2 gap-3 px-5" role="radiogroup" aria-label="함께할 친구">
        {PARTNERS.map((partner) => {
          const selected = picked === partner.value;
          return (
            <button
              key={partner.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setPicked(partner.value)}
              className={`relative flex h-[258px] flex-col items-center gap-[7px] rounded-[18px] p-3 ${
                selected
                  ? 'bg-surface-brand'
                  : 'border border-meti-line bg-surface-primary'
              }`}
            >
              {selected && (
                <span className="absolute top-2.5 right-2.5 flex size-5 items-center justify-center rounded-full bg-button-primary text-[11px] leading-none text-white">
                  ✓
                </span>
              )}
              <PartnerFigure persona={partner.value} size={110} />
              <span className="text-[16px] leading-6 font-semibold text-text-primary">
                {PARTNER_NAME[partner.value]}
              </span>
              <span className="text-[14px] leading-5 text-text-secondary">{partner.tag}</span>
              <span
                className={`flex min-h-[46px] w-full items-center justify-center rounded-xl px-2 py-[7px] text-[12px] leading-[18px] text-text-secondary ${
                  selected ? 'bg-surface-primary shadow-card' : ''
                }`}
              >
                {selected ? partner.line : '선택해서 자세히 보기'}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-auto px-5 pt-5 pb-[max(34px,env(safe-area-inset-bottom))]">
        <BrandButton disabled={picked === null}>
          {picked === null ? '친구를 골라 줘' : `${PARTNER_NAME[picked]}와 함께하기`}
        </BrandButton>
      </div>
    </form>
  );
}
