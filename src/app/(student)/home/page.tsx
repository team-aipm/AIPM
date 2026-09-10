/**
 * STU-004 학생 HOME · `/home` (DEV-002)
 *
 * 레이아웃 · 색상 · 수치는 프로토타입 원본(`METTY App.dc.html` #1a
 * isHome)을 그대로 옮겼다. `globals.css`의 --color-meti* 도 이 파일의
 * 색과 맞춰뒀다 — 한 곳만 고치면 여기·미션·다른 화면이 같이 맞는다.
 *
 * 원본에 있었지만 뺀 것 — **COM-002 에 근거 테이블이 없어서다.** 숫자를
 * 지어내면 실제 값처럼 보이고, 나중에 그걸 걷어내는 일이 지금 안 넣는
 * 것보다 크다.
 *   - 연속 학습일 · "스스로 설명 N번" 통계 카드
 *   - "메티 프렌즈" 캐릭터 수집 캐러셀 (persona_type 은 2종뿐이라 "모은
 *     캐릭터 목록" 개념 자체가 없다)
 *   - "새로운 미션" / "이어서 하기" 카드 2개를 동시에 보여주는 것. 원본은
 *     정적 목업이라 둘 다 그렸지만, 실제로는 오늘 세션이 있으면 이어서만,
 *     없으면 새로 시작만 가능한 배타 상태다. 카드 1개가 상황에 따라
 *     바뀌는 게 맞는 동작이다.
 *   - 미션 카드의 "약 8분 · 분수 나눗셈" — 다음 문제의 예상 시간·개념을
 *     미리 알 방법이 없다(AI가 그 자리에서 만든다).
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
import { studentIdOfViewer } from '@/lib/services/student-login';
import { startMission, leaveApp } from './_actions';

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

  // 아이 본인인가, 부모가 아이 화면을 보고 있는가. 나가는 문이 다르다.
  const isChild = (await studentIdOfViewer(supabase, data.user.id)) !== null;

  const session = await findTodaySession(supabase, student.student_id);
  const done = session?.completed_problem_count ?? 0;
  const target = session?.target_problem_count ?? 10;
  const partner = PARTNER_NAME[student.persona_type];
  const todayLabel = new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
    timeZone: 'Asia/Seoul',
  }).format(new Date());

  return (
    <main className="flex flex-1 flex-col gap-3.5 bg-[#F7FAFB] px-5 py-6">
      <header className="mb-1 flex items-center justify-between">
        <div className="flex items-center gap-[11px]">
          <span className="flex h-11 w-11 shrink-0 items-end justify-center overflow-hidden rounded-full bg-white p-px">
            <PartnerFace persona={student.persona_type} pose="celebrate" size={43} />
          </span>
          <div>
            <h1 className="text-[23px] font-bold leading-[1.2] tracking-[-0.5px] text-meti">
              반가워! {student.nickname}
            </h1>
            <p className="mt-1 text-[13px] font-medium text-meti-sub">
              초등 {student.grade}학년
            </p>
          </div>
        </div>
        {/* 실제 포인트 원장(ledger)이 없다 — 지어내지 않고 쌓인 게 없다는
            뜻 그대로 0을 보여준다. 실제 적립이 생기면 그 값으로 바뀐다. */}
        <span className="flex items-center gap-1.5 rounded-full bg-meti-warm py-1.5 pl-2.5 pr-3">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-meti-ink text-[12px] font-extrabold text-meti-warm">
            P
          </span>
          <span className="text-[14px] font-extrabold text-meti-ink">0</span>
        </span>
      </header>

      <section className="relative overflow-hidden rounded-[26px] bg-meti-bg p-5">
        <div className="relative z-10 max-w-[196px]">
          <p className="mb-1.5 text-[13px] font-bold text-meti">{todayLabel}</p>
          <p className="text-[20px] font-extrabold leading-[1.35] tracking-[-0.4px] text-meti-ink">
            오늘도 같이
            <br />
            생각해볼까?
          </p>

          <div className="mt-3.5 flex items-center gap-2">
            <div
              className="h-[9px] flex-1 overflow-hidden rounded-full bg-meti-ink/10"
              role="progressbar"
              aria-valuenow={done}
              aria-valuemin={0}
              aria-valuemax={target}
            >
              <div
                className="h-full rounded-full bg-meti-mint transition-[width]"
                style={{ width: `${target === 0 ? 0 : (done / target) * 100}%` }}
              />
            </div>
            <span className="text-[12px] font-bold text-meti-ink">
              {done}/{target}
            </span>
          </div>
          <p className="mt-2 text-[12px] font-bold text-meti">
            일일 미션 완료까지 얼마 안남았어!
          </p>
        </div>
        <PartnerFace
          persona={student.persona_type}
          pose="wave"
          size={110}
          className="absolute right-4 top-6 animate-meti-float"
        />
      </section>

      <h2 className="mb-0.5 mt-1.5 px-0.5 text-[14px] font-extrabold text-meti-ink">
        미션 시작
      </h2>

      <section className="rounded-[22px] bg-white p-4 shadow-[0_2px_10px_rgba(32,107,124,.07)]">
        <div className="flex items-center gap-[13px]">
          <span className="flex h-[46px] w-[46px] shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-meti-bg">
            <PartnerFace persona={student.persona_type} pose="think" size={30} />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="mb-1 text-[16px] font-extrabold text-meti-ink">
              {session === null ? '새로운 미션을 시작할래?' : '남아 있는 미션을 이어할래?'}
            </h3>
            <p className="text-[13px] font-medium leading-[1.45] text-meti-sub">
              {partner}와 함께 오늘의 미션을 시작해보자!
            </p>
          </div>
        </div>

        <div className="mt-3.5 flex items-center justify-end">
          <form action={startMission}>
            <button
              type="submit"
              className="rounded-full bg-meti px-3.5 py-2.5 text-[13px] font-bold text-white"
            >
              {session === null ? TERMS.startLearning.student : TERMS.resumeLearning.student}
            </button>
          </form>
        </div>
      </section>

      <Link
        href="/home/today"
        className="mt-1 rounded-2xl bg-white p-4 text-center text-[14px] font-bold text-meti-ink shadow-[0_2px_10px_rgba(32,107,124,.06)] transition-colors active:bg-meti-bg/40"
      >
        {TERMS.learningResult.student} 보기
      </Link>

      {/*
        아이 계정에는 고를 다른 친구가 없다. 자기 자신뿐이다. 그 자리에
        **나가는 문**을 둔다 — 아이는 부모 영역의 「계정 관리」에 못 들어가서
        여기가 없으면 로그아웃할 길이 아예 없다.
      */}
      {isChild ? (
        <form action={leaveApp}>
          <button
            type="submit"
            className="w-full text-center text-[13px] font-semibold text-meti-sub underline"
          >
            나가기
          </button>
        </form>
      ) : (
        <Link
          href="/students"
          className="text-center text-[13px] font-semibold text-meti-sub underline"
        >
          다른 친구로 바꾸기
        </Link>
      )}
    </main>
  );
}
