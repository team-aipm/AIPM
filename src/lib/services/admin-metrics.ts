import 'server-only';

/**
 * 어드민 대시보드가 쓰는 집계 (ADM-001 · COM-007 §7-1).
 *
 * **집계만 만든다.** 이름 · 대화 원문 · 문제 내용은 돌려주지 않는다.
 * 숫자와 단계 이름뿐이다.
 *
 * ## 퍼널을 어디서 세는가
 *
 * 될 수 있으면 **이벤트가 아니라 테이블에서 센다.** 이벤트는 그 순간부터
 * 쌓이지만 테이블은 지금까지의 사실을 이미 들고 있다 — 어제 학습한 아이도
 * 세어진다. 그래서 여섯 칸 중 다섯은 테이블에서 나온다.
 *
 * ```text
 * 회원(부모)        account                      테이블
 * 학생 등록         student                      테이블
 * 아이디 발급       student.login_id             테이블
 * 아이 첫 로그인    event.child_login_first      이벤트  ← 여기만
 * 미션 시작         learning_session             테이블
 * 문제 완료         problem.problem_status       테이블
 * ```
 *
 * 「아이 첫 로그인」만 이벤트다. 아이가 처음 들어온 순간은 어느 테이블에도
 * 안 남기 때문이다(COM-002 §14). 그래서 **2026-09-17 이전에 이미 들어온
 * 아이는 안 세어진다** — 화면에 그렇게 적는다. 없는 값을 0 으로 보여주면
 * 아무도 안 들어온 것으로 읽힌다.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { EVENT } from '@/lib/analytics/events';

type Db = SupabaseClient<Database>;

/** `child_login_first` 를 남기기 시작한 날. 그 앞은 셀 수가 없다 */
export const CHILD_LOGIN_SINCE = '2026-09-17';

export type FunnelStep = {
  label: string;
  value: number;
  /** 이 칸이 언제부터의 값인가. 테이블에서 센 칸은 `null` */
  since: string | null;
};

/** 같은 학생이 여러 줄이어도 한 명이다 */
function distinct(rows: { student_id: string | null }[] | null): number {
  return new Set((rows ?? []).map((row) => row.student_id).filter((id) => id !== null)).size;
}

export async function funnel(db: Db): Promise<FunnelStep[]> {
  const head = { count: 'exact' as const, head: true };

  const [accounts, students, withLogin, loggedIn, sessions, completed] = await Promise.all([
    db.from('account').select('*', head),
    db.from('student').select('*', head),
    db.from('student').select('*', head).not('login_id', 'is', null),
    db.from('event').select('student_id').eq('event_name', EVENT.childLoginFirst),
    db.from('learning_session').select('student_id'),
    db.from('problem').select('student_id').eq('problem_status', 'completed'),
  ]);

  return [
    { label: '회원(부모)', value: accounts.count ?? 0, since: null },
    { label: '학생 등록', value: students.count ?? 0, since: null },
    { label: '아이디 발급', value: withLogin.count ?? 0, since: null },
    { label: '아이 첫 로그인', value: distinct(loggedIn.data), since: CHILD_LOGIN_SINCE },
    { label: '미션 시작', value: distinct(sessions.data), since: null },
    { label: '문제 완료', value: distinct(completed.data), since: null },
  ];
}

/**
 * 아직 못 들어오는 아이.
 *
 * 아이디 없이 등록된 학생이다. 부모 계정이 학생 화면에 못 들어가게 되면서
 * (COM-003 §4.2) **이 아이들은 학습을 시작할 방법이 없다.** 퍼널의 한 칸이
 * 아니라 지금 손을 써야 하는 숫자라 따로 센다.
 */
export async function blockedStudents(db: Db): Promise<number> {
  const { count } = await db
    .from('student')
    .select('*', { count: 'exact', head: true })
    .is('login_id', null)
    .eq('student_status', 'active');
  return count ?? 0;
}

export type AiFailure = { stage: string; count: number };

export type AiHealth = {
  /** 며칠치인가 */
  days: number;
  /** 단계 호출이 깨진 횟수. 많은 단계부터 */
  calls: AiFailure[];
  callTotal: number;
  /** AI 가 정답을 확신 못 해 접은 문제 수 */
  verification: number;
};

/**
 * AI 가 제대로 도는가.
 *
 * **이건 이벤트 말고는 셀 방법이 없다.** 호출이 깨지면 학생에게는 다시
 * 말해 달라고 하고 넘어가므로 `problem` 에도 `message` 에도 흔적이 없다.
 */
