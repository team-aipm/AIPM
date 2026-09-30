/**
 * AUTH 영역 공통 껍데기.
 *
 * 학생과 부모가 함께 쓰는 화면이라 어느 쪽 어휘도 쓰지 않는다.
 * 모바일 폭으로 가운데 세운다 — Figma 가 375 기준이다. 폭은 학생 · 부모
 * 영역과 같은 480 으로 맞춘다. 로그인하고 넘어갈 때 화면 폭이 튀지 않게.
 */

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh justify-center bg-background-primary">
      <div className="flex w-full max-w-[480px] flex-col">{children}</div>
    </div>
  );
}
