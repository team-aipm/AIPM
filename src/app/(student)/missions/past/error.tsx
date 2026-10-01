'use client';

/**
 * STU-006 오류 상태 · Figma `지난 미션 · 04 Error` (559:3563).
 * 아이 잘못처럼 말하지 않는다 — 무엇을 하면 되는지만 알려준다(CLAUDE.md).
 */

import { useRouter } from 'next/navigation';
import { BrandButton } from '@/components/ui/BrandButton';
import { PastTopBar } from './_components/PastTopBar';

export default function PastMissionsError({ reset }: { reset: () => void }) {
  const router = useRouter();
  return (
    <main className="flex flex-1 flex-col">
      <PastTopBar />
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-5 pb-24 text-center">
        <h1 className="text-[20px] leading-7 font-bold text-text-primary">지난 미션을 불러오지 못했어</h1>
        <p className="text-[14px] leading-5 text-text-secondary">인터넷 연결을 확인하고 다시 시도해 줘.</p>
        <div className="mt-2 w-[162px]">
          <BrandButton
            type="button"
            onClick={() => {
              router.refresh();
              reset();
            }}
          >
            다시 시도
          </BrandButton>
        </div>
      </div>
    </main>
  );
}
