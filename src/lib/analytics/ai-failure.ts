import 'server-only';

/**
 * AI 호출이 깨진 것을 남긴다 (COM-002 §14 · 2026-09-17).
 *
 * **이건 어느 테이블에도 안 남는다.** 단계 호출이 실패하면 학생에게는
 * 「다시 말해줄래?」 하고 넘어가므로 `problem` 에도 `message` 에도 흔적이
 * 없다. 어느 단계가 · 왜 · 얼마나 자주 깨지는지는 이것 말고 알 길이 없다.
 *
 * ## 세 가지를 지킨다
 *
 * ```text
 * 던지지 않는다     기록 때문에 학습이 멈추면 그게 더 큰 손해다
 * 기다리지 않는다   학생은 답을 기다리는 중이다. 뒤에서 남긴다
 * 원문을 안 넣는다  단계 이름과 오류 머리말만. 대화도 문제도 넣지 않는다
 * ```
 *
 * service_role 로 쓴다. 학생 세션으로 쓰면 **이미 실패한 요청의 클라이언트**를
 * 다시 태워야 하는데, 그 실패가 세션 문제일 수도 있다. 운영 기록이라
 * DEV-001 §8 이 허용하는 쪽(배치·운영 작업)에 든다.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { EVENT, record } from '@/lib/analytics/events';

/**
 * 오류 글에서 남길 만큼만 자른다.
 *
 * `Gemini 503\n{"error":{...}}` 처럼 본문이 딸려 온다. 첫 줄이면 무엇이
 * 깨졌는지 알기에 충분하고, 뒤에 무엇이 들어 있을지는 알 수 없다.
 */
function head(error: string): string {
  return error.split('\n')[0].slice(0, 200);
}

export function recordAiFailure(
  who: { studentId?: string; sessionId?: string },
  stage: string,
  error: string,
): void {
  // 학생을 모르면 남기지 않는다. RLS 를 우회해 쓰는 줄이라, 누구 것인지
  // 모르는 행을 쌓아 두면 나중에 지울 근거도 없다.
  if (who.studentId === undefined) return;

  // **await 하지 않는다.** 학생은 화면 앞에서 기다리는 중이다.
  void record(createAdminClient(), EVENT.aiCallFailed, who, {
    stage,
    error: head(error),
  }).catch(() => {
    // `record` 가 이미 삼키지만, 클라이언트를 만들다 터질 수도 있다.
  });
}
