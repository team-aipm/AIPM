'use client';

/**
 * AUTH-002 회원가입 · Figma `부모 / 회원가입`
 *
 * 입력 오류 · 가입 완료는 **State 다**(COM-003 §13-3). 별도 Route 로 만들지
 * 않는다.
 *
 * 생김새는 `/login` 의 카드와 같은 규격을 쓴다 — 흰 카드(radius 24,
 * border `meti-line`), 칸 52px(radius 12, bg `meti-page`), 버튼 52px
 * (radius 8). Figma 의 `Login Card` 와 같은 컴포넌트다.
 */

import { useActionState, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { signUp, type SignUpState } from '../_actions';
import { TERMS, TERMS_ORDER, type TermsKey } from '@/lib/constants/terms';
import { fieldClass } from '@/components/ui/Field';
import { BrandButton } from '@/components/ui/BrandButton';
import { TermsSheet } from './TermsSheet';
import { DoneNotice } from './DoneNotice';

const EMPTY: SignUpState = { status: 'idle' };

const FIELD = fieldClass('card');

const LABEL = 'text-[14px] font-semibold leading-5 text-meti-ink';

export function SignupForm() {
  const [state, action, pending] = useActionState(signUp, EMPTY);

  const [email, setEmail] = useState('');
  const [agreed, setAgreed] = useState<Record<TermsKey, boolean>>({
    terms: false,
    privacy: false,
    guardian: false,
    marketing: false,
  });
  const [sheet, setSheet] = useState<TermsKey | null>(null);

  /**
   * **React 19 는 Action 이 끝나면 폼을 비운다.** 체크박스는 특히 조용히
   * 돌아간다 — React 가 자기 값이 안 바뀌었다고 보고 다시 그리지 않는다.
   * 동의를 넷 다 눌러 뒀는데 이메일 오타 하나로 전부 풀리면 다시 넷을
   * 눌러야 한다. Action 이 끝날 때마다 고른 값을 다시 씌운다.
   * (`login/_components/LoginForm.tsx` 와 같은 이유)
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

  const all = TERMS_ORDER.every((key) => agreed[key]);

  const toggleAll = (on: boolean) =>
    setAgreed({ terms: on, privacy: on, guardian: on, marketing: on });

  return (
    <>
      <div className="flex flex-col gap-3 rounded-3xl border border-meti-line bg-white p-4">
        <form ref={formRef} action={action} className="flex flex-col gap-3">
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
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="가입에 사용하실 이메일 주소를 입력해 주세요."
              className={FIELD}
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className={LABEL}>비밀번호</span>
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              placeholder="비밀번호 입력"
              className={FIELD}
            />
            {/*
              **권장이지 규칙이 아니다.** Action 이 막는 것은 8자 미만뿐이다.
              영문+숫자를 강제하면 쓸 수 있는 비밀번호가 갑자기 줄어든다.
            */}
            <span className="text-[14px] leading-5 text-meti-ink">
              8자 이상, 영문+숫자 조합을 권장해요.
            </span>
          </label>

          <label className="flex flex-col gap-2">
            <span className={LABEL}>비밀번호 확인</span>
            <input
              name="password_confirm"
              type="password"
              autoComplete="new-password"
              placeholder="비밀번호를 다시 입력하세요"
              className={FIELD}
            />
          </label>

          {/* Figma 동의 블록 — 모두 동의 + 4줄 */}
          <div className="flex flex-col">
            <label className="flex min-h-[44px] cursor-pointer items-center gap-3 border-b border-meti-line px-1">
              <input
                type="checkbox"
                checked={all}
                onChange={(e) => toggleAll(e.target.checked)}
                className="size-6 rounded-md accent-meti"
              />
              <span className="text-[16px] font-semibold leading-6 text-meti-ink">
                모두 동의합니다
              </span>
            </label>

            {TERMS_ORDER.map((key) => (
              <div key={key} className="flex min-h-[44px] items-center gap-3 px-1">
                <label className="flex flex-1 cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    name={`agree_${key}`}
                    checked={agreed[key]}
                    onChange={(e) =>
                      setAgreed((prev) => ({ ...prev, [key]: e.target.checked }))
                    }
                    className="size-6 rounded-md accent-meti"
                  />
                  <span className="text-[14px] leading-5 text-meti-ink">
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
                  className="px-2 text-[14px] leading-5 text-meti-sub underline"
                >
                  보기
                </button>
              </div>
            ))}
          </div>

          {state.status === 'error' && (
            <p role="alert" className="text-[14px] leading-5 text-red-500">
              {state.message}
            </p>
          )}

          {state.status === 'taken' && (
            <p role="alert" className="text-[14px] leading-5 text-red-500">
              이미 가입된 이메일이에요.{' '}
              <Link href="/login" className="font-semibold underline">
                로그인하기
              </Link>
            </p>
          )}

          <BrandButton pending={pending}>{pending ? '가입하는 중' : '회원가입'}</BrandButton>
        </form>
      </div>

      <TermsSheet open={sheet} onClose={() => setSheet(null)} />
    </>
  );
}
