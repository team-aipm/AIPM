import 'server-only';

/**
 * 아이 로그인 계정 (MY-003 · COM-005 §9)
 *
 * 부모가 아이의 아이디와 첫 비밀번호를 정해 준다. 아이는 그것으로 자기
 * 기기에서 들어온다.
 *
 * ## service_role 을 쓰는 곳과 쓰지 않는 곳
 *
 * DEV-001 §8 은 service_role 을 "사용자 요청 경로에서 쓰지 않는다" 고
 * 정한다. 그런데 `auth.users` 에 행을 만드는 길은 Admin API 뿐이다 —
 * 부모가 대신 만들어 주는 계정이라 아이가 가입 메일을 받을 수도 없다.
 *
 * 그래서 **딱 한 걸음만** 올라간다.
 *
 * ```text
 * 1  부모 세션으로 학생을 읽는다        ← RLS 가 남의 아이를 안 준다
 * 2  account_id 가 부모 본인인지 본다    ← 아이 세션으로는 못 지나간다
 * 3  그때만 Admin API 로 계정을 만든다
 * 4  student 행은 다시 부모 세션으로 고친다
 * ```
 *
 * 4번을 service_role 로 하지 않는 이유가 있다. 부모 세션으로 쓰면 RLS 와
 * `student_self_update_guard` 가 그대로 걸린다 — 우회하는 길을 하나라도
 * 덜 만든다.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { emailForLoginId, isValidLoginId } from '@/lib/constants/student-login';
import type { Database } from '@/types/database';

type Client = SupabaseClient<Database>;

/** 부모 본인의 아이인지 확인하고 학생을 돌려준다. 아니면 `null` */
async function ownStudent(
  client: Client,
  accountId: string,
  studentId: string,
): Promise<Database['public']['Tables']['student']['Row'] | null> {
  const { data } = await client
    .from('student')
    .select('*')
    .eq('student_id', studentId)
    .maybeSingle();

  // RLS 는 아이 자신에게도 이 행을 준다. **부모인지 여기서 다시 본다** —
  // 아이가 자기 비밀번호를 마음대로 바꾸게 두지 않는다.
  if (data === null || data.account_id !== accountId) return null;
  return data;
}

/**
 * 실패한 이유를 부모가 읽을 수 있는 말로.
 *
 * **아이디 탓으로만 돌리지 않는다.** 트리거가 아이 계정을 부모로 오해해
 * 가입을 되돌렸을 때, 화면에는 "이미 쓰고 있는 아이디" 라고 나왔다. 아이디는
 * 멀쩡했고, 부모는 이름만 계속 바꿔 보게 된다.
 */
function loginError(message: string | undefined): string {
  const text = (message ?? '').toLowerCase();
  if (text.includes('already been registered') || text.includes('already exists')) {
    return '이미 쓰고 있는 아이디예요. 다른 아이디로 지어주세요.';
  }
  return '아이 로그인을 만들지 못했습니다. 잠시 후 다시 시도해주세요.';
}

export type LoginResult = { ok: true } | { ok: false; error: string };

/**
 * 아이 로그인을 만든다 (MY-003).
 *
 * 이미 있으면 만들지 않는다 — 비밀번호만 바꾸려면 `changeChildPassword` 다.
 */
export async function createChildLogin(
  client: Client,
  accountId: string,
  input: { studentId: string; loginId: string; password: string },
): Promise<LoginResult> {
  const loginId = input.loginId.trim().toLowerCase();

  if (!isValidLoginId(loginId)) {
    return { ok: false, error: '아이디는 영문 소문자·숫자·밑줄 4~20자로 지어주세요.' };
  }
  if (input.password.length < 6) {
    return { ok: false, error: '비밀번호는 6자 이상으로 정해주세요.' };
  }

  const student = await ownStudent(client, accountId, input.studentId);
  if (student === null) return { ok: false, error: '학생을 찾지 못했습니다.' };
  if (student.auth_user_id !== null) {
    return { ok: false, error: '이미 로그인이 있습니다. 비밀번호만 바꿀 수 있습니다.' };
  }

  const admin = createAdminClient();
  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email: emailForLoginId(loginId),
    password: input.password,
    // 받을 수 없는 주소다. 확인 메일을 보내면 영원히 못 들어온다.
    email_confirm: true,
    user_metadata: { role: 'student', student_id: student.student_id },
  });

  if (authError !== null || created.user === null) {
    console.error(`[student-login] 계정 생성 실패: ${authError?.message ?? '알 수 없음'}`);
    return { ok: false, error: loginError(authError?.message) };
  }

  const { error: linkError } = await client
    .from('student')
    .update({ login_id: loginId, auth_user_id: created.user.id })
    .eq('student_id', student.student_id);

  if (linkError !== null) {
    // **만들다 만 계정을 남기지 않는다.** 남으면 그 아이디를 아무도 다시
    // 못 쓰는데 화면에는 아무것도 안 보인다.
    await admin.auth.admin.deleteUser(created.user.id);
    console.error(`[student-login] 연결 실패: ${linkError.message}`);
    return { ok: false, error: '로그인을 만들지 못했습니다. 잠시 뒤 다시 시도해주세요.' };
  }

  return { ok: true };
}

