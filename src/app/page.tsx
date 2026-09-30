import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { createClient, currentUser } from '@/lib/supabase/server';
import { studentIdOfViewer } from '@/lib/services/student-login';
import { TERMS } from '@/lib/constants/terms';

/**
 * 진입점. **로그인한 사람은 그대로 자기 자리로 보낸다.**
 *
 * 전에는 누구든 `/login` 으로 넘기기만 했다. 화면이 없었기 때문이다
 * (DEV-002 에 `/` 에 해당하는 Screen 이 없다).
 *
 * ## 소개가 필요해진 이유
 *
 * 구글 OAuth 동의 화면을 게시하려면 **애플리케이션 홈페이지** URL 을
 * 요구한다. 거기에 로그인 폼만 있으면 구글 심사자도, 처음 온 부모도
 * 무엇을 하는 서비스인지 알 수 없다.
 *
 * 그래서 이 페이지는 **가입 전 사람에게만** 보인다. 이미 들어와 있으면
 * `/login` 이 하던 것과 같은 분기로 보낸다 — 부모는 `/parent`, 아이는
 * `/home`. 로그인한 사람이 홈에 오려다 소개글을 보게 되면 안 된다.
 *
 * **Figma `진입 / 스플래시` (1:4770) 로 바꾸지 않았다.** 스플래시는 로고와
 * 한 줄만 있는 화면이라, 구글 심사자와 처음 온 부모에게 서비스를 설명해야
 * 하는 이 페이지의 일을 못 한다. 로고와 색만 가져왔다.
 *
 * **Screen ID 를 만들지 않았다.** COM-003 §12 의 화면 수를 늘리는 것은
 * 문서를 먼저 고쳐야 하는 일이고(CLAUDE.md), 이 페이지는 학습 기능이
 * 아니라 서비스 설명이다. DEV-002 §2 에 route 만 적는다.
 */
export const metadata = {
  title: '메티 · 초등 수학을 스스로 설명하게 하는 학습',
  description:
    '메티는 초등학교 4~6학년이 답을 맞히는 것에서 멈추지 않고, 왜 그렇게 풀었는지 스스로 설명하게 하는 학습 서비스입니다.',
};

/** 무엇을 하는 서비스인가. **기능 목록이 아니라 학습이 어떻게 흐르는지 적는다** */
const STEPS = [
  {
    title: '문제를 풀고 끝내지 않는다',
    body: '답을 맞혔는지보다 어디서 갈렸는지를 본다. 틀렸다가 스스로 바로잡는 장면이 이 서비스가 보려는 것이다.',
  },
  {
    title: '아이가 설명하게 한다',
    body: '왜 그렇게 풀었는지 되묻는다. 설명하다 막히는 자리가 실제로 모르는 자리다.',
  },
  {
    title: '부모는 결과를 따로 본다',
    body: '아이 화면에는 점수와 약점이 나오지 않는다. 사고 과정과 자주 막힌 부분은 부모 화면에서 본다.',
  },
];

export default async function RootPage() {
  const supabase = await createClient();
  const user = await currentUser();

  if (user !== null) {
    const studentId = await studentIdOfViewer(supabase, user.id);
    redirect(studentId === null ? '/parent' : '/home');
  }

  return (
    <main className="mx-auto flex w-full max-w-[720px] flex-1 flex-col gap-10 px-5 py-14">
      <header className="flex flex-col gap-4">
        {/* Figma `진입 / 스플래시` 의 `로고 묶음` — 로고 154×70 */}
        <Image
          src="/meti-logo.png"
          alt="Meti"
          width={154}
          height={70}
          className="h-[70px] w-[154px] object-contain object-left"
          priority
        />
        <p className="text-[14px] font-semibold leading-5 text-meti-hint">
          초등 4~6학년 수학 · 메타인지 학습
        </p>
        <h1 className="text-[28px] font-bold leading-9 text-text-primary">
          답을 맞히는 데서 멈추지 않고,
          <br />
          스스로 설명하게 합니다
        </h1>
        <p className="text-[16px] leading-6 text-text-secondary">
          메티는 아이가 푼 방법을 되묻습니다. 설명하다 막히는 자리가 실제로 모르는
          자리이기 때문입니다.
        </p>
      </header>

      <section className="flex flex-col gap-6">
        {STEPS.map((step, index) => (
          <div key={step.title} className="flex gap-4">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-button-primary text-[13px] font-semibold leading-5 text-white">
              {index + 1}
            </span>
            <div className="flex flex-col gap-1">
              <h2 className="text-[16px] font-semibold leading-6 text-text-primary">{step.title}</h2>
              <p className="text-[14px] leading-5 text-text-secondary">{step.body}</p>
            </div>
          </div>
        ))}
      </section>

      <div className="flex flex-col gap-3">
        <Link
          href="/signup"
          className="flex h-[52px] items-center justify-center rounded-lg bg-button-primary px-5 text-[16px] font-semibold leading-6 text-white hover:bg-button-hover active:bg-button-pressed"
        >
          시작하기
        </Link>
        <Link
          href="/login"
          className="flex h-[52px] items-center justify-center rounded-lg border border-meti-line bg-surface-primary px-5 text-[16px] font-semibold leading-6 text-text-primary hover:bg-background-primary"
        >
          이미 계정이 있어요
        </Link>
      </div>

      {/*
        약관 링크를 여기 두는 이유가 있다. 구글은 홈페이지 · 개인정보
        처리방침 · 이용약관 셋을 각각 요구하는데, 홈페이지에서 나머지 둘로
        가는 길이 없으면 사람이 주소를 직접 쳐야 한다.
      */}
      <footer className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-meti-line pt-6">
        <Link
          href="/terms"
          className="text-[13px] leading-5 text-meti-hint underline underline-offset-4"
        >
          {TERMS.terms.title}
        </Link>
        <Link
          href="/privacy"
          className="text-[13px] leading-5 text-meti-hint underline underline-offset-4"
        >
          {TERMS.privacy.title}
        </Link>
      </footer>
    </main>
  );
}
