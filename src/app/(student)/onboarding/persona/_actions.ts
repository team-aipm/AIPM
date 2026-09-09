'use server';

/**
 * STU-003 Persona 선택.
 *
 * **Persona 는 말투와 연출만 바꾼다**(COM-001 §19). 정답 · 평가 · 난이도 ·
 * 검증 로직은 어느 파트너를 고르든 같다. 화면 문구도 그렇게 쓴다 — "얘로
 * 하면 더 쉬워져" 같은 말은 사실이 아니다.
 */

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { setPersona } from '@/lib/services/student';
import { EVENT, record } from '@/lib/analytics/events';
import { STUDENT_COOKIE } from '@/lib/constants/student-cookie';

export async function choosePersona(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (auth.user === null) redirect('/login');

  const persona = String(formData.get('persona') ?? '');
  if (persona !== 'friend' && persona !== 'villain') redirect('/onboarding/persona');

  const jar = await cookies();
  const studentId = jar.get(STUDENT_COOKIE)?.value ?? '';
  if (studentId === '') redirect('/students');

  await setPersona(supabase, studentId, persona);
  await record(supabase, EVENT.personaSelected, { studentId }, { persona_type: persona });

  redirect('/home');
}
