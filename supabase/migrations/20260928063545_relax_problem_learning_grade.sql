-- problem.learning_grade 를 nullable 로 되돌린다 (긴급)
--
-- 바로 앞 마이그레이션(20260928050524)이 `not null` 로 넣었는데 **기본값이
-- 없다.** 배포된 코드는 아직 이 칸을 모르므로 `createProblem` 의 INSERT 가
-- 전부 실패했다 — 문제 출제가 통째로 막힌 것이다.
--
-- **스키마를 코드보다 먼저 조인 것이 원인이다.** 칸을 더할 때는 옛 코드가
-- 그대로 돌아야 한다.
--
-- 기본값을 5 로 주는 방법도 있으나 그러면 4학년 아이의 문제가 5학년으로
-- 기록된다. **틀린 값보다 빈 값이 낫다** — 빈 값은 「이 칸이 생기기 전에
-- 만들어진 문제」 라고 읽히고, 난이도 판정에서도 지금 자리와 안 맞아
-- 자연히 빠진다.
--
-- 코드가 배포된 뒤에는 새로 만드는 문제에 값이 늘 들어간다. 그때 다시
-- `not null` 로 조일지는 옛 행을 어떻게 할지와 함께 정한다.

alter table public.problem
  alter column learning_grade drop not null;

comment on column public.problem.learning_grade is
  'COM-002 §6. 이 문제를 낼 때의 학년. 1~7 (7 = 중1). NULL 은 이 칸이 생기기 전에 만들어진 문제다. difficulty 는 이 학년 안에서의 수준이다.';
