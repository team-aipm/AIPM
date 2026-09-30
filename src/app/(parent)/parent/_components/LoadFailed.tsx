'use client';

/**
 * Figma `보호자 홈 / 불러오기 실패` · `주간 리포트 / 불러오기 실패`.
 *
 * `error.tsx` 가 부른다. 다시 불러오기는 `reset` 만으로는 server 가 다시
 * 안 읽으므로 `router.refresh()` 를 같이 한다.
 */

import { useRouter } from 'next/navigation';
import { startTransition } from 'react';
import { BrandButton } from '@/components/ui/BrandButton';

export function LoadFailed({
  title,
  body,
  reset,
}: {
  title: string;
  body: string;
  reset: () => void;
}) {
  const router = useRouter();

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 px-5 py-6 text-center">
      <span className="flex size-16 items-center justify-center rounded-2xl bg-background-primary text-[24px] leading-8 font-bold text-error-text">
        !
      </span>
      <h1 className="text-[20px] leading-7 font-semibold text-text-primary">{title}</h1>
      <p className="text-[16px] leading-6 text-text-secondary">{body}</p>
      <BrandButton
        type="button"
        onClick={() =>
          startTransition(() => {
            router.refresh();
            reset();
          })
        }
      >
        다시 불러오기
      </BrandButton>
    </main>
  );
}
