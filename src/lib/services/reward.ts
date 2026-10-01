import 'server-only';

/**
 * 참여 도장 · 보상 약속 (COM-002 §22-1 · §22-5 · COM-001 §16)
 *
 * ```text
 *   도장   평일 오늘의 미션 10개를 다 했을 때  하루 1개   → 부모가 약속한 보상
 * ```
 *
 * 도장은 **DB 함수만 만든다**(`award_participation_stamp`). 함수가 세션과
 * 문제 기록을 직접 보고 조건을 확인하므로 아이 세션으로 불러도 된다.
 *
 * 보상의 진행도는 **그 보상이 시작된 뒤에 받은 도장 수**다. 달성하면 예약된
 * 보상이 곧바로 시작되고, 모은 도장은 지워지지 않는다(§22-5).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

type Client = SupabaseClient<Database>;
export type RewardGoal = Database['public']['Tables']['reward_goal']['Row'];
export type RewardStatus = 'queued' | 'active' | 'achieved' | 'delivered' | 'cancelled';

/** 목표 도장 수 칩 (Figma `보상 관리 · 02 보상 등록`). 직접 입력은 1~365 */
export const STAMP_PRESETS = [5, 10, 20, 30, 50, 100] as const;
export const MIN_TARGET = 1;
export const MAX_TARGET = 365;
/** 이보다 크면 화면이 「오래 걸려요」 라고 말만 한다. 막지 않는다(§22-5) */
export const LONG_TARGET = 100;

// ============================================================
// 도장
// ============================================================

/**
 * 세션이 10/10 이 된 순간 부른다. 조건(평일 · 10개)은 DB 함수가 다시 본다.
 * **던지지 않는다** — 도장을 못 줬다고 아이의 미션 완료가 깨지면 안 된다.
 */
export async function awardStamp(client: Client, sessionId: string): Promise<{ stamped: boolean }> {
  const { data, error } = await client.rpc('award_participation_stamp', { p_session_id: sessionId });
  if (error !== null) {
    console.error(`[reward] 도장 지급 실패: ${error.message}`);
    return { stamped: false };
  }
  return { stamped: (data as { stamped?: boolean } | null)?.stamped === true };
}

/** 이번 주(월~금) 도장을 받은 날짜. 학생 홈 「이번 주」 줄이 쓴다 */
export async function weekStamps(client: Client, studentId: string, monday: string, friday: string): Promise<Set<string>> {
  const { data, error } = await client
    .from('participation_stamp')
    .select('stamp_date')
    .eq('student_id', studentId)
    .gte('stamp_date', monday)
    .lte('stamp_date', friday);

  // **던지지 않는다.** 도장 줄을 못 그렸다고 학생 홈 전체가 깨지면 안 된다.
  if (error !== null) {
    console.error(`[reward] 이번 주 도장 조회 실패: ${error.message}`);
    return new Set();
  }
  return new Set((data ?? []).map((row) => row.stamp_date));
}

/** 오늘 도장을 받았는가. 오늘의 기록 완료 화면 「도장 1개」 가 쓴다 */
export async function stampedOn(client: Client, studentId: string, date: string): Promise<boolean> {
  const { count, error } = await client
    .from('participation_stamp')
    .select('stamp_id', { count: 'exact', head: true })
    .eq('student_id', studentId)
    .eq('stamp_date', date);

  if (error !== null) {
    console.error(`[reward] 오늘 도장 조회 실패: ${error.message}`);
    return false;
  }
  return (count ?? 0) > 0;
}

// ============================================================
// 보상
// ============================================================

export type RewardBoard = {
  /** 진행 중. 진행도와 함께 */
  active: (RewardGoal & { progress: number }) | null;
  /** 다음 차례. 진행 중이 달성되면 곧바로 시작된다 */
  queued: RewardGoal | null;
  /** 도장을 다 모았지만 아직 주지 않은 것. 부모 홈 「보상 도착」 */
  achieved: RewardGoal[];
  /** 준 것 · 지난 보상 */
  delivered: RewardGoal[];
};

export async function rewardBoard(client: Client, studentId: string): Promise<RewardBoard> {
  const { data, error } = await client
    .from('reward_goal')
    .select('*')
    .eq('student_id', studentId)
    .neq('reward_status', 'cancelled')
    .order('created_at', { ascending: false });

  // 학생 홈 · 부모 홈이 같이 부른다. 실패하면 보상이 없는 것처럼 그린다 —
  // 카드 하나 때문에 홈이 통째로 오류 화면이 되면 안 된다.
  if (error !== null) {
    console.error(`[reward] 보상 조회 실패: ${error.message}`);
    return { active: null, queued: null, achieved: [], delivered: [] };
  }
  const goals = data ?? [];

  const active = goals.find((goal) => goal.reward_status === 'active') ?? null;
  return {
    active: active === null ? null : { ...active, progress: await progressOf(client, active) },
    queued: goals.find((goal) => goal.reward_status === 'queued') ?? null,
    achieved: goals.filter((goal) => goal.reward_status === 'achieved'),
    delivered: goals
      .filter((goal) => goal.reward_status === 'delivered')
      .sort((a, b) => (b.delivered_at ?? '').localeCompare(a.delivered_at ?? '')),
  };
}

