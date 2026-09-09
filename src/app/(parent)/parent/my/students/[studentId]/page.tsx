/**
 * MY-003 학생 프로필 · `/parent/my/students/[studentId]` (DEV-002)
 *
 * 부모가 바꿀 수 있는 것과 없는 것을 화면에서 나눈다.
 *
 *   바꿀 수 있다   파트너(Persona) · 삭제 요청
 *   못 바꾼다      난이도 · Logic Gap · Student Memory (COM-003 §9)
 *
 * 학습 판단을 사람이 손대면 다음 문제 선정이 어긋난다.
 */

import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getStudent } from '@/lib/services/student';
import { PARTNER_NAME } from '@/lib/constants/copy';
import { PartnerFace } from '@/components/ui/PartnerFace';
import { changePersona, requestDeleteStudent, undoDeleteStudent } from '../../_actions';

export const metadata = { title: '학생 정보 · 메티' };

/** 되돌릴 수 있는 기간. COM-007 §5-1 */
const UNDO_DAYS = 30;

export default async function StudentProfilePage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (auth.user === null) redirect('/login');

  const student = await getStudent(supabase, studentId);
  if (student === null) notFound();

  const pending = student.student_status === 'deleted_pending';
  const undoUntil =
    student.deleted_at === null
      ? null
      : new Date(new Date(student.deleted_at).getTime() + UNDO_DAYS * 864e5);

  return (
    <main className="flex flex-1 flex-col gap-4 px-5 py-8">
      <header className="flex flex-col gap-1">
        <Link href="/parent/my/students" className="text-[13px] font-semibold text-meti-sub">
          ‹ 학생 관리
        </Link>
        <h1 className="text-xl font-extrabold text-meti-ink">{student.nickname}</h1>
        <p className="text-[13px] text-meti-sub">
          {student.student_name} · 초등 {student.grade}학년
        </p>
      </header>

      {pending && (
        <section className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-[14px] font-bold text-red-600">삭제 요청됨</p>
          <p className="text-[13px] leading-relaxed text-meti-sub">
            {undoUntil === null
              ? ''
              : `${undoUntil.toLocaleDateString('ko-KR')} 까지 되돌릴 수 있습니다.`}
            <br />
            학습기록은 1년간 보관한 뒤 완전히 삭제됩니다.
          </p>
          <form action={undoDeleteStudent}>
            <input type="hidden" name="student_id" value={student.student_id} />
            <button
              type="submit"
              className="w-full rounded-xl bg-meti py-3 text-[14px] font-bold text-white"
            >
              삭제 취소
            </button>
          </form>
        </section>
      )}

      <section className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-[12px] font-bold text-meti-sub">학습 파트너</h2>
        <p className="text-[12px] leading-relaxed text-meti-sub">
          말투만 달라집니다. 문제와 도움은 똑같습니다.
        </p>
        <div className="flex gap-2">
          {(['friend', 'villain'] as const).map((persona) => (
            <form key={persona} action={changePersona} className="flex-1">
              <input type="hidden" name="student_id" value={student.student_id} />
              <input type="hidden" name="persona" value={persona} />
              <button
                type="submit"
                className={`flex w-full flex-col items-center gap-1.5 rounded-xl border py-3 ${
                  student.persona_type === persona
                    ? 'border-meti bg-meti-bg'
                    : 'border-black/10 bg-white'
                }`}
              >
                <PartnerFace persona={persona} size={40} />
                <span className="text-[13px] font-bold text-meti-ink">
                  {PARTNER_NAME[persona]}
                </span>
              </button>
            </form>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-[12px] font-bold text-meti-sub">바꿀 수 없는 것</h2>
        <p className="text-[13px] leading-relaxed text-meti-sub">
          난이도 · 자주 막힌 부분 · 학습 기억은 학습 기록에서 자동으로 정해집니다.
          사람이 고치면 다음 문제 선정이 어긋납니다.
        </p>
      </section>

      {!pending && (
        <form action={requestDeleteStudent}>
          <input type="hidden" name="student_id" value={student.student_id} />
          <button
            type="submit"
            className="w-full rounded-xl border border-red-200 bg-white py-3 text-[13px] font-semibold text-red-600"
          >
            이 학생 삭제 요청
          </button>
        </form>
      )}
    </main>
  );
}
