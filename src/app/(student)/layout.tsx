/**
 * STU · MIS 영역 공통 껍데기.
 *
 * **학생 어휘를 쓰고, 하단 Nav 를 두지 않는다**(CLAUDE.md · DEV-001).
 * 프로토타입에는 하단 5탭이 있지만 그건 COM-003 과 다르다 — 도감 · 상점이
 * COM-002 에 없기도 해서, 탭을 붙이는 것은 그 결정이 난 뒤에 한다.
 */

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh justify-center bg-meti-bg">
      <div className="flex w-full max-w-[420px] flex-col">{children}</div>
    </div>
  );
}
