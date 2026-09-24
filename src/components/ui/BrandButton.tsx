'use client';

/**
 * Figma `Button / Brand` · `Button / Neutral`
 *
 * ```text
 *   52px · radius 8 · Label/Large 16/24 SemiBold
 *   brand    bg #206B7C  글자 흰색
 *   neutral  bg #F7FAFB  border #E2E8EB
 *   못 누름  bg #C8DADD  글자 #B5BDC2
 * ```
 *
 * **기다리는 동안 도는 표시가 들어간다.** Figma 의 `Loading Indicator` 가
 * 그 자리다(`계정 만드는 중` 프레임에서 켜져 있다). 글자만 바뀌면 눌린 건지
 * 아닌지 모르고 한 번 더 누른다.
 */

import type { ReactNode } from 'react';

const BASE =
  'flex h-[52px] w-full items-center justify-center gap-2 rounded-lg px-5 text-[16px] font-semibold leading-6';

const TONE = {
  brand: 'bg-meti text-white disabled:bg-meti-off-bg disabled:text-meti-off',
  neutral:
    'border border-meti-line bg-meti-page text-meti-ink disabled:border-meti-line disabled:bg-meti-page disabled:text-meti-off',
} as const;

export function BrandButton({
  tone = 'brand',
  pending = false,
  disabled = false,
  type = 'submit',
  onClick,
  children,
}: {
  tone?: keyof typeof TONE;
  pending?: boolean;
  disabled?: boolean;
  type?: 'submit' | 'button';
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || pending}
      aria-busy={pending}
      className={`${BASE} ${TONE[tone]}`}
    >
      {pending && <Spinner />}
      {children}
    </button>
  );
}

/**
 * 16px 짜리 도는 표시.
 *
 * **이것만은 손으로 그린다.** Figma 의 `Loading Indicator` 는 가만히 있는
 * 그림이고, 도는 것은 코드가 하는 일이다 — 내보낼 파일이 따로 없다.
 * 원 하나에 테두리를 주고 한쪽만 색을 뺀, 어디에나 있는 방식이다.
 */
function Spinner() {
  return (
    <span
      aria-hidden
      className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  );
}
