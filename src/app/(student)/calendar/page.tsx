/**
 * ⚠️ COM-003에 정의되지 않은 화면이다. `dex/page.tsx` 상단 경고와 같다.
 *
 * 프로토타입(`METTY App.dc.html` isCal)의 '나의 미션 캘린더'를
 * **디자인만** 옮겼다. 달력 격자·요일·오늘 표시는 실제 날짜로 계산한다
 * (서버에서 `Intl`로 구한 진짜 오늘) — 여기까지는 지어낸 게 아니다.
 *
 * 하지만 날짜별 완료 점(●)·이번 달 통계·'이어서 하기' 목록은 실제 학습
 * 기록을 하루 단위로 모아야 나오는데, 그 조회는 `lib/services/**`
 * 영역이라 이번 작업 범위 밖이다(AI 코어 트랙 담당). 그래서 점은 하나도
 * 찍지 않는다 — 안 찍는 게 '아직 기록 없음'의 정직한 표현이고, 아무렇게나
 * 찍으면 실제 학습 기록처럼 보인다.
 */

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getStudent } from '@/lib/services/student';
import { STUDENT_COOKIE } from '@/lib/constants/student-cookie';
import { PartnerFace } from '@/components/ui/PartnerFace';
import { BottomTabs } from '../_components/BottomTabs';

export const metadata = { title: '나의 미션 캘린더 · 메티' };

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function buildMonthCells(now: Date) {
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = now.getDate();

  const cells: { day: number | null; isToday: boolean }[] = [];
  for (let i = 0; i < firstWeekday; i += 1)
    cells.push({ day: null, isToday: false });
  for (let d = 1; d <= daysInMonth; d += 1)
    cells.push({ day: d, isToday: d === today });
  return cells;
}

export default async function CalendarPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user === null) redirect('/login');

  const jar = await cookies();
  const studentId = jar.get(STUDENT_COOKIE)?.value ?? '';
  if (studentId === '') redirect('/students');
  const student = await getStudent(supabase, studentId);
  if (student === null) redirect('/students');

  const now = new Date();
  const monthLabel = new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
  }).format(now);
  const cells = buildMonthCells(now);

  return (
    <div className='flex h-dvh flex-col'>
      <main className='flex flex-1 flex-col overflow-y-auto bg-[#F7FAFB] px-5 py-6'>
        <h1 className='mb-4 mt-1 text-[14px] font-bold text-meti-sub'>
          나의 미션 캘린더
        </h1>

        <div className='rounded-[24px] bg-white p-4 shadow-[0_2px_10px_rgba(32,107,124,.07)]'>
          <div className='mb-3.5 flex items-center justify-center'>
            <span className='text-[16px] font-extrabold text-meti-ink'>
              {monthLabel}
            </span>
          </div>
          <div className='mb-1.5 grid grid-cols-7 gap-1'>
            {WEEKDAYS.map((w) => (
              <div
                key={w}
                className='text-center text-[12px] font-extrabold text-[#9AA7AC]'
              >
                {w}
              </div>
            ))}
          </div>
          <div className='grid grid-cols-7 gap-1'>
            {cells.map((c, i) => (
              <div
                key={i}
                className={`flex h-12 flex-col items-center justify-center gap-[3px] rounded-[13px] border-2 ${
                  c.isToday ? 'border-meti bg-meti-bg' : 'border-transparent'
                }`}
              >
                {c.day !== null && (
                  <span
                    className={`text-[13px] font-extrabold ${c.isToday ? 'text-meti' : 'text-meti-ink'}`}
                  >
                    {c.day}
                  </span>
                )}
              </div>
            ))}
          </div>
          <div className='mt-3.5 flex flex-wrap gap-3 border-t border-[#F0F4F5] pt-3'>
            <span className='flex items-center gap-1.5 text-[12px] font-semibold text-meti-sub'>
              <span className='h-[5px] w-4 rounded-full bg-meti-mint' />
              완료
            </span>
            <span className='flex items-center gap-1.5 text-[12px] font-semibold text-meti-sub'>
              <span className='h-[5px] w-4 rounded-full bg-meti-warm' />
              하다 남음
            </span>
          </div>
        </div>

        <div className='mt-4 flex items-center gap-[11px] rounded-[22px] bg-meti-bg p-[15px]'>
          <PartnerFace persona={student.persona_type} pose='front' size={56} />
          <p className='flex-1 text-[13px] font-bold leading-[1.5] text-meti'>
            아직 이번 달 기록이 없어. 오늘 미션부터 시작해볼까?
          </p>
        </div>
      </main>
      <BottomTabs persona={student.persona_type} />
    </div>
  );
}
