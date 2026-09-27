/**
 * STU-001 첫 학생 등록 · `/onboarding/student` (DEV-002)
 *
 * 부모가 보는 화면이다. 학생 어휘를 쓰지 않는다.
 */

import { requireParent } from '@/lib/services/viewer';
import { BackBar } from '@/components/ui/BackBar';
import { StudentForm } from '@/components/student/StudentForm';
import { addStudent, checkLoginId } from './_actions';

export const metadata = { title: '학생 등록 · 메티' };

export default async function NewStudentPage() {
  // **여기만 부모가 쓴다.** 폴더는 (student) 지만 COM-003 §4.2 의 사용자
  // 칸이 「부모」다. 아이는 자기 홈으로 돌아간다.
  await requireParent();

  /*
    Figma `자녀 계정 생성` 의 뼈대다 — 상단 바, 24/32 제목, 그 아래 폼.
    카드로 감싸지 않는다. 칸이 흰색이라 흰 카드 위에 올리면 경계가 사라진다.
  */
  return (
    <main className="flex flex-1 flex-col pb-5">
      <BackBar href="/parent" label="학습 현황으로" />

      <div className="flex flex-col gap-4 px-5 pt-3">
        <h1 className="text-[24px] font-bold leading-8 text-meti-ink">
          나의 생각이 자라는 시간
        </h1>

        <StudentForm action={addStudent} checkId={checkLoginId} submitLabel="계정 만들기" />
      </div>
    </main>
  );
}
