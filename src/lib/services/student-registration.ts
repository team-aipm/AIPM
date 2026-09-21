import 'server-only';

/**
 * 학생 등록 (COM-001 §3).
 *
 * **두 화면이 같은 일을 한다.** STU-001 첫 학생 등록과 MY-004 학생 추가는
 * 다른 화면이고 Route 도 다르지만(DEV-002 §3), 만드는 것은 같은 학생이다.
 * 학년 검사나 아이 로그인 예약 같은 규칙이 한쪽만 바뀌는 사고를 막으려고
 * 여기 한 벌만 둔다.
 *
 * **엔티티 파일이 아니다.** DEV-001 §4 의 1:1 규칙에서 벗어나 보이지만,
 * 이 일은 `student` 와 `student_login` 두 엔티티에 걸쳐 있고 되돌리는
 * 순서까지 정해야 한다 — 어느 한쪽에 넣으면 다른 쪽을 부르게 된다.
 *
 * 다음 화면은 여기서 정하지 않는다 — 부르는 쪽이 정한다.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { createStudent } from '@/lib/services/student';
import {
  reserveChildAuthUser,
  releaseChildAuthUser,
  attachChildLogin,
} from '@/lib/services/student-login';
import { EVENT, record } from '@/lib/analytics/events';

type Client = SupabaseClient<Database>;

export type RegisterResult =
  | { ok: true; studentId: string }
  | { ok: false; error: string };

/**
 * 폼에서 값을 꺼낸다. **두 화면이 같은 칸 이름을 쓴다.**
 *
 * 꺼내는 곳을 한 벌로 두지 않으면 한쪽 화면의 `input name` 만 바뀌었을 때
 * 조용히 빈 값이 들어간다.
 */
export function readStudentForm(formData: FormData) {
  const text = (key: string) => String(formData.get(key) ?? '').trim();
  return {
    studentName: text('student_name'),
    nickname: text('nickname'),
    birthDate: text('birth_date'),
    grade: Number(formData.get('grade') ?? 0),
    // 아이디는 대소문자를 가리지 않는다. 아이가 대문자로 치면 못 들어온다.
    loginId: text('login_id').toLowerCase(),
    loginPassword: String(formData.get('login_password') ?? ''),
  };
}

export async function registerStudent(
  client: Client,
  accountId: string,
  input: ReturnType<typeof readStudentForm>,
): Promise<RegisterResult> {
  const { studentName, birthDate, grade } = input;

  if (studentName === '' || birthDate === '') {
    return { ok: false, error: '이름과 생년월일을 채워주세요.' };
  }

  // MVP 는 4~6학년이다(COM-002 §4 · DB CHECK 제약). 화면에서 막고, DB 도
  // 막는다. 한쪽만 막으면 다른 경로로 들어온 값이 통과한다.
  if (grade < 4 || grade > 6) {
    return { ok: false, error: '지금은 4~6학년만 시작할 수 있어요.' };
  }

  // 닉네임 기본값은 이름이다(COM-002 §4). 무엇을 기본으로 썼는지도 남긴다 —
  // 나중에 "AI 가 왜 이 이름으로 부르지" 를 설명할 수 있어야 한다.
  const usedDefault = input.nickname === '';
  const nickname = usedDefault ? studentName : input.nickname;

  /**
   * **아이 로그인은 필수다.**
   *
   * 예전에는 선택이었다 — 부모가 로그인한 기기에서 프로필을 골라 들어가는
   * 길이 있었기 때문이다. 그 길을 닫았다(`lib/services/viewer`). 부모
   * 계정은 학생 화면에 들어가지 않으므로, 아이디가 없으면 **그 아이는
   * 학습을 시작할 방법이 아예 없다.**
   *
   * DB 는 여전히 nullable 이다(COM-002 §4-1). 이미 아이디 없이 등록된
   * 학생이 있어서 NOT NULL 로 조일 수 없다 — 그 아이들은 MY-003 에서
   * 아이디를 만들어 준다.
   */
  const { loginId, loginPassword } = input;

  if (loginId === '' || loginPassword === '') {
    return {
      ok: false,
      error: '아이가 쓸 아이디와 비밀번호를 채워주세요. 아이는 이것으로 들어옵니다.',
    };
  }

  // **아이디를 먼저 잡는다.** 학생을 만든 뒤에 붙이면, 아이디가 겹쳤을 때
  // 학생만 남는다 — 부모는 등록이 됐는지 모르고 다시 눌러 같은 아이를 둘로
  // 만든다. 겹치는지는 Auth 만 알고 있다.
  const reserved = await reserveChildAuthUser({ loginId, password: loginPassword });
  if (!reserved.ok) return { ok: false, error: reserved.error };
  const reservedUserId = reserved.userId;

  let studentId: string;
  try {
    const student = await createStudent(client, accountId, {
      studentName,
      nickname,
      nicknameSource: usedDefault ? 'name_default' : 'custom',
      birthDate,
      grade,
    });
    studentId = student.student_id;
  } catch (error) {
    await releaseChildAuthUser(reservedUserId);
    console.error(`[register] 학생 등록 실패: ${String(error)}`);
    return { ok: false, error: '등록하지 못했어요. 잠시 후 다시 해주세요.' };
  }

  const attached = await attachChildLogin(client, {
    studentId,
    loginId,
    userId: reservedUserId,
  });
  if (!attached) {
    // 학생은 남기고 계정만 놓아 준다. 등록 자체는 끝났으므로 되돌리면
    // 부모가 처음부터 다시 해야 한다. 아이디는 MY-003 에서 만들어 준다.
    await releaseChildAuthUser(reservedUserId);
    console.error(`[register] 아이 로그인을 붙이지 못했다: ${studentId}`);
  }

  await record(client, EVENT.studentCreated, { accountId, studentId });

  return { ok: true, studentId };
}
