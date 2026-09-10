/**
 * ⚠️ COM-003에 정의되지 않은 화면이다. `dex/page.tsx` 상단 경고와 같다.
 *
 * `(parent)` 트랙에 이미 부모용 MY(계정 관리)가 있는데, 이 화면은 그거랑
 * 다르다 — 프로토타입(`METTY App.dc.html` isReport)의 **학생 본인용**
 * '마이페이지'(파트너 요약 · 캘린더/도감 바로가기)를 디자인만 옮긴 것이다.
 * 상세 평가점수·Logic Gap은 원래도 이 화면에 없었다 — COM-003 규칙과
 * 충돌하지 않는다.
 *
 * '메티와 함께한 지 38일' 같은 수치는 실제 근거가 없어 뺐다. `home/dex`와
 * 같은 이유.
 */

import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getStudent } from '@/lib/services/student';
import { PARTNER_NAME } from '@/lib/constants/copy';
import { STUDENT_COOKIE } from '@/lib/constants/student-cookie';
import { PartnerFace } from '@/components/ui/PartnerFace';
import { BottomTabs } from '../_components/BottomTabs';

export const metadata = { title: '마이페이지 · 메티' };

export default async function MyPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user === null) redirect('/login');

  const jar = await cookies();
  const studentId = jar.get(STUDENT_COOKIE)?.value ?? '';
  if (studentId === '') redirect('/students');
  const student = await getStudent(supabase, studentId);
  if (student === null) redirect('/students');

  const partner = PARTNER_NAME[student.persona_type];

  return (
    <div className='flex h-dvh flex-col'>
      <main className='flex flex-1 flex-col overflow-y-auto bg-[#F7FAFB] px-5 py-6'>
        <h1 className='mb-3.5 mt-1 text-[22px] font-extrabold tracking-[-0.4px] text-meti-ink'>
          마이페이지
        </h1>

        <div className='mb-3 rounded-[24px] bg-white p-4 shadow-[0_2px_10px_rgba(32,107,124,.07)]'>
          <div className='flex items-center gap-[13px]'>
            <span className='flex h-16 w-16 shrink-0 items-end justify-center overflow-hidden rounded-[22px] bg-meti-bg'>
              <PartnerFace
                persona={student.persona_type}
                pose='celebrate'
                size={62}
              />
            </span>
            <div className='min-w-0 flex-1'>
              <p className='text-[18px] font-extrabold text-meti-ink'>
                {student.nickname}
              </p>
              <p className='mt-[3px] text-[13px] font-bold text-meti'>
                지금 파트너 · {partner}
              </p>
              <p className='mt-0.5 text-[12px] font-semibold text-meti-sub'>
                초등 {student.grade}학년
              </p>
            </div>
            <Link
              href='/onboarding/persona'
              className='shrink-0 whitespace-nowrap rounded-full border-[1.5px] border-meti bg-white px-4 py-3 text-[13px] font-extrabold text-meti'
            >
              변경
            </Link>
          </div>
          <div className='mt-3.5 border-t border-[#F0F4F5] pt-3.5 text-center'>
            {/* 실제 포인트 원장이 없다 — 0을 그대로 보여준다(home/shop과 같은 이유) */}
            <p className='text-[19px] font-extrabold text-meti-ink'>0</p>
            <p className='mt-0.5 text-[12px] font-bold text-meti-sub'>포인트</p>
          </div>
        </div>

        <div className='mb-5 grid grid-cols-2 gap-2.5'>
          <Link
            href='/calendar'
            className='rounded-[20px] bg-white p-3.5 text-left shadow-[0_2px_10px_rgba(32,107,124,.06)]'
          >
            <p className='text-[14px] font-extrabold text-meti-ink'>
              미션 캘린더
            </p>
            <p className='mt-[3px] text-[12px] font-bold text-meti-sub'>
              날짜별로 모아보기
            </p>
          </Link>
          <Link
            href='/dex'
            className='rounded-[20px] bg-white p-3.5 text-left shadow-[0_2px_10px_rgba(32,107,124,.06)]'
          >
            <p className='text-[14px] font-extrabold text-meti-ink'>
              내 기억창고
            </p>
            <p className='mt-[3px] text-[12px] font-bold text-meti-sub'>
              메티 프렌즈 도감
            </p>
          </Link>
        </div>

        <Link
          href='/students'
          className='text-center text-[13px] font-semibold text-meti-sub underline'
        >
          다른 친구로 바꾸기
        </Link>
      </main>
      <BottomTabs persona={student.persona_type} />
    </div>
  );
}
