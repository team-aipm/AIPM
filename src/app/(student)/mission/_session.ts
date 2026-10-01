import 'server-only';

/**
 * 미션이 지금 다루는 세션을 고른다 — 오늘 것인가, 이어 하는 지난 것인가.
 *
 * 미션 화면(`page.tsx`)과 서버 액션(`_actions.ts`)이 **같은 규칙**을 써야 한다.
 * 화면은 지난 미션을 그리는데 액션이 오늘 세션에 답을 적으면 기록이 어긋난다.
 *
 * 지난 미션 쿠키가 있고 그 세션이 아직 이어 할 수 있으면 그것, 아니면 오늘
 * 세션이다. 쿠키는 권한이 아니다 — `findPastSession` 이 매번 다시 본다.
 */

import { cookies } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import {
  findPastSession,
  findTodaySession,
  type LearningSession,
  type PastSession,
} from '@/lib/services/learning-session';
import { PAST_SESSION_COOKIE } from '@/lib/constants/student-cookie';

export type MissionSession =
  | { kind: 'today'; session: LearningSession }
  | { kind: 'past'; session: PastSession };

export async function missionSession(
  client: SupabaseClient<Database>,
  studentId: string,
): Promise<MissionSession | null> {
  const jar = await cookies();
  const pastId = jar.get(PAST_SESSION_COOKIE)?.value ?? '';
  if (pastId !== '') {
    const past = await findPastSession(client, studentId, pastId);
    if (past !== null) return { kind: 'past', session: past };
  }

  const session = await findTodaySession(client, studentId);
  return session === null ? null : { kind: 'today', session };
}
