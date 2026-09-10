/**
 * ⚠️ COM-003에 정의되지 않은 화면이다. `dex/page.tsx` 상단 경고와 같다.
 *
 * 프로토타입(`METTY App.dc.html` isShop)의 '생각 상점'을 **디자인만**
 * 옮겼다. 실제로 교환 가능한 포인트 경제·아이템 테이블이 COM-002에 없어서
 * 버튼은 전부 비활성(disabled)이다 — 누를 수 있어 보이는데 아무 일도 안
 * 일어나면 그게 더 나쁘다. 포인트도 0을 그대로 보여준다(지어내지 않음,
 * `home/page.tsx`와 같은 이유).
 */

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getStudent } from '@/lib/services/student';
import { STUDENT_COOKIE } from '@/lib/constants/student-cookie';
import { PartnerFace } from '@/components/ui/PartnerFace';
import { BottomTabs } from '../_components/BottomTabs';

export const metadata = { title: '생각 상점 · 메티' };

const ITEMS = [
  { name: '큐리 해금', desc: '질문 대장 · 호기심 중심', icon: '?' },
  { name: '포키 해금', desc: '응원 요정 · 작은 성취 축하', icon: '?' },
  { name: '메티 밤하늘 배경', desc: '대화 화면 배경을 바꿔줘', icon: '🌙' },
  { name: '생각 스티커 5종', desc: '리포트에 붙이는 칭찬 스티커', icon: '✦' },
];

export default async function ShopPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user === null) redirect('/login');

  const jar = await cookies();
  const studentId = jar.get(STUDENT_COOKIE)?.value ?? '';
  if (studentId === '') redirect('/students');
  const student = await getStudent(supabase, studentId);
  if (student === null) redirect('/students');

  return (
    <div className='flex h-dvh flex-col'>
      <main className='flex flex-1 flex-col overflow-y-auto bg-[#F7FAFB] px-5 py-6'>
        <h1 className='mb-3.5 mt-1 text-[22px] font-extrabold tracking-[-0.4px] text-meti-ink'>
          생각 상점
        </h1>

        <div className='mb-4.5 flex items-center justify-between rounded-[24px] bg-meti-warm p-[18px]'>
          <div>
            <p className='text-[13px] font-bold text-meti-ink/75'>내 포인트</p>
            <p className='text-[32px] font-extrabold leading-[1.2] text-meti-ink'>
              0 P
            </p>
            <p className='text-[13px] font-bold text-meti-ink/75'>
              미션을 마치면 쌓이기 시작해
            </p>
          </div>
          <PartnerFace
            persona={student.persona_type}
            pose='wave'
            size={92}
            className='animate-meti-float'
          />
        </div>

        <h2 className='mb-2.5 px-0.5 text-[14px] font-extrabold text-meti-ink'>
          교환하기
        </h2>
        <div className='flex flex-col gap-2.5'>
          {ITEMS.map((item) => (
            <div
              key={item.name}
              className='flex items-center gap-3 rounded-[20px] bg-white p-3.5 shadow-[0_2px_10px_rgba(32,107,124,.06)]'
            >
              <span className='flex h-12 w-12 shrink-0 items-center justify-center rounded-[15px] bg-[#F1F5F6] text-[20px]'>
                {item.icon}
              </span>
              <div className='min-w-0 flex-1'>
                <p className='text-[16px] font-extrabold text-meti-ink'>
                  {item.name}
                </p>
                <p className='mt-0.5 text-[13px] font-semibold text-meti-sub'>
                  {item.desc}
                </p>
              </div>
              <button
                type='button'
                disabled
                className='shrink-0 whitespace-nowrap rounded-full bg-[#E7EEF0] px-4 py-3 text-[13px] font-extrabold text-meti-sub'
              >
                준비 중
              </button>
            </div>
          ))}
        </div>
      </main>
      <BottomTabs persona={student.persona_type} />
    </div>
  );
}
