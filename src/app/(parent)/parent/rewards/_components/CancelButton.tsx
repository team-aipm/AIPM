'use client';

/**
 * 「보상 그만두기」 와 확인 창 (RWD-003).
 *
 * 아이와 한 약속을 거두는 일이라 한 번 더 묻는다. 진행 중이던 것을
 * 그만두면 예약한 다음 보상이 곧바로 시작된다 — 아이 홈에 보상이 비지
 * 않게(`lib/services/reward` cancelGoal). 그 일을 창에서 미리 말한다.
 */

import { useState, useTransition } from 'react';
import { BrandButton } from '@/components/ui/BrandButton';
import { Dialog } from '../../my/_components/Dialog';
import { cancelRewardGoal } from '../[rewardGoalId]/_actions';
import { withObject } from './RewardParts';

export function CancelButton({
  goalId,
  rewardName,
  nextStarts,
}: {
  goalId: string;
  rewardName: string;
  /** 그만두면 예약한 다음 보상이 시작되는가 */
  nextStarts: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const close = () => {
    if (pending) return;
    setOpen(false);
    setError(null);
  };

  const confirm = () => {
    start(async () => {
      // 성공하면 목록으로 넘어간다. 돌아온 것은 실패뿐이다.
      const result = await cancelRewardGoal(goalId);
      setError(result.error);
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-center py-3 text-[14px] leading-5 text-text-secondary"
      >
        보상 그만두기
      </button>

      <Dialog
        open={open}
        title={`${withObject(rewardName)} 그만둘까요?`}
        onClose={close}
        actions={
          <>
            <BrandButton type="button" pending={pending} onClick={confirm}>
              그만두기
            </BrandButton>
            <BrandButton tone="neutral" type="button" disabled={pending} onClick={close}>
              계속 모을게요
            </BrandButton>
          </>
        }
      >
        <p>
          그만둔 보상은 되돌릴 수 없어요. 아이가 받은 도장은 지워지지 않아요.
          {nextStarts && ' 예약한 다음 보상이 바로 시작돼요.'}
        </p>
        {error !== null && (
          <p role="alert" className="mt-2 text-error-text">
            {error}
          </p>
        )}
      </Dialog>
    </>
  );
}
