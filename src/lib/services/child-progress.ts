import 'server-only';

/**
 * PAR-003 자녀 학습 상세 · 성장 추이 (COM-003 PAR-003)
 *
 * 부모가 한 아이의 오늘 · 최근 7일 · 최근 몇 주의 변화를 본다. 새로 저장하는
 * 것은 없다 — 이미 쌓인 세션 · 문제 · 평가 · 도장 · 학생 기억을 모아 센다.
 *
 * **AI 대화 원문과 사진은 꺼내지 않는다**(COM-003 PAR-003 · COM-007). 점수와
 * 개념 이름, 숫자만 다룬다.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { addDays, today } from '@/lib/services/learning-session';

type Client = SupabaseClient<Database>;

/** 한국 날짜 'YYYY-MM-DD'. 문제 시각을 날짜로 자를 때 쓴다 */
function kstDate(at: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date(at));
}

/** 그 날짜가 든 주의 월요일 */
export function mondayOf(date: string): string {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 일 ~ 6 토
  return addDays(date, day === 0 ? -6 : 1 - day);
}

const isWeekday = (date: string) => {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day >= 1 && day <= 5;
};

const counted = (status: string) => status === 'completed' || status === 'needs_review';

/** 개념 이름. 아직 이름이 안 붙은 문제(`미지정`)는 빼고 셀 수 없다 */
const named = (concept: string | null) => (concept !== null && concept !== '미지정' ? concept : null);

function jsonNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item : typeof item === 'object' && item !== null ? String((item as { concept?: unknown }).concept ?? '') : ''))
    .filter((name) => name !== '' && name !== '미지정');
}

// ============================================================
// 오늘 · 최근 7일 (PAR-003 위쪽 · Figma 587:6653)
// ============================================================

export type DayRow = {
  date: string;
  done: number;
  target: number;
  /** 코인은 기본 미션 1개당 10개, 하루 최대 100 (COM-001 §11-A) */
  coins: number;
  stamped: boolean;
  weekend: boolean;
};

export type TodayDetail = {
  date: string;
  day: DayRow;
  /** 진행 중 · 완료 · 시작 전 */
  state: 'idle' | 'progress' | 'done';
  understood: string[];
  confused: string[];
  selfCorrected: number;
  reviewNext: string | null;
  recent: DayRow[];
};

export async function childToday(client: Client, studentId: string): Promise<TodayDetail> {
  const now = today();
  const from = addDays(now, -6);

  const [sessions, stamps, problems, memory] = await Promise.all([
    client
      .from('learning_session')
      .select('session_date, session_status, completed_problem_count, target_problem_count')
      .eq('student_id', studentId)
      .gte('session_date', from)
      .lte('session_date', now),
    client.from('participation_stamp').select('stamp_date').eq('student_id', studentId).gte('stamp_date', from),
    client
      .from('problem')
      .select('concept, problem_status, created_at, evaluation(initial_accuracy, self_correction)')
      .eq('student_id', studentId)
      .gte('created_at', `${now}T00:00:00+09:00`),
    client.from('student_memory').select('weak_concepts, review_concepts').eq('student_id', studentId).maybeSingle(),
  ]);

  const stampDates = new Set((stamps.data ?? []).map((row) => row.stamp_date));
  const byDate = new Map((sessions.data ?? []).map((row) => [row.session_date, row]));

  const recent: DayRow[] = Array.from({ length: 7 }, (_, idx) => {
    const date = addDays(now, -idx);
    const session = byDate.get(date);
    const done = Math.min(session?.completed_problem_count ?? 0, session?.target_problem_count ?? 10);
    return {
      date,
      done,
      target: session?.target_problem_count ?? 10,
      coins: Math.min(done, 10) * 10,
      stamped: stampDates.has(date),
      weekend: !isWeekday(date),
    };
  });

  const todays = problems.data ?? [];
  const evaluationOf = (row: (typeof todays)[number]) =>
    Array.isArray(row.evaluation) ? row.evaluation[0] : row.evaluation;

  const understood = new Set<string>();
  const confused = new Set<string>();
  let selfCorrected = 0;
  for (const row of todays) {
    const concept = named(row.concept);
    const evaluation = evaluationOf(row);
    if (evaluation?.self_correction === true) selfCorrected += 1;
    if (concept === null || !counted(row.problem_status)) continue;
    if (row.problem_status === 'completed' && evaluation?.initial_accuracy === true) understood.add(concept);
    else confused.add(concept);
  }
  // 한 개념이 둘 다에 들면 헷갈린 쪽으로 둔다. 다시 볼 것을 먼저 알려준다.
  for (const concept of confused) understood.delete(concept);

  const reviewNext =
    jsonNames(memory.data?.review_concepts)[0] ?? jsonNames(memory.data?.weak_concepts)[0] ?? null;

  const day = recent[0];
  return {
    date: now,
    day,
    state: day.done === 0 ? 'idle' : day.done >= day.target ? 'done' : 'progress',
    understood: [...understood].slice(0, 2),
    confused: [...confused].slice(0, 2),
    selfCorrected,
    reviewNext,
    recent,
  };
}

