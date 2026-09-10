-- 아이 계정에는 부모 프로필을 만들지 않는다 (COM-002 §4-1)
--
-- `on_auth_user_created` 는 `auth.users` 에 행이 생길 때마다 `public.account`
-- 를 함께 만든다. 부모 가입만 있던 때는 그것이 맞았다.
--
-- 아이 계정이 생기면서 깨졌다. 아이에게는 `account_name` · `phone_number` ·
-- `birth_date` 가 없다 — 받지 않기로 한 값들이다(COM-007 §2-2-1). 트리거는
-- 그것을 "빠뜨렸다" 고 보고 가입을 통째로 되돌렸다.
--
--   [student-login] 선점 실패: Database error creating new user
--
-- 화면에는 "이미 쓰고 있는 아이디이거나, 만들 수 없는 아이디입니다" 로
-- 보였다. 아이디는 멀쩡했다.
--
-- ## 아이인지 어떻게 아는가
--
-- 둘을 함께 본다.
--
--   raw_user_meta_data ->> 'role' = 'student'
--   email 이 학생 도메인으로 끝난다
--
-- **하나만 보면 부족하다.** `role` 은 가입할 때 앱이 보내는 값이라 누구나
-- 실을 수 있고, 도메인도 형식만 맞으면 회원가입 화면에 칠 수 있다. 둘 다
-- 맞춰 넣는다고 얻는 것도 없다 — `account` 가 없는 계정이 되어 로그인해도
-- 할 수 있는 일이 없다. 그래도 우연히 통과하는 길은 막아 둔다.
--
-- 학생 도메인을 바꾸면 여기와 `lib/constants/student-login.ts` 를 **함께**
-- 고쳐야 한다.

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
  -- 아이 계정이면 여기서 끝난다. 부모 프로필이 없는 것이 정상이다.
  if v_meta ->> 'role' = 'student'
     and new.email like '%@student.aipm.invalid' then
    return new;
  end if;

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
  'COM-002 §20. auth.users insert 시 public.account 를 함께 만든다. 아이 계정(role=student)은 건너뛴다.';

revoke all on function public.handle_new_account() from public, anon, authenticated;
