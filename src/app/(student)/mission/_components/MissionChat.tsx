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
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { learningModeLabel, term } from '@/lib/constants/copy';
import { BrandButton } from '@/components/ui/BrandButton';
import { PartnerFace } from '@/components/ui/PartnerFace';
import { PhotoSheet } from './PhotoSheet';
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
  /**
   * 지난 미션을 이어 하는 중이면 「9월 29일」. 오늘 미션이면 `null`.
   * 다 끝낸 뒤 「오늘의 기록」 대신 홈으로 보낸다 — 지난 미션은 오늘의 기록 ·
   * 도장 · 코인에 들어가지 않는다(COM-001 §11-2).
   */
  pastLabel?: string | null;
};

export function MissionChat({ partner, persona, initial, pastLabel = null }: Props) {
  const router = useRouter();
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
   *
   * **문제를 마친 뒤에도 된다.** 처음엔 `!finished` 로 막아 뒀는데, 거기가
   * 바로 다음 문제를 가져오고 싶은 자리다. 「한 문제 더 하기」는 AI 가 내는
   * 쪽으로만 가서, 내 문제를 가져올 길이 없었다.
   */
  const canSendPhoto = !sessionDone && (problemText === null || finished);
  /** 사진 출처를 고르는 바텀시트 */
  const [sheetOpen, setSheetOpen] = useState(false);
  /** 고정 문제 카드를 펼쳤는지. 접혀 있으면 한 줄만 보인다 */
  const [problemOpen, setProblemOpen] = useState(false);
  /**
   * 힌트로 받은 말. 말풍선 대신 힌트 카드(Figma `Chat / Hint Card`)로 그린다.
   * 새로고침하면 보통 말풍선으로 돌아간다 — `message` 에 구분이 없어서다.
   */
  const hintTurns = useRef(new WeakSet<Turn>());
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

  /**
   * 말이 늘 때만이 아니라 **대화창이 줄어들 때도** 맨 아래로 내린다.
   * 보기 영역이 새로 생기거나 문제 카드를 펼치면 창이 작아지는데, 그때
   * 다시 내리지 않으면 방금 온 말이 창 아래에 숨는다 — 새 문제의 첫 인사가
   * 안 보이던 이유다.
   */
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns, pending, choices, problemOpen, finished]);

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

  /**
   * MODE B · 글로 적어서 가져온다.
   *
   * 사진과 같은 자리로 들어간다 — 마친 상태를 풀고, 문제를 적으라고 한다.
   * 아이가 적은 글은 `say` 가 `readSource` 로 보낸다.
   */
  function bringOwn() {
    setFinished(false);
    setProblemText(null);
    setProblemOpen(false);
    setChoices([]);
    setFromPhoto(false);
    setSourceStage('ask');
    addAi('어떤 문제를 가져왔어? 문제를 그대로 적어줘.');
  }

  /** MODE B · 사진으로 가져온다 */
  async function sendPhoto(file: File) {
    setPending(true);
    setChoices([]);
    // 마친 뒤에 올렸다면 새 문제를 가져오는 것이다. 마침 상태를 푼다.
    setFinished(false);
    setProblemText(null);
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
    if (reply.ok) {
      // 힌트 카드로 그리려고 표시만 해 둔다. 대화 내용은 그대로다
      const turn: Turn = { who: 'ai', text: reply.message };
      hintTurns.current.add(turn);
      setTurns((now) => [...now, turn]);
    } else {
      addAi(reply.message);
    }
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

    // 머리글의 「오늘의 미션 · n / 10」 은 서버가 그린다. 문제를 마쳤으면
    // 새로 받아 온다. 이 컴포넌트는 그대로 남으므로 대화는 사라지지 않는다.
    //
    // **마지막 문제는 받아 오지 않는다.** 미션 화면은 다 끝낸 세션이면 오늘의
    // 기록으로 보내므로, 받아 오는 순간 「오늘 미션 끝!」 을 보기도 전에 넘어간다.
    if (reply.finished && !reply.sessionFinished) router.refresh();
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
  const showHint = problemText !== null && !finished && !pending;

  /** Figma `Mission / Reflection Choice` · 44px · r12 · 14/20 SemiBold */
  const chip =
    'flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-meti-line bg-surface-primary px-3 py-3 text-[14px] font-semibold leading-5 text-text-primary transition-colors hover:border-button-primary active:border-button-primary active:bg-surface-brand active:text-button-primary disabled:bg-disabled-bg disabled:text-disabled-text';

  /** 사진 올리기. 누르면 카메라 · 앨범을 고르는 시트가 열린다 */
  function photoButton(shape: 'icon' | 'wide') {
    if (shape === 'icon') {
      return (
        <button
          type="button"
          aria-label="사진으로 문제 올리기"
          onClick={() => setSheetOpen(true)}
          disabled={pending}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-meti-line bg-background-primary transition-colors hover:bg-surface-brand disabled:opacity-40"
        >
          <Image src="/icons/camera.svg" alt="" width={24} height={24} />
        </button>
      );
    }
    return (
      <BrandButton type="button" tone="neutral" disabled={pending} onClick={() => setSheetOpen(true)}>
        <Image src="/icons/camera.svg" alt="" width={24} height={24} />
        사진으로 가져오기
      </BrandButton>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {problemText !== null && (
        // Figma `미션 고정 영역` · 대화가 길어져도 문제는 늘 보인다(COM-003 §4.3)
        <div className="shrink-0 bg-surface-primary px-5 py-2">
          <div className="flex min-h-[52px] items-center justify-between gap-3 rounded-xl border border-meti-line bg-background-primary px-4 py-3">
            <p
              className={`min-w-0 flex-1 whitespace-pre-wrap text-[16px] font-semibold leading-6 text-text-primary ${
                problemOpen ? '' : 'line-clamp-1'
              }`}
            >
              {problemText}
            </p>
            <button
              type="button"
              onClick={() => setProblemOpen((now) => !now)}
              aria-expanded={problemOpen}
              className="shrink-0 self-start py-[3px] text-[12px] leading-[18px] text-text-secondary"
            >
              {problemOpen ? '접기' : '미션 보기'}
            </button>
          </div>
          {!finished && (
            <p className="mt-1.5 px-1 text-[12px] leading-[18px] text-meti-hint">
              {turnsLeft}번 더 말할 수 있어
            </p>
          )}
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-5">
        {/* 말이 적을 때는 입력창 쪽(아래)에 붙인다. Figma `대화` 가 아래 정렬이다 */}
        <div className="mt-auto flex flex-col gap-3.5">
          {turns.map((turn, index) => {
            if (turn.who === 'student') {
              return (
                <p
                  key={index}
                  className="max-w-[78%] self-end whitespace-pre-wrap rounded-2xl bg-button-primary px-4 py-3 text-[16px] leading-6 text-white"
                >
                  {turn.text}
                </p>
              );
            }
            // 파트너가 잇달아 말하면 얼굴은 첫 말풍선에만 붙인다
            const grouped = index > 0 && turns[index - 1].who === 'ai';
            const isHint = hintTurns.current.has(turn);
            return (
              <div key={index} className={`flex items-start gap-2 ${grouped ? '-mt-1.5' : ''}`}>
                <span className="h-8 w-8 shrink-0">
                  {!grouped && <PartnerFace persona={persona} size={32} />}
                </span>
                {isHint ? (
                  <div className="flex min-w-0 flex-1 flex-col gap-2 rounded-2xl border border-button-primary bg-surface-primary px-4 py-3.5">
                    <p className="flex items-center gap-1.5 text-[14px] font-semibold leading-5 text-button-primary">
                      <Image src="/icons/hint.png" alt="" width={24} height={24} />
                      힌트
                    </p>
                    <p className="whitespace-pre-wrap text-[16px] leading-6 text-text-primary">
                      {turn.text}
                    </p>
                  </div>
                ) : (
                  <p className="max-w-[calc(100%-40px)] whitespace-pre-wrap rounded-2xl bg-surface-brand px-4 py-3 text-[16px] leading-6 text-text-primary">
                    {turn.text}
                  </p>
                )}
              </div>
            );
          })}

          {pending && (
            // Figma `메티 응답 생성 중 / 2개 말풍선`
            <div className="flex items-start gap-2" role="status">
              <span className="h-8 w-8 shrink-0">
                {(turns.length === 0 || turns[turns.length - 1].who !== 'ai') && (
                  <PartnerFace persona={persona} size={32} />
                )}
              </span>
              <div className="flex flex-col items-start gap-1.5">
                <p className="rounded-2xl bg-surface-brand px-4 py-2.5 text-[16px] leading-6 text-text-primary">
                  잠깐만, 생각해 볼게
                </p>
                <span
                  aria-hidden
                  className="flex h-10 items-center gap-1.5 rounded-2xl bg-surface-brand px-3.5"
                >
                  <span className="h-[7px] w-[7px] animate-bounce rounded-full bg-button-primary/40" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-button-primary/70 [animation-delay:240ms]" />
                  <span className="h-[9px] w-[9px] animate-bounce rounded-full bg-button-primary [animation-delay:480ms]" />
                </span>
              </div>
            </div>
          )}
        </div>

        <div ref={bottom} />
      </div>

      <div className="flex shrink-0 flex-col border-t border-meti-line bg-surface-primary pb-[calc(12px+env(safe-area-inset-bottom))]">
        {(choices.length > 0 || showHint) && (
          // Figma `예시 답변 영역`
          <div className="flex flex-col gap-2 bg-background-primary px-5 py-3">
            {choices.length > 0 && (
              <div className="flex flex-col gap-0.5">
                <p className="text-[12px] leading-[18px] text-text-secondary">이렇게 말해 볼까?</p>
                {!inputBlocked && (
                  <p className="text-[12px] leading-[18px] text-text-secondary opacity-70">
                    눌러서 보내거나 직접 말해도 돼
                  </p>
                )}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {choices.map((choice) => (
                <button
                  key={choice.value + choice.label}
                  type="button"
                  onClick={() => say(labelOf(choice, partner), choice.label)}
                  disabled={pending}
                  className={chip}
                >
                  {labelOf(choice, partner)}
                </button>
              ))}
              {showHint && (
                <button type="button" onClick={() => void hint()} className={chip}>
                  <Image src="/icons/hint.png" alt="" width={20} height={20} />
                  힌트 주세요
                </button>
              )}
            </div>
          </div>
        )}

        {finished ? (
          <div className="flex flex-col gap-3 px-5 pt-3">
            {sessionDone && pastLabel !== null ? (
              <>
                <p className="text-center text-[16px] font-semibold leading-6 text-text-primary">
                  {pastLabel} 미션 끝! 정말 잘했어
                </p>
                <a
                  href="/home"
                  className="flex h-[52px] w-full items-center justify-center rounded-lg bg-button-primary text-[16px] font-semibold leading-6 text-white transition-colors hover:bg-button-hover active:bg-button-pressed"
                >
                  홈으로
                </a>
              </>
            ) : sessionDone ? (
              <>
                <p className="text-center text-[16px] font-semibold leading-6 text-text-primary">
                  오늘 미션 끝! 정말 잘했어
                </p>
                <a
                  href="/home/today"
                  className="flex h-[52px] w-full items-center justify-center rounded-lg bg-button-primary text-[16px] font-semibold leading-6 text-white transition-colors hover:bg-button-hover active:bg-button-pressed"
                >
                  {term('learningResult', 'student')} 보기
                </a>
              </>
            ) : (
              <>
                <BrandButton type="button" pending={pending} onClick={() => void openProblem()}>
                  {term('nextProblem', 'student')}
                </BrandButton>
                {/*
                  「다음 미션」은 파트너가 내는 쪽이다. 내 문제를
                  가져오는 길이 여기 없으면, 아이는 다음 문제를 고를 수
                  없다. 사진과 글 두 길을 둔다(COM-001 §5 · 직접 입력 · 사진 촬영).
                  「어느 방식으로 할래?」 를 묻는 대신 가져오는 행동 자체가
                  선택이 된다(§6.3).
                */}
                {canSendPhoto && (
                  <div className="grid grid-cols-2 gap-2">
                    {photoButton('wide')}
                    <BrandButton type="button" tone="neutral" disabled={pending} onClick={bringOwn}>
                      내 문제 적기
                    </BrandButton>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              say(draft);
            }}
            className="flex items-center gap-2 px-5 pt-3"
          >
            {/*
              **문제를 푸는 중에는 숨긴다.** 그때 올린 사진은 새 문제인데
              지금 문제가 아직 안 끝나서, 어느 쪽을 말하는지 아이도 AI 도
              알 수 없다. 학습 대화에는 풀이 사진을 받지 않는다(COM-001 §6.4).
              문제가 없을 때는 언제든 올릴 수 있다.
            */}
            {canSendPhoto && photoButton('icon')}

            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              disabled={inputBlocked}
              placeholder={
                pending
                  ? `${partner}가 답을 만들고 있어`
                  : sourceStage === 'ask'
                    ? '문제를 그대로 적어줘'
                    : sourceStage === 'confirm'
                      ? '맞으면 "응", 아니면 고쳐서 적어줘'
                      : '내 생각을 써 볼까?'
              }
              className="h-[54px] min-w-0 flex-1 rounded-xl border border-meti-line bg-background-primary px-4 text-[16px] leading-6 text-text-primary outline-none placeholder:text-meti-hint focus:border-button-primary disabled:opacity-55"
            />
            <button
              type="submit"
              aria-label="보내기"
              disabled={inputBlocked || draft.trim() === ''}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-button-primary transition-colors hover:bg-button-hover active:bg-button-pressed disabled:bg-disabled-bg"
            >
              <Image src="/icons/send.svg" alt="" width={24} height={24} />
            </button>
          </form>
        )}
      </div>

      {sheetOpen && (
        <PhotoSheet
          onClose={() => setSheetOpen(false)}
          onPick={(file) => {
            setSheetOpen(false);
            void sendPhoto(file);
          }}
        />
      )}
    </div>
  );
}

