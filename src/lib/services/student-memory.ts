/**
 * StudentMemory (COM-002 §10) · 학생의 장기 학습 상태.
 *
 * > 세션 종료 후 삭제하지 않는다. **새 문제 생성 시 핵심 입력 데이터로
 * > 사용한다.** 첫날 학습 결과로 초기 생성한다. 이후 Evaluation/LogicGap 을
 * > 바탕으로 갱신한다. 학생 1명당 1행을 유지한다.
 *
 * 표는 처음부터 있었지만 **읽는 곳도 쓰는 곳도 없었다.** 모든 단계가
 * `student_memory: null` 을 받았고, 그래서 01 은 매일 처음 만난 아이처럼
 * 인사했다 — 프롬프트에는 "기존 학생이면 student_memory 에서 오늘과
 * 연결하기 좋은 내용 하나만 짧게 활용한다" 고 적혀 있는데도.
 *
 * ## 두 개의 「수준」을 나눈다
 *
 * COM-002 에는 비슷한 값이 둘 있다. 뜻이 다르고 고치는 주기도 다르다.
 *
 * ```text
 * student.current_difficulty     다음 문제를 얼마나 어렵게 낼까
 *                                서버가 최근 3문제로 (lib/services/difficulty.ts)
 * student_memory.current_level   이 아이가 지금 어디쯤인가
 *                                06 이 하루를 마치며
 * ```
 *
 * 앞은 매 문제 쓰는 조절값, 뒤는 하루 단위 상태 요약이다.
 *
 * ## 02 · 03 에는 왜 안 넘기나
 *
 * 그 단계의 입력에는 `student_memory` 칸이 없다. 대신
 * `learning_target.concept` 와 `difficulty` 를 받는다 — 기억은 **개념 선정과
 * 난이도를 거쳐** 들어간다(`concept.ts` · `difficulty.ts`). 같은 것을 두 경로로
 * 넣으면 어느 쪽을 봐야 하는지 모델이 모른다.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/types/database';

type Client = SupabaseClient<Database>;
export type StudentMemory = Database['public']['Tables']['student_memory']['Row'];

/** COM-002 §10. `current_level` 3 = 학년 중간 수준 */
const START_LEVEL = 3;

/** 평가 점수는 0~2, 수준은 1~5 (COM-002 §19 확정). 0→1 · 1→3 · 2→5 */
function toLevel(scores: (number | null)[]): number | null {
  const values = scores.filter((v): v is number => typeof v === 'number');
  if (values.length === 0) return null;
  const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
  return Math.min(5, Math.max(1, Math.round(1 + avg * 2)));
}

/** 복습으로 돌릴 기준. `concept.ts` 와 같은 값을 쓴다 */
const REVIEW_AFTER_DAYS = 7;

/** 이만큼만 본다. 반년 전 기록이 오늘의 취약 개념을 정하지 않는다 */
const WINDOW = 20;

export async function getMemory(
  client: Client,
  studentId: string,
): Promise<StudentMemory | null> {
  const { data, error } = await client
    .from('student_memory')
    .select('*')
    .eq('student_id', studentId)
    .maybeSingle();

  if (error !== null) {
    console.error(`[memory] 읽지 못했습니다: ${error.message}`);
    return null;
  }
  return data;
}

/**
 * 단계 입력의 `payload.student_memory` 에 넣을 모양.
 *
 * **행 전체를 그대로 보내지 않는다.** `memory_id` 와 `student_id` 는 모델이
 * 쓸 일이 없고, 내부 식별자를 프롬프트에 흘리지 않는다.
 */
export function forPrompt(memory: StudentMemory | null): Json | null {
  if (memory === null) return null;
  return {
    current_level: memory.current_level,
    reasoning_level: memory.reasoning_level,
    transfer_level: memory.transfer_level,
    average_support_level: memory.average_support_level,
    weak_concepts: memory.weak_concepts,
    review_concepts: memory.review_concepts,
    recurring_logic_gaps: memory.recurring_logic_gaps,
    updated_at: memory.updated_at,
  } as Json;
}

