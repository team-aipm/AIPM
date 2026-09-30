/**
 * MY-009 회원탈퇴 안내 · `/parent/my/account/withdraw` (DEV-002)
 *
 * **무엇이 사라지고 무엇이 남는지 먼저 말한다**(COM-007 §5-2). 누르고 나서
 * 알게 되면 늦다.
 *
 * 생김새는 Figma `설정 · 05 회원 탈퇴 확인` 이다. 문구는 Figma 가 아니라
 * COM-007 을 따른다 — Figma 는 「30일 후 학습 기록 완전 삭제」 인데 문서는
 * 학습 기록을 1년 보관한다(§4 · §5-2).
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient, currentUser } from '@/lib/supabase/server';
import { listStudents } from '@/lib/services/student';
import { MyTopBar } from '../../_components/MyTopBar';

export const metadata = { title: '회원탈퇴 · 메티' };

const CARD = 'flex flex-col gap-2 rounded-2xl border border-meti-line bg-surface-primary p-4';
const CARD_TITLE = 'text-[14px] font-semibold leading-5 text-text-primary';
const CARD_BODY = 'text-[14px] leading-5 text-text-secondary';

export default async function WithdrawPage() {
  const supabase = await createClient();
  const user = await currentUser();
  if (user === null) redirect('/login');

  const students = await listStudents(supabase);

  return (
    <main className="flex flex-1 flex-col">
      <MyTopBar title="회원 탈퇴" back="/parent/my" backLabel="설정으로" />

      <div className="flex flex-1 flex-col gap-3 px-5 pt-3">
        <section className={CARD}>
          <h3 className={CARD_TITLE}>함께 삭제됩니다</h3>
          <ul className={`flex flex-col gap-2 ${CARD_BODY}`}>
            <li>· 로그인 계정</li>
            <li>· 등록된 학생 {students.length}명의 프로필</li>
            <li>· 학습 기록 · 대화 · 평가 (1년 뒤 완전 삭제)</li>
            <li>· 문제 사진 (즉시 삭제)</li>
          </ul>
        </section>

        <section className={CARD}>
          <h3 className={CARD_TITLE}>남습니다</h3>
          <p className={CARD_BODY}>
            결제 기록은 법에 따라 보관합니다.
            <br />
            대금 결제 · 재화 공급 5년 · 소비자 불만 처리 3년.
          </p>
        </section>

        <section className={CARD}>
          <h3 className={CARD_TITLE}>30일 안에는 되돌릴 수 있습니다</h3>
          <p className={CARD_BODY}>
            같은 이메일로 복구를 요청하시면 됩니다. 30일이 지나면 새로 가입하는
            것이며 이전 기록은 이어지지 않습니다.
          </p>
        </section>
      </div>

      <div className="flex flex-col items-center gap-1 bg-background-primary px-5 pb-5 pt-3">
        <Link
          href="/parent/my"
          className="flex h-[52px] w-full items-center justify-center rounded-lg bg-button-primary text-[16px] font-semibold leading-6 text-white hover:bg-button-hover active:bg-button-pressed"
        >
          계속 이용하기
        </Link>
        <Link
          href="/parent/my/account/withdraw/confirm"
          className="py-3 text-[14px] leading-5 text-text-secondary"
        >
          이해했습니다. 계속하기
        </Link>
      </div>
    </main>
  );
}
