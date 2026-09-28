-- 문제를 낼 때의 학년도 남긴다 (COM-002 §6)
--
-- `difficulty` 는 이미 「낼 때의 수준」을 담고 있다. 학년을 넘나들게
-- 되면서(COM-001 §9) 그것만으로는 모자라다 — **4학년 레벨 5 와 5학년
-- 레벨 5 가 구분되지 않는다.**
--
-- 난이도 판정은 「현재 수준에서 푼 평가만」 본다(§9 판정 시점). 학년이
-- 바뀌었는데 레벨이 같으면 옛 학년의 평가를 계속 세게 되고, 그러면 방금
-- 옮긴 학년에서 곧바로 또 움직인다.

alter table public.problem
  add column if not exists learning_grade smallint;

-- 기존 행은 그 학생의 지금 학년에서 낸 것으로 본다. 학년을 넘나들기
-- 전에 쌓인 것이라 모두 제 학년이다.
update public.problem p
  set learning_grade = s.learning_grade
  from public.student s
  where p.student_id = s.student_id
    and p.learning_grade is null;

alter table public.problem
  alter column learning_grade set not null;

alter table public.problem
  add constraint problem_learning_grade_range
  check (learning_grade between 1 and 7);

comment on column public.problem.learning_grade is
  'COM-002 §6. 이 문제를 낼 때의 학년. 1~7 (7 = 중1). difficulty 는 이 학년 안에서의 수준이다.';