/**
 * 평가와 사고 오류에서 다시 센다 (COM-002 §10 「Evaluation/LogicGap 을
 * 바탕으로 갱신한다」).
 *
 * 문제를 하나 마칠 때마다 부른다. **덧붙이지 않고 매번 다시 센다** —
 * 덧붙이면 한 번 잘못 들어간 값이 영영 남는다.
 *
 * 던지지 않는다. 기억을 못 갱신했다고 학습을 멈출 이유가 없다.
 */
export async function refreshMemory(client: Client, studentId: string): Promise<void> {
  const [evals, gaps] = await Promise.all([
    client
      .from('evaluation')
      .select('reasoning_score, rule_score, transfer_score, support_level')
      .eq('student_id', studentId)
      .order('evaluated_at', { ascending: false })
      .limit(WINDOW),
    client
      .from('logic_gap')
      .select('gap_type, concept, detected_at')
      .eq('student_id', studentId)
      .order('detected_at', { ascending: false })
      .limit(WINDOW * 2),
  ]);

  if (evals.error !== null || gaps.error !== null) {
    console.error(
      `[memory] 근거를 읽지 못했습니다: ${evals.error?.message ?? gaps.error?.message}`,
    );
    return;
  }

  const rows = evals.data ?? [];
  if (rows.length === 0) return; // 아직 아무것도 마치지 않았다

  const supports = rows.map((e) => e.support_level);
  const average = supports.reduce((sum, v) => sum + v, 0) / supports.length;

  // 이유 설명 수준은 reasoning 과 rule 을 함께 본다. 둘 다 "왜 그런가" 다.
  const reasoning =
    toLevel(rows.flatMap((e) => [e.reasoning_score, e.rule_score])) ?? START_LEVEL;
  const transfer = toLevel(rows.map((e) => e.transfer_score)) ?? START_LEVEL;

  // 취약 개념: 사고 오류가 잦았던 개념. 많이 나온 것이 앞이다.
  const byConcept = new Map<string, number>();
  const lastSeen = new Map<string, string>();
  const byType = new Map<string, number>();
  for (const gap of gaps.data ?? []) {
    byConcept.set(gap.concept, (byConcept.get(gap.concept) ?? 0) + 1);
    byType.set(gap.gap_type, (byType.get(gap.gap_type) ?? 0) + 1);
    if (!lastSeen.has(gap.concept)) lastSeen.set(gap.concept, gap.detected_at);
  }

  const weak = [...byConcept.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([concept, count]) => ({ concept, count }));

  // 복습: 한동안 안 본 개념. 취약과 겹칠 수 있다 — 다른 질문에 답한다.
  const cutoff = Date.now() - REVIEW_AFTER_DAYS * 864e5;
  const review = [...lastSeen.entries()]
    .filter(([, at]) => new Date(at).getTime() < cutoff)
    .slice(0, 5)
    .map(([concept, at]) => ({ concept, last_seen: at }));

  // 반복 사고오류: 두 번 이상 나온 것만. 한 번은 그날의 실수일 수 있다.
  const recurring = [...byType.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => ({ type, count }));

  const existing = await getMemory(client, studentId);

  const { error } = await client.from('student_memory').upsert(
    {
      student_id: studentId,
      // **current_level 은 여기서 건드리지 않는다.** 06 이 하루를 마치며
      // 정한다. 문제마다 흔들리면 「지금 어디쯤인가」가 아니게 된다.
      current_level: existing?.current_level ?? START_LEVEL,
      reasoning_level: reasoning,
      transfer_level: transfer,
      average_support_level: Math.round(average * 10) / 10,
      weak_concepts: weak as unknown as Json,
      review_concepts: review as unknown as Json,
      recurring_logic_gaps: recurring as unknown as Json,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'student_id' },
  );

  if (error !== null) console.error(`[memory] 저장하지 못했습니다: ${error.message}`);
}

