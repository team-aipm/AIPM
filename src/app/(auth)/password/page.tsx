/**
 * AUTH-005 비밀번호 찾기 / 재설정 · `/password` (DEV-002 §2)
 *
 * **Route 는 하나다.** 「메일을 보냈어요」 · 「비밀번호를 바꿨어요」 ·
 * 「링크를 쓸 수 없어요」 는 모두 이 화면의 State 다 — COM-003 §13-3.
 * `/signup/verify` 가 가입 완료를 State 로 두는 것과 같은 방식이다
 * (DEV-002 §2).
 *
 * 갈래는 주소에 `code` 가 붙어 있느냐 하나뿐이다.
 *
 * ```text
 *   /password              이메일을 받아 링크를 보낸다
 *   /password?code=…       메일 속 링크로 돌아왔다. 새 비밀번호를 받는다
 * ```
 */

import { NewPasswordForm } from './_components/NewPasswordForm';
import { RequestResetForm } from './_components/RequestResetForm';

export const metadata = { title: '비밀번호 찾기 · 메티' };

export default async function PasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;

  return (
    <main className="flex flex-1 flex-col">
      {typeof code === 'string' && code !== '' ? (
        <NewPasswordForm code={code} />
      ) : (
        <RequestResetForm />
      )}
    </main>
  );
}
