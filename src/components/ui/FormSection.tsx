/**
 * Figma `Group / 자녀 정보` · `Group / 로그인 정보`
 *
 * ```text
 *   섹션 타이틀  Label/Large 16/24 SemiBold  #206B7C  ← 브랜드색이다
 *   (8px)
 *   칸들         8px 간격
 * ```
 *
 * **타이틀이 브랜드색인 것이 이 컴포넌트의 전부다.** 다른 라벨(`Field`)은
 * `#24333A` 인데 섹션 타이틀만 `#206B7C` 라, 눈이 먼저 여기에 걸리고
 * 「여기부터 다른 묶음」 이라는 것을 읽지 않고 안다.
 *
 * 묶음 사이 간격(28px)은 감싸는 쪽이 정한다 — 화면마다 다르다.
 *
 * **`fieldset`/`legend` 를 쓰지 않았다.** `display:flex` 인 `fieldset`
 * 안에서 `legend` 가 브라우저마다 다르게 놓인다. `role="group"` 과
 * `aria-label` 로 같은 뜻을 전하면서 배치는 우리가 쥔다.
 */

import type { ReactNode } from 'react';

export function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section role="group" aria-label={title} className="flex flex-col gap-2">
      <p className="text-[16px] font-semibold leading-6 text-meti">{title}</p>
      {children}
    </section>
  );
}
