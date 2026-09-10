-- 어느 말이 힌트였는지 남긴다 (COM-002 §7)
--
-- 04 HINT 는 "이전에 제공한 Hint 를 반복하지 않는다" 는 규칙을 갖고 있다.
-- 그런데 **앞서 무엇을 줬는지 알려 준 적이 없다** — 코드가 `hint_count` 를
-- 0, `hint_history` 를 빈 배열로 고정해 보내고 있었다. 그래서 힌트 버튼을
-- 몇 번을 눌러도 매번 "첫 힌트" 였고, 같은 말이 되풀이됐다.
--
--   오, 제법인데? 그럼 그 '어떤 수'는 무엇이고 …
--   오, 제법인데? '어떤 수'를 먼저 구하려는 거군 …
--   오, 제법인데? 그럼 그 '어떤 수'를 구했다면 …
--
-- 이력을 넘기려면 쌓인 말 중 무엇이 힌트였는지 가려낼 수 있어야 한다.
--
-- `support_level` 로는 못 가린다. MODE A · B 의 보통 턴도 도움 수준을
-- 함께 남긴다. `drilldown_stage` 도 아니다 — 그 값은 사고 단계이지
-- 「이 말이 힌트였다」가 아니다.
--
-- 기본값이 false 라 이미 쌓인 대화는 그대로 보통 턴으로 남는다.

alter table public.message
  add column is_hint boolean not null default false;

comment on column public.message.is_hint is
  '04 HINT 가 준 말인가. 다음 힌트에 이력으로 넘겨 같은 말을 되풀이하지 않게 한다';

-- 힌트만 골라 읽는 일이 매 힌트마다 일어난다.
create index message_hint_idx on public.message (problem_id) where is_hint;
