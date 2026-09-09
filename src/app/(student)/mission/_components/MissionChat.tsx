'use client';

/**
 * 프로토타입(METI)의 세션 화면. 말풍선 · 보기 · 입력창.
 *
 * **보기는 우리가 지어내지 않는다.** 01 이 내놓는 `mode_choices` 를 그대로
 * 그린다. 모델이 낸 보기를 화면이 안 그리면, 학생은 말로만 골라야 하고
 * 그러면 무엇을 고를 수 있는지 알 수가 없다.
 */

import { useEffect, useRef, useState } from 'react';
import { learningModeLabel } from '@/lib/constants/copy';
import { talkToHost, type Choice, type Turn } from '../_actions';

/**
 * 보기에 적을 말.
 *
 * 01 이 내놓는 이름은 프롬프트의 말투다 — "AI가 문제 내기". 학생 화면의
 * 이름은 `copy.ts` 한 곳에서 정한다(CLAUDE.md 「용어」). 파트너 이름도
 * 거기서 따라온다.
 *
 * **모델에게 되돌려 보내는 말은 바꾸지 않는다.** 01 은 자기가 낸 보기의
 * 말로 학생의 선택을 읽는다. 화면 이름을 그대로 보내면 못 알아본다.
 */
function labelOf(choice: Choice, partner: string): string {
  if (choice.value === 'A') return learningModeLabel('mode_a', 'student', partner);
  if (choice.value === 'B') return learningModeLabel('mode_b', 'student', partner);
  return choice.label;
}

type Props = { partner: string };

export function MissionChat({ partner }: Props) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [choices, setChoices] = useState<Choice[]>([]);
  const [pending, setPending] = useState(true);
  const [handoff, setHandoff] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const opened = useRef(false);
  const bottom = useRef<HTMLDivElement>(null);

  /** 첫 말을 받아 온다. StrictMode 가 두 번 부르므로 한 번만 열게 막는다 */
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    void send(null, []);
  }, []);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns, pending]);

  async function send(text: string | null, prior: Turn[]) {
    setPending(true);
    setChoices([]);

    const reply = await talkToHost(text, prior);

    if (!reply.ok) {
      setTurns((now) => [...now, { who: 'ai', text: reply.message }]);
      setPending(false);
      return;
    }

    setTurns((now) => [...now, { who: 'ai', text: reply.message }]);
    setChoices(reply.choices);
    setPending(false);

    // 문제로 넘어가는 자리. 다음 차례에 잇는다.
    if (reply.nextModule === 'MODE_A' || reply.nextModule === 'MODE_B') {
      setHandoff(reply.nextModule);
      setChoices([]);
    }
  }

  /**
   * `shown` 은 말풍선에 남는 말, `sent` 는 모델에게 가는 말이다. 보기를
   * 누를 때만 둘이 다르다.
   */
  function say(shown: string, sent: string = shown) {
    const trimmed = shown.trim();
    if (trimmed === '' || pending) return;
    const next: Turn[] = [...turns, { who: 'student', text: trimmed }];
    setTurns(next);
    setDraft('');
    void send(sent.trim(), next);
  }

  return (
    <div className="flex flex-1 flex-col">
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

        {handoff !== null && (
          <p className="rounded-2xl border border-dashed border-meti/40 px-4 py-3 text-center text-[12px] leading-relaxed text-meti-sub">
            여기서 문제로 넘어가.
            <br />이 부분은 아직 준비 중이야.
          </p>
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
            disabled={pending || handoff !== null}
            placeholder="내 생각을 써볼까?"
            className="flex-1 rounded-full border border-black/10 bg-white px-4 py-2.5 text-[14px] outline-none focus:border-meti disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={pending || draft.trim() === '' || handoff !== null}
            className="rounded-full bg-meti px-4 py-2.5 text-[14px] font-bold text-white disabled:opacity-40"
          >
            보내기
          </button>
        </form>
      </div>
    </div>
  );
}
