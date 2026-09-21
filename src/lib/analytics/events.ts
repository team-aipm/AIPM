/**
 * 행동 이벤트 (COM-002 §14).
 *
 * 어드민의 퍼널 · 리텐션 · 대시보드가 전부 이 테이블 위에 선다. **안 남기면
 * 그 순간은 영영 없다** — 나중에 되돌아가 만들 수 없는 종류의 데이터다.
 *
 * 이벤트명은 COM-002 §14 가 확정한 것뿐이다. 새 이름이 필요하면 문서를
 * 먼저 고친다(CLAUDE.md). 문자열을 화면마다 적으면 `problem_complete` 와
 * `problem_completed` 가 섞이고, 그건 집계할 때에야 드러난다.
 *
 * **이미 다른 테이블에 있는 사실은 여기 또 남기지 않는다**(COM-002 §17).
 * 힌트 사용은 `message.is_hint`, Drill-down 과 스스로 고침은 `evaluation`,
 * 모드 A/B 는 `problem.learning_mode` 가 들고 있다. 두 벌로 두면 반드시
 * 어긋난다 — 아래 `record` 는 실패해도 조용히 넘어가므로 이벤트 쪽이
 * 가끔 빠진다. 어긋난 뒤에는 어느 쪽이 맞는지 가릴 근거가 없다.
 *
 * **이벤트는 어느 테이블에도 안 남는 사실에만 쓴다.**
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

type Client = SupabaseClient<Database>;

/** COM-002 §14 「초기 공통 이벤트명」 그대로. 순서도 문서와 같게 둔다 */
export const EVENT = {
  signupCompleted: 'signup_completed',
  studentCreated: 'student_created',
  personaSelected: 'persona_selected',
  firstLearningStarted: 'first_learning_started',
  problemStarted: 'problem_started',
  problemCompleted: 'problem_completed',
  problemNeedsReview: 'problem_needs_review',
  sessionCompleted: 'session_completed',
  sessionEndedEarly: 'session_ended_early',
  sessionResumed: 'session_resumed',
  trialStarted: 'trial_started',
  trialEnded: 'trial_ended',
  subscriptionStarted: 'subscription_started',
  paymentFailed: 'payment_failed',
  subscriptionExpired: 'subscription_expired',
  weeklyReportGenerated: 'weekly_report_generated',
  // 2026-09-17 추가 (COM-002 §14)
  childLoginFirst: 'child_login_first',
  aiCallFailed: 'ai_call_failed',
  answerVerificationFailed: 'answer_verification_failed',
} as const;

export type EventName = (typeof EVENT)[keyof typeof EVENT];

type Who = {
  /** 부모 계정. 로그인한 사람 자신일 때만 쓴다 */
  accountId?: string;
  studentId?: string;
  sessionId?: string;
};

/**
 * 이벤트 하나를 남긴다.
 *
 * **실패해도 던지지 않는다.** 기록이 안 됐다고 학습을 멈출 이유가 없다 —
 * 문제를 다 풀었는데 통계 한 줄 때문에 화면이 오류로 바뀌면 그게 더 큰
 * 손해다. 대신 서버 로그에는 남겨서 조용히 사라지지는 않게 한다.
 *
 * RLS 는 `account_id = auth.uid()` 이거나 내 학생일 때만 넣게 한다
 * (`event_insert_own`). 그래서 **둘 중 하나는 반드시 채워야 한다.**
 */
export async function record(
  client: Client,
  name: EventName,
  who: Who,
  properties: Record<string, unknown> = {},
): Promise<void> {
  if (who.accountId === undefined && who.studentId === undefined) {
    console.error(`[event] ${name}: account_id 도 student_id 도 없어 남기지 않았습니다`);
    return;
  }

  const { error } = await client.from('event').insert({
    event_name: name,
    account_id: who.accountId ?? null,
    student_id: who.studentId ?? null,
    session_id: who.sessionId ?? null,
    event_properties: properties as never,
  });

  if (error !== null) {
    console.error(`[event] ${name} 기록 실패: ${error.message}`);
  }
}

/**
 * 한 번만 남기는 이벤트.
 *
 * `signup_completed` 가 그렇다. **가입하는 순간에는 남길 수가 없다** —
 * Email 확인이 켜져 있어 signUp 직후에는 세션이 없고, `event` 의 insert
 * 정책은 `to authenticated` 다(DEV-003 §4-4 · `event_insert_own`).
 *
 * 그래서 확인을 마치고 **처음 들어온 순간**에 남긴다. 시각은 몇 분 늦지만
 * "가입을 끝내고 실제로 들어온 사람" 을 세는 쪽이 퍼널에는 더 맞는 값이다.
 * 로그인할 때마다 부르므로 이미 있으면 넘어간다.
 *
 * `child_login_first` 도 같은 방식이다 — 아이가 로그인할 때마다 부르고,
 * 이미 있으면 넘어간다.
 */
export async function recordOnce(
  client: Client,
  name: EventName,
  who: Who,
  properties: Record<string, unknown> = {},
): Promise<void> {
  /**
   * 무엇을 기준으로 「한 번」인가.
   *
   * `signup_completed` 는 계정마다 한 번이고, `child_login_first` 는
   * **학생마다 한 번**이다 — 한 계정에 아이가 여럿이면 각자 처음이 있다.
   * 계정으로만 세면 둘째 아이의 첫 로그인이 영영 안 남는다.
   */
  const key =
    who.studentId !== undefined
      ? ({ column: 'student_id', value: who.studentId } as const)
      : who.accountId !== undefined
        ? ({ column: 'account_id', value: who.accountId } as const)
        : null;

  if (key === null) {
    console.error(`[event] ${name}: 한 번만 남기는 이벤트는 기준이 될 id 가 필요합니다`);
    return;
  }

  const { data, error } = await client
    .from('event')
    .select('event_id')
    .eq('event_name', name)
    .eq(key.column, key.value)
    .limit(1)
    .maybeSingle();

  // 확인에 실패하면 남기지 않는다. 두 번 남기는 쪽이 더 나쁘다 —
  // 퍼널이 100% 를 넘어 버린다.
  if (error !== null) {
    console.error(`[event] ${name} 중복 확인 실패: ${error.message}`);
    return;
  }
  if (data !== null) return;

  await record(client, name, who, properties);
}
