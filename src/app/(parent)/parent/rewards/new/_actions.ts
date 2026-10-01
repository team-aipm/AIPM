'use server';

/**
 * RWD-002 보상 만들기. `lib/services/reward` 를 부르는 얇은 래퍼다(DEV-001).
 *
 * 진행 중이 없으면 곧바로 시작하고, 있으면 다음 차례로 둔다 — 그 판단과
 * 「진행 중 1개 · 다음 1개」 제한은 서비스가 한다(COM-002 §22-5).
 */

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireParent } from '@/lib/services/viewer';
import { createGoal } from '@/lib/services/reward';
import type { RewardFormState } from '../_components/RewardForm';

export async function createRewardGoal(_prev: RewardFormState, formData: FormData): Promise<RewardFormState> {
  const { client, userId } = await requireParent();
  const studentId = String(formData.get('student_id') ?? '');

  const result = await createGoal(client, userId, studentId, {
    name: String(formData.get('name') ?? ''),
    target: Number(formData.get('target')),
  });
  if (!result.ok) return { error: result.error };

  revalidatePath('/parent');
  redirect(`/parent/rewards?child=${studentId}`);
}
