/**
 * AUTH-001 로그인 · `/login` (DEV-002)
 *
 * 생김새는 Figma `로그인 / 기본 (통합)` (478:15748) 을 옮긴 것이다.
 *
 * ```text
 *   Welcome / 메티의 인사   180px   캐릭터 + 로고
 *   Content / 335                   로그인 카드 + 가입 안내
 *   (아래 34px 은 홈 인디케이터 자리)
 * ```
 *
 * **소셜 로그인 버튼은 있고, 아직 들어가지지는 않는다.**
 * `_components/SocialSignIn.tsx` 가 구글 · 카카오 공식 아이콘을 그린다.
 * 누르면 「아직 준비 중」 이라고 알려준다 — 자격증명과 돌아오는 길이
 * 아직 없어서다. 이유는 `_actions.ts` 의 `signInWithSocial` 에 적어 뒀다.
 *
 * 네이버는 Figma 에 있었지만 뺐다(2026-09-28). Supabase 가 Provider 로
 * 제공하지 않아 버튼만 두면 영영 안 되는 길을 보여주게 된다.
 */

import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient, currentUser } from '@/lib/supabase/server';
import { studentIdOfViewer } from '@/lib/services/student-login';
import { isActiveAdmin } from '@/lib/services/admin';
import { LoginForm } from './_components/LoginForm';

export const metadata = { title: '로그인 · 메티' };

export default async function LoginPage() {
  const supabase = await createClient();
  const user = await currentUser();

  // 이미 들어와 있으면 로그인 화면을 보여 줄 이유가 없다.
  //
  // **누구인지 보고 보낸다.** 로그인 Action 과 같은 규칙이다 — 부모는
  // 보호자 화면, 아이는 자기 홈. 한쪽으로 몰아 보내면 아이가 부모 화면에
  // 닿는다. 거기엔 상세 평가점수가 있다(COM-003).
  if (user !== null) {
    const studentId = await studentIdOfViewer(supabase, user.id);
    if (studentId !== null) redirect('/home');
    redirect((await isActiveAdmin(supabase, user.id)) ? '/admin' : '/parent');
  }

  return (
    <main className="flex flex-1 flex-col pb-[34px]">
      {/*
        Figma `Welcome / 메티의 인사` — 180px 에 손 흔드는 메티(97) 와 로고(121×55).
        `PartnerFace` 가 아니라 그림을 바로 쓴다. 대화 속 얼굴이 아니라
        첫인사용 `METTY_02_Wave` 한 장이라서다.
      */}
      <header className="flex h-[180px] flex-col items-center justify-center px-5 py-3">
        <Image
          src="/characters/meti-wave.png"
          alt=""
          width={97}
          height={97}
          className="size-[97px] object-contain"
          priority
        />
        <Image
          src="/meti-logo.png"
          alt="Meti"
          width={121}
          height={55}
          className="h-[55px] w-[121px] object-contain"
          priority
        />
      </header>

      {/* Figma `Content / 335` */}
      <div className="flex flex-col gap-3 px-5 pt-3">
        <LoginForm />

        {/* Figma `Text Link / 회원가입` — 아이는 스스로 가입하지 않는다(COM-003 §4.1) */}
        <div className="flex flex-col gap-1 pt-1 text-center">
          <Link href="/signup" className="text-[14px] font-semibold leading-5 text-button-primary">
            처음 오셨나요? 보호자 회원가입
          </Link>
          <p className="text-[12px] leading-[18px] text-text-secondary">
            학생 계정은 보호자가 가입 후 만들어 줘요.
          </p>
        </div>
      </div>
    </main>
  );
}
