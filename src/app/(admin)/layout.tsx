/**
 * ADM 영역 공통 껍데기.
 *
 * **부모 · 학생 화면과 완전히 다른 화면이다.** 어휘도 다르다 — 여기서는
 * 내부 용어(Evaluation · Logic Gap · needs_review)를 그대로 쓴다.
 *
 * 와이어프레임(2026-09-03)의 구조를 따른다: 조회는 보는 화면, 관리는
 * 손대는 화면. 섞지 않는다.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { currentAdmin } from '@/lib/services/admin';

const ROLE_LABEL = { full: '전체 권한', cs: 'CS', readonly: '읽기전용' } as const;

const NAV = [
  { group: '조회', items: [{ href: '/admin', label: '대시보드' }] },
  {
    group: '관리',
    items: [
      { href: '/admin/accounts', label: '계정' },
      { href: '/admin/students', label: '학생' },
    ],
  },
  { group: '시스템', items: [{ href: '/admin/operators', label: '운영자 계정' }] },
] as const;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await currentAdmin();
  // **없는 화면처럼 보이게 한다.** "권한이 없습니다" 는 여기 무엇이 있다는
  // 것을 알려주는 답이다.
  if (ctx === null) notFound();

  return (
    <div className="flex min-h-dvh bg-neutral-100 text-neutral-900">
      <aside className="hidden w-56 shrink-0 flex-col gap-6 border-r border-black/10 bg-white px-4 py-6 md:flex">
        <p className="text-[15px] font-extrabold">AIPM 운영</p>
        {NAV.map((section) => (
          <div key={section.group} className="flex flex-col gap-1">
            <p className="px-2 text-[11px] font-bold text-neutral-400">{section.group}</p>
            {section.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded px-2 py-1.5 text-[13px] font-semibold hover:bg-neutral-100"
              >
                {item.label}
              </Link>
            ))}
          </div>
        ))}
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-black/10 bg-white px-6 py-3">
          <p className="text-[13px] font-bold md:hidden">AIPM 운영</p>
          <p className="ml-auto text-[12px] text-neutral-500">
            {ctx.admin.admin_name} · {ROLE_LABEL[ctx.admin.admin_role]}
          </p>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
