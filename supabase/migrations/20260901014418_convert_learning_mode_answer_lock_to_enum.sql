-- COM-002 v1.1 §6 · PM 전원 합의로 두 상태값이 확정되었다.
-- 20260831090000_create_enum_types.sql 은 값이 미정이라 TEXT로 두었고,
-- 그 파일의 주석이 "확정 후 enum으로 전환한다"고 예고한 작업이다.
-- 기존 migration 파일은 수정하지 않고 여기에 추가한다. (CLAUDE.md)
--
-- 판정 기준: docs/prompts/logic-auditor.md Prompt 02 · Prompt 06

create type public.learning_mode as enum ('mode_a', 'mode_b');

create type public.answer_lock_status as enum (
  'locked',
  'recheck',
  'invalid_problem'
);

-- 기존 행은 없다. PR #1의 스키마는 아직 어느 환경에도 적용되지 않았다.
-- using 절은 이후 재적용 시를 위해 남긴다.
alter table public.problem
  alter column learning_mode type public.learning_mode
    using learning_mode::public.learning_mode;

alter table public.problem
  alter column answer_lock_status type public.answer_lock_status
    using answer_lock_status::public.answer_lock_status;

comment on column public.problem.learning_mode is
  'COM-002 §6. mode_a = 학생이 답과 이유를 설명. mode_b = AI 의도오답을 학생이 교정.';
comment on column public.problem.answer_lock_status is
  'COM-002 §6. invalid_problem 이면 problem_status 를 verification_failed 로 둔다.';
