'use server';

/**
 * ADM-004 계정 관리 · 마스킹 해제.
 *
 * **해제는 사유가 필수이고 반드시 기록된다**(COM-007 §7-1 · §7-3).
 * 기록에 실패하면 해제도 하지 않는다 — 흔적 없이 보는 길을 열어 두지
 * 않는다.
 */

import { revalidatePath } from 'next/cache';
import { can, currentAdmin, logAudit } from '@/lib/services/admin';

export type UnmaskState = { error: string | null; unmaskedId: string | null };

export async function unmaskAccount(
  _prev: UnmaskState,
  formData: FormData,
): Promise<UnmaskState> {
  const accountId = String(formData.get('account_id') ?? '');
  const reason = String(formData.get('reason') ?? '').trim();

  if (accountId === '') return { error: '대상이 없습니다.', unmaskedId: null };
  if (reason.length < 5) {
    return { error: '사유를 5자 이상 적어주세요.', unmaskedId: null };
  }

  const ctx = await currentAdmin();
  if (ctx === null) return { error: '권한이 없습니다.', unmaskedId: null };
  if (!can(ctx.admin.admin_role, 'unmask')) {
    return { error: '읽기전용 권한으로는 해제할 수 없습니다.', unmaskedId: null };
  }

  const logged = await logAudit(ctx, {
    action: 'unmask',
    targetType: 'account',
    targetId: accountId,
    reason,
  });

  if (!logged) {
    return { error: '기록을 남기지 못해 해제하지 않았습니다.', unmaskedId: null };
  }

  revalidatePath('/admin/accounts');
  return { error: null, unmaskedId: accountId };
}
