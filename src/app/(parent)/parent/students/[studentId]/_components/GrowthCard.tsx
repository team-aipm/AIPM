/**
 * PAR-003 「성장 추이」 · 최근 4주를 주 단위로 비교한다 (COM-003 PAR-003 · 2026-10-02).
 *
 * - 생각하는 힘은 4단계 막대로 보인다. 점수 숫자(0~2)는 보이지 않는다.
 * - 한 주에 3번 이상 관찰돼야 단계를 매긴다. 모자라면 「아직 기록이 적어요」.
 * - 지난주보다 내려가도 「다시 다지는 중」 — 실패처럼 말하지 않는다.
 * - 다른 아이와 비교하지 않는다.
 */

import { ABILITIES, type WeekGrowth } from '@/lib/services/child-progress';
import { MAX_LEVEL } from '@/lib/services/difficulty';

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

/**
 * 학년과 레벨을 한 줄로 세운다. 레벨은 학년 안의 1~5 다(COM-002 §6) —
 * 5학년 레벨 5 다음이 6학년 레벨 1 이다.
 */
const rank = (level: { grade: number; difficulty: number }) => (level.grade - 1) * MAX_LEVEL + level.difficulty;

/**
 * 문제 수준 · 4주 흐름 (COM-003 PAR-003 · v1.6).
 *
 * 내려간 주를 실패처럼 그리지 않는다. 난이도는 서버가 최근 평가로 맞추는
 * 값이라 내려간 것은 「알맞은 수준을 찾는 중」이다. 문제가 없는 주는 비워
 * 둔다 — 앞 주 값을 끌어와 이어 그리면 그 주에도 그 수준이었던 것처럼 보인다.
 */
function LevelTrend({ weeks }: { weeks: WeekGrowth[] }) {
  const seen = weeks.filter((week) => week.level !== null);
  if (seen.length === 0) {
    return (
      <div className="flex flex-col gap-1">
        <p className="text-[14px] leading-5 font-semibold text-text-primary">문제 수준</p>
        <p className="text-[14px] leading-5 text-text-secondary">아직 기록이 적어요</p>
      </div>
    );
  }

  const ranks = seen.map((week) => rank(week.level!));
  const low = Math.min(...ranks);
  const high = Math.max(...ranks);
  const first = seen[0].level!;
  const last = seen.at(-1)!.level!;
  const moved = rank(last) - rank(first);
  const summary =
    seen.length < 2
      ? '다음 주부터 흐름을 보여드려요'
      : moved > 0
        ? '▲ 수준이 올랐어요'
        : moved < 0
          ? '알맞은 수준을 찾는 중이에요'
          : '같은 수준을 다지는 중이에요';

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[14px] leading-5 font-semibold text-text-primary">문제 수준</p>
        <span className={`text-[12px] leading-[18px] ${moved > 0 && seen.length >= 2 ? 'text-button-primary' : 'text-text-secondary'}`}>
          {summary}
        </span>
      </div>
      <div className="flex items-end justify-between gap-2 px-1" aria-label="최근 4주 문제 수준">
        {weeks.map((week, idx) => {
          const isNow = idx === weeks.length - 1;
          // 가장 낮은 주도 막대가 보이게 바닥을 둔다. 다 같으면 모두 가운데 높이다.
          const height =
            week.level === null ? 0 : high === low ? 32 : 12 + Math.round(((rank(week.level) - low) / (high - low)) * 40);
          return (
            <div key={week.monday} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-center text-[12px] leading-[18px] text-text-primary">
                {week.level === null ? '—' : `${week.level.grade}학년`}
                {week.level !== null && (
                  <>
                    <br />
                    레벨 {week.level.difficulty}
                  </>
                )}
              </span>
              <span
                className={`w-full max-w-10 rounded-t-md ${week.level === null ? 'bg-transparent' : isNow ? 'bg-button-primary' : 'bg-surface-brand'}`}
                style={{ height: `${height}px` }}
              />
              <span className="text-[12px] leading-[18px] text-meti-hint">
                {isNow ? '이번 주' : `${Number(week.monday.slice(5, 7))}/${Number(week.monday.slice(8, 10))}`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
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
          </dl>

          <hr className="border-meti-line" />

          <LevelTrend weeks={weeks} />
        </>
      )}
    </section>
  );
}
