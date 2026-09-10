'use client';

/**
 * ⚠️ COM-003에 정의되지 않은 화면이다. `dex/page.tsx` 상단 주석과 동일한
 * 경고 적용 — 머지 전 COM-003 변경 제안 필요.
 *
 * ⚠️ 경로 알림: `/login`은 이미 `AUTH-001`(부모용 로그인)로 확정 배정되어
 * 있어 (DEV-002 §2) 같은 경로를 쓸 수 없다. 그래서 `/student/login`을
 * 임시로 쓴다. 실제로는 "학생이 별도 아이디/비밀번호로 로그인한다"는
 * 발상 자체가 COM-001 흐름(부모가 가입 → 학생 프로필을 등록 → 학생은
 * 프로필을 선택만 함, `STU-002`)과 다르다. 그대로 반영하기 전에 서비스
 * 흐름과 맞는지 팀 확인이 필요하다.
 *
 * Route: `/student/login` (임시)
 */

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { LOGO_IMG, CHARACTER_IMG } from '../../_lib/mock-data';

export default function StudentLoginPage() {
  const router = useRouter();
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [pwShown, setPwShown] = useState(false);
  const [saveId, setSaveId] = useState(true);

  return (
    <div className="flex h-full flex-col bg-[#DDF4F6]">
      <div className="flex-1 overflow-y-auto px-5.5 pb-5 pt-10">
      <div className="text-center">
        <div className="mb-2.5 text-sm font-bold text-[#3E5057]">내 생각을 발견하는 시간</div>
        <Image src={LOGO_IMG} alt="Meti" width={200} height={90} className="mx-auto mt-4 block w-[200px]" />
        <Image
          src={CHARACTER_IMG.metty.wave}
          alt="메티"
          width={168}
          height={168}
          className="mx-auto mt-2.5 block h-[168px] w-auto animate-metty-float"
        />
      </div>

      <div className="mt-12 rounded-3xl bg-white p-4.5 shadow-[0_4px_16px_rgba(32,107,124,.1)]">
        <div className="mb-1.5 text-[13px] font-extrabold text-[#718087]">아이디</div>
        <input
          value={id}
          onChange={(e) => setId(e.target.value)}
          placeholder="seoyeon2016"
          className="h-[52px] w-full rounded-2xl border-[1.5px] border-[#E1EAEC] bg-[#F7FAFB] px-4 text-lg font-bold text-[#24333A] outline-none"
        />
        <div className="mb-1.5 mt-3.5 text-[13px] font-extrabold text-[#718087]">비밀번호</div>
        <div className="relative">
          <input
            type={pwShown ? 'text' : 'password'}
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="••••••"
            className="h-[52px] w-full rounded-2xl border-[1.5px] border-[#E1EAEC] bg-[#F7FAFB] px-4 pr-16 text-lg font-bold text-[#24333A] outline-none"
          />
          <button
            onClick={() => setPwShown((v) => !v)}
            className="absolute right-1.5 top-1 h-11 rounded-2xl bg-[#EDF2F3] px-3.5 text-[13px] font-extrabold text-[#546269]"
          >
            {pwShown ? '숨기기' : '보기'}
          </button>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={() => setSaveId((v) => !v)}
            className="flex h-7 w-7 flex-none items-center justify-center rounded-lg border-2 text-xs font-extrabold text-white"
            style={{ borderColor: saveId ? '#206B7C' : '#C9D5D8', background: saveId ? '#206B7C' : '#FFFFFF' }}
          >
            {saveId ? '✓' : ''}
          </button>
          <span className="text-[13px] font-bold text-[#546269]">아이디 저장하기</span>
        </div>
        <button
          onClick={() => router.push('/student/onboarding')}
          className="mt-4 w-full rounded-2xl bg-[#206B7C] py-4.5 text-lg font-extrabold text-white"
        >
          로그인
        </button>
        <div className="mt-3.5 flex items-center justify-center gap-3 text-[13px] font-bold text-[#718087]">
          <span className="text-[#206B7C] underline">비밀번호 찾기</span>
          <span className="h-2.5 w-px bg-[#D8E2E5]" />
          <span className="text-[#206B7C] underline">회원가입</span>
        </div>
      </div>

      <div className="mt-3.5 flex items-center gap-2.5 rounded-2xl bg-white/60 p-3.5">
        <span className="text-[13px] font-bold leading-snug text-[#3E5057]">
          계정이 없으면 부모님과 함께 회원가입해줘
        </span>
      </div>
      </div>
    </div>
  );
}
