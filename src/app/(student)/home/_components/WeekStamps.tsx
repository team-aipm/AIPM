/**
 * 학생 홈 「이번 주 참여 도장」 (COM-003 §4.9 문구 · COM-001 §11-A)
 *
 * Figma `홈 · 02 진행 중`(392:138) 하단 줄. 월~금 다섯 칸.
 *
 * - 도장 받은 날 → 도장 그림 · 「완료」
 * - 오늘(아직 도장 전) → 오늘 끝낸 미션 수 · 「진행 중」(0 이면 「오늘」)
 * - 그 밖의 날 → 점선 동그라미, 글자 없음
 *
 * **안 한 날은 앞으로의 날과 똑같이 그린다.** 빨간색 · ✕ 로 실패처럼
 * 보이게 하지 않는다(CLAUDE.md — 연속기록은 처벌이 아니다).
 */

import Image from 'next/image';

const DAY_NAMES = ['월', '화', '수', '목', '금'] as const;

export function WeekStamps({
  days,
  today,
  stamped,
  todayDone,
}: {
  /** 이번 주 월~금 'YYYY-MM-DD' 다섯 개 */
  days: string[];
  today: string;
  stamped: Set<string>;
  todayDone: number;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center">
        <h2 className="flex-1 text-[16px] leading-6 font-semibold text-text-primary">이번 주</h2>
        <p className="flex items-baseline gap-px">
          <span className="text-[16px] leading-6 font-semibold text-button-primary">{stamped.size}</span>
          <span className="text-[14px] leading-5 text-text-secondary">개 참여 도장</span>
        </p>
      </div>

      <ol className="flex justify-between" aria-label={`이번 주 참여 도장 ${stamped.size}개`}>
        {days.map((date, idx) => {
          const isStamped = stamped.has(date);
          const isToday = date === today && !isStamped;
          const status = isStamped ? '완료' : isToday ? (todayDone > 0 ? '진행 중' : '오늘') : null;

          return (
            <li key={date} className="flex w-10 flex-col items-center gap-2">
              <span
                className={`text-[12px] leading-[18px] ${date === today ? 'text-button-primary' : 'text-text-secondary'}`}
              >
                {DAY_NAMES[idx]}
              </span>

              {isStamped ? (
                <Image src="/icons/mission-stamp.png" alt="도장" width={40} height={40} />
              ) : isToday ? (
                <span className="flex size-10 items-center justify-center rounded-full border-2 border-button-primary bg-surface-primary text-[14px] leading-5 font-semibold text-button-primary">
                  {todayDone}
                </span>
              ) : (
                <span className="size-10 rounded-full border-[1.5px] border-dashed border-meti-off bg-surface-primary" />
              )}

              {/* 글자가 없는 날도 줄 높이를 지킨다 */}
              <span
                className={`h-[18px] text-[12px] leading-[18px] ${isToday ? 'text-button-primary' : 'text-text-secondary'}`}
              >
                {status}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
