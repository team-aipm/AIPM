/**
 * MY-004 학생 추가 · `/parent/my/students/new` (DEV-002)
 *
 * **보호자 화면 안에서 끝낸다.** 전에는 STU-001(`/onboarding/student`) 로
 * 넘겨 버렸는데, 그러면 부모가 학생 영역으로 튕겨 나가고 하단 Nav 도
 * 사라진다. 등록하러 들어갔다가 돌아올 길을 잃는다.
 *
 * DEV-002 §3 이 정한 대로다 — 두 화면은 Route 를 나누고 **폼만 같이 쓴다**.
 *
 * 부모 어휘로 쓴다(COM-003 §7). 「미션」 같은 학생 어휘를 쓰지 않는다.
 *
 * 생김새는 Figma `자녀 계정 생성` 이다. 이메일 방식 고르기 · 인증번호 ·
 * 메티 이메일 발급 단계는 없다 — 부모가 아이 이메일을 직접 넣는다
 * (FIGMA-MD-AUDIT §0 · COM-007 §2-2-1).
 */

import { redirect } from 'next/navigation';
import { createClient, currentUser } from '@/lib/supabase/server';
import { listStudents } from '@/lib/services/student';
import { StudentForm } from '@/components/student/StudentForm';
import { MyTopBar } from '../../_components/MyTopBar';
import { MAX_STUDENTS } from '../_components/limit';
import { addStudentFromParent, checkLoginId } from './_actions';

export const metadata = { title: '학생 추가 · 메티' };

export default async function AddStudentPage() {
  const supabase = await createClient();
  const user = await currentUser();
  if (user === null) redirect('/login');

  // 첫 아이인지 둘째인지에 따라 안내가 달라진다. 이미 등록한 부모에게
  // "시작합니다" 라고 말하면 지금까지의 기록이 어떻게 되는지 걱정한다.
  const students = await listStudents(supabase);
  const first = students.length === 0;

  // **네 번째 폼을 열지 않는다.** 목록의 버튼을 꺼도 주소로는 들어온다.
  if (students.length >= MAX_STUDENTS) redirect('/parent/my/students');

  return (
    <main className="flex flex-1 flex-col pb-5">
      <MyTopBar
        back={first ? '/parent' : '/parent/my/students'}
        backLabel={first ? '학습 현황으로' : '학생 관리로'}
      />

      <div className="flex flex-col gap-4 px-5 pt-3">
        <header className="flex flex-col gap-2">
          <h1 className="text-[24px] font-bold leading-8 text-text-primary">학생 추가</h1>
          <p className="text-[16px] leading-6 text-text-secondary">
            {first
              ? '아이의 정보를 알려주세요. 학년에 맞는 문제와 말투로 시작합니다.'
              : '아이마다 학습 기록과 파트너를 따로 둡니다. 지금 등록한 아이의 기록은 그대로입니다.'}
          </p>
        </header>

        {/*
          카드로 감싸지 않는다. Figma 의 칸이 흰색이라 흰 카드 위에 올리면
          칸과 카드의 경계가 사라진다(`components/ui/Field.tsx`).
        */}
        <StudentForm
          action={addStudentFromParent}
          checkEmail={checkLoginId}
          submitLabel="계정 만들기"
        />
      </div>
    </main>
  );
}
