import 'server-only';

/**
 * prompt-lab 접근 통제.
 *
 * 이 도구는 원래 개발 서버 전용이었다. 배포본에서도 열기로 하면서
 * 잠금이 필요해졌다. 주소만 알면 누구나 들어오고, 서버의 Gemini 키가
 * 그대로 쓰이기 때문이다.
 *
 * ## 통과 암호를 없앴다 (2026-09-18)
 *
 * 전에는 팀 공용 암호(`PROMPT_LAB_PASSCODE`)를 물었다. 그때는 어드민이
 * 없어서 기댈 것이 그것뿐이었다. 지금은 `admin_user` 가 있다.
 *
 * ```text
 * 예전   팀이 공유하는 문자열 하나. 나가는 사람이 생겨도 그대로 유효
 * 지금   admin_user 에 행이 있는 사람만. 행은 SQL 로만 넣는다
 * ```
 *
 * **암호를 없앤 것이 문을 연 것은 아니다.** 오히려 좁혔다 — 공용 문자열은
 * 퍼지면 회수할 수 없지만, 운영자 행은 `is_active` 를 내리면 그 순간
 * 막힌다. 어드민에서 프롬프트랩으로 가는 링크를 둔 것도 이 때문이다.
 *
 * ```text
 * 개발 서버   항상 열림
 * 배포본      운영자만. 아니면 404
 * ```
 *
 * 404 인 이유는 어드민과 같다 — 「권한이 없습니다」는 여기 무엇이 있다는
 * 것을 알려주는 답이다(COM-003 §4.8).
 */

import { currentAdmin } from '@/lib/services/admin';

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * 들어와도 되는 사람인가.
 *
 * 개발 서버에서는 묻지 않는다. 학생·부모 데이터를 다루지 않는 도구이고,
 * 로컬에서 쓰려고 매번 운영자 계정으로 로그인하게 하면 도구를 안 쓰게 된다.
 */
export async function isUnlocked(): Promise<boolean> {
  if (!isProduction()) return true;
  return (await currentAdmin()) !== null;
}

/**
 * 서버에서 키를 대신 써 줄지.
 *
 * 배포본에서는 쓰지 않는다. 운영자라도 세팅 담당 개인의 Gemini 키로
 * 무제한 호출하게 두지 않는다. 각자 화면에 자기 키를 넣는다.
 */
export function allowServerApiKey(): boolean {
  return !isProduction();
}
