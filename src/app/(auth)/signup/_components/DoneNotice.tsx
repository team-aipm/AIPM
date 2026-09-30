/**
 * Figma `회원가입 / 가입 완료` (1:5611) — AUTH-002 의 State 다(COM-003 §13-3).
 *
 * 다음 걸음이 하나뿐이다 — **자녀 계정 만들기.** 학생이 하나도 없는 부모를
 * 학습 현황으로 보내면 빈 화면부터 본다(DEV-002 §2 흐름).
 *
 * 확인 메일이 켜진 환경에서는 아직 세션이 없다. 그때는 링크를 먼저 눌러야
 * 하므로 같은 화면에서 안내만 바꾼다(DEV-003 §4-4). 그 모양은 Figma 에 없어
 * 같은 틀을 쓴다.
 *
 * 마친 화면이라 뒤로 가기 바가 없다. 갈 곳은 아래 버튼이 정한다.
 */

import Link from 'next/link';
import Image from 'next/image';

/** Figma `Button / Brand` 를 링크로 쓴 것. 가는 곳이 다른 화면이라 `a` 다 */
const BRAND =
  'flex h-[52px] w-full items-center justify-center rounded-lg bg-button-primary px-5 text-[16px] font-semibold leading-6 text-white hover:bg-button-hover active:bg-button-pressed';

export function DoneNotice({ email }: { email: string | null }) {
  const confirming = email !== null;

  return (
    <div className="flex flex-1 flex-col">
      {/* Figma `Content / 335` — 위 88 띄우고 가운데 정렬, gap16 */}
      <div className="flex flex-1 flex-col items-center gap-4 px-5 pt-[88px]">
        <div
          aria-hidden
          className="flex size-[72px] items-center justify-center rounded-full bg-surface-brand"
        >
          <Image src="/icons/check.svg" alt="" width={18} height={13} />
        </div>

        <h2 className="text-center text-[24px] font-bold leading-8 text-text-primary">
          {confirming ? '확인 메일을 보냈어요' : '가입이 끝났어요'}
        </h2>

        {/*
          「아이가 쓰는 이메일로」 — 아이 계정도 실제 이메일로 만든다
          (정책 v0.1 §7 · 2026-09-29). 메티가 이메일을 발급하지 않는다
          (FIGMA-MD-AUDIT §0).
        */}
        <p className="text-center text-[16px] leading-6 text-text-secondary">
          {confirming
            ? `${email}로 보낸 링크를 눌러야 가입이 끝나요. 메일이 보이지 않으면 스팸함도 확인해 주세요.`
            : '이제 자녀의 학습 계정을 만들어 볼까요? 아이가 쓰는 이메일로 로그인 정보를 만들어요.'}
        </p>
      </div>

      {/* Figma `CTA / Safe area` */}
      <div className="px-5 pb-[34px] pt-5">
        {confirming ? (
          <Link href="/login" className={BRAND}>
            로그인으로 돌아가기
          </Link>
        ) : (
          <Link href="/onboarding/student" className={BRAND}>
            자녀 계정 만들기
          </Link>
        )}
      </div>
    </div>
  );
}
