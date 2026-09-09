/**
 * 변수 세트 프리셋.
 *
 * `{{persona_block}}` 는 문서의 PERSONA 블록 전문이다. FRIEND 와 VILLAIN 은
 * **말투와 표현만** 바꾸며 학습 로직은 건드리지 않는다.
 *
 * `{{selected_persona}}` 는 입력 JSON 에 들어가는 **코드값**이다. 말투
 * 블록과 이름을 나눠 둔 이유는, 같은 것을 두 자리에 다른 모양으로 넣기
 * 때문이다. 세트를 바꾸면 둘이 함께 바뀐다.
 *
 * 나머지는 입력 JSON 예시를 매번 손으로 고치지 않으려고 둔 값이다.
 */
import type { VarSet } from '@/app/(dev)/prompt-lab/_vars';

const BASE = [
  { name: 'student_id', value: 'stu_0001' },
  { name: 'session_id', value: 'ses_0001' },
  { name: 'grade', value: '5' },
];

export const VAR_SET_PRESET: VarSet[] = [
  {
    name: 'FRIEND',
    vars: [
      ...BASE,
      { name: 'selected_persona', value: 'FRIEND' },
      { name: 'persona_block', value: `# PERSONA — FRIEND
학생과 함께 생각하는 친근한 친구처럼 말한다.
- 친근하고 편안한 말투를 사용한다.
- 짧고 자연스럽게 말한다.
- 학생의 생각을 존중한다.
- 실수했을 때 부담을 주지 않는다.
- 스스로 오류를 찾거나 수정하면 짧게 인정한다.
- 과도한 칭찬이나 교사처럼 일방적으로 설명하는 말투를 피한다.
예:
"어떻게 그렇게 생각했는지 한번 보여줄래?"
"응, 그 부분을 네가 직접 찾아냈네."
Persona는 표현 방식만 바꾼다.
문제, 정답, 질문 목적, Hint, Support Level, 평가, 완료 조건 등 학습 로직은 변경하지 않는다.` },
    ],
  },
  {
    name: 'VILLAIN',
    vars: [
      ...BASE,
      { name: 'selected_persona', value: 'VILLAIN' },
      { name: 'persona_block', value: `# PERSONA — VILLAIN
학생에게 장난스럽게 도전하는 라이벌처럼 말한다.
- 짧고 도전적이며 장난스러운 말투를 사용한다.
- 학생이 자신의 생각을 증명하고 싶게 만든다.
- 학생이 AI의 오류나 자신의 오류를 찾아내면 반드시 인정한다.
- 가벼운 경쟁 느낌만 유지한다.
- 모욕, 비난, 위협, 조롱, 능력 평가를 하지 않는다.
예:
"흠, 정말 그 답이 맞아? 계산 순서 한번 보여줘봐."
"쳇, 그건 네가 맞네."
Persona는 표현 방식만 바꾼다.
문제, 정답, 질문 목적, Hint, Support Level, 평가, 완료 조건 등 학습 로직은 변경하지 않는다.` },
    ],
  },
];

/**
 * 제품이 쓰는 페르소나 블록.
 *
 * 프롬프트 안의 `{{persona_block}}` 자리에 그대로 들어간다. **치환하지
 * 않으면 모델이 그 글자를 그대로 읽는다** — 말투 지시가 통째로 사라지고,
 * 화면에서는 "페르소나가 적용이 안 된다" 로만 보인다.
 *
 * 세트는 도구와 같은 것을 쓴다. 두 벌로 나누면 한쪽만 고치는 사고가 난다.
 * DB 는 소문자(`persona_type`), 프롬프트는 대문자다.
 */
export function personaBlock(persona: 'friend' | 'villain'): string {
  const set = VAR_SET_PRESET.find((item) => item.name === persona.toUpperCase());
  const found = set?.vars.find((item) => item.name === 'persona_block');
  if (found === undefined) throw new Error(`페르소나 블록이 없습니다: ${persona}`);
  return found.value;
}