/** 진행 중인 보상이 시작된 뒤에 받은 도장 수. 목표를 넘지 않는다 */
async function progressOf(client: Client, goal: RewardGoal): Promise<number> {
  if (goal.activated_at === null) return 0;
  const { count, error } = await client
    .from('participation_stamp')
    .select('stamp_id', { count: 'exact', head: true })
    .eq('student_id', goal.student_id)
    .gte('created_at', goal.activated_at);

  if (error !== null) {
    console.error(`[reward] 진행도 조회 실패: ${error.message}`);
    return 0;
  }
  return Math.min(count ?? 0, goal.target_stamp_count);
}

export type GoalInput = { name: string; target: number };

function check(input: GoalInput): string | null {
  const name = input.name.trim();
  if (name === '') return '보상 이름을 적어 주세요.';
  if (name.length > 40) return '보상 이름은 40자까지 적을 수 있어요.';
  if (!Number.isInteger(input.target) || input.target < MIN_TARGET || input.target > MAX_TARGET) {
    return `목표 도장 수는 ${MIN_TARGET}~${MAX_TARGET}개로 정해 주세요.`;
  }
  return null;
}

/**
 * 보상을 정한다. 진행 중이 없으면 곧바로 시작하고, 있으면 다음 차례로 둔다.
 * 학생당 진행 중 1개 · 다음 차례 1개까지다(§22-5).
 */
export async function createGoal(
  client: Client,
  accountId: string,
  studentId: string,
  input: GoalInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const invalid = check(input);
  if (invalid !== null) return { ok: false, error: invalid };

  const board = await rewardBoard(client, studentId);
  if (board.active !== null && board.queued !== null) {
    return { ok: false, error: '진행 중인 보상과 다음 보상이 이미 있어요. 하나를 마치면 더 정할 수 있어요.' };
  }

  const startNow = board.active === null;
  const { error } = await client.from('reward_goal').insert({
    student_id: studentId,
    account_id: accountId,
    reward_name: input.name.trim(),
    target_stamp_count: input.target,
    reward_status: startNow ? 'active' : 'queued',
    activated_at: startNow ? new Date().toISOString() : null,
  });

  if (error !== null) return { ok: false, error: '보상을 저장하지 못했어요. 잠시 후 다시 해 주세요.' };
  return { ok: true };
}

/**
 * 고친다. **진행 중인 보상은 이름만** 고칠 수 있다 — 목표 수를 바꾸면 아이와
 * 한 약속이 바뀐다(§22-5). 다음 차례는 둘 다 고칠 수 있다.
 */
export async function updateGoal(
  client: Client,
  goal: RewardGoal,
  input: GoalInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const target = goal.reward_status === 'queued' ? input.target : goal.target_stamp_count;
  const invalid = check({ name: input.name, target });
  if (invalid !== null) return { ok: false, error: invalid };

  const { error } = await client
    .from('reward_goal')
    .update({ reward_name: input.name.trim(), target_stamp_count: target })
    .eq('reward_goal_id', goal.reward_goal_id);

  if (error !== null) return { ok: false, error: '고치지 못했어요. 잠시 후 다시 해 주세요.' };
  return { ok: true };
}

/** 부모가 실제로 줬다. 도장을 다 모은 것(achieved)과는 다른 날이다(§22-5) */
export async function markDelivered(client: Client, goalId: string): Promise<boolean> {
  // **바뀐 행이 있어야 성공이다.** 이미 줬거나 아직 달성 전이면 0행이 바뀌는데,
  // 그것을 성공으로 알리면 부모는 줬다고 믿고 화면은 그대로다.
  const { data, error } = await client
    .from('reward_goal')
    .update({ reward_status: 'delivered', delivered_at: new Date().toISOString() })
    .eq('reward_goal_id', goalId)
    .eq('reward_status', 'achieved')
    .select('reward_goal_id');
  if (error !== null) console.error(`[reward] 전달 표시 실패: ${error.message}`);
  return error === null && (data ?? []).length === 1;
}

/**
 * 그만둔다. 진행 중이던 것을 그만두면 다음 차례를 곧바로 시작한다 —
 * 아이 홈에 보상이 비지 않게.
 */
export async function cancelGoal(client: Client, goal: RewardGoal): Promise<void> {
  const { error } = await client
    .from('reward_goal')
    .update({ reward_status: 'cancelled' })
    .eq('reward_goal_id', goal.reward_goal_id);
  if (error !== null) throw new Error(`보상을 그만두지 못했습니다: ${error.message}`);

  if (goal.reward_status === 'active') {
    const { error: nextError } = await client
      .from('reward_goal')
      .update({ reward_status: 'active', activated_at: new Date().toISOString() })
      .eq('student_id', goal.student_id)
      .eq('reward_status', 'queued');
    // 그만두기는 이미 됐다. 다음 보상이 안 올라왔으면 남기고, 부모가 목록에서
    // 다시 정할 수 있게 둔다.
    if (nextError !== null) console.error(`[reward] 다음 보상 시작 실패: ${nextError.message}`);
  }
}

export async function getGoal(client: Client, goalId: string): Promise<RewardGoal | null> {
  const { data, error } = await client.from('reward_goal').select('*').eq('reward_goal_id', goalId).maybeSingle();
  if (error !== null) throw new Error(`보상을 불러오지 못했습니다: ${error.message}`);
  return data;
}
