'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Database } from '@/types/database';
import { PartnerFace } from '@/components/ui/PartnerFace';

/**
 * 하단 탭 5개(홈/도감/상점/마이) 중 홈(STU-004)만 COM-003에 정의된
 * Screen이다. 도감·상점·마이는 아직 Screen ID가 없는 프로토타입 화면이라
 * (`METTY App.dc.html`) 팀 문서화 전까지는 `/dex`, `/shop`, `/my` 임시
 * 경로로만 있고 실제 데이터에 연결하지 않는다 — 화면만 그대로 옮겨 둔다.
 *
 * 가운데 원형 버튼(FAB)은 프로토타입 원본의 '빠른 미션 시작' 버튼이다.
 * 항상 `/mission`으로 보낸다 — 이어할 세션이 있는지 여기서 미리 갈라
 * 보내지 않는다. `/mission`이 이미 그 판단(활성 세션 이어하기 vs 새로
 * 시작)을 한다.
 *
 * ⚠️ 위치: `position: fixed`로 뷰포트 바닥에 고정하지 않는다. 데스크톱은
 * `(student)/layout.tsx`가 앱을 카드 프레임으로 감싸는데, 카드 높이가
 * 뷰포트보다 짧으면 `fixed` 탭바가 카드 바깥에 따로 떠 보인다. 이 컴포넌트를
 * 쓰는 페이지는 `flex h-dvh flex-col` 루트 안에서 스크롤 영역
 * (`flex-1 overflow-y-auto`) 바로 다음의 평범한 마지막 자식으로 둬야 한다.
 */

type Persona = Database['public']['Enums']['persona_type'];

const TABS = [
  { href: '/home', label: '홈' },
  { href: '/dex', label: '도감' },
  { href: '/shop', label: '상점' },
  { href: '/my', label: '마이' },
] as const;

export function BottomTabs({ persona }: { persona: Persona }) {
  const pathname = usePathname();

  return (
    <div className='relative flex flex-none items-start gap-1 border-t border-[#E7EEF0] bg-white/95 px-3 pt-2 backdrop-blur-md'>
      {TABS.map((tab, i) => {
        const active = pathname === tab.href;
        return (
          <div
            key={tab.href}
            className='flex flex-1 items-start justify-center'
          >
            {i === 2 && <div className='w-14' />}
            <Link
              href={tab.href}
              className='flex flex-1 flex-col items-center gap-1 py-1.5'
            >
              <span
                className={`block h-[22px] w-[22px] rounded-lg ${active ? 'bg-meti' : 'bg-[#9AA7AC]'}`}
              />
              <span
                className={`text-xs font-extrabold ${active ? 'text-meti' : 'text-[#9AA7AC]'}`}
              >
                {tab.label}
              </span>
            </Link>
          </div>
        );
      })}
      <Link
        href='/mission'
        aria-label='미션 시작하기'
        className='absolute left-1/2 top-[-38px] flex h-16 w-16 -translate-x-1/2 items-center justify-center overflow-hidden rounded-full border-4 border-[#F7FAFB] bg-meti shadow-[0_8px_20px_rgba(32,107,124,.35)]'
      >
        <PartnerFace
          persona={persona}
          pose='wave'
          size={56}
          className='translate-y-1'
        />
      </Link>
    </div>
  );
}
