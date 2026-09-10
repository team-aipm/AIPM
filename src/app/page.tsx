import { redirect } from 'next/navigation';

/**
 * ⚠️ 임시 진입점. DEV-001/DEV-002 어디에도 "/"의 소유자나 목적지가
 * 정의되어 있지 않아서, METI 학생 화면 시연을 위해 `/student/login`으로
 * 보내도록 잠깐 바꿔뒀다. 실제 랜딩(AUTH-001 로그인인지, 별도 마케팅
 * 페이지인지)은 회원·유입 PM과 합의가 필요하다 — 그 결정이 나면 이 파일을
 * 되돌리거나 교체해야 한다.
 */
export default function RootPage() {
  redirect('/student/login');
}
