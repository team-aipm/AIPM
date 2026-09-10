import 'server-only';

/**
 * 로그아웃 (AUTH-001 · MY-008)
 *
 * 세 화면에서 나갈 수 있고, 나가는 일은 셋 다 똑같다. 각자 적어 두면
 * **한 곳만 고치는 사고**가 난다 — 실제로 그랬다. 세션은 지우고 학생
 * 쿠키는 남기는 코드가 두 곳에 있었다.
 *
 * `next/headers` 를 쓰므로 요청 안에서만 부를 수 있다. 서버 전용이다.
 */

import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { STUDENT_COOKIE } from '@/lib/constants/student-cookie';

/**
 * 세션과 「지금 보고 있는 학생」을 함께 지운다.
 *
 * **학생 쿠키를 남기지 않는다.** 남기면 다음에 들어온 사람이 남의 학생 id 를
 * 물고 있게 된다. RLS 가 막아 주므로 새는 것은 없지만, 화면이 빈 채로 떠서
 * 왜 그런지 알 수 없다.
 *
 * 리다이렉트는 부르는 쪽이 한다 — 나가서 어디로 갈지는 화면마다 다르다.
 */
export async function endSession(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const jar = await cookies();
  jar.delete(STUDENT_COOKIE);
}
