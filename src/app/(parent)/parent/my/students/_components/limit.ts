/**
 * 한 계정에 등록할 수 있는 자녀 수 (COM-002 §3 · CLAUDE.md).
 *
 * **화면에서만 막는다.** 서버(`registerStudent`)와 DB 에는 아직 이 제한이
 * 없다 — 주소를 직접 치고 들어와 폼을 보내면 네 번째가 만들어진다.
 * 서버 쪽 제한은 `lib/services` 에서 따로 해야 한다.
 */
export const MAX_STUDENTS = 3;
