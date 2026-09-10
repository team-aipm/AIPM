/**
 * STU-003 Persona 선택 · `/onboarding/persona` (DEV-002)
 *
 * 레이아웃·색·크기는 프로토타입 원본(`METTY App.dc.html` isPick)을 그대로
 * 옮겼다. 다만 두 가지는 프로토타입과 다르게 뒀다.
 *
 *   1. 프로토타입은 "선택하는 파트너에 따라 미션 진행 방식이 달라" 라고
 *      적었는데, **그건 COM-001 §19 와 어긋난다** — Persona 는 말투와
 *      연출만 바꾼다. 그래서 문구를 바꿨다.
 *   2. 파트너가 둘뿐인 것도 DB 때문이다(`persona_type` = friend · villain).
 *      프로토타입의 6인 그리드(모노·토리 잠금 포함)와 "미리 보기 → 확정"
 *      2단계 흐름은 COM-002 변경이 먼저다. 지금은 카드를 누르면 바로
 *      선택된다 — 한 단계로 줄였다.
 *
 * perks 문구는 프로토타입의 캐릭터 데이터(`pickedPerk1/2`)에서 그대로
 * 가져왔다. 지어낸 카피가 아니다.
 */

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getStudent } from '@/lib/services/student';
import { PARTNER_NAME } from '@/lib/constants/copy';
import { STUDENT_COOKIE } from '@/lib/constants/student-cookie';
import { PartnerFace, type PartnerPose } from '@/components/ui/PartnerFace';
import { choosePersona } from './_actions';

export const metadata = { title: '파트너 고르기 · 메티' };

const PARTNERS = [
  {
    value: 'friend' as const,
    en: 'METI',
    tag: '생각 코치 · 되묻기 중심',
    line: '"왜 그렇게 생각했어? 네 말로 설명해줘!"',
    pose: 'celebrate' as PartnerPose,
    perks: ['너의 생각을 들으며 함께 미션을 진행해', '한 문장 정리를 꼭 같이 써'],
  },
  {
    value: 'villain' as const,
    en: 'HETI',
    tag: '흔들기 라이벌 · 반박 중심',
    line: '"정말? 나는 다르게 봤는데. 확실해?"',
    pose: 'wave' as PartnerPose,
    perks: ['미션 중 실수를 하거나 의심을 해', '지기 싫어하는 승부사 기질이 강해'],
  },
];

export default async function PersonaPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (auth.user === null) redirect('/login');

  const jar = await cookies();
  const studentId = jar.get(STUDENT_COOKIE)?.value ?? '';
  const student = studentId === '' ? null : await getStudent(supabase, studentId);
  if (student === null) redirect('/students');

  return (
    <main className="flex flex-1 flex-col gap-5 bg-[#F7FAFB] px-5 py-6">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-[23px] font-extrabold leading-[1.35] tracking-[-0.5px] text-meti-ink">
          누구랑 함께
          <br />
          공부해볼까?
        </h1>
        <p className="mt-1 text-[13px] font-semibold text-meti-sub">
          말투만 달라요. 문제와 도움은 똑같아요.
        </p>
      </header>

      <div className="flex flex-col gap-4">
        {PARTNERS.map((partner) => (
          <form key={partner.value} action={choosePersona}>
            <input type="hidden" name="persona" value={partner.value} />
            <button type="submit" className="w-full text-left">
              <div className="flex items-center gap-[13px] rounded-[24px] bg-meti-bg p-4">
                <PartnerFace
                  persona={partner.value}
                  pose={partner.pose}
                  size={86}
                  className="shrink-0 animate-meti-float"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[18px] font-extrabold text-meti-ink">
                      {PARTNER_NAME[partner.value]}
                    </span>
                    <span className="text-[12px] font-extrabold tracking-[0.6px] text-meti">
                      {partner.en}
                    </span>
                  </div>
                  <p className="mt-1 text-[13px] font-bold text-meti">{partner.tag}</p>
                  <p className="mt-[9px] rounded-[14px] rounded-bl-[4px] bg-white px-3 py-2.5 text-[13px] font-bold leading-[1.5] text-meti-ink">
                    {partner.line}
                  </p>
                </div>
              </div>

              <div className="mt-2 rounded-[20px] bg-white p-3.5 shadow-[0_2px_10px_rgba(32,107,124,.06)]">
                <p className="mb-2 text-[13px] font-extrabold text-meti-sub">이 파트너랑 하면</p>
                {partner.perks.map((perk) => (
                  <div key={perk} className="mb-1.5 flex items-center gap-2 last:mb-0">
                    <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[6px] bg-meti-bg text-[12px] font-extrabold text-meti">
                      ✓
                    </span>
                    <span className="text-[13px] font-bold text-meti-ink">{perk}</span>
                  </div>
                ))}
              </div>
            </button>
          </form>
        ))}
      </div>

      <p className="text-center text-[12px] font-semibold text-meti-sub">
        나중에 마이페이지에서 바꿀 수 있어요.
      </p>
    </main>
  );
}
