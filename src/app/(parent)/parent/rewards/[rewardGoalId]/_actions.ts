'use server';

/**
 * RWD-003 보상 상세·수정. `lib/services/reward` 를 부르는 얇은 래퍼다(DEV-001).
 *
 * 진행 중인 보상의 목표 수를 못 고치게 하는 것은 서비스가 한다 — 화면이
 * 칩을 잠가도 요청은 따로 올 수 있다(COM-002 §22-5).
 */

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireParent } from '@/lib/services/viewer';
import { cancelGoal, getGoal, updateGoal } from '@/lib/services/reward';
import type { RewardFormState } from '../_components/RewardForm';

export async function updateRewardGoal(_prev: RewardFormState, formData: FormData): Promise<RewardFormState> {
  const { client } = await requireParent();
  const goal = await getGoal(client, String(formData.get('reward_goal_id') ?? ''));
  if (goal === null || (goal.reward_status !== 'active' && goal.reward_status !== 'queued')) {
    return { error: '이 보상은 고칠 수 없어요.' };
  }

  const result = await updateGoal(client, goal, {
    name: String(formData.get('name') ?? ''),
    target: Number(formData.get('target')),
  });
  if (!result.ok) return { error: result.error };

  revalidatePath('/parent');
  redirect(`/parent/rewards?child=${goal.student_id}`);
}

export async function cancelRewardGoal(goalId: string): Promise<{ error: string | null }> {
  const { client } = await requireParent();
  const goal = await getGoal(client, goalId);
  if (goal === null || (goal.reward_status !== 'active' && goal.reward_status !== 'queued')) {
    return { error: '이 보상은 그만둘 수 없어요.' };
  }

  try {
    await cancelGoal(client, goal);
  } catch (error) {
    console.error(error);
    return { error: '보상을 그만두지 못했어요. 잠시 후 다시 해 주세요.' };
  }

  revalidatePath('/parent');
  redirect(`/parent/rewards?child=${goal.student_id}`);
}
