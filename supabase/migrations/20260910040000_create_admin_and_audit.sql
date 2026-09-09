-- 운영자 계정 · 감사 로그 · 동의 이력. COM-007 §13 (2026-09-10 승인)
--
-- 세 가지가 없어서 ADM 영역을 만들 수 없었다.
--   AdminUser   운영자와 권한 등급 (COM-007 §7-2)
--   AuditLog    마스킹 해제와 대화 열람 기록 (§7-3)
--   동의 이력    약관 버전별 동의 (§11)
--
-- **운영자는 부모 계정과 별개다.** 같은 auth.users 를 쓰되, 이 표에
-- 없으면 어드민이 아니다. 부모가 스스로 운영자가 될 수 없다.

create type public.admin_role as enum ('full', 'cs', 'readonly');

create table public.admin_user (
  admin_id    uuid primary key references auth.users (id) on delete cascade,
  admin_name  text              not null,
  email       text              not null,
  admin_role  public.admin_role not null default 'readonly',
  is_active   boolean           not null default true,
  created_at  timestamptz       not null default now(),
  last_seen_at timestamptz
);

comment on table public.admin_user is
  'COM-007 §7-2. 운영자 계정과 권한 등급. 여기 없으면 어드민이 아니다.';

-- 감사 로그. **마스킹 해제와 대화 원문 열람은 반드시 남긴다**(§7-3).
-- 누가 · 언제 · 무엇을 · 왜 봤는지가 없으면 §7 의 규칙은 글일 뿐이다.
create table public.audit_log (
  audit_id    uuid primary key default gen_random_uuid(),
  admin_id    uuid        not null references public.admin_user (admin_id) on delete restrict,
  action      text        not null,
  target_type text        not null,
  target_id   text        not null,
  reason      text,
  created_at  timestamptz not null default now()
);

comment on column public.audit_log.reason is
  'COM-007 §7-1. 마스킹 해제는 사유가 필수다. 조회만 하는 행동은 비어 있을 수 있다.';

create index audit_log_admin_created_idx on public.audit_log (admin_id, created_at desc);
create index audit_log_target_idx on public.audit_log (target_type, target_id);

-- 동의 이력. 약관은 개정되므로 **버전이 함께 남아야 한다**(§11).
create table public.consent_log (
  consent_id     uuid primary key default gen_random_uuid(),
  account_id     uuid        not null references public.account (account_id) on delete cascade,
  consent_type   text        not null,
  document_version text      not null,
  agreed         boolean     not null,
  agreed_at      timestamptz not null default now()
);

create index consent_log_account_idx on public.consent_log (account_id, agreed_at desc);

-- ============================================================
-- RLS · 셋 다 켠다 (DEV-003 §4-5 "RLS 없는 테이블은 만들지 않는다")
-- ============================================================
alter table public.admin_user  enable row level security;
alter table public.audit_log   enable row level security;
alter table public.consent_log enable row level security;

-- 운영자인지 확인한다. security definer 라 RLS 를 거치지 않는다 —
-- 그러지 않으면 자기 자신을 확인하려고 admin_user 를 읽어야 하고,
-- 그 정책이 다시 이 함수를 부른다.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.admin_user
    where admin_id = auth.uid() and is_active
  );
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- 운영자는 자기 행만 본다. 목록은 어드민 화면이 service_role 로 읽는다.
create policy admin_user_select_self on public.admin_user
  for select to authenticated
  using (admin_id = auth.uid());

-- 감사 로그는 **지우거나 고칠 수 없다.** 남기는 것과 보는 것만 있다.
create policy audit_log_insert_admin on public.audit_log
  for insert to authenticated
  with check (public.is_admin() and admin_id = auth.uid());

create policy audit_log_select_admin on public.audit_log
  for select to authenticated
  using (public.is_admin());

-- 동의 이력은 본인 것만. 운영자 조회는 service_role 로 한다.
create policy consent_log_select_own on public.consent_log
  for select to authenticated
  using (account_id = auth.uid());

create policy consent_log_insert_own on public.consent_log
  for insert to authenticated
  with check (account_id = auth.uid());
