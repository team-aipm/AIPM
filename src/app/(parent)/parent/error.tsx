'use client';

/**
 * Figma `보호자 홈 / 불러오기 실패`.
 *
 * `/parent/my/**` 의 오류도 여기로 온다(더 가까운 error 가 없으면). 그때
 * 「홈을 불러오지 못했어요」 라고 하면 틀리므로 주소를 보고 고른다.
 */

import { usePathname } from 'next/navigation';
import { LoadFailed } from './_components/LoadFailed';

export default function ParentError({ reset }: { error: Error; reset: () => void }) {
  const pathname = usePathname();
  return (
    <LoadFailed
      title={pathname === '/parent' ? '홈을 불러오지 못했어요' : '화면을 불러오지 못했어요'}
      body="연결을 확인한 뒤 다시 시도해 주세요."
      reset={reset}
    />
  );
}
