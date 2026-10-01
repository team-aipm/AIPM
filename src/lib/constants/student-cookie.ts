/**
 * 지금 보고 있는 학생을 담는 쿠키 이름.
 *
 * `'use server'` 파일은 async 함수만 내보낼 수 있어서 상수를 거기 둘 수
 * 없다. 고르는 쪽(Server Action)과 읽는 쪽(화면)이 같은 이름을 써야 하므로
 * 여기 한 곳에 둔다.
 *
 * **이 쿠키는 권한이 아니다.** 남의 학생 id 가 들어 있어도 RLS 가 행을 안
 * 돌려주므로 화면에는 아무것도 안 나온다. "누구를 보고 있는가" 일 뿐이다.
 */
export const STUDENT_COOKIE = 'aipm_student';

/**
 * 지난 미션을 이어 하는 중일 때 그 세션 id (COM-001 §11-2).
 *
 * 미션 화면과 서버 액션은 이 쿠키가 있으면 오늘 세션 대신 그 세션을 쓴다.
 * **이 쿠키도 권한이 아니다.** 읽는 쪽(`findPastSession`)이 본인 것인지 ·
 * 7일 안인지 · 아직 안 끝났는지를 매번 다시 본다. 아니면 오늘 세션으로 돌아간다.
 */
export const PAST_SESSION_COOKIE = 'aipm_past_session';
