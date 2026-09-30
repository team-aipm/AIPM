'use client';

/**
 * AUTH-005 걸음 2 — 메일 속 링크로 돌아와 새 비밀번호를 정한다.
 * Figma `비밀번호 재설정 / 새 비밀번호 설정` (1:5446)
 *
 * `code` 는 메일 링크가 달고 온 값이다. 화면에 보이지 않는 칸으로 들고
 * 있다가 「비밀번호 변경」 을 누를 때 Action 에 넘긴다. 세션으로 바뀌는
 * 것은 그 순간이다 — 링크를 연 것만으로는 로그인되지 않는다.
 *
 * ```text
 *   조건 미충족   132:2789   새 비밀번호 칸의 안내 자리에
 *   불일치        132:2873   확인 칸 아래 12/18
 *   변경 중       132:2958   칸을 잠그고 버튼이 「비밀번호 변경 중」
 *   변경 실패     74:3008    토스트 + 버튼이 「다시 시도」
 *   변경 완료     1:5458     Done
 *   링크 만료     132:2614   Expired
 * ```
 *
 * **오류 문구는 서버가 정한다.** 어느 칸에 붙일지만 여기서 고른다 —
 * `signup/_components/SignupForm.tsx` 와 같은 방식이다.
 */

import Image from 'next/image';
import { useActionState, useState } from 'react';
import Link from 'next/link';
import { setNewPassword, type NewPasswordState } from '../_actions';
import { isValidPassword } from '@/lib/constants/student-login';
import { BackBar } from '@/components/ui/BackBar';
import { fieldClass } from '@/components/ui/Field';
import { BrandButton } from '@/components/ui/BrandButton';
import { DoneMark } from './DoneMark';

const EMPTY: NewPasswordState = { status: 'idle' };

/** Figma `Button / Brand` 를 링크로 쓴 것. 가는 곳이 다른 화면이라 `a` 다 */
const BRAND =
  'flex h-[52px] w-full items-center justify-center rounded-lg bg-button-primary px-5 text-[16px] font-semibold leading-6 text-white hover:bg-button-hover active:bg-button-pressed';

const LABEL = 'text-[14px] font-semibold leading-5 text-text-primary';

