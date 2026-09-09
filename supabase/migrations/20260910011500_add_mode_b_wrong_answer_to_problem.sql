-- MODE B 에서 AI 가 만든 의도적 오답을 담는다. COM-002 §20-A (2026-09-10 승인)
--
-- 왜 필요한가
--   MODE B 는 학생이 문제를 가져오고 AI 가 일부러 틀리게 푼 뒤, 학생이 그
--   오류를 잡아내는 방식이다(COM-001). 프롬프트 03 은 자기가 만든 오답을
--   다음 턴 입력으로 다시 받는다. 담을 자리가 없으면 AI 가 그것을 잊고,
--   남는 차이는 "문제를 누가 내느냐" 뿐이라 MODE A 와 같아진다.
--
--   verified_answer 에 섞을 수 없다. 그건 검증된 정답이다(§6 · §17).
--
-- 셋 다 선택이다. MODE A 문제에서는 비어 있다.

alter table public.problem
  add column ai_wrong_answer      jsonb,
  add column ai_wrong_reasoning   text,
  add column target_misconception text;

comment on column public.problem.ai_wrong_answer is
  'COM-002 §6. MODE B 에서 AI 가 만든 의도적 오답. **학생·부모 화면에 노출 금지** — verified_answer 와 같은 취급이다(§17). MODE A 에서는 NULL.';
comment on column public.problem.ai_wrong_reasoning is
  'COM-002 §6. 그 오답의 논리. 내부 값이며 화면에 나가지 않는다.';
comment on column public.problem.target_misconception is
  'COM-002 §6. 겨냥한 오개념. 내부 값이며 화면에 나가지 않는다.';
