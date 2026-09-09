-- 회원가입 시 auth.users 와 public.account 를 함께 만든다.
-- COM-002 §20 "Supabase Auth와 Account 프로필 테이블의 정확한 연결 방식"
--
-- 왜 트리거인가
--   auth.signUp() 은 GoTrue 가 auth.users 에 쓰는 동작이라 public 스키마의
--   RLS 와 무관하다. 반면 COM-002 §3 의 프로필 필드(account_name ·
--   phone_number · birth_date · 마케팅 동의)는 public.account 에 있고,
--   이 테이블은 RLS 가 켜져 있으며 정책이 모두 to authenticated 다.
--
--   이메일 확인이 켜져 있으면 signUp 직후 세션이 없어 역할이 anon 이므로
--   account insert 가 거부된다. 확인이 꺼져 있어 통과하더라도 요청이 둘로
--   나뉘어 있어, 두 번째가 실패하면 auth.users 에는 있고 account 에는 없는
--   계정이 남는다. 앱에서 되돌릴 수 없다.
--
--   트리거는 같은 트랜잭션에서 두 행을 만든다. 프로필 생성이 실패하면
--   가입 자체가 롤백된다.
--
-- 앱에서 쓰는 법
--   supabase.auth.signUp({
--     email, password,
--     options: { data: { account_name, phone_number, birth_date,
--                        marketing_email_opt_in, ... } },
--   })
--   account 를 직접 insert 하지 않는다.

create or replace function public.handle_new_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta    jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_missing text[] := '{}';
begin
  -- COM-002 §3 의 필수 필드. 하나라도 없으면 not null 위반으로 끝나는 대신
  -- 무엇이 빠졌는지 알려준다.
  if nullif(trim(v_meta ->> 'account_name'), '') is null then
    v_missing := v_missing || 'account_name';
  end if;

  if nullif(trim(v_meta ->> 'phone_number'), '') is null then
    v_missing := v_missing || 'phone_number';
  end if;

  if nullif(trim(v_meta ->> 'birth_date'), '') is null then
    v_missing := v_missing || 'birth_date';
  end if;

  if array_length(v_missing, 1) is not null then
    raise exception
      'signUp options.data 에 필수 항목이 없습니다: %. COM-002 §3 참조.',
      array_to_string(v_missing, ', ');
  end if;

  insert into public.account (
    account_id,
    account_name,
    email,
    phone_number,
    birth_date,
    marketing_email_opt_in,
    marketing_sms_opt_in,
    marketing_alimtalk_opt_in
  )
  values (
    new.id,
    trim(v_meta ->> 'account_name'),
    new.email,
    trim(v_meta ->> 'phone_number'),
    (v_meta ->> 'birth_date')::date,
    coalesce((v_meta ->> 'marketing_email_opt_in')::boolean, false),
    coalesce((v_meta ->> 'marketing_sms_opt_in')::boolean, false),
    coalesce((v_meta ->> 'marketing_alimtalk_opt_in')::boolean, false)
  );

  return new;
end;
$$;

comment on function public.handle_new_account() is
  'COM-002 §20. auth.users insert 시 public.account 를 함께 만든다. security definer 로 RLS 를 거치지 않는다.';

-- PostgREST 는 trigger 를 반환하는 함수를 RPC 로 노출하지 않는다.
-- 그래도 20260901015948 에서 겪은 것과 같은 노출을 만들지 않도록 회수한다.
revoke all on function public.handle_new_account() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_account();

-- 앱은 account 를 직접 insert 하지 않는다. 트리거가 유일한 생성 경로이므로
-- insert 정책을 남겨두면 쓰이지 않는 쓰기 경로만 열어두는 셈이 된다.
-- 조회(select)와 수정(update) 정책은 그대로 둔다.
drop policy if exists account_insert_own on public.account;
