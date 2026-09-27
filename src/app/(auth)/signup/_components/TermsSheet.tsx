'use client';

/**
 * AUTH-003 약관 본문 · Figma `약관 본문 / 이용약관 (바텀시트)`
 *
 * **별도 Route 로 만들지 않았다.** COM-003 §13-3 — State/Modal 은 Route 가
 * 아니다. Figma 도 바텀시트로 그려져 있다.
 *
 * DEV-002 §2 에는 `AUTH-003 → /signup/terms` 로 적혀 있다. 그 줄은 이
 * 구현과 맞지 않는다 — 문서 쪽을 고쳐야 한다.
 *
 * **본문은 번들에 들어 있다**(`lib/constants/terms.ts`). 그래서 Figma 의
 * 「불러오는 중」 · 「불러오기 실패」 상태가 생기지 않는다. 약관을 담을
 * 테이블이 COM-002 에 없어서 가져올 곳이 없다.
 */

import { useEffect, useRef } from 'react';
import { TERMS, type TermsKey } from '@/lib/constants/terms';

export function TermsSheet({ open, onClose }: { open: TermsKey | null; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  // 열리면 닫기 버튼으로 초점을 옮긴다. 키보드로 읽는 사람이 시트 안에서
  // 시작하지 않으면, 탭을 눌러도 뒤에 있는 폼을 훑게 된다.
  useEffect(() => {
    if (open !== null) closeRef.current?.focus();
  }, [open]);

  // Esc 로 닫는다. 바텀시트는 뒤로가기가 아니라 닫기로 빠져나가는 것이다.
  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (open === null) return null;

  const doc = TERMS[open];

  return (
    <div className="fixed inset-0 z-50 flex justify-center">
      {/*
        뒤를 눌러도 닫힌다. `aria-hidden` 은 붙이지 않는다 — 그러면 보조
        기술이 이 버튼을 못 보고, 닫을 길이 Esc 하나만 남는다.
      */}
      <button
        type="button"
        aria-label="닫기"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={doc.title}
        className="relative mt-auto flex max-h-[85vh] w-full max-w-[420px] flex-col rounded-t-3xl bg-white"
      >
        <div className="flex items-center justify-between border-b border-meti-line px-5 py-4">
          <h2 className="text-[18px] font-bold leading-7 text-meti-ink">{doc.title}</h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1 text-[14px] font-semibold leading-5 text-meti-sub"
          >
            닫기
          </button>
        </div>

        {/*
          `whitespace-pre-wrap` 이라 본문의 줄바꿈이 그대로 나온다. 조문은
          줄바꿈이 의미를 갖는 글이라 문단으로 뭉치면 읽기 어려워진다.
        */}
        <div className="overflow-y-auto px-5 py-4">
          <p className="whitespace-pre-wrap text-[14px] leading-[22px] text-meti-ink">
            {doc.body}
          </p>
          <p className="mt-4 text-[12px] leading-[18px] text-meti-hint">
            버전 {doc.version}
          </p>
        </div>
      </div>
    </div>
  );
}
