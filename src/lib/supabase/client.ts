import { createBrowserClient } from '@supabase/ssr';

/**
 * 브라우저용 Supabase 클라이언트. anon key를 쓴다.
 *
 * 접근 통제는 이 파일이 아니라 DB의 RLS 정책이 담당한다.
 * anon key는 번들에 포함되어 공개되는 값이므로, 여기서 막는다는 발상을
 * 하지 않는다. (DEV-003 §4-5)
 *
 * Client Component에서만 쓴다. RSC나 Server Action에서는 `./server`를 쓴다.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
