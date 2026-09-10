'use client';

/**
 * ⚠️ COM-003에 정의되지 않은 화면이다. `dex/page.tsx` 상단 주석과 동일한
 * 경고 적용 — 머지 전 COM-003 변경 제안 필요.
 *
 * COM-003 §5는 State/Modal을 별도 Route로 만들지 말라고 하므로(§13-3),
 * 온보딩 3단계는 한 Route 안에서 단계(step) State로 흡수했다.
 *
 * Route: `/student/onboarding` (임시)
 */

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { CHARACTER_IMG, GROUP_IMG } from '../../_lib/mock-data';

export default function StudentOnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);

  function next() {
    if (step === 3) router.push('/onboarding/persona');
    else setStep((s) => ((s + 1) as 1 | 2 | 3));
  }

  function back() {
    if (step === 1) router.push('/student/login');
    else setStep((s) => ((s - 1) as 1 | 2 | 3));
  }

  return (
    <div className="flex h-full flex-col bg-[#F7FAFB]">
      <div className="flex flex-none items-center gap-2 px-5.5 pb-2 pt-10">
        <button onClick={back} className="-ml-2.5 flex h-11 w-11 items-center justify-center text-[22px] text-[#24333A]">
          ‹
        </button>
        <div className="flex flex-1 gap-1.5">
          {[1, 2, 3].map((n) => (
            <span key={n} className="h-1.5 flex-1 rounded-full" style={{ background: step >= n ? '#206B7C' : '#DDE7E9' }} />
          ))}
        </div>
        <button onClick={() => router.push('/onboarding/persona')} className="text-[13px] font-bold text-[#9AA7AC]">
          건너뛰기
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5.5">
        {step === 1 && <Step1 />}
        {step === 2 && <Step2 />}
        {step === 3 && <Step3 />}
      </div>

      <div className="flex-none px-5.5 pb-6 pt-4">
        <button onClick={next} className="w-full rounded-2xl bg-[#206B7C] py-4.5 text-lg font-extrabold text-white">
          {step === 3 ? '파트너 고르러 가기' : '다음'}
        </button>
      </div>
    </div>
  );
}

function Step1() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="mt-8.5 text-center">
        <div className="inline-block rounded-full bg-[#DDF4F6] px-3.5 py-1.5 text-xs font-extrabold text-[#206B7C]">
          메티는 네 생각을 발견하는 것을 좋아해
        </div>
        <div className="mt-3 text-2xl font-extrabold leading-snug tracking-tight text-pretty">
          메티는 너의
          <br />
          생각이 궁금해
        </div>
        <div className="mt-2 text-sm font-semibold leading-relaxed text-[#718087] text-pretty">
          네가 생각을 자세히
          <br />
          말해 수록 더 즐거워할거야
        </div>
      </div>
      <div className="mt-5 rounded-3xl bg-white p-4 shadow-[0_3px_14px_rgba(32,107,124,.08)]">
        <div className="mb-2.5 flex items-end gap-2">
          <Image src={CHARACTER_IMG.metty.front} alt="메티" width={30} height={30} className="h-[30px] w-auto" />
          <div className="rounded-2xl rounded-bl-sm bg-[#F1F5F6] px-3 py-2.5 text-[13px] font-semibold text-[#24333A]">
            내가 먼저 풀어볼게 👀
          </div>
        </div>
        <div className="mb-1.5 rounded-xl border-[1.5px] border-[#EDF2F3] px-2.5 py-2 text-sm font-bold">3/4 ÷ 2/5</div>
        <div className="flex items-center justify-between rounded-xl border-[1.5px] border-[#E08C7C] bg-[#FDEDE9] px-2.5 py-2">
          <span className="text-sm font-bold">= 3/4 × 2/5</span>
          <span className="text-xs font-extrabold text-[#C2554E]">여기!</span>
        </div>
        <div className="mt-2.5 text-[13px] font-bold text-[#206B7C]">틀린 줄을 누르면 대화가 시작돼</div>
      </div>
      <Image
        src={CHARACTER_IMG.metty.front}
        alt="메티"
        width={150}
        height={150}
        className="mx-auto mt-11.5 block h-[150px] w-auto animate-metty-float"
      />
    </div>
  );
}

