/**
 * MY-004 학생 추가 · `/parent/my/students/new` (DEV-002)
 *
 * 등록 자체는 온보딩(STU-001)과 같은 일이라 그 화면을 다시 쓴다. **폼을
 * 두 벌 두지 않는다** — 학년 검사 같은 규칙이 한쪽만 바뀌는 사고가 난다.
 */

import { redirect } from 'next/navigation';

export default function AddStudentPage() {
  redirect('/onboarding/student');
}
