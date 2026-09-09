import 'server-only';

/**
 * 운영자 (COM-007 §7 · COM-002 §20-B)
 *
 * **운영자는 기본적으로 아동의 학습 내용을 볼 수 없다.** 필요할 때, 필요한
 * 만큼, 흔적을 남기고 본다. 이 파일이 그 규칙을 코드로 옮긴 것이다.
 *
 * ## service_role 을 쓰는 이유
 *
 * DEV-001 §8 은 "학생 요청을 그대로 대신 수행하는 용도로 쓰지 않는다" 고
 * 정한다. 어드민은 그 경우가 아니다 — 남의 계정을 보는 것이 일이라 RLS 로는
 * 애초에 한 줄도 못 읽는다.
 *
 * 대신 **순서를 지킨다.**
 *
 * ```text
 * 1  로그인한 사람의 세션으로 admin_user 를 읽는다   ← RLS 가 본인 행만 준다
 * 2  없거나 is_active 가 false 면 거기서 끝
 * 3  그때만 service_role 클라이언트를 돌려준다
 * ```
 *
 * 부모가 스스로 운영자가 될 수 없다. `admin_user` 에 행을 넣는 것은 SQL 로만
 * 한다.
 */

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Database } from '@/types/database';

export type AdminUser = Database['public']['Tables']['admin_user']['Row'];
export type AdminRole = Database['public']['Enums']['admin_role'];

export type AdminContext = {
  admin: AdminUser;
  /** RLS 를 우회한다. 위의 확인을 통과한 뒤에만 손에 들어온다 */
  db: ReturnType<typeof createAdminClient>;
};

/** 운영자가 아니면 `null`. 부르는 쪽이 화면을 안 그린다 */
export async function currentAdmin(): Promise<AdminContext | null> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (auth.user === null) return null;

  const { data, error } = await supabase
    .from('admin_user')
    .select('*')
    .eq('admin_id', auth.user.id)
    .maybeSingle();

  if (error !== null || data === null || !data.is_active) return null;

  return { admin: data, db: createAdminClient() };
}

/** 권한 등급 (COM-007 §7-2) */
export function can(role: AdminRole, what: 'view' | 'unmask' | 'write'): boolean {
  if (what === 'view') return true;
  if (what === 'unmask') return role === 'full' || role === 'cs';
  return role === 'full';
}

/**
 * 감사 로그를 남긴다 (COM-007 §7-3).
 *
 * **마스킹 해제와 대화 원문 열람은 반드시 남긴다.** 남기지 못하면 그
 * 행동도 하지 않는다 — 흔적 없이 보는 길을 열어 두지 않는다.
 */
export async function logAudit(
  ctx: AdminContext,
  entry: { action: string; targetType: string; targetId: string; reason?: string },
): Promise<boolean> {
  const { error } = await ctx.db.from('audit_log').insert({
    admin_id: ctx.admin.admin_id,
    action: entry.action,
    target_type: entry.targetType,
    target_id: entry.targetId,
    reason: entry.reason ?? null,
  });

  if (error !== null) {
    console.error(`[admin] 감사 로그 실패: ${error.message}`);
    return false;
  }
  return true;
}

// ============================================================
// 마스킹 (COM-007 §7-1)
// ============================================================

/** 김은재 → 김** · 은재 → 은* */
export function maskName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length <= 1) return trimmed;
  return trimmed[0] + '*'.repeat(trimmed.length - 1);
}

/** kim@gmail.com → ki**@gmail.com */
export function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at <= 0) return '***';
  const head = email.slice(0, at);
  const kept = head.slice(0, Math.min(2, head.length));
  return `${kept}${'*'.repeat(Math.max(1, head.length - kept.length))}${email.slice(at)}`;
}

/** 010-1234-5678 → 010-****-**78 */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '***';
  return `${digits.slice(0, 3)}-****-**${digits.slice(-2)}`;
}
