/**
 * 학생 홈 「부모님과 약속한 보상」 (COM-001 §11-A · COM-002 §22-5)
 *
 * Figma `홈 · 02 진행 중`(392:138) · `03 보상 미등록`(394:3947) ·
 * `04 오늘 미션 완료 · 보상 도착`(394:4077) · `05 보상 받은 뒤 다시 시작`(394:4227).
 *
 * 막대 숫자는 **그 보상이 시작된 뒤 받은 도장 수**(`progress`)다. 도장만
 * 센다 — 코인은 여기 섞지 않는다.
 */

import Image from 'next/image';
import type { ReactNode } from 'react';
import type { Database } from '@/types/database';
import type { RewardBoard } from '@/lib/services/reward';
import { PartnerFace } from '@/components/ui/PartnerFace';

type Persona = Database['public']['Enums']['persona_type'];

export function RewardProgress({
  board,
  persona,
  dailyTarget,
}: {
  board: RewardBoard;
  persona: Persona;
  dailyTarget: number;
}) {
  /*
    도장을 다 모았는데 부모가 아직 안 준 것이 있으면 그것부터 말한다 —
    아이가 부모에게 말해야 받는다. 다음 보상은 뒤에서 이미 쌓이고 있다(§22-5).
  */
  const arrived = board.achieved[0] ?? null;

  if (arrived !== null) {
    return (
      <Board
        persona={persona}
        progress={arrived.target_stamp_count}
        target={arrived.target_stamp_count}
        title={
          <>
            {arrived.reward_name} <span className="text-button-primary">도착!</span> 부모님께 말해 봐
          </>
        }
      />
    );
  }

  const active = board.active;
  if (active === null) {
    return (
      <div className="flex items-center gap-3 rounded-xl bg-background-primary p-3">
        <Image src="/icons/reward-diamond.png" alt="" width={28} height={28} />
        <div className="flex flex-col gap-0.5">
          <p className="text-[14px] leading-5 font-semibold text-text-primary">부모님과 보상을 정해 봐</p>
          <p className="text-[12px] leading-[18px] text-text-secondary">
            오늘 미션 {dailyTarget}개를 모두 끝내면 보상이 가까워져
          </p>
        </div>
      </div>
    );
  }

  /*
    「받았지?」 는 지금 보상이 진행되는 동안 부모가 앞의 보상을 줬을 때만
    말한다. 보상은 달성 순간 다음 것이 시작되고, 주는 날은 그 뒤다(§22-5).
  */
  const lastDelivered = board.delivered[0] ?? null;
  const justDelivered =
    lastDelivered !== null &&
    active.activated_at !== null &&
    (lastDelivered.delivered_at ?? '') >= active.activated_at;

  return (
    <Board
      persona={persona}
      progress={active.progress}
      target={active.target_stamp_count}
      lead={justDelivered ? `${lastDelivered.reward_name} 받았지? 다음 보상도 같이 모아 보자` : null}
      title={`${active.reward_name}까지 도장 ${active.target_stamp_count - active.progress}개`}
    />
  );
}

function Board({
  persona,
  progress,
  target,
  title,
  lead = null,
}: {
  persona: Persona;
  progress: number;
  target: number;
  title: ReactNode;
  lead?: string | null;
}) {
  const pct = target > 0 ? Math.min(100, (progress / target) * 100) : 0;

  return (
    <div className="flex flex-col gap-3">
      {lead !== null && <p className="text-[14px] leading-5 text-button-primary">{lead}</p>}

      <div className="flex items-center gap-3">
        <Image src="/icons/reward-chest.png" alt="" width={44} height={44} className="shrink-0" />
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="text-[12px] leading-[18px] text-text-secondary">부모님과 약속한 보상</p>
          <p className="text-[16px] leading-6 font-semibold text-text-primary">{title}</p>
        </div>
      </div>

      {/* 캐릭터 얼굴이 채움 끝에 선다. 양 끝에서는 막대 밖으로 나가지 않게 붙든다 */}
      <div className="relative h-[46px]">
        <span
          className="absolute top-0 flex size-[30px] items-center justify-center rounded-full bg-surface-primary shadow-card"
          style={{ left: `clamp(0px, calc(${pct}% - 15px), calc(100% - 30px))` }}
        >
          <PartnerFace persona={persona} size={26} />
        </span>
        <div
          role="progressbar"
          aria-label={`도장 ${target}개 중 ${progress}개`}
          aria-valuemin={0}
          aria-valuemax={target}
          aria-valuenow={progress}
          className="absolute inset-x-0 bottom-0 h-2.5 overflow-hidden rounded-full bg-background-primary"
        >
          <span className="block h-full rounded-full bg-button-primary" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <p className="flex justify-between text-[12px] leading-[18px]">
        <span className="text-button-primary">{progress}</span>
        <span className="text-meti-hint">{target}</span>
      </p>
    </div>
  );
}
