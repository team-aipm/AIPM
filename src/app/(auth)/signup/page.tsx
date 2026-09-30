/**
 * AUTH-002 회원가입 · `/signup` (DEV-002) · Figma `회원가입 / 기본` (1:4690)
 *
 * 가입하는 사람은 **부모**다(COM-003). 그래서 이 화면만 학생 어휘를 쓰지
 * 않는다 — 「보호자 회원가입」 그대로 쓴다.
 *
 * **약관 동의(AUTH-003)가 이 화면 안으로 들어왔다.** 전에는 별도 Screen 이라
 * 빼 뒀는데, Figma 는 동의 줄을 가입 폼 안에 두고 본문만 바텀시트로 띄운다.
 * COM-003 §13-3 과도 맞는다 — 시트는 Route 가 아니다.
 *
 * DEV-002 §2 의 `AUTH-003 → /signup/terms` 줄은 이 구현과 맞지 않는다.
 * 문서 쪽을 고쳐야 한다.
 *
 * **휴대폰 인증(AUTH-004)은 없다.** 가입에서 휴대폰을 받지 않기로 했고
 * (COM-002 §3-1), 본인확인 수단이 미정이다(FIGMA-MD-AUDIT §0). Figma 의
 * 「보호자 본인확인」 버튼 자리는 그래서 「회원가입」 이다.
 *
 * 화면 전체를 `SignupForm` 이 그린다. 「가입이 끝났어요」 State 는 뒤로 가기
 * 바도 제목도 없는 다른 모양이라서, 그 갈림을 폼이 쥐고 있어야 한다.
 */

import { redirect } from 'next/navigation';
import { createClient, currentUser } from '@/lib/supabase/server';
import { studentIdOfViewer } from '@/lib/services/student-login';
import { SignupForm } from './_components/SignupForm';

export const metadata = { title: '회원가입 · 메티' };

export default async function SignupPage() {
  const supabase = await createClient();
  const user = await currentUser();

  // 이미 들어와 있으면 가입 화면을 보여 줄 이유가 없다. 로그인 화면과
  // 같은 규칙으로 보낸다.
  if (user !== null) {
    const studentId = await studentIdOfViewer(supabase, user.id);
    redirect(studentId === null ? '/parent' : '/home');
  }

  return (
    <main className="flex flex-1 flex-col">
      <SignupForm />
    </main>
  );
}
