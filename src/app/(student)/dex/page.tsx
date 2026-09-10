/**
 * ⚠️ COM-003에 정의되지 않은 화면이다 (`docs/DEV-002-routes.md`에 없음).
 * `student/login`과 같은 경고 — 머지 전 COM-003 변경 제안이 먼저 필요하다.
 *
 * 프로토타입(`METTY App.dc.html` isDex)의 '메티 프렌즈 도감' 화면을
 * **디자인만** 그대로 옮겼다. 실제 DB(`persona_type`)는 friend·villain
 * 2종뿐이라 '캐릭터를 모은다'는 개념 자체가 없다 — 그래서:
 *   - 메티·헤티는 항상 '함께하는 중'으로 보여준다 (실제로 존재하는 2종)
 *   - 큐리·포키·모노·토리는 프로토타입에 있던 자리만 남기고 '🔒 200P'
 *     같은 가격표는 뺐다. 포인트 경제 자체가 없는데 가격을 보여주면
 *     실제로 살 수 있는 것처럼 보인다 — 그 대신 '준비 중'만 둔다.
 */

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getStudent } from '@/lib/services/student';
import { STUDENT_COOKIE } from '@/lib/constants/student-cookie';
import { PartnerFace } from '@/components/ui/PartnerFace';
import { BottomTabs } from '../_components/BottomTabs';

export const metadata = { title: '메티 프렌즈 도감 · 메티' };

const ACTIVE = [
  {
    persona: 'friend' as const,
    ko: '메티',
    en: 'METI',
    tag: '생각 코치 · 되묻기 중심',
  },
  {
    persona: 'villain' as const,
    ko: '헤티',
    en: 'HETI',
    tag: '흔들기 라이벌 · 반박 중심',
  },
];

const LOCKED = ['큐리', '포키', '모노', '토리'];

export default async function DexPage() {
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
        <h1 className='mt-1 text-[22px] font-extrabold tracking-[-0.4px] text-meti-ink'>
          메티 프렌즈 도감
        </h1>
        <p className='mb-4 mt-1 text-[13px] font-semibold text-meti-sub'>
          생각을 나눌수록 친구가 늘어나 · {ACTIVE.length}/
          {ACTIVE.length + LOCKED.length}
        </p>

        <div className='grid grid-cols-2 gap-3'>
          {ACTIVE.map((c) => (
            <div
              key={c.ko}
              className='overflow-hidden rounded-[22px] border-[1.5px] border-meti-bg bg-white p-3.5 text-center'
            >
              <PartnerFace
                persona={c.persona}
                pose='celebrate'
                size={78}
                className='mx-auto'
              />
              <p className='mt-1.5 text-[16px] font-extrabold text-meti-ink'>
                {c.ko}
              </p>
              <p className='text-[12px] font-bold tracking-[0.6px] text-meti-sub'>
                {c.en}
              </p>
              <p className='mt-[7px] min-h-8 text-[13px] font-semibold leading-[1.45] text-[#546269]'>
                {c.tag}
              </p>
              <span className='mt-2 inline-block whitespace-nowrap rounded-full bg-meti-bg px-2.5 py-1 text-[12px] font-extrabold text-meti'>
                함께하는 중
              </span>
            </div>
          ))}
          {LOCKED.map((name) => (
            <div
              key={name}
              className='overflow-hidden rounded-[22px] border-[1.5px] border-meti-bg bg-[#F2F5F6] p-3.5 text-center'
            >
              <div className='mx-auto flex h-[78px] w-[78px] items-center justify-center rounded-full bg-white/60 text-[28px]'>
                ?
              </div>
              <p className='mt-1.5 text-[16px] font-extrabold text-meti-sub'>
                {name}
              </p>
              <p className='text-[12px] font-bold tracking-[0.6px] text-[#9AA7AC]'>
                ?????
              </p>
              <p className='mt-[7px] min-h-8 text-[13px] font-semibold leading-[1.45] text-[#9AA7AC]'>
                아직 만나지 못한 친구
              </p>
              <span className='mt-2 inline-block whitespace-nowrap rounded-full bg-[#E7EEF0] px-2.5 py-1 text-[12px] font-extrabold text-meti-sub'>
                준비 중
              </span>
            </div>
          ))}
        </div>
      </main>
      <BottomTabs persona={student.persona_type} />
    </div>
  );
}
