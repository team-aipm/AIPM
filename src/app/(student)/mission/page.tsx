'use client';

/**
 * MIS-001 · 미션 진행 (`docs/COM-003-screen-ui.md` §4.3)
 * Route: `/mission` (`docs/DEV-002-routes.md`)
 *
 * COM-003 §5에 따라 "AI 생각 중 / 힌트 / 문제 완료" State는 모두 이 한
 * Route 안에서 흡수한다 (별도 Route로 만들지 않음).
 *
 * `/api/ai/chat` (MODE_A, `lib/ai/drilldown.ts`)와 실제로 대화한다.
 * ⚠️ 이번 연동 범위는 MODE_A(AI가 문제를 낸다) 한 문제 진행뿐이다 —
 * 사진으로 문제 가져오기(MODE_B·OCR)는 아직 안 붙였다. 그래서 caption의
 * "사진으로 올릴게" 같은 옛 목업 문구는 걷어내고, AI가 낸 문제를 카드로
 * 보여주는 흐름으로 바꿨다. persona(friend/villain)는 말투에만 쓴다 —
 * villain이라고 다른 학습 로직(MODE_B)을 타지 않는다 (COM-001 §4).
 *
 * 원칙 준수(COM-003 §4.3):
 * - 정답 보기 버튼 없음 — 정답은 서버가 문제 종료 시점에만 message에 실어 보낸다.
 * - AI 응답 중(=typing) 중복 전송 방지 — 입력/전송 버튼 disabled 처리
 * - Drill-down 단계명은 학생에게 노출하지 않음 (서버 응답에도 없음)
 */

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { CHARACTER_IMG, CHARACTERS, type CharacterId } from '../_lib/mock-data';
import { useStudentState } from '../_lib/use-student-state';

/**
 * ⚠️ 임시 개발용 student_id. STU-002(학생 프로필 선택)가 아직 없어 실제
 * 로그인 세션에서 가져올 방법이 없다 — `aipm-dev` 프로젝트에 이미 있는
 * student 레코드 하나를 그대로 쓴다. STU-002가 생기면 반드시 교체한다.
 */
const DEV_STUDENT_ID = 'bac59a54-1222-4ed1-bb1a-46985f802d7b';

type Choice = { id: string; label: string; value: string };
type ResponseTurn = {
  response_role: 'ANSWER' | 'REASONING' | 'RULE' | 'ERROR_CHECK' | 'RETRY' | null;
  response_type: 'CHOICE' | 'FREE_TEXT' | null;
  choice_id: string | null;
  content: string | null;
};

type Msg =
  | { kind: 'text'; who: 'bot' | 'me'; text: string }
  | { kind: 'problem'; text: string }
  | { kind: 'reward' }
  | { kind: 'error'; text: string };

