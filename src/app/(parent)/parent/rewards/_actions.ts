'use server';

/**
 * 「보상을 줬어요」 — 부모 홈 카드 · RWD-001 목록 · RWD-003 상세가 같이 부른다.
 *
 * `lib/services/reward` 를 부르는 얇은 래퍼다(DEV-001). 도장을 다 모은 것
 * (`achieved`)과 실제로 준 것(`delivered`)은 다른 날이다(COM-002 §22-5).
 * 진행 중인 다음 보상의 도장은 건드리지 않는다.
 */

import { revalidatePath } from 'next/cache';
import { requireParent } from '@/lib/services/viewer';
import { markDelivered } from '@/lib/services/reward';

export async function deliverReward(goalId: string): Promise<{ ok: boolean }> {
  const { client } = await requireParent();
  const ok = await markDelivered(client, goalId);
  if (ok) {
    revalidatePath('/parent');
    revalidatePath('/parent/rewards', 'layout');
  }
  return { ok };
}
