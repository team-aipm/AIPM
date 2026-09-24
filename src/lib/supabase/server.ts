import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import {
  REMEMBER_COOKIE,
  REMEMBER_OFF,
  untilBrowserCloses,
} from '@/lib/constants/session-persistence';

/**
 * Server Component · Server Action · Route Handler용 클라이언트.
 *
 * 쿠키에서 세션을 읽어 로그인한 사용자 권한으로 동작한다.
 * anon key를 쓰므로 RLS가 그대로 적용된다.
 *
 * 요청마다 새로 만든다. 모듈 최상단에서 호출해 재사용하지 않는다.
 */
export async function createClient(options?: {
  /**
   * 「로그인 유지」 를 **지금 막 고른 경우**에만 넘긴다(로그인 Action).
   *
   * 그 요청에서는 표시 쿠키를 방금 쓴 참이라 되읽는 것에 기대고 싶지 않다.
   * 고른 값을 그대로 받는 편이 확실하다. 나머지 요청은 쿠키를 읽는다.
   */
  remember?: boolean;
}) {
  const cookieStore = await cookies();

  const remember =
    options?.remember ?? cookieStore.get(REMEMBER_COOKIE)?.value !== REMEMBER_OFF;

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, remember ? options : untilBrowserCloses(options)),
            );
          } catch {
            // Server Component에서는 쿠키를 쓸 수 없다.
            // 세션 갱신은 middleware가 담당하므로 여기서는 무시해도 된다.
          }
        },
      },
    },
  );
}
