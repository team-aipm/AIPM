/**
 * Figma `회원가입 / 가입 완료` — AUTH-002 의 State 다(COM-003 §13-3).
 *
 * 다음 걸음이 하나뿐이다 — **자녀 계정 만들기.** 학생이 하나도 없는 부모를
 * 학습 현황으로 보내면 빈 화면부터 본다(DEV-002 §2 흐름).
 *
 * 확인 메일이 켜진 환경에서는 아직 세션이 없다. 그때는 링크를 먼저 눌러야
 * 하므로 같은 화면에서 안내만 바꾼다(DEV-003 §4-4).
 */

import Link from 'next/link';
import Image from 'next/image';

const BRAND =
  'flex h-[52px] w-full items-center justify-center rounded-lg text-[16px] font-semibold';

export function DoneNotice({ email }: { email: string | null }) {
  const confirming = email !== null;

  return (
    <div className="flex flex-col items-center gap-4 rounded-3xl border border-meti-line bg-white p-6">
      <div className="flex size-[72px] items-center justify-center rounded-full bg-meti-bg">
        <Image src="/icons/check.svg" alt="" width={18} height={13} />
      </div>

      <h2 className="text-center text-[24px] font-bold leading-8 text-meti-ink">
        {confirming ? '확인 메일을 보냈어요' : '가입이 끝났어요'}
      </h2>

      <p className="text-center text-[16px] leading-6 text-meti-sub">
        {confirming
          ? `${email}로 보낸 링크를 눌러야 가입이 끝나요. 메일이 보이지 않으면 스팸함도 확인해 주세요.`
          : '이제 자녀의 학습 계정을 만들어 볼까요? 아이디와 비밀번호를 직접 정해 주세요.'}
      </p>

      {confirming ? (
        <Link href="/login" className={`${BRAND} bg-meti text-white`}>
          로그인으로 돌아가기
        </Link>
      ) : (
        <Link href="/onboarding/student" className={`${BRAND} bg-meti text-white`}>
          자녀 계정 만들기
        </Link>
      )}
    </div>
  );
}
