/**
 * 학생 화면 전체를 감싸는 레이아웃.
 *
 * 데스크톱 브라우저처럼 뷰포트가 훨씬 넓은 환경에서 보면 앱 콘텐츠
 * (`max-w-md`)와 그 바깥 여백이 색 차이가 거의 없어(`#EEF2F3` vs 흰색)
 * 경계가 안 보인다. `md:` 이상에서는 뚜렷하게 다른 배경색 위에 카드형
 * 프레임(둥근 모서리 + 그림자)으로 감싸 "이게 앱 화면이다"를 시각적으로
 * 분리한다. 모바일 폭에서는 이 프레임이 전혀 적용되지 않고 지금처럼
 * 화면을 꽉 채운다.
 *
 * 카드는 모든 브레이크포인트에서 **명시적인 높이**를 가진다(`auto`가
 * 아니다) — 모바일은 `h-dvh`(실제 뷰포트), 데스크톱은
 * `md:h-[calc(100dvh-80px)]`(위아래 40px 여백을 뺀 값). 각 페이지는
 * `flex h-full flex-col` 루트로 이 값을 그대로 물려받고,
 * `flex-1 overflow-y-auto` 콘텐츠 영역만 내부에서 스크롤한다
 * (`mission/page.tsx`가 원래 쓰던 구조를 전체 화면으로 확장한 것). 부모가
 * `auto` 높이였다면 자식의 `h-full`이 무엇을 100%로 삼아야 할지 알 수
 * 없어 깨진다 — 그래서 카드 높이를 반드시 명시값으로 고정해야 한다.
 *
 * 이 구조 덕분에 하단 탭바(`BottomTabs`)는 항상 카드 바닥에 자연스럽게
 * 붙는 평범한 마지막 자식이 되고(뷰포트에 `fixed`로 고정해서 카드보다
 * 아래에 따로 떠 있던 문제 해결), 카드에 건 `overflow-hidden`도 내용을
 * 자르지 않는다 — 자식 높이가 카드 높이와 정확히 같기 때문이다.
 */
export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="metty-app min-h-dvh bg-[#D7E0E3] md:flex md:justify-center md:px-6 md:py-10">
      <div className="mx-auto h-dvh w-full max-w-md overflow-hidden bg-[#EEF2F3] text-[#24333A] md:h-[calc(100dvh-80px)] md:rounded-[36px] md:shadow-[0_20px_60px_rgba(20,40,50,.18)] md:ring-1 md:ring-black/5">
        {children}
      </div>
    </div>
  );
}
