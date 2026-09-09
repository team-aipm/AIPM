import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * 30일이 지난 문제 사진을 지운다. COM-007 §4-3
 *
 * **인식이 끝난 사진은 30일만 둔다.** 그 기간을 두는 이유는 하나다 —
 * "인식이 잘못됐다" 는 신고가 들어왔을 때 원본을 봐야 하기 때문이다. 지나면
 * 사진의 쓸모는 없고 보관 비용과 위험만 남는다.
 *
 * `src/app/api` 는 스트리밍 · 외부 콜백 · **배치**만 두는 자리다(DEV-001).
 * 이건 배치다.
 *
 * 세션이 없는 작업이라 service_role 을 쓴다. 그래서 **아무나 부르면 안 된다** —
 * `CRON_SECRET` 을 아는 요청만 받는다.
 */

export const dynamic = 'force-dynamic';

const BUCKET = 'problem-photos';
const KEEP_DAYS = 30;
/** 한 번에 훑는 양. 폴더 하나에 이보다 많으면 다음 실행이 이어서 지운다 */
const PAGE = 100;

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  // 비밀값을 안 정해 두면 아무나 부를 수 있다. 그럴 바에는 안 도는 게 낫다.
  if (secret === undefined || secret.trim() === '') return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const cutoff = Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000;

  // 경로가 <student_id>/<uuid>.<ext> 라서 첫 층이 학생 폴더다.
  const roots = await supabase.storage.from(BUCKET).list('', { limit: 1000 });
  if (roots.error !== null) {
    console.error(`[photo-sweep] 목록 실패: ${roots.error.message}`);
    return NextResponse.json({ error: 'list failed' }, { status: 500 });
  }

  let removed = 0;
  let kept = 0;

  for (const folder of roots.data ?? []) {
    // 파일이 아니라 폴더만 본다. 폴더는 id 가 null 로 온다.
    if (folder.id !== null) continue;

    const files = await supabase.storage
      .from(BUCKET)
      .list(folder.name, { limit: PAGE, sortBy: { column: 'created_at', order: 'asc' } });

    if (files.error !== null) {
      console.error(`[photo-sweep] ${folder.name} 목록 실패: ${files.error.message}`);
      continue;
    }

    const old = (files.data ?? [])
      .filter((file) => file.id !== null)
      .filter((file) => {
        const at = file.created_at;
        // 만든 시각을 모르면 지우지 않는다. 지우는 쪽이 되돌릴 수 없다.
        if (typeof at !== 'string') return false;
        return new Date(at).getTime() < cutoff;
      })
      .map((file) => `${folder.name}/${file.name}`);

    kept += (files.data ?? []).length - old.length;
    if (old.length === 0) continue;

    const gone = await supabase.storage.from(BUCKET).remove(old);
    if (gone.error !== null) {
      console.error(`[photo-sweep] ${folder.name} 삭제 실패: ${gone.error.message}`);
      continue;
    }
    removed += old.length;
  }

  console.log(`[photo-sweep] ${removed}장 삭제 · ${kept}장 유지 (${KEEP_DAYS}일 기준)`);
  return NextResponse.json({ removed, kept, keepDays: KEEP_DAYS });
}
