import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Supabase 세션 쿠키를 갱신한다. (DEV-001 §6 · 운영 및 백오피스 PM 소유)
 *
 * 하는 일은 이것뿐이다.
 *   - 만료가 임박한 Access Token을 재발급받아 쿠키에 다시 심는다
 *
 * 하지 않는 일 — 여기에 넣지 말 것
 *   - 로그인 여부에 따른 Route 보호 · 리다이렉트
 *   - 부모 PIN 게이트(PAR-001)
 *   위 둘은 AUTH 영역이며 COM-003 확정 후 회원·유입 PM이 담당한다.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  // 이 호출이 토큰 갱신을 유발한다. 제거하면 세션이 조용히 만료된다.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    // 정적 파일과 이미지 최적화 요청은 제외한다.
    '/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