// ============================================================
// 성장 추이 (PAR-003 아래쪽 · COM-003 PAR-003 「성장 추이」)
// ============================================================

/**
 * 생각하는 힘 넷. 05 EVALUATOR 의 점수(COM-002 §8)를 부모가 읽는 말로 부른다.
 * 이름은 여기 한 곳에서만 정한다.
 */
export const ABILITIES = [
  { key: 'reasoning_score', label: '이유를 설명하는 힘' },
  { key: 'rule_score', label: '규칙을 쓰는 힘' },
  { key: 'transfer_score', label: '다른 문제에 적용하는 힘' },
  { key: 'reflection_score', label: '자기 생각을 돌아보는 힘' },
] as const;

export type AbilityKey = (typeof ABILITIES)[number]['key'];

/** 한 주에 이만큼은 관찰돼야 단계를 매긴다. 한두 문제로 단정하지 않는다 */
export const MIN_OBSERVED = 3;

/**
 * 0~2 평균을 4단계로 나눈다. 평균은 관찰된 것(null 이 아닌 것)만 낸다 —
 * 묻지 않은 것을 0 으로 세면 낮게 나온다(COM-002 §8 · 05 「null 과 0 은 다르다」).
 */
export function stageOf(average: number): 1 | 2 | 3 | 4 {
  if (average < 0.5) return 1;
  if (average < 1.0) return 2;
  if (average < 1.5) return 3;
  return 4;
}

export type WeekGrowth = {
  monday: string;
  sunday: string;
  learningDays: number;
  completed: number;
  selfCorrected: number;
  /** 0~4. 낮을수록 혼자 해냈다. 평가가 없으면 null */
  support: number | null;
  /** 관찰이 MIN_OBSERVED 보다 적으면 stage 는 null */
  abilities: Record<AbilityKey, { average: number | null; observed: number; stage: 1 | 2 | 3 | 4 | null }>;
  /** 그 주 마지막 문제의 자리. 「5학년 레벨 3」 */
  level: { grade: number; difficulty: number } | null;
};

export async function childGrowth(client: Client, studentId: string, weeks = 4): Promise<WeekGrowth[]> {
  const thisMonday = mondayOf(today());
  const firstMonday = addDays(thisMonday, -7 * (weeks - 1));

  const [problems, sessions] = await Promise.all([
    client
      .from('problem')
      .select('problem_status, created_at, difficulty, learning_grade, evaluation(*)')
      .eq('student_id', studentId)
      .gte('created_at', `${firstMonday}T00:00:00+09:00`)
      .order('created_at', { ascending: true }),
    client
      .from('learning_session')
      .select('session_date, completed_problem_count')
      .eq('student_id', studentId)
      .gte('session_date', firstMonday),
  ]);

  if (problems.error !== null) throw new Error(`성장 기록을 불러오지 못했습니다: ${problems.error.message}`);

  return Array.from({ length: weeks }, (_, idx) => {
    const monday = addDays(firstMonday, idx * 7);
    const sunday = addDays(monday, 6);
    const inWeek = (date: string) => date >= monday && date <= sunday;

    const rows = (problems.data ?? []).filter((row) => inWeek(kstDate(row.created_at)));
    const evaluations = rows
      .map((row) => (Array.isArray(row.evaluation) ? row.evaluation[0] : row.evaluation))
      .filter((item): item is NonNullable<typeof item> => item !== null && item !== undefined);

    const abilities = Object.fromEntries(
      ABILITIES.map(({ key }) => {
        const values = evaluations
          .map((item) => item[key])
          .filter((value): value is number => typeof value === 'number');
        const average = values.length === 0 ? null : values.reduce((sum, v) => sum + v, 0) / values.length;
        return [
          key,
          { average, observed: values.length, stage: average !== null && values.length >= MIN_OBSERVED ? stageOf(average) : null },
        ];
      }),
    ) as WeekGrowth['abilities'];

    const supports = evaluations.map((item) => item.support_level);
    const last = rows.at(-1);

    return {
      monday,
      sunday,
      learningDays: (sessions.data ?? []).filter((row) => inWeek(row.session_date) && row.completed_problem_count > 0).length,
      completed: rows.filter((row) => counted(row.problem_status)).length,
      selfCorrected: evaluations.filter((item) => item.self_correction).length,
      support: supports.length === 0 ? null : supports.reduce((sum, v) => sum + v, 0) / supports.length,
      abilities,
      // 옛 문제는 학년이 비어 있을 수 있다(COM-002 §6). 그때는 수준을 말하지 않는다.
      level: last === undefined || last.learning_grade === null ? null : { grade: last.learning_grade, difficulty: last.difficulty },
    };
  });
}
