'use client';

/**
 * 이 화면에서만 쓰는 폼이라 `src/components` 가 아니라 route 의
 * `_components/` 에 둔다(DEV-001).
 *
 * 클라이언트 컴포넌트인 이유는 하나다 — **틀렸을 때 그 자리에서 알려주기
 * 위해서**다. `useActionState` 가 서버가 돌려준 오류를 들고 있는다.
 */

import { useActionState } from 'react';
import { signIn, type SignInState } from '../_actions';

const EMPTY: SignInState = { error: null };

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, EMPTY);

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-meti-sub">이메일</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          className="rounded-xl border border-black/10 bg-white px-3.5 py-3 text-[15px] outline-none focus:border-meti"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-meti-sub">비밀번호</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="rounded-xl border border-black/10 bg-white px-3.5 py-3 text-[15px] outline-none focus:border-meti"
        />
      </label>

      {state.error !== null && (
        <p role="alert" className="text-[13px] font-semibold text-red-600">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-meti py-3.5 text-[15px] font-bold text-white disabled:opacity-60"
      >
        {pending ? '들어가는 중…' : '로그인'}
      </button>
    </form>
  );
}
