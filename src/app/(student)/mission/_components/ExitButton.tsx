'use client';

/**
 * 미션 화면의 뒤로 가기 + 「중간 종료 확인」 Modal (COM-003 §5 · Figma 309:8127).
 *
 * 바로 홈으로 보내지 않고 한 번 묻는다. 대화는 턴마다 저장되므로 나가도
 * 잃는 것은 없지만, 아이가 실수로 눌러 흐름이 끊기는 것을 막는다.
 * Modal 은 route 가 아니라 이 화면 안의 State 다(COM-003 §13-3).
 */

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Database } from '@/types/database';
import { BrandButton } from '@/components/ui/BrandButton';
import { PartnerFace } from '@/components/ui/PartnerFace';

export function ExitButton({
  persona,
}: {
  persona: Database['public']['Enums']['persona_type'];
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label="홈으로"
        onClick={() => setOpen(true)}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors hover:bg-background-primary"
      >
        <Image src="/icons/chevron-left.svg" alt="" width={44} height={44} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="exit-title"
            onClick={(event) => event.stopPropagation()}
            className="flex w-full max-w-[335px] flex-col items-center gap-4 rounded-2xl bg-surface-primary p-6 shadow-overlay"
          >
            <PartnerFace persona={persona} size={88} />
            <p id="exit-title" className="text-center text-[20px] font-semibold leading-7 text-text-primary">
              벌써 가려고?
            </p>
            <p className="text-center text-[14px] leading-5 text-text-primary">
              지금까지 한 이야기는 내가 기억해 둘게.
              <br />
              다음에 여기서부터 이어서 하자!
            </p>
            <div className="flex w-full flex-col gap-4">
              <BrandButton type="button" onClick={() => setOpen(false)}>
                조금 더 할래
              </BrandButton>
              <BrandButton type="button" tone="neutral" onClick={() => router.push('/home')}>
                다음에 할래
              </BrandButton>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
