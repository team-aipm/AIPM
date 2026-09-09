/**
 * STU-004 학생 HOME · `/home` (DEV-002)
 *
 * 프로토타입(METI)의 홈에서 **지금 값을 채울 수 있는 것만** 옮겼다.
 * 포인트 · 연속 학습 · 도감은 COM-002 에 테이블이 없어서 뺐다. 숫자를
 * 지어내 보여 주면 되는 것처럼 보이고, 나중에 그걸 지우는 일이 더 크다.
 */

import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getStudent } from '@/lib/services/student';
import { findTodaySession } from '@/lib/services/learning-session';
import { PARTNER_NAME, TERMS } from '@/lib/constants/copy';
import { STUDENT_COOKIE } from '@/lib/constants/student-cookie';
import { PartnerFace } from '@/components/ui/PartnerFace';
import { startMission } from './_actions';

export const metadata = { title: '오늘의 미션 · 메티' };

export default async function HomePage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user === null) redirect('/login');

  const jar = await cookies();
  const studentId = jar.get(STUDENT_COOKIE)?.value ?? '';
  if (studentId === '') redirect('/students');

  // 쿠키에 남의 학생 id 가 들어 있어도 여기서 null 이 된다. 고르는 화면으로
  // 돌려보내는 것으로 충분하다 — 무엇이 잘못됐는지 알려 줄 필요가 없다.
  const student = await getStudent(supabase, studentId);
  if (student === null) redirect('/students');

  const session = await findTodaySession(supabase, student.student_id);
  const done = session?.completed_problem_count ?? 0;
  const target = session?.target_problem_count ?? 10;
  const partner = PARTNER_NAME[student.persona_type];

  return (
    <main className="flex flex-1 flex-col gap-5 px-6 py-8">
      <header className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-white shadow-sm">
          <PartnerFace persona={student.persona_type} size={40} />
        </span>
        <div className="flex flex-col">
          <h1 className="text-xl font-extrabold text-meti-ink">
            반가워! {student.nickname}
          </h1>
          <p className="text-[12px] font-semibold text-meti-sub">
            초등 {student.grade}학년
          </p>
        </div>
      </header>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <p className="text-[17px] font-extrabold leading-snug text-meti-ink">
          오늘도 같이
          <br />
          생각해볼까?
        </p>

        <div className="mt-4 flex items-center gap-3">
          <div
            className="h-2 flex-1 overflow-hidden rounded-full bg-meti-bg"
            role="progressbar"
            aria-valuenow={done}
            aria-valuemin={0}
            aria-valuemax={target}
          >
            <div
              className="h-full rounded-full bg-meti"
              style={{ width: `${target === 0 ? 0 : (done / target) * 100}%` }}
            />
          </div>
          <span className="text-[12px] font-bold text-meti-sub">
            {done}/{target}
          </span>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-[15px] font-bold text-meti-ink">
          {session === null ? '새로운 미션을 시작할래?' : '남아 있는 미션을 이어할래?'}
        </h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-meti-sub">
          {partner}와 함께 오늘의 미션을 시작해보자!
        </p>

        <form action={startMission}>
          <button
            type="submit"
            className="mt-4 w-full rounded-xl bg-meti py-3 text-[14px] font-bold text-white"
          >
            {session === null ? TERMS.startLearning.student : TERMS.resumeLearning.student}
          </button>
        </form>
      </section>

      <Link
        href="/students"
        className="text-center text-[13px] font-semibold text-meti-sub underline"
      >
        다른 친구로 바꾸기
      </Link>
    </main>
  );
}