export async function aiHealth(db: Db, days = 7): Promise<AiHealth> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const [calls, verification] = await Promise.all([
    db
      .from('event')
      .select('event_properties')
      .eq('event_name', EVENT.aiCallFailed)
      .gte('created_at', since),
    db
      .from('event')
      .select('*', { count: 'exact', head: true })
      .eq('event_name', EVENT.answerVerificationFailed)
      .gte('created_at', since),
  ]);

  const byStage = new Map<string, number>();
  for (const row of calls.data ?? []) {
    const props = row.event_properties;
    const stage =
      typeof props === 'object' && props !== null && !Array.isArray(props)
        ? String((props as Record<string, unknown>).stage ?? '(알 수 없음)')
        : '(알 수 없음)';
    byStage.set(stage, (byStage.get(stage) ?? 0) + 1);
  }

  return {
    days,
    calls: [...byStage.entries()]
      .map(([stage, count]) => ({ stage, count }))
      .sort((a, b) => b.count - a.count),
    callTotal: (calls.data ?? []).length,
    verification: verification.count ?? 0,
  };
}

// ============================================================
// 학생 한 명의 이용 깊이 (ADM-005 상세)
// ============================================================

/**
 * 얼마나 오래 · 얼마나 도움받으며 했나.
 *
 * **전부 `message` 에서 나온다.** 새로 모으는 값이 하나도 없다 — 턴 순서와
 * 힌트 표시는 학습을 굴리려고 이미 남기는 것들이다(COM-002 §7 ·
 * `message.is_hint`). 여기에 `hint_used` 같은 이벤트를 또 두면 두 숫자가
 * 갈라진다(COM-002 §14 · §17).
 *
 * ## 평균만 보여주지 않는다
 *
 * 힌트 평균 0.7회는 「다들 조금씩 쓴다」로 읽히지만, 실제로는 **대부분 한
 * 번도 안 쓰고 한 문제에서 일곱 번 쓴다**. 그 둘은 전혀 다른 일이다 —
 * 앞엣것은 힌트 버튼이 안 보인다는 뜻일 수 있고, 뒤엣것은 그 문제에서
 * 아이가 한참 헤맸다는 뜻이다. 그래서 분포를 함께 낸다.
 */
export type UsageDepth = {
  /** 대화가 있는 문제 수. 평균의 분모다 */
  problems: number;
  /** 문제당 학생 발화 수의 평균 */
  avgTurns: number;
  /** 한 문제에서 가장 길었던 대화 */
  maxTurns: number;
  hintTotal: number;
  /** 힌트를 한 번이라도 쓴 문제 수 */
  hintProblems: number;
  /** 0회 · 1~2회 · 3회 이상이 각각 몇 문제인가 */
  hintSpread: { none: number; few: number; many: number };
  /** 사고 단계별로 몇 번 물었나. 많은 것부터 */
  stages: { stage: string; count: number }[];
};

/** `drilldown_stage` 를 사람이 읽는 말로. COM-001 §7 의 다섯 단계다 */
export const STAGE_LABEL: Record<string, string> = {
  judgment: '판단',
  reasoning: '근거',
  rule: '규칙 적용',
  transfer: '전이',
  reflection: '점검',
};

export async function usageDepth(db: Db, studentId: string): Promise<UsageDepth> {
  const { data } = await db
    .from('message')
    .select('problem_id, speaker, is_hint, drilldown_stage')
    .eq('student_id', studentId);

  const rows = data ?? [];

  const byProblem = new Map<string, { turns: number; hints: number }>();
  const byStage = new Map<string, number>();

  for (const row of rows) {
    const found = byProblem.get(row.problem_id) ?? { turns: 0, hints: 0 };
    // **학생이 말한 횟수를 센다.** 전체 행을 세면 AI 말까지 들어가 두 배가
    // 된다. "몇 턴까지 갔나" 는 아이가 몇 번 답했나를 묻는 것이다.
    if (row.speaker === 'student') found.turns += 1;
    if (row.is_hint) found.hints += 1;
    byProblem.set(row.problem_id, found);

    if (row.drilldown_stage !== null) {
      byStage.set(row.drilldown_stage, (byStage.get(row.drilldown_stage) ?? 0) + 1);
    }
  }

  const problems = [...byProblem.values()];
  const sum = (pick: (item: { turns: number; hints: number }) => number) =>
    problems.reduce((total, item) => total + pick(item), 0);

  return {
    problems: problems.length,
    // 대화가 없으면 평균도 없다. 0 으로 나누지 않는다.
    avgTurns: problems.length === 0 ? 0 : sum((item) => item.turns) / problems.length,
    maxTurns: problems.length === 0 ? 0 : Math.max(...problems.map((item) => item.turns)),
    hintTotal: sum((item) => item.hints),
    hintProblems: problems.filter((item) => item.hints > 0).length,
    hintSpread: {
      none: problems.filter((item) => item.hints === 0).length,
      few: problems.filter((item) => item.hints >= 1 && item.hints <= 2).length,
      many: problems.filter((item) => item.hints >= 3).length,
    },
    stages: [...byStage.entries()]
      .map(([stage, count]) => ({ stage, count }))
      .sort((a, b) => b.count - a.count),
  };
}

