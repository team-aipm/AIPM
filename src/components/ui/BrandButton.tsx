'use client';

/**
 * Figma `Button / Brand` · `Button / Neutral`
 *
 * ```text
 *   52px · radius 8 · Label/Large 16/24 SemiBold
 *   brand    bg #206B7C  글자 흰색
 *   neutral  bg #F7FAFB  border #E2E8EB
 *   못 누름  bg #E2E8EB  글자 #5B6A72  (2026-09-30 Figma 02 · Components)
 * ```
 *
 * **기다리는 동안 도는 표시가 들어간다.** Figma 의 `Loading Indicator` 가
 * 그 자리다(`계정 만드는 중` 프레임에서 켜져 있다). 글자만 바뀌면 눌린 건지
 * 아닌지 모르고 한 번 더 누른다.
 */

import type { ReactNode } from 'react';

const BASE =
  'flex w-full items-center justify-center rounded-lg font-semibold transition-colors disabled:cursor-not-allowed';

/**
 * Figma 의 세 크기. Small 부터 글자가 14 로 내려간다.
 *
 * ```text
 *   md  52px  padding 20  gap 8  Label/Large 16/24
 *   sm  44px  padding 16  gap 6  14/20
 *   xs  36px  padding 12  gap 4  14/20
 * ```
 */
const SIZE = {
  md: 'h-[52px] gap-2 px-5 text-[16px] leading-6',
  sm: 'h-[44px] gap-1.5 px-4 text-[14px] leading-5',
  xs: 'h-[36px] gap-1 px-3 text-[14px] leading-5',
} as const;

/**
 * Hover · Pressed · Focused · Disabled 는 Figma 의 State 그대로다.
 * Focused 는 키보드로 왔을 때만 보이게 `focus-visible` 에 건다.
 */
const TONE = {
  brand:
    'bg-button-primary text-white hover:enabled:bg-button-hover active:enabled:bg-button-pressed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-button-primary',
  neutral:
    'border border-meti-line bg-surface-primary text-text-primary hover:enabled:bg-background-primary active:enabled:bg-background-primary focus-visible:border-2 focus-visible:border-button-pressed focus-visible:outline-none',
} as const;

/**
 * 못 누름 색은 **정말 못 누를 때만** 입힌다. 기다리는 동안(`pending`)에도
 * 버튼은 잠기지만 Figma 의 `State=Loading` 은 원래 색 그대로다 — 회색이
 * 되면 「눌렀는데 안 됐다」로 읽힌다.
 */
const OFF = {
  brand: 'bg-disabled-bg text-disabled-text',
  neutral: 'bg-background-primary text-disabled-text',
} as const;

export function BrandButton({
  tone = 'brand',
  size = 'md',
  pending = false,
  disabled = false,
  type = 'submit',
  onClick,
  children,
}: {
  tone?: keyof typeof TONE;
  size?: keyof typeof SIZE;
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
      className={`${BASE} ${SIZE[size]} ${disabled ? OFF[tone] : TONE[tone]}`}
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
