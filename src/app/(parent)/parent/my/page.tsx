/**
 * MY-001 마이페이지 · `/parent/my` (DEV-002)
 *
 * 부모가 보는 설정 목록이다. 여기서 갈라지는 화면들이 MY-002~010 이다.
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { listStudents } from '@/lib/services/student';

export const metadata = { title: '마이페이지 · 메티' };

const MENU = [
  { href: '/parent/my/students', label: '학생 관리', hint: '등록 · 정보 수정' },
  { href: '/parent/my/profile', label: '회원 정보', hint: '이름 · 연락처' },
  { href: '/parent/my/marketing', label: '소식 받기', hint: '이메일 · 문자 · 알림톡' },
  { href: '/parent/my/notifications', label: '알림 설정', hint: '학습 알림' },
  { href: '/parent/my/account', label: '계정 관리', hint: '로그아웃 · 회원탈퇴' },
] as const;

export default async function MyPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (auth.user === null) redirect('/login');

  const { data: account } = await supabase
    .from('account')
    .select('account_name, email')
    .eq('account_id', auth.user.id)
    .maybeSingle();

  const students = await listStudents(supabase);

  return (
    <main className="flex flex-1 flex-col gap-4 px-5 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-extrabold text-meti-ink">
          {account?.account_name ?? '보호자'} 님
        </h1>
        <p className="text-[13px] text-meti-sub">
          {account?.email ?? ''} · 학생 {students.length}명
        </p>
      </header>

      <ul className="flex flex-col gap-2">
        {MENU.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm"
            >
              <span className="flex flex-col">
                <span className="text-[15px] font-bold text-meti-ink">{item.label}</span>
                <span className="text-[12px] text-meti-sub">{item.hint}</span>
              </span>
              <span aria-hidden className="text-meti-sub">
                ›
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
