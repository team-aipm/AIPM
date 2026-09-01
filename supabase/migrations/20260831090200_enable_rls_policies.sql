-- RLS. COM-002 §19-4 "부모 Account와 Student 소유관계를 기준으로 설계한다"
--
-- 전제 (COM-005 §9): Supabase Auth는 부모 Account 인증만 담당한다.
-- 학생은 별도 로그인하지 않으므로 모든 접근 주체는 부모 auth.uid()다.
--
-- RLS 세부 정책은 COM-002 §20에서 미확정 항목으로 남아 있다. 이 파일은
-- "본인 Account와 그에 속한 Student의 데이터만 접근 가능"이라는 최소
-- 원칙만 구현한다. 팀 합의 후 후속 migration에서 조정한다.
--
-- service_role(lib/supabase/admin.ts)은 RLS를 우회한다. 배치·웹훅 전용이며
-- 학생·부모 요청 처리에는 쓰지 않는다. (DEV-001 §8)

-- ============================================================
-- 소유관계 판별 함수
-- ============================================================
-- 각 정책에서 student 테이블을 서브쿼리로 반복 조회하면 RLS가 재귀적으로
-- 평가된다. security definer 함수로 한 번만 확인한다.
create or replace function public.owns_student(p_student_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.student s
    where s.student_id = p_student_id
      and s.account_id = auth.uid()
  );
$$;

revoke all on function public.owns_student(uuid) from public;
grant execute on function public.owns_student(uuid) to authenticated;

-- ============================================================
-- RLS 활성화 — 정책이 없는 테이블은 전면 차단된다
-- ============================================================
alter table public.account          enable row level security;
alter table public.student          enable row level security;
alter table public.learning_session enable row level security;
alter table public.problem          enable row level security;
alter table public.message          enable row level security;
alter table public.evaluation       enable row level security;
alter table public.logic_gap        enable row level security;
alter table public.student_memory   enable row level security;
alter table public.subscription     enable row level security;
alter table public.payment          enable row level security;
alter table public.learning_report  enable row level security;
alter table public.event            enable row level security;

-- ============================================================
-- Account · 본인 행만
-- ============================================================
create policy account_select_own on public.account
  for select to authenticated
  using (account_id = auth.uid());

create policy account_insert_own on public.account
  for insert to authenticated
  with check (account_id = auth.uid());

create policy account_update_own on public.account
  for update to authenticated
  using (account_id = auth.uid())
  with check (account_id = auth.uid());

-- 삭제 정책은 두지 않는다. 회원탈퇴 처리는 COM-007 확정 후 정의한다.

-- ============================================================
-- Student · 본인 Account 소속만
-- ============================================================
create policy student_select_own on public.student
  for select to authenticated
  using (account_id = auth.uid());

create policy student_insert_own on public.student
  for insert to authenticated
  with check (account_id = auth.uid());

create policy student_update_own on public.student
  for update to authenticated
  using (account_id = auth.uid())
  with check (account_id = auth.uid());

-- 삭제 정책 없음. COM-002 §18은 물리 삭제가 아니라
-- student_status = deleted_pending 으로 처리한다.

-- ============================================================
-- 학습 데이터 · owns_student 기준
-- ============================================================
create policy learning_session_own on public.learning_session
  for all to authenticated
  using (public.owns_student(student_id))
  with check (public.owns_student(student_id));

create policy problem_own on public.problem
  for all to authenticated
  using (public.owns_student(student_id))
  with check (public.owns_student(student_id));

create policy message_own on public.message
  for all to authenticated
  using (public.owns_student(student_id))
  with check (public.owns_student(student_id));

create policy evaluation_own on public.evaluation
  for all to authenticated
  using (public.owns_student(student_id))
  with check (public.owns_student(student_id));

create policy logic_gap_own on public.logic_gap
  for all to authenticated
  using (public.owns_student(student_id))
  with check (public.owns_student(student_id));

create policy student_memory_own on public.student_memory
  for all to authenticated
  using (public.owns_student(student_id))
  with check (public.owns_student(student_id));

-- ============================================================
-- 구독 · 결제 · 리포트
-- ============================================================
-- 구독 상태 변경은 결제 웹훅(service_role)이 수행한다.
-- 부모에게는 조회만 허용한다.
create policy subscription_select_own on public.subscription
  for select to authenticated
  using (account_id = auth.uid());

-- 결제 이력은 조회만. 생성·상태 변경은 PG 웹훅(service_role)이 담당한다.
create policy payment_select_own on public.payment
  for select to authenticated
  using (account_id = auth.uid());

-- 리포트는 배치(service_role)가 생성한다. 부모는 조회만.
-- COM-002 §13 "구독 종료 후 기존 리포트 조회 가능"
create policy learning_report_select_own on public.learning_report
  for select to authenticated
  using (public.owns_student(student_id));

-- ============================================================
-- Event · 본인 관련 행만
-- ============================================================
create policy event_select_own on public.event
  for select to authenticated
  using (
    account_id = auth.uid()
    or (student_id is not null and public.owns_student(student_id))
  );

create policy event_insert_own on public.event
  for insert to authenticated
  with check (
    account_id = auth.uid()
    or (student_id is not null and public.owns_student(student_id))
  );
