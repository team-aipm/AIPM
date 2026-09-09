'use client';

/**
 * 입력 오류 · 가입 완료는 **State 다**(COM-003). 별도 Route 로 만들지
 * 않는다(CLAUDE.md UI). 그래서 한 컴포넌트가 세 모습을 갖는다.
 */

import { useActionState } from 'react';
import Link from 'next/link';
import { signUp, type SignUpState } from '../_actions';

const IDLE: SignUpState = { status: 'idle' };

const field =
  'rounded-xl border border-black/10 bg-white px-3.5 py-3 text-[15px] outline-none focus:border-meti';

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-meti-sub">
        {label}
        {hint !== undefined && <span className="ml-1.5 font-normal">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

export function SignupForm() {
  const [state, action, pending] = useActionState<SignUpState, FormData>(
    signUp,
    IDLE,
  );

  if (state.status === 'sent') {
    return (
      <div className="flex flex-col gap-4 text-center">
        <p className="text-[15px] font-bold text-meti-ink">
          {state.email} 으로
          <br />
          확인 메일을 보냈어요
        </p>
        <p className="text-[13px] leading-relaxed text-meti-sub">
          메일의 링크를 한 번 눌러야 로그인할 수 있어요.
          <br />
          메일이 안 보이면 스팸함도 확인해주세요.
        </p>
        <Link
          href="/login"
          className="rounded-xl bg-meti py-3.5 text-[15px] font-bold text-white"
        >
          로그인하러 가기
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <Row label="이메일">
        <input name="email" type="email" autoComplete="email" required className={field} />
      </Row>

      <Row label="비밀번호" hint="8자 이상">
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className={field}
        />
      </Row>

      <Row label="보호자 이름">
        <input name="account_name" type="text" autoComplete="name" required className={field} />
      </Row>

      <Row label="휴대폰 번호">
        <input
          name="phone_number"
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          placeholder="010-0000-0000"
          required
          className={field}
        />
      </Row>

      <Row label="보호자 생년월일">
        <input name="birth_date" type="date" required className={field} />
      </Row>

      <fieldset className="flex flex-col gap-2 rounded-xl bg-meti-bg/60 p-3.5">
        <legend className="px-1 text-xs font-semibold text-meti-sub">
          소식 받기 (선택)
        </legend>
        {[
          ['marketing_email_opt_in', '이메일'],
          ['marketing_sms_opt_in', '문자'],
          ['marketing_alimtalk_opt_in', '알림톡'],
        ].map(([name, label]) => (
          <label key={name} className="flex items-center gap-2 text-[13px] text-meti-ink">
            <input type="checkbox" name={name} className="h-4 w-4 accent-meti" />
            {label}
          </label>
        ))}
      </fieldset>

      {state.status === 'error' && (
        <p role="alert" className="text-[13px] font-semibold text-red-600">
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-meti py-3.5 text-[15px] font-bold text-white disabled:opacity-60"
      >
        {pending ? '만드는 중…' : '회원가입'}
      </button>
    </form>
  );
}