export function NewPasswordForm({ code }: { code: string }) {
  const [state, action, pending] = useActionState(setNewPassword, EMPTY);

  // 두 칸이 다 차기 전에는 누를 수 없다. 걸음 1 과 같은 규칙이다.
  const [typed, setTyped] = useState({ password: '', confirm: '' });

  if (state.status === 'done') return <Done />;
  if (state.status === 'expired') return <Expired />;

  const message = state.status === 'error' ? state.message : '';
  const where =
    state.status !== 'error'
      ? null
      : typed.password === '' || typed.confirm === '' || !isValidPassword(typed.password)
        ? 'password'
        : typed.password !== typed.confirm
          ? 'confirm'
          : 'form';

  return (
    <form action={action} className="flex flex-1 flex-col">
      <BackBar />
      <input type="hidden" name="code" value={code} />

      {/* Figma `Content / 335` — p[12,20,20,20] gap16 */}
      <fieldset disabled={pending} className="flex flex-1 flex-col gap-4 px-5 pb-5 pt-3">
        <h1 className="text-[24px] font-bold leading-8 text-text-primary">새 비밀번호 설정</h1>

        <p className="text-[16px] leading-6 text-text-secondary">
          앞으로 사용할 새 비밀번호를 입력해 주세요.
        </p>

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-2">
            <span className={LABEL}>새 비밀번호</span>
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              value={typed.password}
              onChange={(e) => setTyped((t) => ({ ...t, password: e.target.value }))}
              placeholder="비밀번호 입력"
              aria-invalid={where === 'password'}
              aria-describedby={where === 'password' ? 'password-error' : undefined}
              className={fieldClass('page', where === 'password')}
            />
            {/*
              안내는 Figma 문구 「권장해요」 그대로다. Action 은 영문+숫자 8자
              이상을 **강제한다**(정책 v0.1 §3.2) — 문구와 규칙이 다르다.
            */}
            {where === 'password' ? (
              <span id="password-error" role="alert" className="text-[14px] leading-5 text-error-text">
                {message}
              </span>
            ) : (
              <span className="text-[14px] leading-5 text-text-primary">
                8자 이상, 영문+숫자 조합을 권장해요.
              </span>
            )}
          </label>

          <label className="flex flex-col gap-2">
            <span className={LABEL}>새 비밀번호 확인</span>
            <input
              name="password_confirm"
              type="password"
              autoComplete="new-password"
              value={typed.confirm}
              onChange={(e) => setTyped((t) => ({ ...t, confirm: e.target.value }))}
              placeholder="비밀번호를 다시 입력하세요"
              aria-invalid={where === 'confirm'}
              aria-describedby={where === 'confirm' ? 'password-error' : undefined}
              className={fieldClass('page', where === 'confirm')}
            />
            {where === 'confirm' && (
              <span
                id="password-error"
                role="alert"
                className="text-[12px] leading-[18px] text-error-text"
              >
                {message}
              </span>
            )}
          </label>
        </div>

        {/*
          Figma `Toast / Snackbar` (74:3008) — 칸 탓이 아니라 우리 쪽에서 못
          바꾼 경우다. 칸을 빨갛게 칠하지 않는다(CLAUDE.md 「오류를 잘못처럼
          표현하지 않는다」).
        */}
        {where === 'form' && (
          <div
            role="alert"
            className="flex items-center gap-3 rounded-2xl border border-meti-line bg-surface-primary py-3 pl-3 pr-4 shadow-overlay"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-error-bg">
              <Image src="/icons/close-error.svg" alt="" width={20} height={20} />
            </span>
            <span className="text-[14px] leading-5 text-text-primary">{message}</span>
          </div>
        )}
      </fieldset>

      {/* Figma `CTA / Safe area` — p[20,20,34,20] */}
      <div className="px-5 pb-[34px] pt-5">
        <BrandButton
          pending={pending}
          disabled={typed.password === '' || typed.confirm === ''}
        >
          {pending ? '비밀번호 변경 중' : where === 'form' ? '다시 시도' : '비밀번호 변경'}
        </BrandButton>
      </div>
    </form>
  );
}

/** Figma `비밀번호 재설정 / 변경 완료` (1:5458) */
function Done() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col items-center gap-4 px-5 pt-[112px]">
        <DoneMark />
        <h1 className="text-center text-[24px] font-bold leading-8 text-text-primary">
          비밀번호를 바꿨어요
        </h1>
        <p className="text-center text-[16px] leading-6 text-text-secondary">
          새 비밀번호로 로그인해 주세요.
        </p>
      </div>

      <div className="px-5 pb-[34px] pt-5">
        <Link href="/login" className={BRAND}>
          로그인하기
        </Link>
      </div>
    </div>
  );
}

/**
 * 링크가 만료됐다 · Figma `비밀번호 재설정 / 이메일 링크 만료` (132:2614)
 *
 * **만료만 여기로 오는 것이 아니다.** 메일을 다른 기기나 다른 브라우저에서
 * 열어도 같은 곳으로 온다(`_actions.ts` 참고). 화면은 만료라고만 말하므로,
 * 폰으로 메일을 연 사람은 시간이 안 지났는데도 만료라는 말을 듣는다.
 * 문구를 늘리는 대신 디자인을 따랐다 — 고칠 곳은 화면이 아니라 흐름이다.
 *
 * **사용자 잘못처럼 적지 않는다.** CLAUDE.md 「오류를 학생의 잘못처럼
 * 표현하지 않는다」.
 */
function Expired() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col items-center gap-4 px-5 pt-[88px]">
        <h1 className="text-center text-[24px] font-bold leading-8 text-text-primary">
          인증 링크가 만료됐어요
        </h1>
        <p className="text-center text-[16px] leading-6 text-text-secondary">
          보안을 위해 링크 사용 시간이 지났어요. 새 인증 메일을 받아 주세요.
        </p>
      </div>

      <div className="px-5 pb-[34px] pt-5">
        <Link href="/password" className={BRAND}>
          인증 메일 다시 받기
        </Link>
      </div>
    </div>
  );
}
