/**
 * MY-002 학생 관리 · `/parent/my/students` (DEV-002)
 *
 * 생김새는 Figma `자녀 계정 목록 / 기본 · Empty · 최대 3명` 이다.
 *
 * **3명이면 추가 버튼을 끈다**(COM-003 §4.9 · COM-002 §3). 네 번째를
 * 등록하는 길을 만들지 않는다.
 *
 * 카드 둘째 줄의 로그인 이메일은 빠져 있다 — `listStudents` 가
 * `login_email` 을 싣지 않는다. 학년 옆에 파트너 이름을 둔다.
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient, currentUser } from '@/lib/supabase/server';
import { listStudents } from '@/lib/services/student';
import { PARTNER_NAME } from '@/lib/constants/copy';
import { MyTopBar } from '../_components/MyTopBar';
import { ChevronRight } from '../_components/SettingsGroup';
import { MAX_STUDENTS } from './_components/limit';

export const metadata = { title: '학생 관리 · 메티' };

const CTA =
  'flex h-[52px] w-full items-center justify-center rounded-lg text-[16px] font-semibold leading-6';

export default async function MyStudentsPage() {
  const supabase = await createClient();
  const user = await currentUser();
  if (user === null) redirect('/login');

  const students = await listStudents(supabase);
  const full = students.length >= MAX_STUDENTS;
  const empty = students.length === 0;

  return (
    <main className="flex flex-1 flex-col">
      <MyTopBar back="/parent/my" backLabel="설정으로" />

      <div className="flex flex-1 flex-col gap-9 px-5 pt-6">
        <header className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h1 className="text-[24px] font-bold leading-8 text-text-primary">
              {empty ? '자녀 계정' : '등록된 자녀'}
            </h1>
            <span className="text-[14px] font-semibold leading-5 text-button-primary">
              {students.length}/{MAX_STUDENTS}
            </span>
          </div>
          <p className="text-[14px] leading-5 text-meti-hint">
            {empty
              ? '학습을 시작할 자녀 계정을 만들어 주세요.'
              : full
                ? `자녀는 최대 ${MAX_STUDENTS}명까지 등록할 수 있어요.`
                : '자녀 계정을 선택해 정보를 관리할 수 있어요.'}
          </p>
        </header>

        {empty ? (
          <section className="flex flex-col items-center gap-3 py-5 text-center">
            <span
              aria-hidden
              className="flex size-16 items-center justify-center rounded-full bg-surface-primary text-[24px] font-bold leading-8 text-button-primary"
            >
              +
            </span>
            <h2 className="text-[20px] font-semibold leading-7 text-text-primary">
              아직 등록된 자녀가 없어요
            </h2>
            <p className="text-[14px] leading-5 text-meti-hint">
              자녀 계정을 만들면 학습 현황과 리포트를 확인할 수 있어요.
            </p>
          </section>
        ) : (
          <ul className="flex flex-col gap-3">
            {students.map((student) => (
              <li key={student.student_id}>
                {/* Figma `Card / Child Account` */}
                <Link
                  href={`/parent/my/students/${student.student_id}`}
                  className="flex items-center gap-4 rounded-2xl border border-meti-line bg-surface-primary px-5 py-4"
                >
                  <span
                    aria-hidden
                    className="flex size-12 shrink-0 items-center justify-center rounded-full bg-background-primary text-[16px] font-semibold leading-6 text-button-primary"
                  >
                    {student.nickname.slice(0, 1)}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="text-[16px] font-semibold leading-6 text-text-primary">
                      {student.nickname}
                    </span>
                    <span className="text-[14px] leading-5 text-meti-hint">
                      초등 {student.grade}학년 · {PARTNER_NAME[student.persona_type]}
                    </span>
                  </span>
                  <ChevronRight size={24} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-surface-primary px-5 pb-5 pt-5">
        {full ? (
          <span aria-disabled className={`${CTA} cursor-not-allowed bg-disabled-bg text-disabled-text`}>
            최대 {MAX_STUDENTS}명 등록 완료
          </span>
        ) : (
          <Link
            href="/parent/my/students/new"
            className={`${CTA} bg-button-primary text-white hover:bg-button-hover active:bg-button-pressed`}
          >
            {empty ? '자녀 계정 만들기' : '자녀 추가'}
          </Link>
        )}
      </div>
    </main>
  );
}
