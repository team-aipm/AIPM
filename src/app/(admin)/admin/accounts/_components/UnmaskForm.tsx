'use client';

/**
 * 마스킹 해제. **사유를 적어야 열린다**(COM-007 §7-1).
 *
 * 해제된 값은 이 화면에서만 잠깐 보인다. 새로고침하면 다시 가려진다 —
 * 열어 둔 채로 자리를 비우는 일을 막는다.
 */

import { useActionState } from 'react';
import { unmaskAccount, type UnmaskState } from '../_actions';

const IDLE: UnmaskState = { error: null, unmaskedId: null };

export function UnmaskForm({
  accountId,
  name,
  email,
  phone,
  canUnmask,
}: {
  accountId: string;
  name: string;
  email: string;
  phone: string;
  canUnmask: boolean;
}) {
  const [state, action, pending] = useActionState(unmaskAccount, IDLE);

  if (!canUnmask) {
    return <span className="text-[11px] text-neutral-400">권한 없음</span>;
  }

  if (state.unmaskedId === accountId) {
    return (
      <div className="flex flex-col gap-0.5 text-[12px]">
        <span className="font-semibold">{name}</span>
        <span>{email}</span>
        <span>{phone}</span>
        <span className="text-[10px] text-neutral-400">기록됨 · 새로고침하면 다시 가려짐</span>
      </div>
    );
  }

  return (
    <form action={action} className="flex items-center gap-1.5">
      <input type="hidden" name="account_id" value={accountId} />
      <input
        name="reason"
        placeholder="사유"
        className="w-28 rounded border border-black/15 px-2 py-1 text-[12px] outline-none focus:border-neutral-500"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded border border-black/15 px-2 py-1 text-[12px] font-semibold disabled:opacity-50"
      >
        해제
      </button>
      {state.error !== null && (
        <span className="text-[11px] text-red-600">{state.error}</span>
      )}
    </form>
  );
}