function Step2() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="mt-4.5 text-center">
        <div className="inline-block rounded-full bg-[#DDF4F6] px-3.5 py-1.5 text-xs font-extrabold text-[#206B7C]">
          방법은 두 가지
        </div>
        <div className="mt-3 text-2xl font-extrabold leading-snug tracking-tight text-pretty">
          사진으로 올려도,
          <br />
          말로 해도 돼
        </div>
        <div className="mt-2 text-sm font-semibold leading-relaxed text-[#718087] text-pretty">
          문제를 사진으로 찍어 올리거나,
          <br />
          메티 질문에 그냥 답을 해도 시작이야
        </div>
      </div>
      <div className="mt-5 flex items-center gap-3.5 rounded-3xl bg-white p-4 shadow-[0_3px_14px_rgba(32,107,124,.08)]">
        <div className="flex h-12 w-12 flex-none items-center justify-center overflow-hidden rounded-2xl bg-[#DDF4F6]">
          <Image src={CHARACTER_IMG.metty.wave} alt="메티" width={40} height={40} className="h-10 w-auto object-contain" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-base font-extrabold">메티의 미션을 해결하기</div>
          <div className="mt-1 text-[13px] font-semibold leading-snug text-[#718087]">
            메티와 함께 고민하며 미션을 해결하기
          </div>
        </div>
      </div>
      <div className="mt-2.5 flex items-center gap-3.5 rounded-3xl bg-white p-4 shadow-[0_3px_14px_rgba(32,107,124,.08)]">
        <div className="flex h-12 w-12 flex-none items-center justify-center overflow-hidden rounded-2xl bg-[#FDEDE9]">
          <Image src={CHARACTER_IMG.hetty.wave} alt="헤티" width={40} height={40} className="h-10 w-auto object-contain" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-base font-extrabold">헤티의 실수를 찾아내기</div>
          <div className="mt-1 text-[13px] font-semibold leading-snug text-[#718087]">
            헤티의 실수를 찾아내고 미션을 해결하기
          </div>
        </div>
      </div>
      <Image
        src={CHARACTER_IMG.quri.celebrate}
        alt="큐리"
        width={130}
        height={130}
        className="mx-auto mt-11.5 block h-[130px] w-auto animate-metty-float [--metty-float-duration:4.4s]"
      />
    </div>
  );
}

function Step3() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="mt-4.5 text-center">
        <div className="inline-block rounded-full bg-[#FFF3D6] px-3.5 py-1.5 text-xs font-extrabold text-[#8A6410]">
          일일미션만 완료하면 충분해
        </div>
        <div className="mt-3 text-2xl font-extrabold leading-snug tracking-tight text-pretty">
          생각할수록
          <br />
          친구가 늘어나
        </div>
        <div className="mt-2 text-sm font-semibold leading-relaxed text-[#718087] text-pretty">
          미션을 끝내면 포인트를 모아
          <br />
          새 친구를 만날 수 있어.
        </div>
      </div>
      <Image src={GROUP_IMG} alt="메티 프렌즈" width={290} height={190} className="mx-auto mt-2 block w-full max-w-[290px]" />
      <div className="mt-1.5 rounded-3xl bg-white p-4 shadow-[0_3px_14px_rgba(32,107,124,.08)]">
        <div className="mb-2.5 flex items-center justify-between">
          <span className="text-[13px] font-extrabold">오늘의 목표</span>
          <span className="text-[13px] font-extrabold text-[#206B7C]">하루 10개 · 약 15분</span>
        </div>
        <div className="flex gap-1.5">
          <span className="h-2.5 flex-1 rounded-full bg-[#57C7B6]" />
          <span className="h-2.5 flex-1 rounded-full bg-[#DDF4F6]" />
          <span className="h-2.5 flex-1 rounded-full bg-[#DDF4F6]" />
        </div>
        <div className="mt-2.5 text-[13px] font-semibold text-[#718087]">목표는 나중에 설정에서 바꿀 수 있어</div>
      </div>
    </div>
  );
}
