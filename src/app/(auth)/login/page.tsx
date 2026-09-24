/**
 * AUTH-001 로그인 · `/login` (DEV-002)
 *
 * 생김새는 Figma `통합 로그인 / 부모님` 프레임을 옮긴 것이다.
 *
 * ```text
 *   Welcome / 메티의 인사   180px   캐릭터 + 로고
 *   Content / 335                   로그인 카드 + 가입 안내
 *   (아래 34px 은 홈 인디케이터 자리)
 * ```
 *
 * **소셜 로그인은 빼 두었다.** 프레임에는 「또는 간편하게 로그인」 아래
 * 구글 · 카카오 · 네이버 동그라미가 있지만, 그건 외부 서비스를 새로
 * 들이는 일이다(COM-005 §14). 같은 페이지 스티키도 「소셜 버튼은 추후
 * 각 소셜에 맞춰 변경예정」 이라고 적어 뒀다 — 아직 정해진 것이 없다.
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { studentIdOfViewer } from '@/lib/services/student-login';
import { PartnerFace } from '@/components/ui/PartnerFace';
import { LoginForm } from './_components/LoginForm';

export const metadata = { title: '로그인 · 메티' };

export default async function LoginPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  // 이미 들어와 있으면 로그인 화면을 보여 줄 이유가 없다.
  //
  // **누구인지 보고 보낸다.** 로그인 Action 과 같은 규칙이다 — 부모는
  // 보호자 화면, 아이는 자기 홈. 한쪽으로 몰아 보내면 아이가 부모 화면에
  // 닿는다. 거기엔 상세 평가점수가 있다(COM-003).
  if (data.user !== null) {
    const studentId = await studentIdOfViewer(supabase, data.user.id);
    redirect(studentId === null ? '/parent' : '/home');
  }

  return (
    <main className="flex flex-1 flex-col pb-[34px]">
      {/*
        Figma `Welcome / 메티의 인사` — 180px 에 캐릭터(97) 와 로고(121×55).

        **둘 다 진짜 그림이 아직 없다.** 캐릭터는 프레임이 `METTY_02_Wave`
        인데 우리에겐 `meti.png` 한 장뿐이라 그걸 쓴다. 로고 `meti-logo2.png`
        는 받은 적이 없어 글자로 대신한다. 파일이 오면 여기만 바꾸면 된다.
      */}
      <header className="flex h-[180px] flex-col items-center justify-center px-5 py-3">
        <PartnerFace persona="friend" size={97} />
        <h1 className="flex h-[55px] items-center text-[34px] font-extrabold tracking-tight text-meti">
          Meti
        </h1>
      </header>

      {/* Figma `Content / 335` */}
      <div className="flex flex-col gap-3 px-5 pt-3">
        <LoginForm />

        {/* Figma `처음 온 부모님 안내` */}
        <div className="flex flex-col gap-1 pt-1 text-center">
          <Link href="/signup" className="text-[14px] font-semibold leading-5 text-meti">
            처음 오셨나요? 회원가입
          </Link>
          <p className="text-[12px] leading-[18px] text-meti-sub">
            아이와 함께할 첫걸음, 메티가 도와드려요.
          </p>
        </div>
      </div>
    </main>
  );
}
