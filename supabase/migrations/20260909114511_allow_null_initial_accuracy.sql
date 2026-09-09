-- initial_accuracy 를 NULL 허용으로 바꾼다.
--
-- 프롬프트가 최초 정답을 "관찰하지 못한" 경우를 표현해야 한다. MODE B 는
-- 학생이 AI 의 오류를 찾는 구조라 "최초 정답" 이라는 개념이 성립하지 않는
-- 경우가 정상적으로 생긴다.
--
-- false 는 "틀렸다" 를 뜻하므로 쓸 수 없다. transfer_score ·
-- reflection_score 를 이미 같은 이유로 NULL 허용했다. (COM-002 §8)
--
-- NULL 은 정답률 계산에서 제외한다. false 로 치환하지 않는다.
alter table public.evaluation
  alter column initial_accuracy drop not null;

comment on column public.evaluation.initial_accuracy is
  '최초 정답 여부. 관찰하지 못했으면 NULL. false(틀림)와 구분한다';