/**
 * 그날 낸 문제들의 수준 하나. 문제가 없으면 `null`.
 *
 * **중앙값이다.** 마지막 값을 쓰면 그날 마지막 한 문제의 운에 좌우되고,
 * 최빈값은 동점일 때 무엇을 고를지 또 정해야 한다. 중앙값은 낮에 몇 번
 * 출렁여도 가운데를 집는다. (COM-001 §9)
 */
async function todayLevel(client: Client, sessionId: string): Promise<number | null> {
  const { data, error } = await client
    .from('problem')
    .select('difficulty')
    .eq('session_id', sessionId);

  if (error !== null) {
    console.error(`[memory] 오늘 문제 수준을 읽지 못했습니다: ${error.message}`);
    return null;
  }

  const levels = (data ?? []).map((p) => p.difficulty).sort((a, b) => a - b);
  if (levels.length === 0) return null;

  const mid = Math.floor(levels.length / 2);
  // 짝수 개면 가운데 둘의 평균이 3.5 같은 값이 된다. 수준은 정수 칸이므로
  // 내림한다 — 올림하면 실제로 푼 적 없는 수준으로 올라갈 수 있다.
  const median =
    levels.length % 2 === 1 ? levels[mid] : Math.floor((levels[mid - 1] + levels[mid]) / 2);

  return Math.min(5, Math.max(1, median));
}

/**
 * 하루를 마치며 총평을 반영한다 (COM-002 §10 「첫날 학습 결과로 초기
 * 생성한다」).
 *
 * ## `current_level` 은 서버가 정한다 (COM-001 §9 · COM-002 §10)
 *
 * 전에는 06 의 `memory_update.current_level` 을 읽었다. **그런데 06 의
 * 출력 스펙에 그 필드가 없었다.** 모델이 낼 이유가 없는 값을 기다리다
 * 매번 빈손으로 돌아왔고, 학생 전원이 시작값 3 에 머물렀다.
 *
 * AI 에 다시 맡기지 않는다. 05 가 문제마다 내놓는 난이도 의견을 쓰지
 * 않는 것, Support Level 최종값을 서버가 계산하는 것과 같은 이유다 —
 * 같은 기록이면 언제나 같은 결과여야 이상할 때 재현해 볼 수 있다.
 *
 * 06 은 `memory_update` 로 `logic_gaps` · `priority_concepts` ·
 * `next_session_focus` 를 낸다. **세는 것은 이미 `refreshMemory` 가 했다.**
 * 여기서는 06 만 아는 것 — 무엇을 다음에 볼지 — 을 얹는다.
 */
export async function applyDailySummary(
  client: Client,
  studentId: string,
  input: { sessionId: string; priorityConcepts: unknown; nextFocus: unknown },
): Promise<void> {
  const existing = await getMemory(client, studentId);
  if (existing === null) {
    console.error('[memory] 하루 총평을 얹을 기억이 없습니다');
    return;
  }

  const level = (await todayLevel(client, input.sessionId)) ?? existing.current_level;

  const review = Array.isArray(input.priorityConcepts) && input.priorityConcepts.length > 0
    ? (input.priorityConcepts as unknown as Json)
    : existing.review_concepts;

  const { error } = await client
    .from('student_memory')
    .update({
      current_level: level,
      // 06 이 다음에 볼 것을 정했으면 그것이 복습 목록이다. 06 은 하루
      // 전체를 보고 말하므로 개별 오류를 세는 것보다 낫다.
      review_concepts: review,
      updated_at: new Date().toISOString(),
    })
    .eq('student_id', studentId);

  if (error !== null) console.error(`[memory] 하루 총평 반영 실패: ${error.message}`);
}
