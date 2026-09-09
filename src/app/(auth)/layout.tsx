/**
 * AUTH 영역 공통 껍데기.
 *
 * 학생과 부모가 함께 쓰는 화면이라 어느 쪽 어휘도 쓰지 않는다.
 * 모바일 폭으로 가운데 세운다 — 프로토타입이 모바일 기준이다.
 */

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh justify-center bg-meti-bg">
      <div className="flex w-full max-w-[420px] flex-col">{children}</div>
    </div>
  );
}
