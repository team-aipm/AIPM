/**
 * Gemini 모델 목록.
 *
 * COM-005 §13의 모델 라우팅은 아직 미확정이다. 단계별로 어떤 모델을 쓸지
 * 정하는 것이 prompt-lab 을 만든 이유이므로, 여기 목록은 "자주 쓰는 후보"일
 * 뿐이고 화면에서 임의의 모델명을 직접 입력할 수 있다.
 *
 * 목록에 없는 이름을 넣으면 Gemini API가 404를 돌려준다. 화면이 그 오류를
 * 그대로 보여주므로, 존재하지 않는 모델은 실행 즉시 드러난다.
 */

export const GEMINI_MODEL_CANDIDATES = [
  'gemini-flash-latest',
  'gemini-pro-latest',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-2.5-pro',
  'gemini-2.5-flash',
] as const;

/**
 * 단계별로 정해지기 전까지 쓰는 기본값. 확정되면 COM-005 §13에 기록한다.
 *
 * `gemini-2.5-flash`는 (이 프로젝트 키 기준, 2026-09) `generateContent`
 * 호출 시 "새 사용자에게는 더 이상 제공되지 않는다"며 404를 낸다 —
 * ListModels 목록엔 여전히 보이지만 실제 호출은 막혀 있다. `-latest`
 * 별칭을 쓰면 이런 모델 세대교체를 프롬프트/코드 수정 없이 흡수한다.
 */
export const DEFAULT_GEMINI_MODEL = 'gemini-flash-latest';
