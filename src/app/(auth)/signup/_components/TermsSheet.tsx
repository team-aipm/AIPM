'use client';

/**
 * AUTH-003 약관 본문 · Figma `약관 본문 / 이용약관 (바텀시트)` (1:5212 · 83:878 · 83:995)
 *
 * ```text
 *   Scrim            검정 40%
 *   Bottom Sheet     위 모서리 24 · p[20,20,34,20] · gap16 · shadow-overlay
 *     손잡이         40×4
 *     제목           20/28 w600
 *     본문           16/24 · 스크롤
 *     확인           Button / Brand
 * ```
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
import { BrandButton } from '@/components/ui/BrandButton';

export function TermsSheet({ open, onClose }: { open: TermsKey | null; onClose: () => void }) {
  const sheetRef = useRef<HTMLDivElement>(null);

  // 열리면 시트로 초점을 옮긴다. 키보드로 읽는 사람이 시트 안에서
  // 시작하지 않으면, 탭을 눌러도 뒤에 있는 폼을 훑게 된다.
  useEffect(() => {
    if (open !== null) sheetRef.current?.focus();
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
        기술이 이 버튼을 못 보고, 닫을 길이 Esc 와 「확인」 만 남는다.
      */}
      <button
        type="button"
        aria-label="닫기"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />

      <div
        ref={sheetRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={doc.title}
        className="relative mt-auto flex max-h-[85vh] w-full max-w-[480px] flex-col gap-4 rounded-t-3xl bg-surface-primary px-5 pb-[34px] pt-5 shadow-overlay outline-none"
      >
        {/* Figma `Handle` 40×4 · #C5CFD4 — 토큰에 없어 가장 가까운 meti-off 를 쓴다 */}
        <div aria-hidden className="mx-auto h-1 w-10 shrink-0 rounded-full bg-meti-off" />

        <h2 className="text-[20px] font-semibold leading-7 text-text-primary">{doc.title}</h2>

        {/*
          `whitespace-pre-wrap` 이라 본문의 줄바꿈이 그대로 나온다. 조문은
          줄바꿈이 의미를 갖는 글이라 문단으로 뭉치면 읽기 어려워진다.
        */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <p className="whitespace-pre-wrap text-[16px] leading-6 text-text-secondary">
            {doc.body}
          </p>
          <p className="mt-4 text-[12px] leading-[18px] text-meti-hint">버전 {doc.version}</p>
        </div>

        <BrandButton type="button" onClick={onClose}>
          확인
        </BrandButton>
      </div>
    </div>
  );
}
