/**
 * RWD-001 보상 목록 · `/parent/rewards?child=` (DEV-002)
 *
 * DEV-002 의 파일 칸은 `(parent)/rewards` 지만 부모 화면은 모두
 * `(parent)/parent/…` 아래에 있다. 주소(`/parent/rewards`)가 같도록 여기에 둔다.
 *
 * 생김새는 Figma `보상 관리` 01 진행 중 · 다음 예약(414:4168) ·
 * 03 보상이 없을 때(414:4346) · 04 보상을 준 뒤(414:4415).
 *
 * 순서: 도착한 보상(줄 차례) → 진행 중 → 다음 → 지난 보상.
 * 학생당 진행 중 1개 · 다음 1개까지다(COM-002 §22-5). 둘 다 차 있으면
 * 더 정하는 길을 두지 않고 이유를 적는다.
 */

import Link from 'next/link';
import { requireParent } from '@/lib/services/viewer';
import { listStudents } from '@/lib/services/student';
import { rewardBoard } from '@/lib/services/reward';
import { ChildChips } from '../_components/ChildChips';
import { MyTopBar } from '../my/_components/MyTopBar';
import {
  ActiveRewardCard,
  ArrivedRewardCard,
  BRAND_LINK,
  CARD,
  EmptyRewardCard,
  QueuedRewardCard,
} from './_components/RewardCards';
import { givenOn } from './_components/RewardParts';

export const metadata = { title: '보상 관리 · 메티' };

export default async function RewardsPage({
  searchParams,
}: {
  searchParams: Promise<{ child?: string }>;
}) {
  const { client } = await requireParent();
  const { child } = await searchParams;

  const students = await listStudents(client);
  // 남의 아이 id 는 RLS 가 막는다. 화면도 내 아이 목록에 없으면 첫 아이로 돌린다.
  const selected = students.find((item) => item.student_id === child) ?? students[0];

  if (selected === undefined) {
    return (
      <main className="flex flex-1 flex-col">
        <MyTopBar title="보상 관리" back="/parent/my" backLabel="설정으로" />
        <div className="flex flex-col gap-3 px-5 pt-3 pb-5">
          <section className={`flex flex-col gap-3 ${CARD}`}>
            <h2 className="text-[16px] font-semibold leading-6 text-text-primary">자녀 계정을 먼저 만들어 주세요</h2>
            <p className="text-[14px] leading-5 text-text-secondary">
              보상은 아이마다 따로 정해요. 계정을 만들면 여기에서 정할 수 있어요.
            </p>
            <Link href="/parent/my/students/new" className={BRAND_LINK}>
              자녀 계정 만들기
            </Link>
          </section>
        </div>
      </main>
    );
  }

  const board = await rewardBoard(client, selected.student_id);
  const newHref = `/parent/rewards/new?child=${selected.student_id}`;
  const full = board.active !== null && board.queued !== null;

  return (
    <main className="flex flex-1 flex-col">
      <MyTopBar title="보상 관리" back="/parent/my" backLabel="설정으로" />

      <div className="flex flex-col gap-4 px-5 pt-3 pb-5">
        <ChildChips
          base="/parent/rewards"
          items={students.map((item) => ({ id: item.student_id, name: item.nickname }))}
          selectedId={selected.student_id}
        />

        {board.achieved.map((goal) => (
          <ArrivedRewardCard key={goal.reward_goal_id} goal={goal} hasNext={board.active !== null} />
        ))}

        {board.active !== null ? (
          <>
            <ActiveRewardCard goal={board.active} />
            <QueuedRewardCard goal={board.queued} newHref={newHref} />
            {full && (
              <p className="text-[12px] leading-[18px] text-text-secondary">
                진행 중인 보상과 다음 보상이 이미 있어요. 하나를 마치면 더 정할 수 있어요.
              </p>
            )}
          </>
        ) : (
          /*
            진행 중이 없으면 새로 정하는 보상이 곧바로 시작된다. 「예약」 이
            아니라 「정하기」 다. 이미 받은 보상이 있으면 처음 오는 부모처럼
            「아직 없어요」 라고 하지 않는다.
          */
          <EmptyRewardCard
            newHref={newHref}
            title={
              board.achieved.length + board.delivered.length === 0
                ? '아직 약속한 보상이 없어요'
                : '다음 보상을 정해 주세요'
            }
          />
        )}

        {board.delivered.length > 0 && (
          <>
            <h2 className="text-[16px] font-semibold leading-6 text-text-primary">지난 보상</h2>
            <ul className="flex flex-col divide-y divide-meti-line rounded-2xl border border-meti-line bg-surface-primary px-4 py-1">
              {board.delivered.map((goal) => (
                <li key={goal.reward_goal_id} className="flex items-center gap-2 py-3">
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-[16px] leading-6 text-text-primary">{goal.reward_name}</span>
                    <span className="text-[12px] leading-[18px] text-text-secondary">
                      도장 {goal.target_stamp_count}개
                    </span>
                  </div>
                  <span className="shrink-0 text-[12px] leading-[18px] text-text-secondary">
                    {givenOn(goal.delivered_at)}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </main>
  );
}
