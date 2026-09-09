'use client';

/**
 * 프로토타입(METI)의 세션 화면. 말풍선 · 보기 · 입력창.
 *
 * 두 마당이 이어진다.
 *
 *   호스트   01 이 "어떻게 할까?" 를 묻고 학생이 고른다
 *   문제     02 가 문제를 내고 5턴 안에서 함께 푼다
 *
 * **보기는 우리가 지어내지 않는다.** 01 · 02 가 내놓는 것을 그대로 그린다.
 * 모델이 낸 보기를 화면이 안 그리면 학생은 무엇을 고를 수 있는지 알 수가
 * 없다.
 */

import { useEffect, useRef, useState } from 'react';
import { learningModeLabel } from '@/lib/constants/copy';
import {
  answerProblem,
  startProblem,
  talkToHost,
  type Choice,
  type Turn,
} from '../_actions';

/**
 * 보기에 적을 말.
 *
 * 01 이 내놓는 이름은 프롬프트의 말투다 — "AI가 문제 내기". 학생 화면의
 * 이름은 `copy.ts` 한 곳에서 정한다(CLAUDE.md 「용어」).
 *
 * **모델에게 되돌려 보내는 말은 바꾸지 않는다.** 01 은 자기가 낸 보기의
 * 말로 학생의 선택을 읽는다.
 */
function labelOf(choice: Choice, partner: string): string {
  if (choice.value === 'A') return learningModeLabel('mode_a', 'student', partner);
  if (choice.value === 'B') return learningModeLabel('mode_b', 'student', partner);
  return choice.label;
}

export type Initial =
  | { kind: 'host' }
  | { kind: 'problem'; problemText: string; turns: Turn[]; turnsLeft: number };

type Props = { partner: string; initial: Initial };

