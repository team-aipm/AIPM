import 'server-only';

/**
 * 지금 보고 있는 사람이 부모인가 아이인가.
 *
 * **부모와 아이는 계정으로 갈린다**(COM-002 §4-1). 같은 `auth.users` 를
 * 쓰지만 `student.auth_user_id` 에 걸려 있으면 아이다.
 *
 * ## 왜 화면마다 막는가
 *
 * 부모는 부모 화면만, 아이는 학생 화면만 본다. 링크를 안 두는 것으로는
 * 모자란다 — 주소를 치면 그만이고, 뒤로가기로도 넘어간다.
 *
 * 학생 영역 안에서도 **한 화면은 예외다.** `STU-001` 첫 학생 등록은
 * 폴더만 `(student)` 에 있을 뿐 부모가 쓰는 화면이다(COM-003 §4.2 의
 * 사용자 칸이 「부모」다). 그래서 영역 전체를 껍데기에서 막지 않고
 * 화면마다 부른다.
 */

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { studentIdOfViewer } from '@/lib/services/student-login';

type Viewer = {
  client: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  /** 아이 계정이면 그 학생. 부모면 `null` */
  studentId: string | null;
};

async function viewer(): Promise<Viewer> {
  const client = await createClient();
  const { data } = await client.auth.getUser();
  if (data.user === null) redirect('/login');
  return {
    client,
    userId: data.user.id,
    studentId: await studentIdOfViewer(client, data.user.id),
  };
}

/**
 * 아이만 들어온다. 부모는 부모 홈으로 돌려보낸다.
 *
 * 학생 화면에는 부모가 볼 것이 없다. 반대로 **부모 화면에는 아이가 보면
 * 안 되는 것이 있다** — 상세 평가점수와 Logic Gap 이다(COM-003).
 */
export async function requireChild(): Promise<Viewer & { studentId: string }> {
  const found = await viewer();
  if (found.studentId === null) redirect('/parent');
  return { ...found, studentId: found.studentId };
}

/** 부모만 들어온다. 아이는 자기 홈으로 돌려보낸다 */
export async function requireParent(): Promise<Viewer> {
  const found = await viewer();
  if (found.studentId !== null) redirect('/home');
  return found;
}
