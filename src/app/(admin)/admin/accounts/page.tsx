/**
 * ADM-004 계정 관리 — 목록 · `/admin/accounts`
 *
 * **개인정보는 기본 마스킹이다.** 해제하면 감사 로그가 남는다
 * (COM-007 §7-1 · §7-3). 와이어프레임(2026-09-03)이 그렇게 그려져 있다.
 */

import { notFound } from 'next/navigation';
import { currentAdmin, maskEmail, maskName, maskPhone } from '@/lib/services/admin';
import { UnmaskForm } from './_components/UnmaskForm';

export const metadata = { title: 'AIPM 운영 · 계정' };

export default async function AdminAccountsPage() {
  const ctx = await currentAdmin();
  if (ctx === null) notFound();

  const { data: accounts } = await ctx.db
    .from('account')
    .select('account_id, account_name, email, phone_number, created_at, last_login_at')
    .order('created_at', { ascending: false })
    .limit(50);

  const rows = accounts ?? [];

  const { data: students } = await ctx.db.from('student').select('account_id');
  const countOf = (accountId: string) =>
    (students ?? []).filter((item) => item.account_id === accountId).length;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-[18px] font-extrabold">계정</h1>
        <p className="text-[12px] text-neutral-500">
          개인정보는 기본 마스킹입니다. 해제하면 감사 로그가 남습니다.
        </p>
      </header>

      <div className="overflow-x-auto rounded-lg border border-black/10 bg-white">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-black/10 bg-neutral-50 text-[11px] text-neutral-500">
            <tr>
              <th className="px-4 py-2 font-semibold">이름</th>
              <th className="px-4 py-2 font-semibold">이메일</th>
              <th className="px-4 py-2 font-semibold">휴대폰</th>
              <th className="px-4 py-2 font-semibold">학생</th>
              <th className="px-4 py-2 font-semibold">가입</th>
              <th className="px-4 py-2 font-semibold">마스킹</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((account) => (
              <tr key={account.account_id} className="border-b border-black/5 last:border-0">
                <td className="px-4 py-2.5">{maskName(account.account_name)}</td>
                <td className="px-4 py-2.5">{maskEmail(account.email)}</td>
                <td className="px-4 py-2.5">{maskPhone(account.phone_number)}</td>
                <td className="px-4 py-2.5">{countOf(account.account_id)}</td>
                <td className="px-4 py-2.5 text-neutral-500">
                  {new Date(account.created_at).toLocaleDateString('ko-KR')}
                </td>
                <td className="px-4 py-2.5">
                  <UnmaskForm
                    accountId={account.account_id}
                    name={account.account_name}
                    email={account.email}
                    phone={account.phone_number}
                    canUnmask={ctx.admin.admin_role !== 'readonly'}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length === 0 && (
        <p className="text-[13px] text-neutral-500">계정이 없습니다.</p>
      )}
    </div>
  );
}
