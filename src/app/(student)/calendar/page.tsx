'use client';

/**
 * ⚠️ COM-003에 정의되지 않은 화면이다. `dex/page.tsx` 상단 주석과 동일한
 * 경고 적용 — 머지 전 COM-003 변경 제안 필요.
 *
 * Route: `/calendar` (임시)
 */

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { BottomTabs } from '../_components/BottomTabs';
import {
  CALENDAR_DAYS,
  CALENDAR_FIRST_WEEKDAY,
  CALENDAR_TODAY,
  CALENDAR_TOTAL_DAYS,
  CHARACTER_IMG,
  MISSION_SUBS,
  MISSION_TITLES,
} from '../_lib/mock-data';

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

export default function CalendarPage() {
  const router = useRouter();
  const [monthOffset, setMonthOffset] = useState(0);
  const [selDay, setSelDay] = useState(CALENDAR_TODAY);

  const isThisMonth = monthOffset === 0;
  const monthLabel = isThisMonth ? '2026년 9월' : monthOffset < 0 ? '2026년 8월' : '2026년 10월';
  const firstWeekday = isThisMonth ? CALENDAR_FIRST_WEEKDAY : monthOffset < 0 ? 6 : 4;
  const totalDays = isThisMonth ? CALENDAR_TOTAL_DAYS : 31;

  const cells = useMemo(() => {
    const out: Array<{ date: number; status: string; doneCount: number } | null> = [];
    for (let i = 0; i < firstWeekday; i++) out.push(null);
    for (let d = 1; d <= totalDays; d++) {
      const rec = isThisMonth ? CALENDAR_DAYS.find((c) => c.date === d) : undefined;
      const status = rec ? rec.status : isThisMonth && d > CALENDAR_TODAY ? 'future' : 'none';
      out.push({ date: d, status, doneCount: rec?.doneCount ?? 0 });
    }
    return out;
  }, [firstWeekday, totalDays, isThisMonth]);

  const selected = isThisMonth ? CALENDAR_DAYS.find((c) => c.date === selDay) : undefined;
  const doneN = selected?.doneCount ?? 0;
  const isToday = selDay === CALENDAR_TODAY;

  const dayMissions = isThisMonth
    ? MISSION_TITLES.map((title, i) => {
        const done = i < doneN;
        const next = !done && i === doneN;
        return {
          title,
          sub: MISSION_SUBS[i],
          mark: done ? '✓' : String(i + 1),
          state: done ? '완료' : next ? '이어서 할 차례' : '대기',
          resumable: next,
        };
      })
    : [];

  const leftoverCount = CALENDAR_DAYS.filter((c) => c.date <= CALENDAR_TODAY).reduce(
    (sum, c) => sum + (3 - c.doneCount),
    0,
  );

  return (
    <div className="flex h-full flex-col bg-[#F7FAFB]">
      <div className="flex-1 overflow-y-auto px-5 pb-6 pt-10">
      <div className="mb-4 flex items-center gap-2.5">
        <button
          onClick={() => router.back()}
          className="-ml-2.5 flex h-11 w-11 items-center justify-center text-[22px] text-[#24333A]"
        >
          ‹
        </button>
        <span className="text-[13px] font-bold text-[#718087]">나의 미션 캘린더</span>
      </div>

      <div className="rounded-3xl bg-white p-4 shadow-[0_2px_10px_rgba(32,107,124,.07)]">
        <div className="mb-3.5 flex items-center justify-between">
          <button
            onClick={() => setMonthOffset((v) => Math.max(-1, v - 1))}
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F1F5F6] text-lg font-extrabold text-[#546269]"
          >
            ‹
          </button>
          <div className="text-base font-extrabold text-[#24333A]">{monthLabel}</div>
          <button
            onClick={() => setMonthOffset((v) => Math.min(1, v + 1))}
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F1F5F6] text-lg font-extrabold text-[#546269]"
          >
            ›
          </button>
        </div>
        <div className="mb-1.5 grid grid-cols-7 gap-1">
          {WEEKDAY_LABELS.map((w) => (
            <div key={w} className="text-center text-xs font-extrabold text-[#9AA7AC]">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((c, i) => {
            if (!c) return <div key={i} />;
            const sel = isThisMonth && c.date === selDay;
            const dotColor =
              c.status === 'done' ? '#57C7B6' : c.status === 'partial' ? '#FFC857' : c.status === 'future' ? 'transparent' : '#E3EAEC';
            return (
              <button
                key={i}
                onClick={() => isThisMonth && setSelDay(c.date)}
                disabled={!isThisMonth}
                className="flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl border-2"
                style={{
                  borderColor: sel ? '#206B7C' : isThisMonth && c.date === CALENDAR_TODAY ? '#57C7B6' : '#F1F5F6',
                  background: sel ? '#DDF4F6' : '#FFFFFF',
                }}
              >
                <span className="text-[13px] font-extrabold" style={{ color: c.status === 'future' ? '#C2CDD1' : '#24333A' }}>
                  {c.date}
                </span>
                <span className="h-1 w-4 rounded-full" style={{ background: dotColor }} />
              </button>
            );
          })}
        </div>
        <div className="mt-3.5 flex flex-wrap gap-3 border-t border-[#F0F4F5] pt-3">
          <Legend color="#57C7B6" label="3개 완료" />
          <Legend color="#FFC857" label="하다 남음" />
          <Legend color="#E3EAEC" label="안 함" />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2.5">
        <Stat label="이번 달 완료" value="5일" />
        <Stat label="남은 미션" value={`${leftoverCount}개`} color="#C2554E" />
        <Stat label="연속" value="5일" />
      </div>

      <div className="mb-2.5 mt-5 flex items-baseline justify-between">
        <span className="text-sm font-extrabold text-[#24333A]">
          {isThisMonth ? (isToday ? `오늘 · 9월 ${selDay}일` : `9월 ${selDay}일`) : `${monthLabel.slice(6)} 기록 없음`}
        </span>
        <span className="text-[13px] font-bold text-[#206B7C]">
          {isThisMonth ? (doneN === 3 ? '3개 모두 완료' : `${doneN}/3 진행 · ${3 - doneN}개 남음`) : ''}
        </span>
      </div>

      {!isThisMonth && (
        <div className="rounded-2xl border-[1.5px] border-dashed border-[#DDE7E9] bg-white p-6 text-center">
          <div className="text-sm font-extrabold text-[#546269]">이 달에는 기록이 없어</div>
          <div className="mt-1 text-[13px] font-semibold text-[#9AA7AC]">9월로 돌아가면 남은 미션을 볼 수 있어</div>
        </div>
      )}

      {dayMissions.map((m) => (
        <div
          key={m.title}
          className="mb-2.5 rounded-2xl border-[1.5px] p-3.5 shadow-[0_2px_10px_rgba(32,107,124,.05)]"
          style={{ borderColor: m.resumable ? '#DDF4F6' : '#F1F5F6', background: '#FFFFFF' }}
        >
          <div className="flex items-center gap-2.5">
            <span
              className="flex h-6 w-6 flex-none items-center justify-center rounded-lg text-xs font-extrabold"
              style={{
                background: m.mark === '✓' ? '#57C7B6' : m.resumable ? '#DDF4F6' : '#F1F5F6',
                color: m.mark === '✓' ? '#FFFFFF' : m.resumable ? '#206B7C' : '#9AA7AC',
              }}
            >
              {m.mark}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-extrabold text-[#24333A]">{m.title}</div>
              <div className="mt-0.5 text-[13px] font-semibold text-[#718087]">{m.sub}</div>
            </div>
            <span
              className="flex-none whitespace-nowrap text-xs font-extrabold"
              style={{ color: m.mark === '✓' ? '#57C7B6' : m.resumable ? '#206B7C' : '#9AA7AC' }}
            >
              {m.state}
            </span>
          </div>
          {m.resumable && (
            <button
              onClick={() => router.push('/mission')}
              className="mt-3 w-full rounded-2xl bg-[#206B7C] py-3 text-sm font-extrabold text-white"
            >
              이어서 하기
            </button>
          )}
        </div>
      ))}

      <div className="mt-1.5 flex items-center gap-2.5 rounded-2xl bg-[#DDF4F6] p-3.5">
        <Image src={CHARACTER_IMG.meti.front} alt="메티" width={56} height={56} className="h-14 w-auto flex-none" />
        <span className="min-w-0 flex-1 text-[13px] font-bold leading-snug text-[#206B7C] text-pretty">
          {isThisMonth
            ? doneN === 3
              ? '이 날은 완벽했어! 다른 날의 남은 미션도 채워볼까?'
              : '남은 미션은 언제든 이어서 할 수 있어. 지난 날도 채우면 포인트를 줄게!'
            : '이 달에는 기록이 없어. 9월로 돌아가면 오늘 미션을 이어서 할 수 있어!'}
        </span>
      </div>
      </div>

      <BottomTabs />
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="h-1 w-4 rounded-full" style={{ background: color }} />
      <span className="text-xs font-bold text-[#718087]">{label}</span>
    </div>
  );
}

function Stat({ label, value, color = '#24333A' }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-2xl bg-white p-3.5 shadow-[0_2px_10px_rgba(32,107,124,.06)]">
      <div className="text-xs font-bold text-[#718087]">{label}</div>
      <div className="mt-1 text-xl font-extrabold" style={{ color }}>
        {value}
      </div>
    </div>
  );
}
