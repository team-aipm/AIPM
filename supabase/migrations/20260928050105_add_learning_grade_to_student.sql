-- 학년을 넘나드는 출제 (COM-001 §9 · COM-002 §4)
--
-- 4학년 아이가 4학년 레벨 1 에서도 막히면 3학년으로 내려가야 한다.
-- 결손이 있는 아이에게 제 학년 문제만 주면 아무것도 되지 않는다.
--
-- `grade` 는 실제 학년이라 쓸 수 없다. 부모가 고치기 전에는 안 움직이는
-- 값이고, 4~6 으로 묶여 있다. 지금 푸는 학년은 따로 담는다.
--
--     grade            4~6    실제 학년
--     learning_grade   1~7    지금 푸는 학년 (7 = 중1)
--
-- 바닥은 1학년(`1 + 1` 수준), 천장은 중1 이다. 천장을 중1 로 둔 것은
-- 6학년 레벨 5 를 뚫는 아이가 실제로 나오는지 아직 모르기 때문이다.

alter table public.student
  add column if not exists learning_grade smallint;

-- 기존 행은 제 학년에서 시작한 것으로 본다. 난이도는 이미 1~5 로 있다.
update public.student
  set learning_grade = grade
  where learning_grade is null;

alter table public.student
  alter column learning_grade set not null;

-- 새로 등록하는 아이도 제 학년에서 시작한다 (COM-001 §9 첫날).
-- 기본값을 5 로 두는 것은 MVP 대상 4~6 의 가운데라서다. 등록 화면이
-- grade 를 함께 넣으므로 실제로 이 기본값이 쓰이는 일은 드물다.
alter table public.student
  alter column learning_grade set default 5;

alter table public.student
  add constraint student_learning_grade_range
  check (learning_grade between 1 and 7);

comment on column public.student.learning_grade is
  'COM-002 §4. 지금 푸는 학년. 1~7 (7 = 중1). grade 는 실제 학년이라 다른 값이다. 학생·부모 화면에 노출하지 않는다.';

comment on column public.student.current_difficulty is
  'COM-002 §6. learning_grade 안에서의 상대값 1~5. 학년이 다르면 같은 숫자라도 다른 문제다.';