// ============================================================
// 리포트 (ADM-005 · COM-003 §4.8-1)
// ============================================================
//
// **주간과 하루를 같이 본다.** 07 이 이상할 때 재료가 문제인지 프롬프트가
// 문제인지 가리려면 06 하루 총평도 보여야 한다. 하루 총평은 어느 화면에도
// 안 나오고 07 의 재료로만 쓰이므로, 여기가 유일하게 볼 수 있는 자리다.

/** 07 OUTPUT JSON 의 `report` 아래 칸들. 순서도 프롬프트와 같게 둔다 */
export const WEEKLY_FIELDS = [
  'weekly_summary',
  'learning_volume',
  'strengths',
  'improvements',
  'areas_to_watch',
  'self_correction',
  'support_change',
  'mode_a_observation',
  'mode_b_observation',
  'next_week_focus',
  'parent_message',
] as const;

/** 06 OUTPUT JSON 의 `daily_summary` 아래 칸들 */
export const DAILY_FIELDS = [
  'problems_completed',
  'mode_a_count',
  'mode_b_count',
  'strengths',
  'areas_to_watch',
  'new_logic_gaps',
  'recurring_logic_gaps',
  'resolved_logic_gaps',
  'self_correction_summary',
  'support_summary',
  'mode_observation',
] as const;

/** 어느 종류인가에 따라 볼 칸과 뿌리가 다르다 */
const SHAPE = {
  weekly_parent: { root: 'report', fields: WEEKLY_FIELDS as readonly string[], label: '주간' },
  daily_student: { root: 'daily_summary', fields: DAILY_FIELDS as readonly string[], label: '하루' },
} as const;

export type ReportKind = keyof typeof SHAPE;

export type ReportRow = {
  reportId: string;
  kind: ReportKind;
  /** 화면에 쓰는 말. 「주간」 · 「하루」 */
  kindLabel: string;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  /** 07 규격에서 빠진 칸 · 비어 있는 칸. **내용은 안 읽는다** */
  missing: string[];
  empty: string[];
  /** 펼쳤을 때 보여줄 칸. 열지 않으면 `null` */
  body: { field: string; value: unknown }[] | null;
};

/**
 * 규격만 본다. **내용이 좋은지는 여기서 판단하지 않는다.**
 *
 * COM-004 §6-2 가 정한 대로다 — AI 출력은 형식과 규칙만 확인하고, 말투와
 * 적절성은 사람이 눈으로 본다. 다만 **배열이 죄다 비었거나 문장이 한 줄이면
 * 모델이 성의 없이 낸 것**이라, 그건 내용을 안 읽어도 잡힌다.
 */
function inspect(
  summary: unknown,
  kind: ReportKind,
): { missing: string[]; empty: string[]; body: Record<string, unknown> | null } {
  const shape = SHAPE[kind];
  const root =
    typeof summary === 'object' && summary !== null && !Array.isArray(summary)
      ? (summary as Record<string, unknown>)[shape.root]
      : undefined;

  if (typeof root !== 'object' || root === null || Array.isArray(root)) {
    return { missing: [...shape.fields], empty: [], body: null };
  }

  const found = root as Record<string, unknown>;
  const missing: string[] = [];
  const empty: string[] = [];

  for (const field of shape.fields) {
    if (!(field in found)) {
      missing.push(field);
      continue;
    }
    const value = found[field];
    if (Array.isArray(value) ? value.length === 0 : String(value ?? '').trim() === '') {
      empty.push(field);
    }
  }
  return { missing, empty, body: found };
}

/**
 * 한 학생의 리포트 전부. **주간과 하루를 함께 돌려준다.**
 *
 * `openId` 로 지정한 하나만 본문을 돌려준다. 목록은 집계라 늘 보여도
 * 되지만 본문은 한 아이에 대한 서술이다 — 열람은 부르는 쪽이 감사 로그에
 * 남긴다(COM-003 §4.8-1 · COM-007 §7-3).
 */
export async function studentReports(
  db: Db,
  studentId: string,
  openId: string | null = null,
): Promise<ReportRow[]> {
  const { data } = await db
    .from('learning_report')
    .select('report_id, report_type, period_start, period_end, generated_at, summary_data')
    .eq('student_id', studentId)
    .order('period_end', { ascending: false });

  return (data ?? [])
    .filter((row): row is typeof row & { report_type: ReportKind } => row.report_type in SHAPE)
    .map((row) => {
      const kind = row.report_type;
      const checked = inspect(row.summary_data, kind);

      return {
        reportId: row.report_id,
        kind,
        kindLabel: SHAPE[kind].label,
        periodStart: row.period_start,
        periodEnd: row.period_end,
        generatedAt: row.generated_at,
        missing: checked.missing,
        empty: checked.empty,
        body:
          row.report_id !== openId || checked.body === null
            ? null
            : SHAPE[kind].fields.map((field) => ({
                field,
                value: (checked.body as Record<string, unknown>)[field],
              })),
      };
    });
}
