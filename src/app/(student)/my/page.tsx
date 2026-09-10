'use client';

/**
 * ⚠️ COM-003에 정의되지 않은 화면이다. `dex/page.tsx` 상단 주석과 동일한
 * 경고 적용 — 머지 전 COM-003 변경 제안 필요.
 *
 * `RPT-001`(주간 성장 리포트, 부모용)과 겹치는 부분이 있지만 이건 학생
 * 본인이 보는 버전이다. COM-002 §377 `report_type: daily_student`가
 * 이미 존재해서, 학생용 리포트 자체는 데이터 모델상 근거가 있다 — 다만
 * Screen ID는 아직 없다.
 *
 * Route: `/my` (임시)
 */

import Image from 'next/image';
import Link from 'next/link';

import { BottomTabs } from '../_components/BottomTabs';
import { CHARACTER_IMG, CHARACTERS, WEEKLY_ACTIVITY, WEEKLY_METRICS } from '../_lib/mock-data';
import { useStudentState } from '../_lib/use-student-state';

export default function MyPage() {
  const { state, hydrated } = useStudentState();
  if (!hydrated) return null;

  const partner = CHARACTERS[state.partner];

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-5 pb-6 pt-10">
      <h1 className="mb-3.5 text-[22px] font-extrabold tracking-tight">마이페이지</h1>

      <div className="mb-3 rounded-3xl bg-white p-4 shadow-[0_2px_10px_rgba(32,107,124,.07)]">
        <div className="flex items-center gap-3.5">
          <div className="flex h-16 w-16 flex-none items-end justify-center overflow-hidden rounded-3xl bg-[#DDF4F6]">
            <Image src={CHARACTER_IMG.meti.celebrate} alt="파트너" width={62} height={62} className="h-[62px] w-auto" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-lg font-extrabold text-[#24333A]">초등 4학년</div>
            <div className="mt-0.5 text-[13px] font-bold text-[#206B7C]">지금 파트너 · {partner.ko}</div>
            <div className="mt-0.5 text-xs font-semibold text-[#718087]">메티와 함께한 지 38일</div>
          </div>
          <Link
            href="/onboarding/persona"
            className="flex-none whitespace-nowrap rounded-full border-[1.5px] border-[#206B7C] bg-white px-4 py-3 text-[13px] font-extrabold text-[#206B7C]"
          >
            변경
          </Link>
        </div>
        <div className="mt-3.5 grid grid-cols-3 gap-2 border-t border-[#F0F4F5] pt-3.5 text-center">
          <div>
            <div className="text-lg font-extrabold text-[#24333A]">{state.points}</div>
            <div className="mt-0.5 text-xs font-bold text-[#718087]">포인트</div>
          </div>
          <div className="border-x border-[#F0F4F5]">
            <div className="text-lg font-extrabold text-[#24333A]">{state.streakDays}일</div>
            <div className="mt-0.5 text-xs font-bold text-[#718087]">연속 학습</div>
          </div>
          <div>
            <div className="text-lg font-extrabold text-[#24333A]">4/6</div>
            <div className="mt-0.5 text-xs font-bold text-[#718087]">친구 도감</div>
          </div>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-2.5">
        <Link href="/calendar" className="rounded-2xl bg-white p-3.5 text-left shadow-[0_2px_10px_rgba(32,107,124,.06)]">
          <div className="text-sm font-extrabold text-[#24333A]">미션 캘린더</div>
          <div className="mt-1 text-xs font-bold text-[#C2554E]">남은 미션 8개</div>
        </Link>
        <Link href="/dex" className="rounded-2xl bg-white p-3.5 text-left shadow-[0_2px_10px_rgba(32,107,124,.06)]">
          <div className="text-sm font-extrabold text-[#24333A]">내 기억창고</div>
          <div className="mt-1 text-xs font-bold text-[#206B7C]">저장한 문장 12개</div>
        </Link>
      </div>

      <div className="mb-1 text-base font-extrabold text-[#24333A]">이번 주 생각 리포트</div>
      <div className="mb-3.5 text-[13px] font-semibold text-[#718087]">9월 2일 – 9월 8일</div>

      <div className="mb-4 flex gap-3 rounded-3xl bg-[#DDF4F6] p-4.5">
        <Image src={CHARACTER_IMG.quri.front} alt="큐리" width={66} height={66} className="flex-none" />
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 text-[13px] font-extrabold text-[#206B7C]">큐리의 한 줄</div>
          <div className="text-sm font-bold leading-snug text-[#24333A] text-pretty">
            &ldquo;틀린 이유를 말로 설명한 날, 다음 문제 정답률이 확 올랐어!&rdquo;
          </div>
        </div>
      </div>

      <div className="mb-3.5 rounded-3xl bg-white p-4.5 shadow-[0_2px_10px_rgba(32,107,124,.06)]">
        <div className="mb-3.5 text-sm font-extrabold">메타인지 4가지 힘</div>
        {WEEKLY_METRICS.map((m) => (
          <div key={m.name} className="mb-3.5 last:mb-0">
            <div className="mb-1.5 flex items-baseline justify-between">
              <span className="text-[13px] font-bold text-[#24333A]">{m.name}</span>
              <span className="text-[13px] font-extrabold text-[#206B7C]">{m.val}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-[#EEF3F4]">
              <div className="h-full rounded-full bg-[#57C7B6]" style={{ width: `${m.pct}%` }} />
            </div>
            <div className="mt-1 text-xs font-semibold text-[#718087]">{m.note}</div>
          </div>
        ))}
      </div>

      <div className="rounded-3xl bg-white p-4.5 shadow-[0_2px_10px_rgba(32,107,124,.06)]">
        <div className="mb-3 text-sm font-extrabold">요일별 생각 시간</div>
        <div className="flex h-[104px] items-end gap-2.5">
          {WEEKLY_ACTIVITY.map((d) => (
            <div key={d.day} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
              <div
                className="w-full rounded-lg"
                style={{ height: `${d.pct}%`, background: d.pct >= 50 ? '#57C7B6' : '#EEF3F4' }}
              />
              <span className="text-xs font-bold text-[#718087]">{d.day}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-2.5 mt-6 text-base font-extrabold text-[#24333A]">설정</div>
      <div className="rounded-2xl bg-white px-4 py-1 shadow-[0_2px_10px_rgba(32,107,124,.06)]">
        <SettingRow label="하루 목표" value="3개 · 약 15분 ›" />
        <SettingRow label="학습 알림" value="저녁 7시 ›" />
        <SettingRow label="부모님 연결" value="연결하기 ›" color="#206B7C" />
        <SettingRow label="계정" value="seoyeon2016 ›" last />
      </div>
      </div>

      <BottomTabs />
    </div>
  );
}

function SettingRow({ label, value, color = '#718087', last = false }: { label: string; value: string; color?: string; last?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-3.5 ${last ? '' : 'border-b border-[#F0F4F5]'}`}>
      <span className="text-sm font-bold text-[#24333A]">{label}</span>
      <span className="text-[13px] font-bold" style={{ color }}>
        {value}
      </span>
    </div>
  );
}
