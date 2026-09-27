'use client';

/**
 * AUTH-005 걸음 2 — 메일 속 링크로 돌아와 새 비밀번호를 정한다.
 *
 * `code` 는 메일 링크가 달고 온 값이다. 화면에 보이지 않는 칸으로 들고
 * 있다가 「비밀번호 변경」 을 누를 때 Action 에 넘긴다. 세션으로 바뀌는
 * 것은 그 순간이다 — 링크를 연 것만으로는 로그인되지 않는다.
 */

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { setNewPassword, type NewPasswordState } from '../_actions';
import { BackBar } from '@/components/ui/BackBar';
import { fieldClass } from '@/components/ui/Field';
import { BrandButton } from '@/components/ui/BrandButton';
import { DoneMark } from './DoneMark';

const EMPTY: NewPasswordState = { status: 'idle' };

const BRAND =
  'flex h-[52px] w-full items-center justify-center rounded-lg text-[16px] font-semibold';

const FIELD = fieldClass('page');

export function NewPasswordForm({ code }: { code: string }) {
  const [state, action, pending] = useActionState(setNewPassword, EMPTY);

  // 두 칸이 다 차기 전에는 누를 수 없다. 걸음 1 과 같은 규칙이다.
  const [typed, setTyped] = useState({ password: '', confirm: '' });

  if (state.status === 'done') return <Done />;
  if (state.status === 'expired') return <Expired />;

  const invalid = state.status === 'error';

  return (
    <form action={action} className="flex flex-1 flex-col">
      <BackBar />
      <input type="hidden" name="code" value={code} />

      <div className="flex flex-1 flex-col gap-4 px-5 pt-3">
        <h1 className="text-[24px] font-bold leading-8 text-meti-ink">새 비밀번호 설정</h1>

        <p className="text-[16px] leading-6 text-meti-sub">
          앞으로 사용할 새 비밀번호를 입력해 주세요.
        </p>

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-2">
            <span className="text-[14px] font-semibold leading-5 text-meti-ink">새 비밀번호</span>
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              value={typed.password}
              onChange={(e) => setTyped((t) => ({ ...t, password: e.target.value }))}
              placeholder="비밀번호 입력"
              className={FIELD}
            />
            {/*
              **권장이지 규칙이 아니다.** Action 이 막는 것은 8자 미만뿐이다
              (`signup/_actions.ts` 와 같은 기준). 영문+숫자를 강제하면
              가입 때 통과했던 비밀번호가 여기서 거절당한다.
            */}
            <span className="text-[14px] leading-5 text-meti-ink">
              8자 이상, 영문+숫자 조합을 권장해요.
            </span>
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-[14px] font-semibold leading-5 text-meti-ink">
              새 비밀번호 확인
            </span>
            <input
              name="password_confirm"
              type="password"
              autoComplete="new-password"
              value={typed.confirm}
              onChange={(e) => setTyped((t) => ({ ...t, confirm: e.target.value }))}
              placeholder="비밀번호를 다시 입력하세요"
              aria-invalid={invalid}
              aria-describedby={invalid ? 'password-error' : undefined}
              className={FIELD}
            />
          </label>

          {invalid && (
            <p id="password-error" role="alert" className="text-[14px] leading-5 text-red-500">
              {state.message}
            </p>
          )}
        </div>
      </div>

      <div className="px-5 pb-[34px] pt-5">
        <BrandButton
          pending={pending}
          disabled={typed.password === '' || typed.confirm === ''}
        >
          {pending ? '바꾸는 중' : '비밀번호 변경'}
        </BrandButton>
      </div>
    </form>
  );
}

function Done() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col items-center gap-4 px-5 pt-[88px]">
        <DoneMark />
        <h1 className="text-center text-[24px] font-bold leading-8 text-meti-ink">
          비밀번호를 바꿨어요
        </h1>
        <p className="text-center text-[16px] leading-6 text-meti-sub">
          새 비밀번호로 로그인해 주세요.
        </p>
      </div>

      <div className="px-5 pb-[34px] pt-5">
        <Link href="/login" className={`${BRAND} bg-meti text-white`}>
          로그인하기
        </Link>
      </div>
    </div>
  );
}

/**
 * 링크가 만료됐다.
 *
 * 문구는 Figma `검토 상태 · 비밀번호 찾기 / 링크 만료` 그대로다.
 *
 * **만료만 여기로 오는 것이 아니다.** 메일을 다른 기기나 다른 브라우저에서
 * 열어도 같은 곳으로 온다(`_actions.ts` 참고). 화면은 만료라고만 말하므로,
 * 폰으로 메일을 연 사람은 30분이 안 지났는데도 만료라는 말을 듣는다.
 * 문구를 늘리는 대신 디자인을 따랐다 — 고칠 곳은 화면이 아니라 흐름이다.
 *
 * **사용자 잘못처럼 적지 않는다.** CLAUDE.md 「오류를 학생의 잘못처럼
 * 표현하지 않는다」.
 */
function Expired() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col items-center gap-4 px-5 pt-[88px]">
        <h1 className="text-center text-[24px] font-bold leading-8 text-meti-ink">
          링크가 만료됐어요
        </h1>
        <p className="text-center text-[16px] leading-6 text-meti-sub">
          보안을 위해 재설정 링크는 30분 동안만 사용할 수 있어요. 새 링크를 받아 주세요.
        </p>
      </div>

      <div className="flex flex-col gap-3 px-5 pb-[34px] pt-5">
        <Link href="/password" className={`${BRAND} bg-meti text-white`}>
          새 링크 받기
        </Link>
        <Link
          href="/login"
          className={`${BRAND} border border-meti-line bg-meti-page text-meti-ink`}
        >
          로그인으로 돌아가기
        </Link>
      </div>
    </div>
  );
}
