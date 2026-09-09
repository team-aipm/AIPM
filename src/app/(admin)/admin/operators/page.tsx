/**
 * ADM-012 운영자 계정 · 권한 · `/admin/operators`
 *
 * **읽기만 한다.** 운영자를 늘리거나 권한을 바꾸는 것은 SQL 로만 한다 —
 * 화면에서 스스로 권한을 올릴 수 있으면 등급을 나눈 의미가 없다.
 *
 * 감사 로그도 여기서 본다(COM-007 §7-3). 지우거나 고치는 길은 없다.
 */

import { notFound } from 'next/navigation';
import { currentAdmin, maskEmail, type AdminRole } from '@/lib/services/admin';

export const metadata = { title: 'AIPM 운영 · 운영자' };

const ROLE_LABEL: Record<AdminRole, string> = {
  full: '전체',
  cs: 'CS',
  readonly: '읽기전용',
};

export default async function OperatorsPage() {
  const ctx = await currentAdmin();
  if (ctx === null) notFound();

  const { data: admins } = await ctx.db
    .from('admin_user')
    .select('*')
    .order('created_at', { ascending: true });

  const { data: recent } = await ctx.db
    .from('audit_log')
    .select('audit_id, created_at, action, target_type, target_id, reason')
    .order('created_at', { ascending: false })
    .limit(20);

  const logs = recent ?? [];

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h1 className="text-[18px] font-extrabold">운영자 계정</h1>
        <div className="overflow-x-auto rounded-lg border border-black/10 bg-white">
          <table className="w-full text-left text-[13px]">
            <thead className="border-b border-black/10 bg-neutral-50 text-[11px] text-neutral-500">
              <tr>
                <th className="px-4 py-2 font-semibold">이름</th>
                <th className="px-4 py-2 font-semibold">이메일</th>
                <th className="px-4 py-2 font-semibold">권한</th>
                <th className="px-4 py-2 font-semibold">상태</th>
              </tr>
            </thead>
            <tbody>
              {(admins ?? []).map((admin) => (
                <tr key={admin.admin_id} className="border-b border-black/5 last:border-0">
                  <td className="px-4 py-2.5">{admin.admin_name}</td>
                  <td className="px-4 py-2.5">{maskEmail(admin.email)}</td>
                  <td className="px-4 py-2.5">
                    {ROLE_LABEL[admin.admin_role as AdminRole]}
                  </td>
                  <td className="px-4 py-2.5 text-neutral-500">
                    {admin.is_active ? '활성' : '차단'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[12px] text-neutral-500">
          운영자 추가와 권한 변경은 SQL 로만 합니다. 화면에서 스스로 권한을 올릴
          수 있으면 등급을 나눈 의미가 없습니다.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-[15px] font-extrabold">감사 로그</h2>
        <div className="overflow-x-auto rounded-lg border border-black/10 bg-white">
          <table className="w-full text-left text-[13px]">
            <thead className="border-b border-black/10 bg-neutral-50 text-[11px] text-neutral-500">
              <tr>
                <th className="px-4 py-2 font-semibold">시각</th>
                <th className="px-4 py-2 font-semibold">행동</th>
                <th className="px-4 py-2 font-semibold">대상</th>
                <th className="px-4 py-2 font-semibold">사유</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.audit_id} className="border-b border-black/5 last:border-0">
                  <td className="px-4 py-2.5 text-neutral-500">
                    {new Date(log.created_at).toLocaleString('ko-KR')}
                  </td>
                  <td className="px-4 py-2.5">{log.action}</td>
                  <td className="px-4 py-2.5 text-neutral-500">
                    {log.target_type} · {log.target_id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-2.5">{log.reason ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {logs.length === 0 && (
          <p className="text-[13px] text-neutral-500">아직 기록이 없습니다.</p>
        )}
      </section>
    </div>
  );
}
