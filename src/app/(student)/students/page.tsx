/**
 * STU-002 학생 선택 · `/students` (DEV-002)
 *
 * 한 계정에 학생이 여럿일 수 있다(COM-002 §4). 누구로 들어갈지 먼저 고른다.
 */

import { createClient } from '@/lib/supabase/server';
import { requireChild } from '@/lib/services/viewer';
import { listStudents } from '@/lib/services/student';
import { PARTNER_NAME } from '@/lib/constants/copy';
import { PartnerFace } from '@/components/ui/PartnerFace';
import { selectStudent, leaveApp } from './_actions';

export const metadata = { title: '누구로 시작할까 · 메티' };

export default async function StudentsPage() {
  // 아이만 들어온다. 부모는 학생을 고를 일이 없다 — 부모 화면에서
  // 학생 영역으로 건너가지 않는다.
  await requireChild();

  const supabase = await createClient();

  const students = await listStudents(supabase);

  return (
    <main className="flex flex-1 flex-col gap-5 px-6 py-10">
      <h1 className="text-xl font-extrabold text-meti-ink">누구로 시작할까?</h1>

      {students.length === 0 ? (
        /* 아이 계정에는 자기 자신이 늘 있다. 여기가 비는 일은 없지만,
           지우면 화면이 깨지므로 남겨 둔다. 등록하는 길은 두지 않는다 —
           학생을 만드는 것은 부모의 일이다(COM-003 §4.2). */
        <p className="rounded-2xl bg-white p-5 text-[14px] text-meti-sub shadow-sm">
          들어갈 수 있는 학생이 없어요.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {students.map((student) => (
            <li key={student.student_id}>
              <form action={selectStudent}>
                <input type="hidden" name="student_id" value={student.student_id} />
                <button
                  type="submit"
                  className="flex w-full items-center gap-4 rounded-2xl bg-white p-4 text-left shadow-sm"
                >
                  <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-meti-bg">
                    <PartnerFace persona={student.persona_type} size={40} />
                  </span>
                  <span className="flex flex-col">
                    <span className="text-[15px] font-bold text-meti-ink">
                      {student.nickname}
                    </span>
                    <span className="text-[12px] font-semibold text-meti-sub">
                      초등 {student.grade}학년 · {PARTNER_NAME[student.persona_type]}와 함께
                    </span>
                  </span>
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      {/*
        **부모 영역으로 가는 길을 두지 않는다.** 학생 한 명 더 등록하기도
        뺐다 — 추가 등록은 `MY-004` 다(DEV-002 §3). 아이 계정은 학생 화면만
        본다. 부모 화면에는 상세 평가점수와 Logic Gap 이 있다(COM-003).
      */}
      {/*
        로그아웃은 「마이 → 계정 관리」 안에도 있지만 거기까지 세 번을 들어가야
        한다. 계정을 바꾸려는 사람은 대개 이 화면에 서 있다.
      */}
      <form action={leaveApp}>
        <button
          type="submit"
          className="w-full text-center text-[13px] font-semibold text-meti-sub underline"
        >
          로그아웃
        </button>
      </form>
    </main>
  );
}
