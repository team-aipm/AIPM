'use client';

/**
 * Figma `주간 리포트 / 불러오기 실패`.
 *
 * 「학습 기록은 안전하게 보관 중이에요」 를 먼저 말한다. 리포트가 안 보이면
 * 기록이 사라진 줄 안다.
 */

import { LoadFailed } from '../_components/LoadFailed';

export default function ReportsError({ reset }: { error: Error; reset: () => void }) {
  return (
    <LoadFailed
      title="리포트를 불러오지 못했어요"
      body="학습 기록은 안전하게 보관 중이에요. 잠시 후 다시 확인해 주세요."
      reset={reset}
    />
  );
}
