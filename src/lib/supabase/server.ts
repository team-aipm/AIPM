import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

/**
 * Server Component · Server Action · Route Handler용 클라이언트.
 *
 * 쿠키에서 세션을 읽어 로그인한 사용자 권한으로 동작한다.
 * anon key를 쓰므로 RLS가 그대로 적용된다.
 *
 * 요청마다 새로 만든다. 모듈 최상단에서 호출해 재사용하지 않는다.
 */
export async function createClient() {
  const cookieStore = await cookies();

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
              cookieStore.set(name, value, options),
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
