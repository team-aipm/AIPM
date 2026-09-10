/**
 * MIS-001 미션 진행 · `/mission` (DEV-002)
 *
 * 세션은 홈의 [미션 시작하기] 가 연다. 여기서 열지 않는다 — 화면을 여는
 * 것만으로 행이 생기면 새로고침할 때마다 세션이 늘어난다.
 */

import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getStudent } from '@/lib/services/student';
import { findTodaySession } from '@/lib/services/learning-session';
import { findActiveProblem } from '@/lib/services/problem';
import { listMessages } from '@/lib/services/message';
import { PARTNER_NAME } from '@/lib/constants/copy';
import { STUDENT_COOKIE } from '@/lib/constants/student-cookie';
import { PartnerFace } from '@/components/ui/PartnerFace';
import { MissionChat, type Initial } from './_components/MissionChat';

export const metadata = { title: '미션 · 메티' };

export default async function MissionPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (auth.user === null) redirect('/login');

  const jar = await cookies();
  const studentId = jar.get(STUDENT_COOKIE)?.value ?? '';
  if (studentId === '') redirect('/students');

  const student = await getStudent(supabase, studentId);
  if (student === null) redirect('/students');

  const session = await findTodaySession(supabase, student.student_id);
  if (session === null) redirect('/home');

  const partner = PARTNER_NAME[student.persona_type];

  // 풀던 문제가 있으면 그 자리에서 이어 붙인다. 대화가 `message` 에 남아
  // 있으므로 새로고침해도 사라지지 않는다 — 01 의 대화만 못 남긴다.
  const active = await findActiveProblem(supabase, session.session_id);
  let initial: Initial = { kind: 'host' };
  if (active !== null) {
    const messages = await listMessages(supabase, active.problem_id);
    initial = {
      kind: 'problem',
      problemText: active.problem_text,
      turns: messages.map((m) => ({
        who: m.speaker === 'student' ? ('student' as const) : ('ai' as const),
        text: m.message_text,
      })),
      turnsLeft: Math.max(
        0,
        5 - messages.filter((m) => m.speaker === 'student').length,
      ),
    };
  }

  return (
    // 높이를 화면에 못 박는다. min-h 로 두면 대화가 길어질 때 페이지
    // 전체가 스크롤되고, 위에 붙여 둔 문제 카드가 위로 밀려 사라진다.
    <div className="flex h-dvh flex-col bg-[#F7FAFB]">
      <header className="flex items-center gap-3 border-b border-black/5 bg-white px-4 py-3.5 shadow-[0_1px_0_rgba(18,52,59,.04)]">
        <Link
          href="/home"
          aria-label="홈으로"
          className="-ml-1 flex h-9 w-9 items-center justify-center rounded-full text-lg text-meti-sub transition-colors active:bg-meti-bg/60"
        >
          ‹
        </Link>
        <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-meti-bg ring-2 ring-white shadow-sm">
          <PartnerFace persona={student.persona_type} size={38} />
        </span>
        <div className="flex flex-col">
          <p className="text-[15px] font-extrabold text-meti-ink">{partner}</p>
          <p className="text-[11px] font-semibold text-meti-sub">
            {session.completed_problem_count} / {session.target_problem_count} 문제
          </p>
        </div>
      </header>

      <MissionChat partner={partner} persona={student.persona_type} initial={initial} />
    </div>
  );
}
