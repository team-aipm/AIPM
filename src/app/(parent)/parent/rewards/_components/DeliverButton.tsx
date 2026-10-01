'use client';

/**
 * 「보상을 줬어요」 버튼과 확인 창 (Figma 405:3580 · 실패 462:4179).
 *
 * **한 번 더 묻는다.** 누르면 `delivered` 로 바뀌고 되돌릴 길이 없다.
 * 실패는 따로 화면을 두지 않고 창 안에서 말한다(COM-003 §13-3) —
 * 「보상 진행은 그대로」 를 먼저 말해야 부모가 아이 도장을 걱정하지 않는다.
 */

import { useState, useTransition } from 'react';
import { BrandButton } from '@/components/ui/BrandButton';
import { Dialog } from '../../my/_components/Dialog';
import { deliverReward } from '../_actions';
import { withObject } from './RewardParts';

export function DeliverButton({
  goalId,
  rewardName,
  hasNext,
}: {
  goalId: string;
  rewardName: string;
  /** 다음 보상이 이미 시작됐는가. 창의 안내 한 줄이 달라진다 */
  hasNext: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();

  const close = () => {
    if (pending) return;
    setOpen(false);
    setFailed(false);
  };

  const confirm = () => {
    start(async () => {
      const { ok } = await deliverReward(goalId);
      if (ok) {
        setOpen(false);
        setFailed(false);
      } else {
        setFailed(true);
      }
    });
  };

  return (
    <>
      <BrandButton size="sm" type="button" onClick={() => setOpen(true)}>
        보상을 줬어요
      </BrandButton>

      <Dialog
        open={open}
        title={failed ? '보상 처리가 완료되지 않았어요' : `${withObject(rewardName)} 줬나요?`}
        onClose={close}
        actions={
          <>
            <BrandButton type="button" pending={pending} onClick={confirm}>
              {failed ? '다시 시도' : '줬어요'}
            </BrandButton>
            <BrandButton tone="neutral" type="button" disabled={pending} onClick={close}>
              아직이에요
            </BrandButton>
          </>
        }
      >
        {failed ? (
          <p role="alert" className="text-error-text">
            보상 진행은 그대로 유지돼요. 다시 시도해 주세요.
          </p>
        ) : (
          <p>
            확인하면 보상 전달 완료로 기록돼요.
            {hasNext && ' 다음 목표는 이미 시작되어 도장은 계속 쌓여요.'}
          </p>
        )}
      </Dialog>
    </>
  );
}