export default function MissionPage() {
  const router = useRouter();
  const { state, update, hydrated } = useStudentState();
  const mode: CharacterId = state.partner;

  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [choices, setChoices] = useState<Choice[]>([]);
  const [allowFreeText, setAllowFreeText] = useState(true);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState('');
  const [earned, setEarned] = useState(0);
  const [done, setDone] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const startedRef = useRef(false);

  // 서버(EVALUATOR·MODE_A INPUT)에 다시 보내야 하는 대화 상태. 서버는
  // verified_answer 같은 민감한 값을 여기 담아 보내지 않는다.
  const sessionRef = useRef<{
    problemId: string | null;
    responseHistory: ResponseTurn[];
    initialAnswer: string | null;
  }>({ problemId: null, responseHistory: [], initialAnswer: null });

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs, typing, choices.length]);

  async function start() {
    setTyping(true);
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phase: 'start', studentId: DEV_STUDENT_ID }),
      });
      const data = await res.json();
      setTyping(false);
      if (!data.ok) {
        setMsgs((m) => [...m, { kind: 'error', text: data.error ?? '문제를 불러오지 못했어요.' }]);
        return;
      }
      sessionRef.current = { problemId: data.problemId, responseHistory: [], initialAnswer: null };
      setMsgs([
        { kind: 'problem', text: data.ui.problemText },
        { kind: 'text', who: 'bot', text: data.ui.message },
      ]);
      setChoices(data.ui.choices ?? []);
      setAllowFreeText(data.ui.allowFreeText !== false);
    } catch {
      setTyping(false);
      setMsgs((m) => [...m, { kind: 'error', text: '연결이 끊겼어요. 다시 시도해 주세요.' }]);
    }
  }

  async function answer(content: string, choiceId: string | null) {
    if (!sessionRef.current.problemId) return;
    setMsgs((m) => [...m, { kind: 'text', who: 'me', text: content }]);
    setChoices([]);
    setDraft('');
    setTyping(true);

    const latestResponse: ResponseTurn = {
      response_role: sessionRef.current.responseHistory.length === 0 ? 'ANSWER' : 'REASONING',
      response_type: choiceId ? 'CHOICE' : 'FREE_TEXT',
      choice_id: choiceId,
      content,
    };
    if (sessionRef.current.initialAnswer === null) sessionRef.current.initialAnswer = content;

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          phase: 'interact',
          studentId: DEV_STUDENT_ID,
          problemId: sessionRef.current.problemId,
          interaction: {
            responseHistory: sessionRef.current.responseHistory,
            initialAnswer: sessionRef.current.initialAnswer,
            latestResponse,
          },
        }),
      });
      const data = await res.json();
      setTyping(false);
      if (!data.ok) {
        setMsgs((m) => [...m, { kind: 'error', text: data.error ?? '잠시 문제가 생겼어요. 다시 시도해 주세요.' }]);
        return;
      }

      sessionRef.current.responseHistory = [...sessionRef.current.responseHistory, latestResponse];
      setMsgs((m) => [...m, { kind: 'text', who: 'bot', text: data.ui.message }]);

      if (data.completion.status === 'CONTINUE') {
        setChoices(data.ui.choices ?? []);
        setAllowFreeText(data.ui.allowFreeText !== false);
        return;
      }

      // 문제 종료 — 정답·해설은 이미 위 message에 담겨 있다.
      setChoices([]);
      setAllowFreeText(false);
      setDone(true);
      setMsgs((m) => [...m, { kind: 'reward' }]);
      update((p) => ({ points: p.points + 25 }));
      setEarned((e) => e + 25);
    } catch {
      setTyping(false);
      setMsgs((m) => [...m, { kind: 'error', text: '연결이 끊겼어요. 다시 시도해 주세요.' }]);
    }
  }

  function finish(label: string) {
    if (label === '오늘 미션 마무리하기') {
      router.push('/home/today');
      return;
    }
    if (label === '한 문제 더 하기') {
      restart();
      return;
    }
    if (label === '도감 보러 가기') {
      router.push('/dex');
    }
  }

  function restart() {
    sessionRef.current = { problemId: null, responseHistory: [], initialAnswer: null };
    setMsgs([]);
    setChoices([]);
    setDraft('');
    setEarned(0);
    setDone(false);
    start();
  }

  useEffect(() => {
    if (!hydrated || startedRef.current) return;
    startedRef.current = true;
    start();
  }, [hydrated]);

  if (!hydrated) return null;
  const partner = CHARACTERS[mode];

  return (
    <div className="flex h-full flex-col bg-[#F7FAFB]">
      <div className="flex flex-none items-center gap-2.5 border-b border-[#E7EEF0] bg-white px-4 pb-3.5 pt-10">
        <button
          onClick={() => router.push('/home')}
          className="-ml-2.5 flex h-11 w-11 items-center justify-center text-[22px] text-[#24333A]"
        >
          ‹
        </button>
        <Image src={CHARACTER_IMG[mode].wave} alt={partner.ko} width={34} height={34} className="h-[34px] w-[34px] object-contain" />
        <div className="min-w-0 flex-1">
          <div className="text-base font-extrabold text-[#24333A]">{partner.ko}</div>
          <div className="text-xs font-semibold text-[#206B7C]">
            {partner.personaType === 'villain' ? `${partner.ko}와 승부 중` : `${partner.ko}와 함께 미션 해결 중`}
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-[#FFF3D6] px-2.5 py-1.5">
          <span className="text-[13px] font-extrabold text-[#24333A]">+{earned}P</span>
        </div>
      </div>

      <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
        <div className="self-center rounded-full bg-[#E7EEF0] px-3 py-1.5 text-xs font-bold text-[#546269]">
          오늘 · 생각 대화 시작
        </div>
        {msgs.map((m, i) => (
          <ChatBubble key={i} m={m} mode={mode} />
        ))}
        {typing && (
          <div className="flex items-end gap-2">
            <Image src={CHARACTER_IMG[mode].think} alt={partner.ko} width={30} height={30} className="h-[30px] w-[30px] object-contain" />
            <div className="flex gap-1.5 rounded-2xl rounded-bl-sm bg-white p-3.5 shadow-[0_2px_8px_rgba(32,107,124,.07)]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#718087]" />
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#718087] [animation-delay:180ms]" />
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#718087] [animation-delay:360ms]" />
            </div>
          </div>
        )}
      </div>

      <div className="flex-none border-t border-[#E7EEF0] bg-white px-3.5 pb-4 pt-2.5">
        {done ? (
          <div className="flex flex-wrap gap-1.5">
            {['오늘 미션 마무리하기', '한 문제 더 하기', '도감 보러 가기'].map((c) => (
              <button
                key={c}
                onClick={() => finish(c)}
                className="min-h-11 rounded-full border-[1.5px] border-[#206B7C] bg-white px-4 py-3 text-sm font-bold text-[#206B7C]"
              >
                {c}
              </button>
            ))}
          </div>
        ) : (
          <>
            {choices.length > 0 && (
              <div className="mb-2.5 flex flex-wrap gap-1.5">
                {choices.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => answer(c.value, c.id)}
                    disabled={typing}
                    className="min-h-11 rounded-full border-[1.5px] border-[#206B7C] bg-white px-4 py-3 text-sm font-bold text-[#206B7C] disabled:opacity-50"
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            )}
            {allowFreeText && (
              <div className="flex items-center gap-2.5">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && draft.trim() && !typing) answer(draft.trim(), null);
                  }}
                  disabled={typing}
                  placeholder="내 생각을 써볼까?"
                  className="h-11 min-w-0 flex-1 rounded-2xl border-[1.5px] border-[#E7EEF0] bg-[#F7FAFB] px-3.5 text-sm text-[#24333A] outline-none disabled:opacity-60"
                />
                <button
                  onClick={() => draft.trim() && !typing && answer(draft.trim(), null)}
                  disabled={typing || !draft.trim()}
                  className="flex h-11 w-11 flex-none items-center justify-center rounded-2xl bg-[#206B7C] text-lg font-extrabold text-white disabled:opacity-50"
                >
                  ↑
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ChatBubble({ m, mode }: { m: Msg; mode: CharacterId }) {
  if (m.kind === 'text' && m.who === 'bot') {
    return (
      <div className="flex max-w-[88%] items-end gap-2">
        <Image
          src={CHARACTER_IMG[mode].front}
          alt={CHARACTERS[mode].ko}
          width={30}
          height={30}
          className="h-[30px] w-[30px] flex-none object-contain"
        />
        <div className="rounded-2xl rounded-bl-sm bg-white px-3.5 py-3 text-sm font-medium leading-relaxed text-[#24333A] text-pretty shadow-[0_2px_8px_rgba(32,107,124,.07)]">
          {m.text}
        </div>
      </div>
    );
  }
  if (m.kind === 'text' && m.who === 'me') {
    return (
      <div className="max-w-[82%] self-end break-keep rounded-2xl rounded-br-sm bg-[#206B7C] px-3.5 py-3 text-sm font-medium leading-relaxed text-white text-pretty">
        {m.text}
      </div>
    );
  }
  if (m.kind === 'problem') {
    return (
      <div className="w-full max-w-[280px] self-start rounded-2xl border border-[#E7EEF0] bg-white p-3.5 shadow-[0_2px_8px_rgba(32,107,124,.07)]">
        <div className="mb-1 text-xs font-extrabold text-[#206B7C]">오늘의 문제</div>
        <div className="text-base font-extrabold leading-snug text-[#24333A] text-pretty">{m.text}</div>
      </div>
    );
  }
  if (m.kind === 'error') {
    return (
      <div className="self-center rounded-2xl border-[1.5px] border-[#F0D9CE] bg-[#FDEDE9] px-3.5 py-3 text-sm font-semibold text-[#C2554E]">
        {m.text}
      </div>
    );
  }
  if (m.kind === 'reward') {
    return (
      <div className="self-stretch rounded-3xl bg-white p-4.5 text-center shadow-[0_4px_16px_rgba(32,107,124,.1)]">
        <Image src={CHARACTER_IMG.poki.wave} alt="포키" width={84} height={84} className="mx-auto h-21 w-auto animate-meti-float" />
        <div className="mt-1 text-base font-extrabold text-[#24333A]">오늘의 생각, 저장 완료!</div>
        <div className="mt-1.5 flex justify-center gap-2">
          <span className="rounded-full bg-[#FFC857] px-3.5 py-2 text-[13px] font-extrabold text-[#24333A]">+25 P</span>
        </div>
      </div>
    );
  }
  return null;
}
