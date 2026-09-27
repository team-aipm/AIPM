/**
 * Figma `Input / Text Field` — 라벨 · 칸 · 아래 한 줄.
 *
 * ```text
 *   라벨    Label/Medium  14/20 SemiBold  #24333A
 *   (8px)
 *   칸      52px  radius 8  border #89939A  padding 12/16
 *   (8px)
 *   도움말  Body/Small    14/20 Regular
 * ```
 *
 * **칸 바탕이 화면마다 다르다.** 흰 카드 위에 올라가면 칸이 살짝 어두워야
 * 보이고(로그인 · 회원가입), 옅은 화면 바탕 위에 바로 놓이면 칸이 희어야
 * 보인다(비밀번호 찾기 · 자녀 계정 생성). Figma 도 그렇게 그려져 있고,
 * 카드 위 칸은 radius 가 12 다.
 *
 * 그 판단을 화면마다 다시 하지 않도록 `tone` 하나로 받는다.
 */

import type { ReactNode } from 'react';

export type FieldTone = 'page' | 'card';

/** 칸 자체의 생김새. `select` 처럼 `input` 이 아닌 것에도 쓴다 */
export function fieldClass(tone: FieldTone, invalid = false): string {
  const base =
    'h-[52px] w-full px-4 text-[16px] leading-6 text-meti-ink outline-none placeholder:text-meti-hint';
  const shape = tone === 'card' ? 'rounded-xl bg-meti-page' : 'rounded-lg bg-white';
  const border = invalid
    ? 'border border-red-500 focus:border-red-500'
    : 'border border-meti-field focus:border-meti';
  return `${base} ${shape} ${border}`;
}

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
}: {
  label: string;
  /** 평소 아래에 두는 한 줄. 오류가 있으면 오류가 대신 나온다 */
  hint?: ReactNode;
  error?: string | null;
  /** `label` 을 쓰지 않고 감싸는 경우(라디오 묶음 등)에 넘긴다 */
  htmlFor?: string;
  children: ReactNode;
}) {
  const Tag = htmlFor === undefined ? 'label' : 'div';

  return (
    <Tag className="flex flex-col gap-2">
      {htmlFor === undefined ? (
        <span className="text-[14px] font-semibold leading-5 text-meti-ink">{label}</span>
      ) : (
        <label htmlFor={htmlFor} className="text-[14px] font-semibold leading-5 text-meti-ink">
          {label}
        </label>
      )}

      {children}

      {/*
        오류가 힌트 자리를 **대신한다.** 둘을 같이 쌓으면 칸 아래가 두 줄이
        되면서 아래 칸들이 통째로 밀린다 — 오타 하나에 화면이 출렁인다.
      */}
      {error != null && error !== '' ? (
        <span role="alert" className="text-[14px] leading-5 text-red-500">
          {error}
        </span>
      ) : hint !== undefined ? (
        <span className="text-[14px] leading-5 text-meti-hint">{hint}</span>
      ) : null}
    </Tag>
  );
}
