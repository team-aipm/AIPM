/**
 * STU · MIS 영역 공통 껍데기.
 *
 * **학생 어휘를 쓴다**(CLAUDE.md · DEV-001). 폭은 Figma 375 화면을 가운데
 * 두는 480 이다 — 부모 · 인증 영역과 같다.
 *
 * 하단 Nav(`홈 / 학습하기 / 내 정보`, COM-003 §11)는 여기 두지 않고 학생
 * HOME 에만 붙인다. 미션 대화 · 오늘의 기록 · 캐릭터 선택 Figma 에는 Nav 가
 * 없다. 레이아웃에 두면 그 화면들에서 걷어낼 방법이 없다.
 */

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh justify-center bg-background-primary">
      <div className="flex w-full max-w-[480px] flex-col">{children}</div>
    </div>
  );
}
