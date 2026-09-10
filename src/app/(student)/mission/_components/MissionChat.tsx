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
  /**
   * 사진을 올릴 수 있는 때.
   *
   * 푸는 중인 문제가 없으면 언제든 된다 — 파트너가 모드를 묻고 있어도,
   * 문제를 적으라고 했어도, 잘못 읽은 것을 다시 찍을 때도.
   */
  const canSendPhoto = problemText === null && !finished;
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
        <div className="shrink-0 border-b border-meti-bg bg-white px-5 py-3.5 shadow-[0_2px_8px_rgba(18,52,59,.05)]">
          <p className="text-[11px] font-extrabold tracking-wide text-meti">오늘의 문제</p>
          <p className="mt-1 text-[14px] font-semibold leading-relaxed text-meti-ink">
            {problemText}
          </p>
          {!finished && (
            <p className="mt-1.5 text-[11px] font-semibold text-meti-sub">
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
            <div key={index} className="flex items-end gap-2">
              <span className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white shadow-sm">
                <PartnerFace persona={persona} size={26} />
              </span>
              <p className="max-w-[78%] whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-white px-3.5 py-2.5 text-[14px] leading-relaxed text-meti-ink shadow-[0_2px_8px_rgba(18,52,59,.06)]">
                {turn.text}
              </p>
            </div>
          ) : (
            <p
              key={index}
              className="max-w-[78%] self-end whitespace-pre-wrap rounded-2xl rounded-br-sm bg-meti px-3.5 py-2.5 text-[14px] leading-relaxed text-white shadow-sm"
            >
              {turn.text}
            </p>
          ),
        )}

        {pending && (
          <div className="flex items-end gap-2">
            <span className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white shadow-sm">
              <PartnerFace persona={persona} size={26} />
            </span>
            <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm bg-white px-3.5 py-3 shadow-[0_2px_8px_rgba(18,52,59,.06)]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-meti-sub" />
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-meti-sub [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-meti-sub [animation-delay:300ms]" />
            </div>
          </div>
        )}

        <div ref={bottom} />
      </div>

      <div className="flex flex-col gap-2.5 border-t border-black/5 bg-white px-4 py-3.5">
        {choices.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {choices.map((choice) => (
              <button
                key={choice.value + choice.label}
                type="button"
                onClick={() => say(labelOf(choice, partner), choice.label)}
                disabled={pending}
                className="min-h-11 rounded-full border-[1.5px] border-meti/40 bg-white px-4 py-2.5 text-[13px] font-bold text-meti transition-colors active:bg-meti-bg/50 disabled:opacity-50"
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
            className="min-h-11 self-start rounded-full border-[1.5px] border-[#F0C36A] bg-[#FFF7E0] px-4 py-2.5 text-[13px] font-bold text-[#8A6100] transition-colors active:bg-[#FCEBB8]"
          >
            💡 힌트 주세요
          </button>
        )}

        {finished ? (
          <div className="flex flex-col gap-2">
            {sessionDone ? (
              <div className="flex flex-col items-center gap-2.5 rounded-3xl bg-white px-5 py-5 text-center shadow-[0_4px_16px_rgba(18,52,59,.1)]">
                <PartnerFace persona={persona} size={72} />
                <p className="text-[14px] font-extrabold text-meti-ink">
                  오늘 미션 끝! 정말 잘했어
                </p>
                <a
                  href="/home/today"
                  className="mt-1 w-full rounded-xl bg-meti py-3 text-center text-[14px] font-bold text-white"
                >
                  오늘의 기록 보기
                </a>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => void openProblem()}
                disabled={pending}
                className="rounded-xl bg-meti py-3 text-[14px] font-bold text-white shadow-sm disabled:opacity-40"
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
            {/*
              **문제를 푸는 중에는 숨긴다.** 그때 올린 사진은 새 문제인데
              지금 문제가 아직 안 끝나서, 어느 쪽을 말하는지 아이도 AI 도
              알 수 없다. 문제가 없을 때는 언제든 올릴 수 있다 — 파트너가
              무엇을 물었든 사진부터 내밀어도 된다.
            */}
            {canSendPhoto && (
              <label
                aria-label="사진으로 문제 올리기"
                className={`flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border-[1.5px] border-meti/40 bg-white text-[18px] transition-colors ${
                  pending ? 'pointer-events-none opacity-40' : 'active:bg-meti-bg/50'
                }`}
              >
                📷
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic"
                  // 휴대폰에서는 카메라가 바로 열린다
                  capture="environment"
                  disabled={pending}
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    // 같은 사진을 다시 골라도 onChange 가 오게 비운다
                    event.target.value = '';
                    if (file !== undefined) void sendPhoto(file);
                  }}
                />
              </label>
            )}

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
              className="h-11 min-w-0 flex-1 rounded-full border-[1.5px] border-black/10 bg-[#F7FAFB] px-4 text-[14px] outline-none focus:border-meti disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={inputBlocked || draft.trim() === ''}
              className="h-11 shrink-0 rounded-full bg-meti px-4 text-[14px] font-bold text-white shadow-sm disabled:opacity-40"
            >
              보내기
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
