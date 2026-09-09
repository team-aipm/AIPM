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
import type { Database } from '@/types/database';
import { learningModeLabel } from '@/lib/constants/copy';
import { PartnerFace } from '@/components/ui/PartnerFace';
import {
  answerProblem,
  confirmSourceProblem,
  askHint,
  offerSourceProblem,
  readPhotoProblem,
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

/** 한 문제에서 학생이 말할 수 있는 횟수. 서버(_actions)와 같은 값이다 */
const TURN_LIMIT = 5;

type Props = {
  partner: string;
  persona: Database['public']['Enums']['persona_type'];
  initial: Initial;
};

export function MissionChat({ partner, persona, initial }: Props) {
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
  /**
   * MODE B 의 앞마당.
   *
   *   ask      "어떤 문제 가져왔어?" 를 기다린다
   *   confirm  "이렇게 읽었는데 맞아?" 를 기다린다
   */
  const [sourceStage, setSourceStage] = useState<'ask' | 'confirm' | null>(null);
  const [recognized, setRecognized] = useState('');
  /** 사진으로 가져왔는지. problem_source 에 그대로 들어간다 */
  const [fromPhoto, setFromPhoto] = useState(false);
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
      // 학생이 문제를 가져오는 차례다. 글로 받는다 — 사진은 다음이다.
      setSourceStage('ask');
      setFromPhoto(false);
      addAi('어떤 문제를 가져왔어? 사진으로 올려도 되고 직접 써도 돼.');
      setChoices([]);
      setPending(false);
      return;
    }

    setChoices(reply.choices);
    setPending(false);
  }

  async function openProblem() {
    setPending(true);
    setSourceStage(null);

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

  /** MODE B · 학생이 적은 문제를 읽는다 */
  async function readSource(text: string) {
    setPending(true);
    setChoices([]);

    const reply = await offerSourceProblem(text);
    if (!reply.ok) {
      addAi(reply.message);
      setPending(false);
      return;
    }

    if (reply.kind === 'confirm') {
      setRecognized(reply.recognized);
      setSourceStage('confirm');
      addAi(reply.message === '' ? `이렇게 읽었어.

${reply.recognized}

맞아?` : reply.message);
      setChoices(reply.choices);
      setPending(false);
    }
  }

  /** MODE B · 사진으로 가져온다 */
  async function sendPhoto(file: File) {
    setPending(true);
    setChoices([]);
    setTurns((now) => [...now, { who: 'student', text: '(사진을 보냈어)' }]);

    const form = new FormData();
    form.append('photo', file);
    const reply = await readPhotoProblem(form);

    if (!reply.ok) {
      addAi(reply.message);
      setPending(false);
      return;
    }

    if (reply.kind === 'confirm') {
      setRecognized(reply.recognized);
      setFromPhoto(true);
      setSourceStage('confirm');
      addAi(
        reply.message === ''
          ? `이렇게 읽었어.

${reply.recognized}

맞아?`
          : reply.message,
      );
      setChoices(reply.choices);
      setPending(false);
    }
  }

  /** MODE B · 학생이 "맞아" 라고 했다. 여기서 문제가 시작된다 */
  async function startSource(text: string) {
    setPending(true);
    setChoices([]);

    const reply = await confirmSourceProblem(recognized, text, fromPhoto);
    if (!reply.ok) {
      // 정답을 확신하지 못하면 진행하지 않는다. 다시 받는다.
      addAi(reply.message);
      setSourceStage('ask');
      setPending(false);
      return;
    }

    if (reply.kind === 'started') {
      setProblemText(reply.problemText);
      addAi(reply.message);
      setChoices(reply.choices);
      setTurnsLeft(TURN_LIMIT);
      setSourceStage(null);
      setPending(false);
    }
  }

  /**
   * 힌트를 받는다.
   *
   * **턴을 쓰지 않는다.** 힌트는 학생의 발화가 아니라 도움 요청이라,
   * 5턴 한도를 힌트로 깎지 않는다.
   */
  async function hint() {
    setPending(true);
    const reply = await askHint();
    addAi(reply.message);
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

    if (sourceStage === 'ask') void readSource(sent.trim());
    else if (sourceStage === 'confirm') void startSource(sent.trim());
    else if (problemText === null) void hostSays(sent.trim(), next);
    else void answer(sent.trim());
  }

  // MODE B 의 앞마당에서는 학생이 자유롭게 적어야 한다. 보기가 없다.
  const inputBlocked = pending || finished || (sourceStage === null && !freeText);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {problemText !== null && (
        <div className="shrink-0 border-b border-black/5 bg-white px-5 py-3 shadow-sm">
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

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 py-5">
        <p className="self-center rounded-full bg-white/70 px-3 py-1 text-[11px] font-semibold text-meti-sub">
          오늘 · 생각 대화 시작
        </p>

        {turns.map((turn, index) =>
          turn.who === 'ai' ? (
            <div key={index} className="flex items-start gap-2">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white shadow-sm">
                <PartnerFace persona={persona} size={26} />
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

        {problemText !== null && !finished && !pending && (
          <button
            type="button"
            onClick={() => void hint()}
            className="self-start rounded-full border border-meti/40 bg-white px-3.5 py-2 text-[13px] font-semibold text-meti"
          >
            💡 힌트 주세요
          </button>
        )}

        {sourceStage === 'ask' && !pending && (
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-full border border-meti/40 bg-white py-2.5 text-[13px] font-semibold text-meti">
            📷 사진으로 올릴게
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic"
              // 휴대폰에서는 카메라가 바로 열린다
              capture="environment"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file !== undefined) void sendPhoto(file);
              }}
            />
          </label>
        )}

        {finished ? (
          <div className="flex flex-col gap-2">
            {sessionDone ? (
              <>
                <p className="text-center text-[13px] font-bold text-meti-ink">
                  오늘 미션 끝! 정말 잘했어
                </p>
                <a
                  href="/home/today"
                  className="rounded-xl bg-meti py-3 text-center text-[14px] font-bold text-white"
                >
                  오늘의 기록 보기
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
              placeholder={
              sourceStage === 'ask'
                ? '문제를 그대로 적어줘'
                : sourceStage === 'confirm'
                  ? '맞으면 "응", 아니면 고쳐서 적어줘'
                  : '내 생각을 써볼까?'
            }
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