export function MissionChat({ partner, initial }: Props) {
  const [turns, setTurns] = useState<Turn[]>(
    initial.kind === 'problem' ? initial.turns : [],
  );
  const [choices, setChoices] = useState<Choice[]>([]);
  const [pending, setPending] = useState(initial.kind === 'host');
  const [problemText, setProblemText] = useState<string | null>(
    initial.kind === 'problem' ? initial.problemText : null,
  );
  const [turnsLeft, setTurnsLeft] = useState(
    initial.kind === 'problem' ? initial.turnsLeft : 0,
  );
  const [freeText, setFreeText] = useState(true);
  const [finished, setFinished] = useState(false);
  const [sessionDone, setSessionDone] = useState(false);
  /** 아직 못 만든 길로 들어갔을 때. 지금은 MODE B */
  const [notYet, setNotYet] = useState(false);
  const [draft, setDraft] = useState('');
  const opened = useRef(false);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (opened.current || initial.kind !== 'host') return;
    opened.current = true;
    void hostSays(null, []);
    // 처음 한 번만 연다. StrictMode 가 두 번 부르므로 ref 로 막는다.
    // hostSays 는 매 렌더 새로 만들어지므로 의존성에 넣지 않는다 — 넣으면
    // 렌더마다 01 을 다시 부른다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial.kind]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns, pending]);

  function addAi(text: string) {
    setTurns((now) => [...now, { who: 'ai', text }]);
  }

  async function hostSays(text: string | null, prior: Turn[]) {
    setPending(true);
    setChoices([]);

    const reply = await talkToHost(text, prior);
    if (!reply.ok) {
      addAi(reply.message);
      setPending(false);
      return;
    }

    addAi(reply.message);

    if (reply.nextModule === 'MODE_A') {
      await openProblem();
      return;
    }
    if (reply.nextModule === 'MODE_B') {
      // 학생이 고른 쪽을 우리가 몰래 바꾸지 않는다. 아직 없다고 말한다.
      setNotYet(true);
      setChoices([]);
      setPending(false);
      return;
    }

    setChoices(reply.choices);
    setPending(false);
  }

  async function openProblem() {
    setPending(true);
    setNotYet(false);

    const reply = await startProblem();
    if (!reply.ok) {
      addAi(reply.message);
      setPending(false);
      return;
    }

    setProblemText(reply.problemText);
    addAi(reply.message === '' ? reply.problemText : reply.message);
    setChoices(reply.choices);
    setFreeText(reply.allowFreeText);
    setTurnsLeft(reply.turnsLeft);
    setFinished(false);
    setPending(false);
  }

  async function answer(text: string) {
    setPending(true);
    setChoices([]);

    const reply = await answerProblem(text);
    if (!reply.ok) {
      addAi(reply.message);
      setPending(false);
      return;
    }

    addAi(reply.message);
    setChoices(reply.choices);
    setFreeText(reply.allowFreeText);
    setTurnsLeft(reply.turnsLeft);
    setFinished(reply.finished);
    setSessionDone(reply.sessionFinished);
    setPending(false);
  }

  /** `shown` 은 말풍선에 남는 말, `sent` 는 모델에게 가는 말이다 */
  function say(shown: string, sent: string = shown) {
    const trimmed = shown.trim();
    if (trimmed === '' || pending) return;

    const next: Turn[] = [...turns, { who: 'student', text: trimmed }];
    setTurns(next);
    setDraft('');

    if (problemText === null) void hostSays(sent.trim(), next);
    else void answer(sent.trim());
  }

  const inputBlocked = pending || finished || notYet || !freeText;

  return (
    <div className="flex flex-1 flex-col">
      {problemText !== null && (
        <div className="border-b border-black/5 bg-white px-5 py-3">
          <p className="text-[11px] font-bold text-meti-sub">오늘의 문제</p>
          <p className="mt-1 text-[14px] font-semibold leading-relaxed text-meti-ink">
            {problemText}
          </p>
          {!finished && (
            <p className="mt-1.5 text-[11px] text-meti-sub">
              {turnsLeft}번 더 말할 수 있어
            </p>
          )}
        </div>
      )}

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 py-5">
        <p className="self-center rounded-full bg-white/70 px-3 py-1 text-[11px] font-semibold text-meti-sub">
          오늘 · 생각 대화 시작
        </p>

        {turns.map((turn, index) =>
          turn.who === 'ai' ? (
            <div key={index} className="flex items-start gap-2">
              <span
                aria-hidden
                className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-sm shadow-sm"
              >
                🐣
              </span>
              <p className="max-w-[78%] whitespace-pre-wrap rounded-2xl rounded-tl-sm bg-white px-3.5 py-2.5 text-[14px] leading-relaxed text-meti-ink shadow-sm">
                {turn.text}
              </p>
            </div>
          ) : (
            <p
              key={index}
              className="max-w-[78%] self-end whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-meti px-3.5 py-2.5 text-[14px] leading-relaxed text-white"
            >
              {turn.text}
            </p>
          ),
        )}

        {pending && (
          <p className="ml-9 text-[13px] text-meti-sub">{partner}가 생각하는 중…</p>
        )}

        {notYet && (
          <div className="flex flex-col gap-2 rounded-2xl border border-dashed border-meti/40 px-4 py-3 text-center">
            <p className="text-[12px] leading-relaxed text-meti-sub">
              네가 문제를 가져오는 방식은 아직 준비 중이야.
            </p>
            <button
              type="button"
              onClick={() => void openProblem()}
              className="rounded-xl bg-meti py-2.5 text-[13px] font-bold text-white"
            >
              {partner}가 문제 내기로 할래
            </button>
          </div>
        )}

        <div ref={bottom} />
      </div>

      <div className="flex flex-col gap-2 border-t border-black/5 bg-white/60 px-5 py-4">
        {choices.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {choices.map((choice) => (
              <button
                key={choice.value + choice.label}
                type="button"
                onClick={() => say(labelOf(choice, partner), choice.label)}
                disabled={pending}
                className="rounded-full border border-meti/40 bg-white px-3.5 py-2 text-[13px] font-semibold text-meti disabled:opacity-50"
              >
                {labelOf(choice, partner)}
              </button>
            ))}
          </div>
        )}

        {finished ? (
          <div className="flex flex-col gap-2">
            {sessionDone ? (
              <>
                <p className="text-center text-[13px] font-bold text-meti-ink">
                  오늘 미션 끝! 정말 잘했어
                </p>
                <a
                  href="/home"
                  className="rounded-xl bg-meti py-3 text-center text-[14px] font-bold text-white"
                >
                  홈으로 가기
                </a>
              </>
            ) : (
              <button
                type="button"
                onClick={() => void openProblem()}
                disabled={pending}
                className="rounded-xl bg-meti py-3 text-[14px] font-bold text-white disabled:opacity-40"
              >
                한 문제 더 하기
              </button>
            )}
          </div>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              say(draft);
            }}
            className="flex items-center gap-2"
          >
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              disabled={inputBlocked}
              placeholder="내 생각을 써볼까?"
              className="flex-1 rounded-full border border-black/10 bg-white px-4 py-2.5 text-[14px] outline-none focus:border-meti disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={inputBlocked || draft.trim() === ''}
              className="rounded-full bg-meti px-4 py-2.5 text-[14px] font-bold text-white disabled:opacity-40"
            >
              보내기
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
