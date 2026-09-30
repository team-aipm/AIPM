/**
 * MY-003 학생 프로필 · `/parent/my/students/[studentId]` (DEV-002)
 *
 * 부모가 바꿀 수 있는 것과 없는 것을 화면에서 나눈다.
 *
 *   바꿀 수 있다   파트너(Persona) · 아이 로그인 · 삭제 요청
 *   못 바꾼다      난이도 · Logic Gap · Student Memory (COM-003 §9)
 *
 * 학습 판단을 사람이 손대면 다음 문제 선정이 어긋난다.
 *
 * 생김새는 Figma `자녀 계정 상세 / 기본` 이다. 「정보 수정」 · 「로그인
 * 이메일 변경 문의」 줄은 저장할 액션과 갈 곳이 없어 두지 않았다.
 */

import { notFound, redirect } from 'next/navigation';
import { createClient, currentUser } from '@/lib/supabase/server';
import { getStudent } from '@/lib/services/student';
import { PARTNER_NAME } from '@/lib/constants/copy';
import { PartnerFace } from '@/components/ui/PartnerFace';
import { changePersona } from '../../_actions';
import { MyTopBar } from '../../_components/MyTopBar';
import { ChildLoginSection } from './_components/ChildLoginSection';
import { DeleteStudent, RestoreStudent } from './_components/DeleteRestore';

export const metadata = { title: '학생 정보 · 메티' };

/** 되돌릴 수 있는 기간. COM-007 §5-1 */
const UNDO_DAYS = 30;

const CARD = 'rounded-2xl border border-meti-line bg-surface-primary';

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-4 py-2">
      <span className="shrink-0 text-[14px] leading-5 text-meti-hint">{label}</span>
      <span className="break-all text-right text-[14px] font-semibold leading-5 text-text-primary">
        {value}
      </span>
    </div>
  );
}

export default async function StudentProfilePage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;

  const supabase = await createClient();
  const user = await currentUser();
  if (user === null) redirect('/login');

  const student = await getStudent(supabase, studentId);
  if (student === null) notFound();

  const pending = student.student_status === 'deleted_pending';
  const undoUntil =
    student.deleted_at === null
      ? null
      : new Date(new Date(student.deleted_at).getTime() + UNDO_DAYS * 864e5);

  return (
    <main className="flex flex-1 flex-col pb-5">
      <MyTopBar back="/parent/my/students" backLabel="학생 관리로" />

      <div className="flex flex-col gap-6 px-5 pt-6">
        {/* Figma `Profile Summary` */}
        <header className="flex flex-col items-center gap-2 text-center">
          <span
            aria-hidden
            className="flex size-16 items-center justify-center rounded-full bg-surface-brand text-[20px] font-semibold leading-7 text-button-primary"
          >
            {student.nickname.slice(0, 1)}
          </span>
          <h1 className="text-[20px] font-semibold leading-7 text-text-primary">
            {student.nickname}
          </h1>
          <p className="text-[14px] leading-5 text-meti-hint">초등 {student.grade}학년</p>
        </header>

        {pending && (
          <section className="flex flex-col gap-3 rounded-2xl border border-error-line bg-error-bg p-5">
            <p className="text-[16px] font-semibold leading-6 text-error-text">삭제 요청됨</p>
            <p className="text-[14px] leading-5 text-text-primary">
              {undoUntil === null
                ? ''
                : `${undoUntil.toLocaleDateString('ko-KR')} 까지 되돌릴 수 있습니다.`}
              <br />
              학습기록은 1년간 보관한 뒤 완전히 삭제됩니다.
            </p>
            <RestoreStudent studentId={student.student_id} name={student.nickname} />
          </section>
        )}

        {/* Figma `Account Information` */}
        <section className={`${CARD} flex flex-col divide-y divide-meti-line px-5 py-2`}>
          <InfoRow label="자녀 이름" value={student.student_name} />
          <InfoRow label="학년" value={`초등 ${student.grade}학년`} />
          <InfoRow label="로그인 이메일" value={student.login_email ?? '—'} />
        </section>

        <section className={`${CARD} flex flex-col gap-3 p-5`}>
          <h2 className="text-[16px] font-semibold leading-6 text-text-primary">학습 파트너</h2>
          <p className="text-[14px] leading-5 text-meti-hint">
            말투만 달라집니다. 문제와 도움은 똑같습니다.
          </p>
          <div className="flex gap-2">
            {(['friend', 'villain'] as const).map((persona) => (
              <form key={persona} action={changePersona} className="flex-1">
                <input type="hidden" name="student_id" value={student.student_id} />
                <input type="hidden" name="persona" value={persona} />
                <button
                  type="submit"
                  aria-pressed={student.persona_type === persona}
                  className={`flex w-full flex-col items-center gap-1.5 rounded-2xl py-3 ${
                    student.persona_type === persona
                      ? 'border-2 border-button-primary bg-surface-brand'
                      : 'border border-meti-line bg-surface-primary'
                  }`}
                >
                  <PartnerFace persona={persona} size={40} />
                  <span className="text-[14px] font-semibold leading-5 text-text-primary">
                    {PARTNER_NAME[persona]}
                  </span>
                </button>
              </form>
            ))}
          </div>
        </section>

        {/*
          삭제 요청한 학생에게는 로그인을 만들어 주지 않는다. 되돌린 뒤에
          만들면 된다.
        */}
        {!pending && (
          <ChildLoginSection
            studentId={student.student_id}
            loginEmail={student.login_email}
            name={student.nickname}
          />
        )}

        <section className={`${CARD} flex flex-col gap-2 p-5`}>
          <h2 className="text-[14px] font-semibold leading-5 text-text-primary">바꿀 수 없는 것</h2>
          <p className="text-[14px] leading-5 text-meti-hint">
            난이도 · 자주 막힌 부분 · 학습 기억은 학습 기록에서 자동으로 정해집니다.
            사람이 고치면 다음 문제 선정이 어긋납니다.
          </p>
        </section>

        {!pending && <DeleteStudent studentId={student.student_id} name={student.nickname} />}
      </div>
    </main>
  );
}
