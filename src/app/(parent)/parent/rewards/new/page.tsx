/**
 * RWD-002 보상 만들기 · `/parent/rewards/new?child=` (DEV-002)
 *
 * 생김새는 Figma `보상 관리 · 02 보상 등록`(414:4251).
 *
 * Figma 제목은 「민준이와 약속한 …」 이지만 이름마다 조사가 달라진다
 * (민준이와 · 서연이와 · 하은이와 …). 제목은 「아이와」 로 두고 이름은
 * 조사가 필요 없는 자리(「{이름} 홈」)에만 넣는다.
 */

import { redirect } from 'next/navigation';
import { requireParent } from '@/lib/services/viewer';
import { listStudents } from '@/lib/services/student';
import { LONG_TARGET, MAX_TARGET, MIN_TARGET, STAMP_PRESETS, rewardBoard } from '@/lib/services/reward';
import { MyTopBar } from '../../my/_components/MyTopBar';
import { RewardForm } from '../_components/RewardForm';
import { createRewardGoal } from './_actions';

export const metadata = { title: '보상 정하기 · 메티' };

export default async function NewRewardPage({
  searchParams,
}: {
  searchParams: Promise<{ child?: string }>;
}) {
  const { client } = await requireParent();
  const { child } = await searchParams;

  const students = await listStudents(client);
  // 남의 아이 id 는 RLS 가 막는다. 화면도 내 아이 목록에 없으면 첫 아이로 돌린다.
  const selected = students.find((item) => item.student_id === child) ?? students[0];
  if (selected === undefined) redirect('/parent/rewards');

  // 진행 중 · 다음이 다 차 있으면 폼을 열지 않는다. 목록이 이유를 말한다.
  const board = await rewardBoard(client, selected.student_id);
  if (board.active !== null && board.queued !== null) redirect(`/parent/rewards?child=${selected.student_id}`);

  return (
    <main className="flex flex-1 flex-col">
      <MyTopBar title="보상 정하기" back={`/parent/rewards?child=${selected.student_id}`} backLabel="보상 관리로" />

      <div className="flex flex-1 flex-col gap-4 px-5 pt-3 pb-5">
        <header className="flex flex-col gap-1">
          <h1 className="text-[20px] font-semibold leading-7 text-text-primary">아이와 약속한 보상을 적어 주세요</h1>
          <p className="text-[14px] leading-5 text-text-secondary">
            아이와 함께 정한 보상과 목표 도장 수를 등록하면, {selected.nickname} 홈에 보상까지 남은 도장이 보여요.
            {board.active !== null && ' 지금 모으는 보상을 달성하면 바로 이어서 시작해요.'}
          </p>
        </header>

        <RewardForm
          action={createRewardGoal}
          hidden={{ student_id: selected.student_id }}
          childName={selected.nickname}
          defaults={{ name: '', target: null }}
          limits={{ presets: STAMP_PRESETS, min: MIN_TARGET, max: MAX_TARGET, long: LONG_TARGET }}
          submitLabel="보상 등록하기"
        />
      </div>
    </main>
  );
}
