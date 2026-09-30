'use client';

/**
 * Figma `Modal / Dialog` — 335 · p24 · gap16 · r16 · 제목 20/28 · 본문 14/20
 * · 버튼 세로 두 개(Brand 위, Neutral 아래).
 *
 * **Route 가 아니다**(COM-003 §13-3). 여는 쪽이 `open` 을 쥔다.
 * 버튼은 `actions` 로 받는다 — 서버 액션 폼을 그대로 넣어야 하는 곳이
 * 있어서 여기서 버튼을 만들지 않는다.
 */

import { useEffect, useId, type ReactNode } from 'react';

export function Dialog({
  open,
  title,
  onClose,
  children,
  actions,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  actions: ReactNode;
}) {
  const titleId = useId();

  // Esc 로 닫는다. 확인창은 뒤로가기가 아니라 닫기로 빠져나간다.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-5">
      {/* 뒤를 눌러도 닫힌다. 보조 기술도 이 버튼을 볼 수 있게 둔다 */}
      <button
        type="button"
        aria-label="닫기"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex w-full max-w-[335px] flex-col gap-4 rounded-2xl bg-surface-primary p-6 shadow-overlay"
      >
        <h2 id={titleId} className="text-[20px] font-semibold leading-7 text-text-primary">
          {title}
        </h2>
        <div className="text-[14px] leading-5 text-text-primary">{children}</div>
        <div className="flex flex-col gap-4">{actions}</div>
      </div>
    </div>
  );
}