/**
 * 비밀번호를 바꾼다 (MY-003).
 *
 * 아이 계정에는 이메일로 재설정하는 길이 없다(받을 수 없는 주소라서).
 * **잊었을 때 부모가 여기서 바꿔 주는 것이 유일한 길이다.**
 */
export async function changeChildPassword(
  client: Client,
  accountId: string,
  input: { studentId: string; password: string },
): Promise<LoginResult> {
  if (input.password.length < 6) {
    return { ok: false, error: '비밀번호는 6자 이상으로 정해주세요.' };
  }

  const student = await ownStudent(client, accountId, input.studentId);
  if (student === null) return { ok: false, error: '학생을 찾지 못했습니다.' };
  if (student.auth_user_id === null) {
    return { ok: false, error: '아직 로그인을 만들지 않았습니다.' };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(student.auth_user_id, {
    password: input.password,
  });

  if (error !== null) {
    console.error(`[student-login] 비밀번호 변경 실패: ${error.message}`);
    return { ok: false, error: '비밀번호를 바꾸지 못했습니다.' };
  }

  return { ok: true };
}

/**
 * 로그인한 사람이 아이라면 그 학생 id.
 *
 * 부모면 `null` 이다. 로그인 직후 어디로 보낼지 이것으로 갈린다.
 */
export async function studentIdOfViewer(
  client: Client,
  userId: string,
): Promise<string | null> {
  const { data } = await client
    .from('student')
    .select('student_id')
    .eq('auth_user_id', userId)
    .maybeSingle();

  return data?.student_id ?? null;
}

// ============================================================
// 학생 등록과 같은 화면에서 만들 때 (STU-001)
// ============================================================
//
// 학생을 먼저 만들고 로그인을 나중에 붙이면, 아이디가 겹쳤을 때 **학생만
// 남는다.** 부모는 등록이 됐는지 안 됐는지 알 수 없고, 다시 누르면 같은
// 아이가 둘이 된다.
//
// 그래서 순서를 뒤집는다. 겹치는지는 Auth 만 알고 있으므로 **계정을 먼저
// 잡아 본다.** 학생 만들기가 실패하면 잡아 둔 것을 놓아 준다.

export type Reserved = { ok: true; userId: string } | { ok: false; error: string };

/** 아이디를 선점한다. 겹치면 여기서 끝난다 — 아직 아무것도 안 만들었다 */
export async function reserveChildAuthUser(input: {
  loginId: string;
  password: string;
}): Promise<Reserved> {
  const loginId = input.loginId.trim().toLowerCase();

  if (!isValidLoginId(loginId)) {
    return { ok: false, error: '아이디는 영문 소문자·숫자·밑줄 4~20자로 지어주세요.' };
  }
  if (input.password.length < 6) {
    return { ok: false, error: '아이 비밀번호는 6자 이상으로 정해주세요.' };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: emailForLoginId(loginId),
    password: input.password,
    email_confirm: true,
    user_metadata: { role: 'student' },
  });

  if (error !== null || data.user === null) {
    console.error(`[student-login] 선점 실패: ${error?.message ?? '알 수 없음'}`);
    return { ok: false, error: loginError(error?.message) };
  }

  return { ok: true, userId: data.user.id };
}

/** 뒤가 실패했을 때 되돌린다. 놓아 주지 못하면 그 아이디는 아무도 못 쓴다 */
export async function releaseChildAuthUser(userId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error !== null) {
    console.error(`[student-login] 선점 해제 실패 ${userId}: ${error.message}`);
  }
}

/**
 * 선점해 둔 계정을 학생에게 붙인다.
 *
 * 부모 세션으로 쓴다 — RLS 와 트리거가 그대로 걸린다.
 */
export async function attachChildLogin(
  client: Client,
  input: { studentId: string; loginId: string; userId: string },
): Promise<boolean> {
  const { error } = await client
    .from('student')
    .update({ login_id: input.loginId.trim().toLowerCase(), auth_user_id: input.userId })
    .eq('student_id', input.studentId);

  if (error !== null) {
    console.error(`[student-login] 붙이기 실패: ${error.message}`);
    return false;
  }
  return true;
}
