/**
 * STU-003 Persona 선택 · `/onboarding/persona` (DEV-002)
 *
 * 프로토타입(METI)의 파트너 선택 화면을 옮겼다. 다만 프로토타입은 "선택하는
 * 파트너에 따라 미션 진행 방식이 달라" 라고 적었는데, **그건 COM-001 §19 와
 * 어긋난다** — Persona 는 말투와 연출만 바꾼다. 그래서 문구를 바꿨다.
 *
 * 파트너가 둘뿐인 것도 DB 때문이다(`persona_type` = friend · villain).
 * 프로토타입의 큐리 · 포키 · 토리 · 모노는 COM-002 변경이 먼저다.
 */

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getStudent } from '@/lib/services/student';
import { PARTNER_NAME } from '@/lib/constants/copy';
import { STUDENT_COOKIE } from '@/lib/constants/student-cookie';
import { choosePersona } from './_actions';

export const metadata = { title: '파트너 고르기 · 메티' };

const PARTNERS = [
  {
    value: 'friend' as const,
    emoji: '🐣',
    tag: '생각 코치 · 되묻기 중심',
    line: '"왜 그렇게 생각했어? 네 말로 설명해줘!"',
  },
  {
    value: 'villain' as const,
    emoji: '🦊',
    tag: '흔들기 라이벌 · 반박 중심',
    line: '"정말? 나는 다르게 봤는데. 확실해?"',
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
    <main className="flex flex-1 flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-extrabold leading-snug text-meti-ink">
          누구랑 함께
          <br />
          공부해볼까?
        </h1>
        <p className="text-[13px] text-meti-sub">
          말투만 달라요. 문제와 도움은 똑같아요.
        </p>
      </header>

      <div className="flex flex-col gap-3">
        {PARTNERS.map((partner) => (
          <form key={partner.value} action={choosePersona}>
            <input type="hidden" name="persona" value={partner.value} />
            <button
              type="submit"
              className="flex w-full items-center gap-4 rounded-2xl bg-white p-4 text-left shadow-sm"
            >
              <span
                aria-hidden
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-meti-bg text-2xl"
              >
                {partner.emoji}
              </span>
              <span className="flex flex-col gap-1">
                <span className="text-[15px] font-bold text-meti-ink">
                  {PARTNER_NAME[partner.value]}
                </span>
                <span className="text-[12px] font-semibold text-meti-sub">{partner.tag}</span>
                <span className="text-[12px] leading-relaxed text-meti-ink">{partner.line}</span>
              </span>
            </button>
          </form>
        ))}
      </div>

      <p className="text-center text-[12px] text-meti-sub">
        나중에 마이페이지에서 바꿀 수 있어요.
      </p>
    </main>
  );
}
