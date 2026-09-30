'use client';

/**
 * AUTH-002 회원가입 · Figma `회원가입 / 기본` (1:4690)
 *
 * 입력 오류 · 처리 중 · 가입 완료는 **State 다**(COM-003 §13-3). 별도 Route 로
 * 만들지 않는다.
 *
 * ```text
 *   이메일 형식 오류   129:1931   이메일 칸 아래
 *   이미 가입          129:2077   이메일 칸 아래 + 로그인하기
 *   비번 조건          129:2221   비밀번호 칸의 안내 자리에
 *   비번 불일치        129:2353   확인 칸 아래
 *   처리 중            129:2485   칸과 동의를 잠그고 버튼이 「회원가입 처리 중」
 *   가입 완료          1:5611     DoneNotice
 * ```
 *
 * **오류 문구는 서버가 정한다.** 어느 칸에 붙일지만 여기서 고른다 — Action
 * 이 한 줄의 문구만 돌려주기 때문이다. 고르는 기준은 Action 이 막는 순서와
 * 같은 검사(`looksLikeEmail` · `isValidPassword`)라 둘이 어긋나지 않는다.
 * 어느 칸에도 해당하지 않으면(필수 동의 · 서버 오류) 버튼 바로 위에 둔다.
 */

import { useActionState, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { signUp, type SignUpState } from '../_actions';
import { TERMS, TERMS_ORDER, type TermsKey } from '@/lib/constants/terms';
import { isValidPassword, looksLikeEmail } from '@/lib/constants/student-login';
import { BackBar } from '@/components/ui/BackBar';
import { fieldClass } from '@/components/ui/Field';
import { BrandButton } from '@/components/ui/BrandButton';
import { TermsSheet } from './TermsSheet';
import { DoneNotice } from './DoneNotice';

const EMPTY: SignUpState = { status: 'idle' };

const LABEL = 'text-[14px] font-semibold leading-5 text-text-primary';

/** Figma `Field Error` — 칸 아래에 붙는 12/18 */
const FIELD_ERROR = 'text-[12px] leading-[18px] text-error-text';

const CHECK = 'size-6 shrink-0 rounded-md accent-button-primary';

type Where = 'email' | 'password' | 'confirm' | 'form';

export function SignupForm() {
  const [state, action, pending] = useActionState(signUp, EMPTY);

  /**
   * **칸은 모두 React 가 들고 있다.** React 19 는 Action 이 끝나면 폼을
   * 비운다. 이메일 오타 하나로 비밀번호 두 칸까지 비면 다시 쳐야 한다 —
   * Figma 의 오류 State 들도 비밀번호를 그대로 둔 채 그린다.
   */
  const [typed, setTyped] = useState({ email: '', password: '', confirm: '' });
  const [agreed, setAgreed] = useState<Record<TermsKey, boolean>>({
    terms: false,
    privacy: false,
    guardian: false,
    marketing: false,
  });
  const [sheet, setSheet] = useState<TermsKey | null>(null);

  /**
   * **체크박스는 상태만으로는 안 지켜진다.** React 가 자기 값이 안 바뀌었다고
   * 보고 다시 그리지 않는다. 동의를 넷 다 눌러 뒀는데 이메일 오타 하나로
   * 전부 풀리면 다시 넷을 눌러야 한다. Action 이 끝날 때마다 고른 값을 다시
   * 씌운다. (`login/_components/LoginForm.tsx` 와 같은 이유)
   */
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const form = formRef.current;
    if (form === null) return;
    for (const key of TERMS_ORDER) {
      const box = form.elements.namedItem(`agree_${key}`);
      if (box instanceof HTMLInputElement) box.checked = agreed[key];
    }
  }, [state, agreed]);

  if (state.status === 'done' || state.status === 'sent') {
    return <DoneNotice email={state.status === 'sent' ? state.email : null} />;
  }

  const where: Where | null =
    state.status !== 'error'
      ? null
      : !looksLikeEmail(typed.email)
        ? 'email'
        : typed.password === '' || typed.confirm === '' || !isValidPassword(typed.password)
          ? 'password'
          : typed.password !== typed.confirm
            ? 'confirm'
            : 'form';
  const message = state.status === 'error' ? state.message : '';
  const taken = state.status === 'taken';

  const all = TERMS_ORDER.every((key) => agreed[key]);

  const toggleAll = (on: boolean) =>
    setAgreed({ terms: on, privacy: on, guardian: on, marketing: on });

  return (
    <>
      <form ref={formRef} action={action} className="flex flex-1 flex-col">
        <BackBar />

        {/* Figma `Content / 335` — p[12,20,20,20] gap16 */}
        <fieldset disabled={pending} className="flex flex-1 flex-col gap-4 px-5 pb-5 pt-3">
          <h1 className="text-[24px] font-bold leading-8 text-text-primary">보호자 회원가입</h1>

          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-2">
              <span className={LABEL}>이메일</span>
              {/*
                type 은 text 다. email 로 두면 브라우저 말풍선이 우리 문구보다
                먼저 뜬다. 확인은 Action 이 한다.
              */}
              <input
                name="email"
                type="text"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                value={typed.email}
                onChange={(e) => setTyped((t) => ({ ...t, email: e.target.value }))}
                placeholder="가입에 사용하실 이메일 주소를 입력해 주세요."
                aria-invalid={where === 'email' || taken}
                className={fieldClass('page', where === 'email' || taken)}
              />
              {where === 'email' && (
                <span role="alert" className={FIELD_ERROR}>
                  {message}
                </span>
              )}
              {taken && (
                <span role="alert" className={FIELD_ERROR}>
                  이미 가입된 이메일이에요.{' '}
                  <Link href="/login" className="font-semibold underline">
                    로그인하기
                  </Link>
                </span>
              )}
            </label>

            <label className="flex flex-col gap-2">
              <span className={LABEL}>비밀번호</span>
              <input
                name="password"
                type="password"
                autoComplete="new-password"
                value={typed.password}
                onChange={(e) => setTyped((t) => ({ ...t, password: e.target.value }))}
                placeholder="비밀번호 입력"
                aria-invalid={where === 'password'}
                className={fieldClass('page', where === 'password')}
              />
              {/*
                Figma 는 오류일 때 안내 자리에 오류를 넣는다(129:2221).

                안내는 Figma 문구 「권장해요」 그대로다. 하지만 Action 은 영문+숫자
                8자 이상을 **강제한다**(정책 v0.1 §3.2) — 문구와 규칙이 다르다.
              */}
              {where === 'password' ? (
                <span role="alert" className="text-[14px] leading-5 text-error-text">
                  {message}
                </span>
              ) : (
                <span className="text-[14px] leading-5 text-text-primary">
                  8자 이상, 영문+숫자 조합을 권장해요.
                </span>
              )}
            </label>

            <label className="flex flex-col gap-2">
              <span className={LABEL}>비밀번호 확인</span>
              <input
                name="password_confirm"
                type="password"
                autoComplete="new-password"
                value={typed.confirm}
                onChange={(e) => setTyped((t) => ({ ...t, confirm: e.target.value }))}
                placeholder="비밀번호를 다시 입력하세요"
                aria-invalid={where === 'confirm'}
                className={fieldClass('page', where === 'confirm')}
              />
              {where === 'confirm' && (
                <span role="alert" className={FIELD_ERROR}>
                  {message}
                </span>
              )}
            </label>
          </div>

          {/* Figma `약관동의` — 모두 동의 + 동의 줄. 줄마다 44px */}
          <div className="flex flex-col">
            <label className="flex min-h-[44px] cursor-pointer items-center gap-3 p-2">
              <input
                type="checkbox"
                checked={all}
                onChange={(e) => toggleAll(e.target.checked)}
                className={CHECK}
              />
              <span className="text-[16px] font-semibold leading-6 text-text-primary">
                모두 동의합니다
              </span>
            </label>

            {TERMS_ORDER.map((key) => (
              <div key={key} className="flex min-h-[44px] items-center justify-between">
                <label className="flex flex-1 cursor-pointer items-center gap-3 p-2">
                  <input
                    type="checkbox"
                    name={`agree_${key}`}
                    checked={agreed[key]}
                    onChange={(e) =>
                      setAgreed((prev) => ({ ...prev, [key]: e.target.checked }))
                    }
                    className={CHECK}
                  />
                  <span className="text-[16px] leading-6 text-text-primary">
                    ({TERMS[key].required ? '필수' : '선택'}) {TERMS[key].label}
                  </span>
                </label>

                {/*
                  **버튼이지 링크가 아니다.** 다른 곳으로 가는 것이 아니라
                  이 화면 위에 시트를 연다(COM-003 §13-3).
                */}
                <button
                  type="button"
                  onClick={() => setSheet(key)}
                  aria-label={`${TERMS[key].title} 보기`}
                  className="flex h-[44px] min-w-[45px] items-center justify-center text-[14px] font-semibold leading-5 text-text-secondary"
                >
                  보기
                </button>
              </div>
            ))}
          </div>

          {where === 'form' && (
            <p role="alert" className="text-[14px] leading-5 text-error-text">
              {message}
            </p>
          )}
        </fieldset>

        {/* Figma `CTA / Safe area` — p[20,20,34,20] */}
        <div className="flex flex-col gap-3 px-5 pb-[34px] pt-5">
          <BrandButton pending={pending}>{pending ? '회원가입 처리 중' : '회원가입'}</BrandButton>

          <Link
            href="/login"
            className="text-center text-[14px] font-semibold leading-5 text-button-primary"
          >
            이미 계정이 있어요? 로그인
          </Link>
        </div>
      </form>

      <TermsSheet open={sheet} onClose={() => setSheet(null)} />
    </>
  );
}
