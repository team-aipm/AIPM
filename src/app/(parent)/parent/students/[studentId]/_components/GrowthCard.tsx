/**
 * PAR-003 「성장 추이」 · 최근 4주를 주 단위로 비교한다 (COM-003 PAR-003 · 2026-10-02).
 *
 * - 생각하는 힘은 4단계 막대로 보인다. 점수 숫자(0~2)는 보이지 않는다.
 * - 한 주에 3번 이상 관찰돼야 단계를 매긴다. 모자라면 「아직 기록이 적어요」.
 * - 지난주보다 내려가도 「다시 다지는 중」 — 실패처럼 말하지 않는다.
 * - 다른 아이와 비교하지 않는다.
 */

import { ABILITIES, type WeekGrowth } from '@/lib/services/child-progress';

function delta(now: number, before: number, unit: string): string | null {
  const diff = now - before;
  if (diff === 0) return '지난주와 같아요';
  return `지난주보다 ${diff > 0 ? '+' : ''}${diff}${unit}`;
}

function supportWords(average: number): string {
  if (average <= 1) return '대부분 혼자 해냈어요';
  if (average <= 2) return '가끔 도움을 받았어요';
  return '도움을 받으며 풀었어요';
}

function Stage({ stage }: { stage: number | null }) {
  return (
    <span className="flex gap-1" aria-label={stage === null ? '아직 기록이 적어요' : `4단계 중 ${stage}단계`}>
      {[1, 2, 3, 4].map((step) => (
        <span
          key={step}
          className={`h-2 w-7 rounded-full ${stage !== null && step <= stage ? 'bg-button-primary' : 'bg-meti-line'}`}
        />
      ))}
    </span>
  );
}

function trend(now: number | null, before: number | null): string {
  if (now === null) return '아직 기록이 적어요';
  if (before === null) return '다음 주부터 비교해요';
  if (now > before) return '▲ 한 단계 올랐어요';
  if (now === before) return '유지';
  return '다시 다지는 중';
}

export function GrowthCard({ weeks }: { weeks: WeekGrowth[] }) {
  const current = weeks.at(-1);
  const previous = weeks.at(-2);
  const anything = weeks.some((week) => week.completed > 0);

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-meti-line bg-surface-primary p-4">
      <div className="flex items-center gap-2">
        <h2 className="flex-1 text-[16px] leading-6 font-semibold text-text-primary">성장 추이</h2>
        <span className="text-[12px] leading-[18px] text-text-secondary">최근 4주 · 주 단위</span>
      </div>

      {current === undefined || !anything ? (
        <p className="text-[14px] leading-5 text-text-secondary">
          학습 기록이 쌓이면 주마다 어떻게 달라지는지 보여드려요.
        </p>
      ) : (
        <>
          {/* 참여 */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-0.5 rounded-xl bg-background-primary px-3 py-2.5">
              <span className="text-[12px] leading-[18px] text-text-secondary">이번 주 학습한 날</span>
              <span className="text-[16px] leading-6 font-semibold text-text-primary">{current.learningDays}일</span>
              {previous !== undefined && (
                <span className="text-[12px] leading-[18px] text-button-primary">
                  {delta(current.learningDays, previous.learningDays, '일')}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-0.5 rounded-xl bg-background-primary px-3 py-2.5">
              <span className="text-[12px] leading-[18px] text-text-secondary">이번 주 완료한 미션</span>
              <span className="text-[16px] leading-6 font-semibold text-text-primary">{current.completed}개</span>
              {previous !== undefined && (
                <span className="text-[12px] leading-[18px] text-button-primary">
                  {delta(current.completed, previous.completed, '개')}
                </span>
              )}
            </div>
          </div>

          {/* 4주 완료 미션 · 막대 */}
          <div className="flex items-end justify-between gap-2 px-1" aria-label="최근 4주 완료한 미션">
            {weeks.map((week, idx) => {
              const peak = Math.max(...weeks.map((item) => item.completed), 1);
              return (
                <div key={week.monday} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-[12px] leading-[18px] text-text-secondary">{week.completed}</span>
                  <span
                    className={`w-full max-w-10 rounded-t-md ${idx === weeks.length - 1 ? 'bg-button-primary' : 'bg-surface-brand'}`}
                    style={{ height: `${Math.max(4, Math.round((week.completed / peak) * 56))}px` }}
                  />
                  <span className="text-[12px] leading-[18px] text-meti-hint">
                    {idx === weeks.length - 1 ? '이번 주' : `${Number(week.monday.slice(5, 7))}/${Number(week.monday.slice(8, 10))}`}
                  </span>
                </div>
              );
            })}
          </div>

          <hr className="border-meti-line" />

          {/* 생각하는 힘 넷 */}
          <div className="flex flex-col gap-2.5">
            <p className="text-[14px] leading-5 font-semibold text-text-primary">생각하는 힘</p>
            {ABILITIES.map(({ key, label }) => {
              const now = current.abilities[key].stage;
              const before = previous?.abilities[key].stage ?? null;
              return (
                <div key={key} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[14px] leading-5 text-text-primary">{label}</span>
                    <Stage stage={now} />
                  </div>
                  <span className={`text-[12px] leading-[18px] ${now !== null && before !== null && now > before ? 'text-button-primary' : 'text-text-secondary'}`}>
                    {trend(now, before)}
                  </span>
                </div>
              );
            })}
          </div>

          <hr className="border-meti-line" />

          {/* 스스로 고침 · 혼자 해낸 정도 · 문제 수준 */}
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[14px] leading-5">
            <dt className="text-text-secondary">스스로 고친 미션</dt>
            <dd className="text-text-primary">
              {current.selfCorrected}개
              {previous !== undefined && <span className="text-text-secondary"> (지난주 {previous.selfCorrected}개)</span>}
            </dd>

            <dt className="text-text-secondary">혼자 해낸 정도</dt>
            <dd className="text-text-primary">
              {current.support === null ? '아직 기록이 적어요' : supportWords(current.support)}
              {current.support !== null && previous?.support != null && current.support < previous.support && (
                <span className="text-button-primary"> · 지난주보다 도움이 줄었어요</span>
              )}
            </dd>

            <dt className="text-text-secondary">문제 수준</dt>
            <dd className="text-text-primary">
              {current.level === null ? '—' : `${current.level.grade}학년 레벨 ${current.level.difficulty}`}
              {current.level !== null && previous?.level != null &&
                (previous.level.grade !== current.level.grade || previous.level.difficulty !== current.level.difficulty) && (
                  <span className="text-text-secondary">
                    {' '}
                    (지난주 {previous.level.grade}학년 레벨 {previous.level.difficulty})
                  </span>
                )}
            </dd>
          </dl>
        </>
      )}
    </section>
  );
}
