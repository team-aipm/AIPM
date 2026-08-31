import 'server-only';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * service_role 클라이언트. **RLS를 통째로 우회한다.**
 *
 * 반드시 지킬 것 (DEV-001 §8 · DEV-003 §4-3)
 *   - 'use client' 파일에서 import 금지. `server-only`가 빌드 단계에서 막는다
 *   - 학생 요청을 그대로 대신 수행하는 용도로 쓰지 않는다
 *   - 배치·웹훅·운영 작업 등 사용자 세션이 없는 경우에만 쓴다
 *
 * 학생·부모의 요청 처리에는 `./server`를 쓴다. 그래야 RLS가 적용된다.
 */
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY가 없습니다. .env.local을 확인하세요. (DEV-003 §6)',
    );
  }

  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}
