import Link from 'next/link';
import type { RewardGoal } from '@/lib/services/reward';
import { ChestIcon, ProgressBar } from './RewardParts';
import { DeliverButton } from './DeliverButton';

/**
 * 보상 카드들. RWD-001 목록과 부모 홈이 같이 쓴다.
 *
 * Figma 414:4168 · 414:4346 · 414:4415(목록) · 404:3365 · 404:3495(홈).
 * 아이 이름 뒤에 조사가 붙는 문장(「민준이가 …」)은 이름 없이 쓴다 —
 * 받침에 따라 조사가 달라진다.
 */

export const CARD = 'rounded-2xl border border-meti-line bg-surface-primary p-4';

const EDIT_LINK =
  'flex size-11 shrink-0 items-center justify-end text-[14px] leading-5 text-text-secondary';

const NEUTRAL_LINK =
  'flex h-11 shrink-0 items-center justify-center rounded-lg border border-meti-line bg-surface-primary px-4 text-[14px] font-semibold leading-5 text-text-primary transition-colors hover:bg-background-primary';

export const BRAND_LINK =
  'flex h-11 w-full items-center justify-center rounded-lg bg-button-primary px-4 text-[14px] font-semibold leading-5 text-white transition-colors hover:bg-button-hover active:bg-button-pressed';

/** 「도장 7개 더 모으면 달성해요」. 며칠 걸린다고 말하지 않는다(COM-003 §4.9) */
function remaining(goal: RewardGoal & { progress: number }): string {
  const left = Math.max(0, goal.target_stamp_count - goal.progress);
  return left === 0 ? '곧 달성해요' : `도장 ${left}개 더 모으면 달성해요`;
}

/** 진행 중인 보상 (414:4168 `진행 중인 보상`) */
export function ActiveRewardCard({
  goal,
  showEdit = true,
}: {
  goal: RewardGoal & { progress: number };
  /** 상세 화면에서는 끈다. 자기 자신으로 가는 링크가 된다 */
  showEdit?: boolean;
}) {
  return (
    <section className={`flex flex-col gap-3 ${CARD}`}>
      <div className="flex items-center gap-3">
        <ChestIcon size={44} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[12px] leading-[18px] text-text-secondary">진행 중인 보상</span>
          <h2 className="truncate text-[20px] font-semibold leading-7 text-text-primary">{goal.reward_name}</h2>
        </div>
        {showEdit && (
          <Link href={`/parent/rewards/${goal.reward_goal_id}`} className={EDIT_LINK}>
            수정
          </Link>
        )}
      </div>
      <ProgressBar value={goal.progress} max={goal.target_stamp_count} />
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[14px] font-semibold leading-5 text-button-primary">
          도장 {goal.target_stamp_count}개 중 {goal.progress}개
        </span>
        <span className="text-[12px] leading-[18px] text-text-secondary">{remaining(goal)}</span>
      </div>
    </section>
  );
}

/** 다음 보상. 있으면 「예약됨」, 없으면 예약하기(414:4415) */
export function QueuedRewardCard({
  goal,
  newHref,
}: {
  goal: RewardGoal | null;
  newHref: string;
}) {
  return (
    <section className={`flex items-center gap-3 ${CARD}`}>
      {goal === null ? (
        <>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[12px] leading-[18px] text-text-secondary">다음 보상</span>
            <span className="text-[14px] leading-5 text-text-secondary">미리 정해 두면 바로 이어서 모아요</span>
          </div>
          <Link href={newHref} className={NEUTRAL_LINK}>
            예약하기
          </Link>
        </>
      ) : (
        <>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[12px] leading-[18px] text-text-secondary">다음 보상</span>
              <span className="rounded-xl bg-background-primary px-2 py-2 text-[14px] font-semibold leading-5 text-text-primary">
                예약됨
              </span>
            </div>
            <span className="truncate text-[16px] font-semibold leading-6 text-text-primary">
              {goal.reward_name} · 도장 {goal.target_stamp_count}개
            </span>
          </div>
          <Link href={`/parent/rewards/${goal.reward_goal_id}`} className={EDIT_LINK}>
            수정
          </Link>
        </>
      )}
    </section>
  );
}

/** 도장을 다 모았고 아직 주지 않았다 (404:3495 `약속한 보상` · 보상 도착) */
export function ArrivedRewardCard({ goal, hasNext }: { goal: RewardGoal; hasNext: boolean }) {
  return (
    <section className={`flex flex-col gap-3 ${CARD}`}>
      <div className="flex items-center gap-3">
        <ChestIcon size={40} />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-[12px] leading-[18px] text-text-secondary">
            약속한 보상 · {goal.reward_name}
          </span>
          <h2 className="text-[16px] font-semibold leading-6 text-text-primary">보상에 도착했어요!</h2>
        </div>
      </div>
      <ProgressBar value={goal.target_stamp_count} max={goal.target_stamp_count} />
      <DeliverButton goalId={goal.reward_goal_id} rewardName={goal.reward_name} hasNext={hasNext} />
    </section>
  );
}

/** 약속한 보상이 없다 (414:4346 `보상 없음`) */
export function EmptyRewardCard({ newHref, title }: { newHref: string; title: string }) {
  return (
    <section className={`flex flex-col items-center gap-2.5 px-4 py-7 text-center ${CARD}`}>
      <ChestIcon size={64} />
      <h2 className="text-[16px] font-semibold leading-6 text-text-primary">{title}</h2>
      <p className="text-[14px] leading-5 text-text-secondary">
        아이와 함께 받고 싶은 보상과 목표 도장 수를 정해 보세요.
      </p>
      <Link href={newHref} className={BRAND_LINK}>
        보상 정하기
      </Link>
    </section>
  );
}

/**
 * 부모 홈의 보상 카드 (404:3365 진행 · 404:3495 도착).
 *
 * 도착한 보상이 있으면 그것부터 — 부모가 할 일(주기)이 있는 쪽이다.
 * 보상이 없으면 작은 카드로 정하러 가는 길만 둔다.
 */
export function HomeRewardCard({
  board,
  studentId,
}: {
  board: { active: (RewardGoal & { progress: number }) | null; achieved: RewardGoal[] };
  studentId: string;
}) {
  const arrived = board.achieved[0];
  if (arrived !== undefined) return <ArrivedRewardCard goal={arrived} hasNext={board.active !== null} />;

  if (board.active === null) {
    return (
      <section className={`flex items-center gap-3 ${CARD}`}>
        <ChestIcon size={40} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[12px] leading-[18px] text-text-secondary">약속한 보상</span>
          <span className="text-[14px] leading-5 text-text-primary">아이와 보상을 정하면 도장이 모이는 게 보여요</span>
        </div>
        <Link href={`/parent/rewards/new?child=${studentId}`} className={NEUTRAL_LINK}>
          보상 정하기
        </Link>
      </section>
    );
  }

  const goal = board.active;
  return (
    <section className={`flex flex-col gap-3 ${CARD}`}>
      <div className="flex items-center gap-3">
        <ChestIcon size={40} />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-[12px] leading-[18px] text-text-secondary">
            약속한 보상 · {goal.reward_name}
          </span>
          <span className="text-[16px] font-semibold leading-6 text-text-primary">
            도장 {goal.target_stamp_count}개 중 {goal.progress}개
          </span>
        </div>
      </div>
      <ProgressBar value={goal.progress} max={goal.target_stamp_count} />
      <Link
        href={`/parent/rewards?child=${studentId}`}
        className="self-start py-3 text-[14px] font-semibold leading-5 text-button-primary"
      >
        보상 관리
      </Link>
    </section>
  );
}
