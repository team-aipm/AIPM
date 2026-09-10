'use server';

/**
 * STU-001 첫 학생 등록.
 *
 * 부모가 가입한 뒤 학생을 만든다. 학생은 부모 계정 안의 프로필이면서,
 * **아이가 직접 들어올 수 있는 계정이기도 하다**(COM-002 §4-1).
 *
 * 아이 로그인은 여기서 함께 만든다. 등록하고 나서 마이페이지에 또 들어가게
 * 하면 한 번에 끝날 일을 두 번 하게 된다. **비워 두어도 된다** — 그때는
 * 지금까지처럼 부모 기기에서 프로필을 골라 들어간다.
 */

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createStudent } from '@/lib/services/student';
import {
  reserveChildAuthUser,
  releaseChildAuthUser,
  attachChildLogin,
} from '@/lib/services/student-login';
import { EVENT, record } from '@/lib/analytics/events';
import { STUDENT_COOKIE } from '@/lib/constants/student-cookie';

export type NewStudentState = { error: string | null };

export async function addStudent(
  _prev: NewStudentState,
  formData: FormData,
): Promise<NewStudentState> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (auth.user === null) redirect('/login');

  const studentName = String(formData.get('student_name') ?? '').trim();
  const nicknameRaw = String(formData.get('nickname') ?? '').trim();
  const birthDate = String(formData.get('birth_date') ?? '').trim();
  const grade = Number(formData.get('grade') ?? 0);

  if (studentName === '' || birthDate === '') {
    return { error: '이름과 생년월일을 채워주세요.' };
  }

  // MVP 는 4~6학년이다(COM-002 §4 · DB CHECK 제약). 화면에서 막고, DB 도
  // 막는다. 한쪽만 막으면 다른 경로로 들어온 값이 통과한다.
  if (grade < 4 || grade > 6) {
    return { error: '지금은 4~6학년만 시작할 수 있어요.' };
  }

  // 닉네임 기본값은 이름이다(COM-002 §4). 무엇을 기본으로 썼는지도 남긴다 —
  // 나중에 "AI 가 왜 이 이름으로 부르지" 를 설명할 수 있어야 한다.
  const usedDefault = nicknameRaw === '';
  const nickname = usedDefault ? studentName : nicknameRaw;

  // 아이 로그인은 선택이다. 둘 중 하나만 채우면 실수다.
  const loginId = String(formData.get('login_id') ?? '').trim().toLowerCase();
  const loginPassword = String(formData.get('login_password') ?? '');
  const wantsLogin = loginId !== '' || loginPassword !== '';

  if (wantsLogin && (loginId === '' || loginPassword === '')) {
    return { error: '아이 로그인을 만들려면 아이디와 비밀번호를 모두 채워주세요.' };
  }

  // **아이디를 먼저 잡는다.** 학생을 만든 뒤에 붙이면, 아이디가 겹쳤을 때
  // 학생만 남는다 — 부모는 등록이 됐는지 모르고 다시 눌러 같은 아이를 둘로
  // 만든다. 겹치는지는 Auth 만 알고 있다.
  let reservedUserId: string | null = null;
  if (wantsLogin) {
    const reserved = await reserveChildAuthUser({ loginId, password: loginPassword });
    if (!reserved.ok) return { error: reserved.error };
    reservedUserId = reserved.userId;
  }

  let studentId: string;
  try {
    const student = await createStudent(supabase, auth.user.id, {
      studentName,
      nickname,
      nicknameSource: usedDefault ? 'name_default' : 'custom',
      birthDate,
      grade,
    });
    studentId = student.student_id;
  } catch (error) {
    if (reservedUserId !== null) await releaseChildAuthUser(reservedUserId);
    console.error(`[onboarding] 학생 등록 실패: ${String(error)}`);
    return { error: '등록하지 못했어요. 잠시 후 다시 해주세요.' };
  }

  if (reservedUserId !== null) {
    const attached = await attachChildLogin(supabase, {
      studentId,
      loginId,
      userId: reservedUserId,
    });
    if (!attached) {
      // 학생은 남기고 계정만 놓아 준다. 등록 자체는 끝났으므로 되돌리면
      // 부모가 처음부터 다시 해야 한다. 로그인은 마이페이지에서 만든다.
      await releaseChildAuthUser(reservedUserId);
      console.error(`[onboarding] 아이 로그인을 붙이지 못했다: ${studentId}`);
    }
  }

  await record(supabase, EVENT.studentCreated, {
    accountId: auth.user.id,
    studentId,
  });

  // 다음 화면이 이 학생의 파트너를 정한다. 쿠키로 넘긴다 — 주소창에 학생
  // id 를 남기지 않는다.
  const jar = await cookies();
  jar.set(STUDENT_COOKIE, studentId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });

  redirect('/onboarding/persona');
}
