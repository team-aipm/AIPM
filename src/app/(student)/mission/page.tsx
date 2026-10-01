/**
 * MIS-001 미션 진행 · `/mission` (DEV-002)
 *
 * 세션은 홈의 [미션 시작하기] 가 연다. 여기서 열지 않는다 — 화면을 여는
 * 것만으로 행이 생기면 새로고침할 때마다 세션이 늘어난다.
 */

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireChild } from '@/lib/services/viewer';
import { getStudent } from '@/lib/services/student';
import { findActiveProblem } from '@/lib/services/problem';
import { listMessages } from '@/lib/services/message';
import { PARTNER_NAME } from '@/lib/constants/copy';
import { STUDENT_COOKIE } from '@/lib/constants/student-cookie';
import { PartnerFace } from '@/components/ui/PartnerFace';
import { ExitButton } from './_components/ExitButton';
import { MissionChat, type Initial } from './_components/MissionChat';
import { missionSession } from './_session';

export const metadata = { title: '미션 · 메티' };

export default async function MissionPage() {
  const me = await requireChild();

  const supabase = await createClient();
  const jar = await cookies();
  /**
   * 쿠키가 없으면 **자기 자신으로 본다.**
   *
   * 「지금 공부하는 아이」 쿠키는 30일짜리다. 만료되거나 지워지면 로그인은
   * 돼 있는데 홈에 못 들어가고 `/students` 로 튕겼다 — 아이 계정에는 고를
   * 다른 학생이 없으므로 물어볼 이유가 없다.
   */
  const studentId = jar.get(STUDENT_COOKIE)?.value ?? me.studentId;
  if (studentId === '') redirect('/students');

  // 둘은 서로 기다릴 필요가 없다. 남의 학생 id 면 RLS 가 둘 다 비워 돌려준다.
  // 세션은 오늘 것이거나, 이어 하기로 고른 지난 것이다(`_session.ts`).
  const [student, picked] = await Promise.all([
    getStudent(supabase, studentId),
    missionSession(supabase, studentId),
  ]);
  if (student === null) redirect('/students');
  if (picked === null) redirect('/home');
  const session = picked.session;
  /** 지난 미션이면 「9월 29일」. 머리글과 끝난 뒤 안내가 오늘 것과 달라진다 */
  const pastLabel =
    picked.kind === 'past'
      ? `${Number(session.session_date.slice(5, 7))}월 ${Number(session.session_date.slice(8, 10))}일`
      : null;

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
    <div className="flex h-dvh flex-col bg-surface-primary">
      {/* Figma `Chat Header` · 높이 57 · 44px 뒤로 · 캐릭터 40 · 이름 16/24 */}
      <header className="flex shrink-0 items-center gap-2 border-b border-meti-line bg-surface-primary py-1.5 pr-5 pl-2">
        <ExitButton persona={student.persona_type} />
        <PartnerFace persona={student.persona_type} size={40} />
        <div className="flex flex-col">
          <p className="text-[16px] font-semibold leading-6 text-text-primary">{partner}</p>
          <p className="text-[12px] leading-[18px] text-button-primary">
            {pastLabel === null ? '오늘의 미션' : `${pastLabel} 미션`} · {session.completed_problem_count} /{' '}
            {session.target_problem_count}
          </p>
        </div>
      </header>

      <MissionChat partner={partner} persona={student.persona_type} initial={initial} pastLabel={pastLabel} />
    </div>
  );
}
