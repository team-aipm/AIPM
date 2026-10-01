/**
 * RWD-003 보상 상세·수정 · `/parent/rewards/[rewardGoalId]` (DEV-002)
 *
 * 등록과 같은 폼(Figma 414:4251)으로 고친다. 상태마다 할 수 있는 일이 다르다.
 *
 * ```text
 *   queued     이름 · 목표 수 모두 고침 · 그만두기
 *   active     이름만 고침(목표 수 칩 잠금) · 그만두기     COM-002 §22-5
 *   achieved   고치지 않는다 · 「보상을 줬어요」
 *   delivered  지난 보상이라 볼 것만 있다
 * ```
 */

import { redirect } from 'next/navigation';
import { requireParent } from '@/lib/services/viewer';
import { listStudents } from '@/lib/services/student';
import {
  LONG_TARGET,
  MAX_TARGET,
  MIN_TARGET,
  STAMP_PRESETS,
  getGoal,
  rewardBoard,
} from '@/lib/services/reward';
import { MyTopBar } from '../../my/_components/MyTopBar';
import { RewardForm } from '../_components/RewardForm';
import { CancelButton } from '../_components/CancelButton';
import { ActiveRewardCard, ArrivedRewardCard, CARD } from '../_components/RewardCards';
import { ChestIcon, givenOn } from '../_components/RewardParts';
import { updateRewardGoal } from './_actions';

export const metadata = { title: '보상 수정 · 메티' };

export default async function RewardDetailPage({
  params,
}: {
  params: Promise<{ rewardGoalId: string }>;
}) {
  const { client } = await requireParent();
  const { rewardGoalId } = await params;

  const goal = await getGoal(client, rewardGoalId);
  const students = await listStudents(client);
  const student = students.find((item) => item.student_id === goal?.student_id);
  // 없는 것 · 그만둔 것 · 내 아이 것이 아닌 것은 같은 길로 돌려보낸다.
  if (goal === null || goal.reward_status === 'cancelled' || student === undefined) redirect('/parent/rewards');

  const board = await rewardBoard(client, goal.student_id);
  const back = `/parent/rewards?child=${goal.student_id}`;
  const editable = goal.reward_status === 'active' || goal.reward_status === 'queued';
  const active = board.active?.reward_goal_id === goal.reward_goal_id ? board.active : null;

  return (
    <main className="flex flex-1 flex-col">
      <MyTopBar title={editable ? '보상 수정' : '보상'} back={back} backLabel="보상 관리로" />

      <div className="flex flex-1 flex-col gap-4 px-5 pt-3 pb-5">
        {active !== null && <ActiveRewardCard goal={active} showEdit={false} />}

        {goal.reward_status === 'achieved' && (
          <ArrivedRewardCard goal={goal} hasNext={board.active !== null} />
        )}

        {goal.reward_status === 'delivered' && (
          <section className={`flex items-center gap-3 ${CARD}`}>
            <ChestIcon size={44} />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[12px] leading-[18px] text-text-secondary">지난 보상</span>
              <h2 className="truncate text-[20px] font-semibold leading-7 text-text-primary">{goal.reward_name}</h2>
              <span className="text-[14px] leading-5 text-text-secondary">
                도장 {goal.target_stamp_count}개 · {givenOn(goal.delivered_at)}
              </span>
            </div>
          </section>
        )}

        {editable && (
          <>
            <RewardForm
              action={updateRewardGoal}
              hidden={{ reward_goal_id: goal.reward_goal_id }}
              childName={student.nickname}
              defaults={{ name: goal.reward_name, target: goal.target_stamp_count }}
              limits={{ presets: STAMP_PRESETS, min: MIN_TARGET, max: MAX_TARGET, long: LONG_TARGET }}
              lockTarget={goal.reward_status === 'active'}
              submitLabel="저장하기"
            />
            <CancelButton
              goalId={goal.reward_goal_id}
              rewardName={goal.reward_name}
              nextStarts={goal.reward_status === 'active' && board.queued !== null}
            />
          </>
        )}
      </div>
    </main>
  );
}
