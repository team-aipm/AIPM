/**
 * 다음 문제의 개념을 고른다 (COM-001 §9).
 *
 * ```text
 * 첫날      학년 기준 중간 난이도. 여러 개념을 섞어 10문제
 * 2일차~    취약 개념 4 · 현재 수준 4 · 복습 필요 2
 * ```
 *
 * **개념 목록을 우리가 갖고 있지 않다.** 교육과정 taxonomy 는 COM-002 §20
 * 이 미확정으로 둔 항목이다. 그래서 목록을 지어내는 대신 **이 학생이 지나온
 * 개념**에서 고른다 — 05 가 문제마다 `next_learning.target_concept` 을
 * 한국어로 내놓고, 그것이 `logic_gap.concept` 에 남는다.
 *
 * 고를 것이 없으면 `null` 을 돌려준다. 그러면 02 가 학년에 맞춰 알아서
 * 낸다(첫날 규칙). **지어낸 개념명을 넣는 것보다 낫다.**
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

type Client = SupabaseClient<Database>;

export type ConceptPick = {
  /** 02 · 03 의 learning_target.concept 로 보낸다 */
  concept: string | null;
  /** 왜 골랐는지. problem.concept 에 함께 남기지 않고 로그로만 쓴다 */
  reason: 'weak' | 'current' | 'review' | 'none';
};

/** 취약 4 · 현재 4 · 복습 2 (COM-001 §9). 합이 10이라 문제 번호로 나눈다 */
const RATIO: ConceptPick['reason'][] = [
  'weak', 'weak', 'weak', 'weak',
  'current', 'current', 'current', 'current',
  'review', 'review',
];

const REVIEW_AFTER_DAYS = 7;

/**
 * @param problemNumber 오늘 몇 번째 문제인지. 1부터
 */
export async function pickConcept(
  client: Client,
  studentId: string,
  problemNumber: number,
): Promise<ConceptPick> {
  // 비율을 문제 번호로 돌린다. 1~4 취약 · 5~8 현재 · 9~10 복습.
  const want = RATIO[(Math.max(1, problemNumber) - 1) % RATIO.length];

  const [weak, current, review] = await Promise.all([
    // 취약: 최근에 막힌 개념. 여러 번 막힌 것이 먼저다
    client
      .from('logic_gap')
      .select('concept, detected_at')
      .eq('student_id', studentId)
      .eq('resolved', false)
      .order('detected_at', { ascending: false })
      .limit(30),
    // 현재 수준: 최근에 다룬 개념
    client
      .from('problem')
      .select('concept, created_at')
      .eq('student_id', studentId)
      .neq('concept', '미지정')
      .order('created_at', { ascending: false })
      .limit(20),
    // 복습: 한동안 안 본 개념
    client
      .from('problem')
      .select('concept, created_at')
      .eq('student_id', studentId)
      .neq('concept', '미지정')
      .lt('created_at', new Date(Date.now() - REVIEW_AFTER_DAYS * 864e5).toISOString())
      .order('created_at', { ascending: true })
      .limit(20),
  ]);

  const mostCommon = (rows: { concept: string }[] | null): string | null => {
    const count = new Map<string, number>();
    for (const row of rows ?? []) {
      const name = row.concept.trim();
      if (name === '' || name === '미지정') continue;
      count.set(name, (count.get(name) ?? 0) + 1);
    }
    const sorted = [...count.entries()].sort((a, b) => b[1] - a[1]);
    return sorted[0]?.[0] ?? null;
  };

  const byWant: Record<string, string | null> = {
    weak: mostCommon(weak.data),
    current: mostCommon(current.data),
    review: mostCommon(review.data),
  };

  // 원하는 쪽이 비면 다른 쪽에서 고른다. 첫날에는 셋 다 비어 있다.
  const order: ConceptPick['reason'][] =
    want === 'weak'
      ? ['weak', 'current', 'review']
      : want === 'current'
        ? ['current', 'weak', 'review']
        : ['review', 'weak', 'current'];

  for (const reason of order) {
    const concept = byWant[reason];
    if (concept !== null && concept !== undefined) return { concept, reason };
  }

  return { concept: null, reason: 'none' };
}
