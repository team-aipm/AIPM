import Image from 'next/image';
import Link from 'next/link';
import type { Database } from '@/types/database';
import { PartnerFigure } from '@/components/student/PartnerFigure';
import { startMission } from '../_actions';

type Persona = Database['public']['Enums']['persona_type'];

/**
 * Figma `Pattern / Student / Bottom Navigation` · `홈 / 학습하기 / 내 정보`.
 *
 * **읽는 순서는 홈 → 학습하기 → 내 정보다**(COM-003 §11). 가운데가 커 보여도
 * DOM 순서를 그대로 둔다.
 *
 * 가운데 `학습하기` 는 홈 카드의 버튼과 같은 `startMission` 을 부른다 —
 * 세션은 누를 때만 연다(`_actions.ts`).
 *
 * `내 정보`(STU-007)는 아직 화면이 없다. 다른 화면으로 잇지 않고 자리만
 * 잡아 둔다. 엉뚱한 화면이 열리는 것보다 안 눌리는 편이 덜 헷갈린다.
 */
export function StudentBottomNav({ persona }: { persona: Persona }) {
  return (
    <nav
      aria-label="학생 메뉴"
      className="fixed inset-x-0 bottom-0 z-50 flex justify-center"
    >
      <div className="flex w-full max-w-[480px] items-start bg-surface-primary pt-2 pb-[max(34px,env(safe-area-inset-bottom))] shadow-nav">
        <Link
          href="/home"
          aria-current="page"
          className="flex h-[54px] flex-1 flex-col items-center justify-center gap-1"
        >
          <Image src="/icons/nav-home-selected.svg" alt="" width={24} height={24} />
          <span className="text-[14px] leading-5 font-semibold text-button-primary">홈</span>
        </Link>

        <form action={startMission} className="flex flex-1 justify-center">
          <button
            type="submit"
            className="-mt-[31px] flex flex-col items-center gap-0.5"
          >
            <span className="flex size-[60px] items-center justify-center rounded-full bg-surface-primary shadow-nav">
              <span className="flex size-[52px] items-center justify-center rounded-full bg-surface-primary shadow-card">
                <PartnerFigure persona={persona} size={38} />
              </span>
            </span>
            <span className="text-[14px] leading-5 font-semibold text-text-secondary">학습하기</span>
          </button>
        </form>

        <span
          aria-disabled="true"
          className="flex h-[54px] flex-1 flex-col items-center justify-center gap-1"
        >
          <Image src="/icons/nav-profile.svg" alt="" width={24} height={24} />
          <span className="text-[14px] leading-5 font-semibold text-text-secondary">내 정보</span>
        </span>
      </div>
    </nav>
  );
}
