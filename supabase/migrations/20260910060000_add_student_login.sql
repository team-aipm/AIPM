-- 아이가 자기 아이디로 로그인한다 (COM-005 §9 · COM-002 §4)
--
-- 지금까지 Supabase Auth 는 부모 Account 인증만 맡았고, 아이는 부모가
-- 로그인한 기기에서 프로필을 골라 들어왔다. 이제 아이도 자기 계정으로
-- 들어온다.
--
-- **부모가 만들어 준다.** 아이가 스스로 가입하지 않는다 — 만 14세 미만의
-- 가입에는 법정대리인 동의가 필요하고(COM-007 §2), 아이에게 이메일 주소를
-- 받지 않기 위해서다. 아이디는 서버에서 가짜 이메일로 바뀌어 Auth 에
-- 들어간다(`lib/constants/student-login.ts`).

-- ============================================================
-- 컬럼
-- ============================================================
-- 둘 다 nullable 이다. **로그인은 선택이다** — 이미 있는 학생에게는 없고,
-- 부모가 안 만들어 주기로 할 수도 있다. 그때 아이는 지금까지처럼 부모
-- 기기에서 들어온다.
alter table public.student
  add column login_id text,
  add column auth_user_id uuid references auth.users(id) on delete set null;

-- 아이디는 가짜 이메일의 앞부분(`<login_id>@...`)이 된다. 그래서 이메일
-- local-part 로 쓸 수 있는 글자만 받는다. **한글은 못 쓴다.**
alter table public.student
  add constraint student_login_id_format
  check (login_id is null or login_id ~ '^[a-z0-9_]{4,20}$');

-- 아이디 하나에 학생 하나. 겹치면 가짜 이메일이 겹쳐 Auth 가 거절한다.
create unique index student_login_id_key on public.student (login_id);
create unique index student_auth_user_id_key on public.student (auth_user_id);

comment on column public.student.login_id is
  '아이가 로그인할 때 입력하는 아이디. 부모가 정한다. null 이면 아이 로그인 없음';
comment on column public.student.auth_user_id is
  '아이 계정의 auth.users.id. login_id 와 함께 생기고 함께 없어진다';

-- ============================================================
-- 소유관계 — 이 함수 하나가 학습 데이터 정책 전부를 정한다
-- ============================================================
-- `learning_session` · `problem` · `message` · `evaluation` · `logic_gap` ·
-- `student_memory` · `learning_report` 가 모두 이 함수를 쓴다. 그래서
-- **여기 한 곳만 고치면 아이도 자기 학습 데이터를 읽고 쓸 수 있다.**
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
      and (s.account_id = auth.uid() or s.auth_user_id = auth.uid())
  );
$$;

-- ============================================================
-- Student · 부모의 것이거나, 자기 자신이거나
-- ============================================================
drop policy student_select_own on public.student;
create policy student_select_own on public.student
  for select to authenticated
  using (account_id = auth.uid() or auth_user_id = auth.uid());

drop policy student_update_own on public.student;
create policy student_update_own on public.student
  for update to authenticated
  using (account_id = auth.uid() or auth_user_id = auth.uid())
  with check (account_id = auth.uid() or auth_user_id = auth.uid());

-- insert 는 그대로 둔다(`account_id = auth.uid()`). 아이는 계정이 아니므로
-- 학생을 만들 수 없다.

-- ============================================================
-- 아이가 자기 행에서 바꿀 수 있는 것은 파트너 하나뿐이다
-- ============================================================
-- RLS 는 행 단위라 "이 컬럼만" 을 못 적는다. 정책만으로는 아이가 자기
-- 난이도나 학년을 바꿀 수 있게 된다 — 화면에는 그런 버튼이 없지만, 브라우저
-- 에서 직접 요청을 만들면 통한다.
--
-- 난이도는 학습 기록에서 자동으로 정해져야 한다. 사람이 고치면 다음 문제
-- 선정이 어긋난다(COM-003 §9).
create or replace function public.guard_student_self_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 배치와 운영자(service_role)는 auth.uid() 가 없다. 부모는 자기 아이를
  -- 다 고칠 수 있다. 둘 다 그대로 통과시킨다.
  if auth.uid() is null or old.account_id = auth.uid() then
    return new;
  end if;

  if new.account_id               is distinct from old.account_id
  or new.auth_user_id             is distinct from old.auth_user_id
  or new.login_id                 is distinct from old.login_id
  or new.student_name             is distinct from old.student_name
  or new.nickname                 is distinct from old.nickname
  or new.nickname_source          is distinct from old.nickname_source
  or new.birth_date               is distinct from old.birth_date
  or new.grade                    is distinct from old.grade
  or new.current_difficulty       is distinct from old.current_difficulty
  or new.student_status           is distinct from old.student_status
  or new.deleted_at               is distinct from old.deleted_at
  or new.learning_data_retain_until is distinct from old.learning_data_retain_until
  then
    raise exception '학생 계정으로는 파트너만 바꿀 수 있습니다';
  end if;

  return new;
end;
$$;

create trigger student_self_update_guard
  before update on public.student
  for each row execute function public.guard_student_self_update();

-- ============================================================
-- 부모만 보는 것 — 주간 리포트
-- ============================================================
-- `owns_student()` 에 아이를 넣는 순간 아이도 `learning_report` 를 읽게
-- 된다. 거기에는 **부모용 주간 리포트(`weekly_parent`)** 가 들어 있고, 그
-- 안에는 사고능력 점수와 자주 막힌 부분이 문장으로 적혀 있다.
--
-- 학생 화면에 상세 평가와 Logic Gap 을 보이지 않기로 했다(COM-003 §7).
-- **화면에 안 그리는 것만으로는 부족하다** — 주소를 치면 그만이다. 행을
-- 주지 않는다.
--
-- 아이가 읽는 것은 하루 총평(`daily_student`) 하나다. 그것은 아이에게 하는
-- 말로 쓰여 있고 「오늘의 기록」(STU-005)이 그것을 그린다.
create or replace function public.parent_of_student(p_student_id uuid)
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

revoke all on function public.parent_of_student(uuid) from public;
grant execute on function public.parent_of_student(uuid) to authenticated;

drop policy learning_report_select_own on public.learning_report;
create policy learning_report_select_own on public.learning_report
  for select to authenticated
  using (
    public.parent_of_student(student_id)
    or (report_type = 'daily_student' and public.owns_student(student_id))
  );
