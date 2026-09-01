-- COM-002 v1.1 §8 · transfer_score · reflection_score 의 Required 를
-- YES → NO 로 확정했다.
--
-- Drill-down 은 학생이 충분히 이해했으면 조기 종료한다. (COM-001 §7)
-- 이때 전이·성찰을 묻지 않고 문제가 끝나는 경우가 정상적으로 생긴다.
-- 0 은 "적용하지 못함"을 뜻하므로 "묻지 않음"에 쓸 수 없다.
--
-- NULL 은 평균·추이 계산에서 제외한다. 0 으로 치환하지 않는다.
--   → StudentMemory.transfer_level 갱신 규칙
--     docs/prompts/logic-auditor.md Prompt 05

alter table public.evaluation
  alter column transfer_score drop not null;

alter table public.evaluation
  alter column reflection_score drop not null;

comment on column public.evaluation.transfer_score is
  'COM-002 §8. 0~2. 전이를 묻지 않고 종료했으면 NULL. 0 으로 치환 금지.';
comment on column public.evaluation.reflection_score is
  'COM-002 §8. 0~2. 성찰을 묻지 않고 종료했으면 NULL. 0 으로 치환 금지.';
