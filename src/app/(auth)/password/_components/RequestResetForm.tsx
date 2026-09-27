'use client';

/**
 * AUTH-005 걸음 1 — 가입한 이메일로 재설정 링크를 받는다.
 *
 * 클라이언트 컴포넌트인 이유는 둘이다.
 *   - 틀린 이메일을 그 자리에서 알려주려고 (`useActionState`)
 *   - 「메일 다시 받기」 의 60초를 세려고
 *
 * 한 화면 안에서 세 모습을 갖는다. COM-003 §13-3 — State 는 별도 Route 가
 * 아니다.
 */

import { useActionState, useEffect, useState } from 'react';
import Link from 'next/link';
import { requestReset, type ResetRequestState } from '../_actions';
import { BackBar } from '@/components/ui/BackBar';
import { fieldClass } from '@/components/ui/Field';
import { BrandButton } from '@/components/ui/BrandButton';
import { DoneMark } from './DoneMark';

const EMPTY: ResetRequestState = { status: 'idle' };

/** 메일 폭탄을 막는 간격. 화면 문구(「60초 후 가능」)와 같은 값이어야 한다 */
const RESEND_SECONDS = 60;

const BRAND =
  'flex h-[52px] w-full items-center justify-center rounded-lg text-[16px] font-semibold';

export function RequestResetForm() {
  const [state, action, pending] = useActionState(requestReset, EMPTY);

  // 빈 칸으로 누를 수 있게 두지 않는다 — 디자인의 기본 모습이 흐린 버튼이다.
  // 눌러 봐야 「이메일을 입력해 주세요」 만 돌아오므로 왕복이 하나 는다.
  const [email, setEmail] = useState('');

  // `key` 가 핵심이다. 「다시 받기」 를 누르면 `sentAt` 이 바뀌고, 그때
  // `Sent` 가 새로 붙어 60초가 처음부터 다시 간다. key 가 없으면 같은
  // 컴포넌트가 살아 있어 0초에 멈춘 채로 남는다.
  if (state.status === 'sent') {
    return <Sent key={state.sentAt} email={state.email} action={action} />;
  }

  const invalid = state.status === 'error';

  return (
    <form action={action} className="flex flex-1 flex-col">
      <BackBar />
      <div className="flex flex-1 flex-col gap-4 px-5 pt-3">
        <h1 className="text-[24px] font-bold leading-8 text-meti-ink">비밀번호 찾기</h1>

        <p className="text-[16px] leading-6 text-meti-sub">
          가입한 이메일을 입력하면 비밀번호를 다시 정할 수 있는 링크를 보내드려요.
        </p>

        <label className="flex flex-col gap-2">
          <span className="text-[14px] font-semibold leading-5 text-meti-ink">이메일</span>
          {/*
            `type="email"` 로 두지 않는다. 브라우저가 먼저 막아 버리면 우리가
            정한 문구 대신 브라우저 말풍선이 뜬다. 확인은 Action 이 한다.
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
            placeholder="이메일을 입력해 주세요"
            aria-invalid={invalid}
            aria-describedby={invalid ? 'email-error' : undefined}
            className={fieldClass('page', invalid)}
          />
          {invalid && (
            <p id="email-error" role="alert" className="text-[14px] leading-5 text-red-500">
              {state.message}
            </p>
          )}
        </label>
      </div>

      <div className="px-5 pb-[34px] pt-5">
        <BrandButton pending={pending} disabled={email.trim() === ''}>
          {pending ? '메일 보내는 중' : '재설정 메일 받기'}
        </BrandButton>
      </div>
    </form>
  );
}

/**
 * 「메일을 보냈어요」.
 *
 * **가입된 이메일인지 말하지 않는다.** 문구가 「…가입된 이메일이라면」 인
 * 것이 그래서다. Action 이 결과를 보지 않는 것과 짝을 이룬다.
 */
function Sent({ email, action }: { email: string; action: (form: FormData) => void }) {
  const [left, setLeft] = useState(RESEND_SECONDS);

  // 보낼 때마다 다시 센다. 「다시 받기」 를 누르면 Action 이 새 state 를
  // 돌려주므로 이 컴포넌트가 새로 그려지고 60 부터 시작한다.
  useEffect(() => {
    if (left <= 0) return;
    const timer = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(timer);
  }, [left]);

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col items-center gap-4 px-5 pt-[88px]">
        <DoneMark />
        <h1 className="text-center text-[24px] font-bold leading-8 text-meti-ink">
          메일을 보냈어요
        </h1>
        <p className="text-center text-[16px] leading-6 text-meti-sub">
          {email}이 가입된 이메일이라면 재설정 링크를 보냈어요. 메일이 보이지 않으면 스팸함도
          확인해 주세요.
        </p>
      </div>

      <div className="flex flex-col gap-3 px-5 pb-[34px] pt-5">
        <Link href="/login" className={`${BRAND} bg-meti text-white`}>
          로그인으로 돌아가기
        </Link>

        <form action={action}>
          {/* 같은 주소로 다시 보낸다. 칸이 없으므로 값을 들고 간다 */}
          <input type="hidden" name="email" value={email} />
          <button
            type="submit"
            disabled={left > 0}
            className={`${BRAND} border border-meti-line bg-meti-page text-meti-ink disabled:border-meti-line disabled:bg-meti-page disabled:text-meti-off`}
          >
            {left > 0 ? `메일 다시 받기 (${left}초 후 가능)` : '메일 다시 받기'}
          </button>
        </form>
      </div>
    </div>
  );
}
