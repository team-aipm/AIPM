'use client';

/**
 * 랩이 앉을 자리를 고르는 판.
 *
 * 앉으면 **제품 액션이 그 학생에게 쓴다.** 프롬프트만 돌리던 것과 달리
 * `lib/services/*` 가 전부 실행된다 — 난이도 판정 · 기억 갱신 · 평가
 * 저장이 제품과 같은 길로 간다.
 *
 * 화면이 작다. 랩의 본체는 아래 프롬프트 판이고 이건 그 앞에 놓는 준비물
 * 이다. 자리에 앉았는지, 지금 몇 수준인지만 보이면 된다.
 */

import { useEffect, useState, useTransition } from 'react';

import { leaveSeat, seatState, setSeatLevel, takeSeat, type SeatState } from '../_seat-actions';

const CREATE_SQL = `-- 테스트 학생 심기. 운영자 계정 아래에 둔다.
-- account_id 는 운영자 자신의 것을 쓴다 (admin_user.admin_id 와 같다).
insert into public.student
  (account_id, student_name, nickname, birth_date, grade, persona_type,
   current_difficulty, student_status)
values
  ('<운영자 account_id>', '랩테스트', '랩테스트', '2015-03-01', 5, 'friend',
   3, 'test');`;

export function LabSeat() {
  const [state, setState] = useState<SeatState | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [pick, setPick] = useState('');
  const [pending, start] = useTransition();

  const reload = () => {
    void seatState().then(setState);
  };

  useEffect(reload, []);

  const act = (run: () => Promise<{ ok: boolean; message: string } | void>) => {
    start(async () => {
      const result = await run();
      setNote(result === undefined ? null : result.message);
      reload();
    });
  };

  if (state === null) {
    return <p className="px-4 py-3 text-sm text-neutral-500">자리를 확인하는 중…</p>;
  }

  const seated = state.seated;

  return (
    <section className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-semibold text-neutral-700">테스트 학생 자리</span>

        {seated === null ? (
          <>
            <select
              value={pick}
              onChange={(event) => setPick(event.target.value)}
              className="rounded border border-neutral-300 px-2 py-1"
            >
              <option value="">고르기…</option>
              {state.candidates.map((candidate) => (
                <option key={candidate.studentId} value={candidate.studentId}>
                  {candidate.nickname} · {candidate.grade}학년
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={pick === '' || pending}
              onClick={() => act(() => takeSeat(pick))}
              className="rounded bg-neutral-800 px-3 py-1 text-white disabled:opacity-40"
            >
              앉기
            </button>
          </>
        ) : (
          <>
            <span className="rounded bg-neutral-800 px-2 py-1 text-white">
              {seated.nickname} · {seated.grade}학년
            </span>
            <span className="text-neutral-600">
              난이도 <strong>{seated.difficulty}</strong> · 요즘수준{' '}
              <strong>{seated.level ?? '—'}</strong> · 오늘 {seated.completed}/{seated.target}문제
            </span>

            <span className="flex items-center gap-1">
              <span className="text-neutral-500">수준 심기</span>
              {[1, 2, 3, 4, 5].map((level) => (
                <button
                  key={level}
                  type="button"
                  disabled={pending}
                  onClick={() => act(() => setSeatLevel(level))}
                  className={`w-7 rounded border px-0 py-1 ${
                    seated.difficulty === level
                      ? 'border-neutral-800 bg-neutral-800 text-white'
                      : 'border-neutral-300 bg-white text-neutral-700'
                  } disabled:opacity-40`}
                >
                  {level}
                </button>
              ))}
            </span>

            <button
              type="button"
              disabled={pending}
              onClick={() => act(async () => void (await leaveSeat()))}
              className="rounded border border-neutral-300 bg-white px-3 py-1 disabled:opacity-40"
            >
              일어나기
            </button>
          </>
        )}
      </div>

      {note !== null && <p className="mt-2 text-neutral-600">{note}</p>}

      {state.candidates.length === 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-neutral-500">
            앉을 학생이 없다 — SQL 로 심는다
          </summary>
          <p className="mt-2 text-neutral-600">
            계정을 만드는 길을 화면에 두지 않는다. `admin_user` 를 SQL 로만 추가하는 것과 같은
            이유다. 아래를 Supabase SQL Editor 에서 돌린다.
          </p>
          <pre className="mt-2 overflow-x-auto rounded bg-neutral-900 p-3 text-xs text-neutral-100">
            {CREATE_SQL}
          </pre>
        </details>
      )}

      {seated !== null && (
        <p className="mt-2 text-xs text-neutral-500">
          앉아 있는 동안 <strong>제품 액션이 이 학생에게 쓴다.</strong> 세션 · 문제 · 대화 · 평가 ·
          난이도 · 기억이 실제로 남는다. 집계와 주간 리포트 배치는 `test` 상태를 세지 않는다
          (COM-002 §4).
        </p>
      )}
    </section>
  );
}
