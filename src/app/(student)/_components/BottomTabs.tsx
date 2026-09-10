'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { CHARACTER_IMG, CHARACTERS } from '../_lib/mock-data';
import { useStudentState } from '../_lib/use-student-state';

/**
 * COM-003에 정의되지 않은 하단 탭 5개(홈/도감/상점/마이) 중 홈만 공식
 * Screen(STU-004)이다. 도감·상점·마이는 아직 Screen ID가 없는 프로토타입
 * 화면이라 팀 문서화 전까지는 임시 경로로만 존재한다 (`/dex`, `/shop`, `/my`).
 *
 * 가운데 원형 버튼(FAB)은 METTY 프로토타입 원본에 있던 "빠른 미션 시작"
 * 버튼이다. 항상 파트너로 지정된 캐릭터로 새 세션을 시작한다 — 실제로는
 * "이어할 세션이 있는가"에 따라 `/mission`으로 바로 보낼지 `/calendar`로
 * 보낼지 분기해야 한다 (COM-003 §4.2 상태별 Primary Action).
 *
 * ⚠️ 위치 잡는 방식: `position: fixed`로 브라우저 뷰포트 바닥에 고정하지
 * 않는다. 데스크톱에서는 `(student)/layout.tsx`가 앱을 카드 프레임으로
 * 감싸는데, 카드 높이가 뷰포트보다 짧으면 `fixed` 탭바는 카드 바깥
 * 아래쪽에 따로 떠 보인다. 대신 이 컴포넌트를 쓰는 각 페이지가
 * `flex h-dvh flex-col` 루트 안에서 스크롤 영역(`flex-1 overflow-y-auto`)
 * 바로 다음의 평범한 마지막 자식으로 배치해야 한다 — `mission/page.tsx`가
 * 원래 쓰던 구조와 동일하다. 그러면 탭바는 항상 그 페이지가 실제로 차지한
 * 프레임의 바닥에 자연스럽게 붙는다.
 */
const TABS = [
  { href: '/home', label: '홈' },
  { href: '/dex', label: '도감' },
  { href: '/shop', label: '상점' },
  { href: '/my', label: '마이' },
] as const;

export function BottomTabs() {
  const pathname = usePathname();
  const { state, hydrated } = useStudentState();
  // hydrated 이전에는 로컬 저장값을 아직 못 읽었으니 기본 파트너(메티)로
  // 잠깐 보여준다 — 서버 렌더와 클라이언트 첫 렌더가 어긋나지 않게 하기
  // 위함. hydrate 되자마자 실제 선택된 캐릭터로 바뀐다.
  const partnerId = hydrated ? state.partner : 'metty';
  const partner = CHARACTERS[partnerId];

  return (
    <div className="relative flex flex-none items-start gap-1 border-t border-[#E7EEF0] bg-white/95 px-3 pt-2 backdrop-blur-md">
      {TABS.map((tab, i) => {
        const active = pathname === tab.href;
        return (
          <div key={tab.href} className="flex flex-1 items-start justify-center">
            {i === 2 && <div className="w-14" />}
            <Link href={tab.href} className="flex flex-1 flex-col items-center gap-1 py-1.5">
              <span
                className={`block h-[22px] w-[22px] rounded-lg ${active ? 'bg-[#206B7C]' : 'bg-[#9AA7AC]'}`}
              />
              <span className={`text-xs font-extrabold ${active ? 'text-[#206B7C]' : 'text-[#9AA7AC]'}`}>
                {tab.label}
              </span>
            </Link>
          </div>
        );
      })}
      <Link
        href="/mission"
        className="absolute left-1/2 top-[-38px] flex h-16 w-16 -translate-x-1/2 items-center justify-center overflow-hidden rounded-full border-4 border-[#F7FAFB]"
        style={{ background: partner.accent, boxShadow: `0 8px 20px ${partner.accent}59` }}
      >
        <Image
          src={CHARACTER_IMG[partnerId].wave}
          alt={`${partner.ko}와 학습 시작`}
          width={56}
          height={56}
          className="h-14 w-auto translate-y-1"
        />
      </Link>
    </div>
  );
}
