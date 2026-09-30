/**
 * STU-003 Persona 선택 · `/onboarding/persona` (DEV-002)
 *
 * Figma `캐릭터 선택` 세 프레임에 맞췄다. 다만 Figma 의 버튼 「메티와 미션
 * 시작하기」 는 쓰지 않는다 — 고른 뒤 가는 곳은 미션이 아니라 홈이다
 * (`choosePersona`). 누른 결과와 다른 말을 버튼에 적지 않는다.
 *
 * 프로토타입은 "선택하는 파트너에 따라 미션 진행 방식이 달라" 라고 적었는데,
 * **그건 COM-001 §19 와 어긋난다** — Persona 는 말투와 연출만 바꾼다.
 *
 * 파트너가 둘뿐인 것은 DB 때문이다(`persona_type` = friend · villain).
 * 큐리 · 포키 · 토리 · 모노는 코인 해금(STU-009)이 생긴 뒤 「내 정보」 에서
 * 연다(COM-001 §11-A). 여기서는 메티 · 헤티만 고른다.
 */

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { requireChild } from '@/lib/services/viewer';
import { getStudent } from '@/lib/services/student';
import { STUDENT_COOKIE } from '@/lib/constants/student-cookie';
import { BackBar } from '@/components/ui/BackBar';
import { PersonaPicker } from './_components/PersonaPicker';

export const metadata = { title: '파트너 고르기 · 메티' };

export default async function PersonaPage() {
  // **파트너는 아이가 고른다.** 부모가 대신 고르지 않는다 — 함께 공부할
  // 상대를 정하는 일이다(COM-003 §4.2 사용자 칸이 「학생」).
  await requireChild();

  const supabase = await createClient();
  const jar = await cookies();
  const studentId = jar.get(STUDENT_COOKIE)?.value ?? '';
  const student = studentId === '' ? null : await getStudent(supabase, studentId);
  if (student === null) redirect('/students');

  return (
    <main className="flex flex-1 flex-col">
      <BackBar href="/home" label="홈으로 돌아가기" />

      <header className="flex flex-col gap-2 px-5 pt-4 pb-3.5">
        <h1 className="text-[24px] leading-8 font-bold text-text-primary">
          미션을 함께할 친구를 골라 봐
        </h1>
        <p className="text-[14px] leading-5 text-text-primary">
          말투만 달라. 미션과 도움은 똑같아. 언제든 다시 바꿀 수 있어.
        </p>
      </header>

      <PersonaPicker current={student.persona_type} />
    </main>
  );
}
