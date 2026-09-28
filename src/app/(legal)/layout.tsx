/**
 * 약관 · 개인정보 문서의 공통 껍데기.
 *
 * **로그인을 묻지 않는다.** 누구나 열려야 한다 — 가입 전에 읽는 사람도,
 * 구글 OAuth 동의 화면에서 링크를 누른 사람도 있다.
 *
 * COM-003 에 Screen ID 가 없다. 제품 화면이 아니라 법적 문서라 학생 어휘 ·
 * 부모 어휘 구분도 없다. `/prompt-lab` 이 Screen ID 없이 있는 것과 같은
 * 자리다(그쪽은 개발 도구, 이쪽은 공개 문서).
 */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-dvh flex-col bg-white">{children}</div>;
}
