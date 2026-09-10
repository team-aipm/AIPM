'use client';

/**
 * MY-003 「아이 로그인」.
 *
 * 이 화면에서만 쓰므로 route 의 `_components/` 에 둔다(DEV-001).
 * 클라이언트인 이유는 하나다 — **틀렸을 때 그 자리에서 알려주기 위해서**다.
 *
 * 아직 없으면 만드는 폼, 있으면 비밀번호를 바꾸는 폼이 나온다. 아이디는
 * 만든 뒤에 바꾸지 않는다 — 아이가 겨우 외운 것을 바꾸면 다시 못 들어온다.
 */

import { useActionState } from 'react';
import {
  makeChildLogin,
  resetChildPassword,
  type ChildLoginState,
} from '../../../_actions';

const EMPTY: ChildLoginState = { error: null, done: null };

const FIELD =
  'rounded-xl border border-black/10 bg-white px-3.5 py-3 text-[15px] outline-none focus:border-meti';
const SUBMIT =
  'rounded-xl bg-meti py-3 text-[14px] font-bold text-white disabled:opacity-60';

function Result({ state }: { state: ChildLoginState }) {
  if (state.error !== null) {
    return (
      <p role="alert" className="text-[13px] font-semibold text-red-600">
        {state.error}
      </p>
    );
  }
  if (state.done !== null) {
    return <p className="text-[13px] font-semibold text-meti">{state.done}</p>;
  }
  return null;
}

function Create({ studentId }: { studentId: string }) {
  const [state, action, pending] = useActionState(makeChildLogin, EMPTY);

  return (
    <form action={action} className="flex flex-col gap-3">
      <p className="text-[12px] leading-relaxed text-meti-sub">
        아이가 자기 기기에서 들어올 수 있게 아이디와 첫 비밀번호를 정해주세요.
        <br />
        아이디는 나중에 바꿀 수 없습니다.
      </p>

      <input type="hidden" name="student_id" value={studentId} />

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-meti-sub">아이디</span>
        <input
          name="login_id"
          type="text"
          required
          autoCapitalize="none"
          spellCheck={false}
          placeholder="jaeun2016"
          className={FIELD}
        />
        <span className="text-[11px] text-meti-sub">
          영문 소문자 · 숫자 · 밑줄 4~20자. 한글은 쓸 수 없습니다.
        </span>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-meti-sub">첫 비밀번호</span>
        <input
          name="password"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          className={FIELD}
        />
      </label>

      <Result state={state} />

      <button type="submit" disabled={pending} className={SUBMIT}>
        {pending ? '만드는 중…' : '로그인 만들기'}
      </button>
    </form>
  );
}

function Reset({ studentId, loginId }: { studentId: string; loginId: string }) {
  const [state, action, pending] = useActionState(resetChildPassword, EMPTY);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1 rounded-xl bg-meti-bg px-3.5 py-3">
        <span className="text-[11px] font-semibold text-meti-sub">아이디</span>
        <span className="text-[15px] font-bold text-meti-ink">{loginId}</span>
      </div>

      <p className="text-[12px] leading-relaxed text-meti-sub">
        아이 계정에는 메일로 비밀번호를 찾는 길이 없습니다. 잊었다면 여기서
        새로 정해주세요.
      </p>

      <form action={action} className="flex flex-col gap-3">
        <input type="hidden" name="student_id" value={studentId} />
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-meti-sub">새 비밀번호</span>
          <input
            name="password"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            className={FIELD}
          />
        </label>

        <Result state={state} />

        <button type="submit" disabled={pending} className={SUBMIT}>
          {pending ? '바꾸는 중…' : '비밀번호 바꾸기'}
        </button>
      </form>
    </div>
  );
}

export function ChildLoginSection({
  studentId,
  loginId,
}: {
  studentId: string;
  loginId: string | null;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="text-[12px] font-bold text-meti-sub">아이 로그인</h2>
      {loginId === null ? (
        <Create studentId={studentId} />
      ) : (
        <Reset studentId={studentId} loginId={loginId} />
      )}
    </section>
  );
}
