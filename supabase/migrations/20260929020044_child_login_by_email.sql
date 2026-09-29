-- 아이도 이메일로 로그인한다 (COM-007 §2-2 · COM-002 §4)
--
-- 전에는 아이디를 받아 서버가 가짜 이메일로 바꿔 Auth 에 넘겼다.
--
--     아이가 치는 것    jaeun2016
--     Auth 가 받는 것   jaeun2016@student.aipm.invalid
--
-- 로그인 화면을 부모·아이 공통으로 두고 아이도 이메일로 들어오게 하면서
-- 그 장치가 필요 없어졌다(정책 v0.1 §5 · §7 · §8). 부모가 **아이가 이미
-- 쓰는 이메일**을 입력한다.
--
-- ## 아이 판별을 app_metadata 로 옮긴다
--
-- 트리거가 아이를 가려내던 방법이 도메인이었다.
--
--     role = 'student' AND email like '%@student.aipm.invalid'
--
-- 실제 이메일이 되면 이 조건이 깨져 **아이에게도 부모 프로필이 생긴다.**
--
-- `app_metadata` 는 `service_role` 만 쓸 수 있다. 아이 계정은
-- `auth.admin.createUser` 로만 만들어지므로 거기에 표식을 넣는다.
-- **지금보다 튼튼하다** — `user_metadata.role` 은 누구나 signUp 에 실을 수
-- 있어서, 예전 주석도 「하나만 보면 부족하다」 고 적어 두고 있었다.
--
-- ## 기존 아이 계정
--
-- 가짜 이메일로 만들어진 다섯은 이 마이그레이션 전에 지웠다. 학습기록은
-- 남겼다 — 로그인 방식과 무관하다. 부모가 이메일로 다시 만든다.

alter table public.student
  add column if not exists login_email text;

-- 한 이메일로 두 아이를 만들 수 없다. auth.users.email 이 이미 유일하지만,
-- student 쪽에도 두어 사본이 어긋나지 않게 한다.
create unique index if not exists student_login_email_key
  on public.student (login_email)
  where login_email is not null;

comment on column public.student.login_email is
  'COM-002 §4. 아이가 로그인할 때 쓰는 이메일. 부모가 입력한다. auth.users.email 의 표시용 사본이다.';

-- 아이디는 더 쓰지 않는다. 제약과 인덱스도 함께 사라진다.
alter table public.student
  drop column if exists login_id;

-- ── 트리거 ──────────────────────────────────────────────────────────
create or replace function public.handle_new_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta    jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_app     jsonb := coalesce(new.raw_app_meta_data, '{}'::jsonb);
  v_consent jsonb;
  v_type    text;
begin
  -- 아이 계정이면 여기서 끝난다. 부모 프로필이 없는 것이 정상이다.
  --
  -- **app_metadata 를 본다.** 전에는 user_metadata 의 role 과 가짜 이메일
  -- 도메인을 함께 봤다. 아이도 실제 이메일을 쓰게 되면서 도메인 표식이
  -- 없어졌고, user_metadata 는 누구나 signUp 에 실을 수 있어 기댈 수 없다.
  -- app_metadata 는 service_role 만 쓴다.
  if v_app ->> 'role' = 'student' then
    return new;
  end if;

  -- **필수 검사를 하지 않는다.** 없으면 없는 대로 넣는다.
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
    nullif(trim(v_meta ->> 'account_name'), ''),
    new.email,
    nullif(trim(v_meta ->> 'phone_number'), ''),
    nullif(v_meta ->> 'birth_date', '')::date,
    coalesce((v_meta ->> 'marketing_email_opt_in')::boolean, false),
    coalesce((v_meta ->> 'marketing_sms_opt_in')::boolean, false),
    coalesce((v_meta ->> 'marketing_alimtalk_opt_in')::boolean, false)
  );

  -- 동의 이력. **철회도 행으로 남긴다**(COM-002 §20-B).
  if jsonb_typeof(v_meta -> 'consents') = 'array' then
    for v_consent in select * from jsonb_array_elements(v_meta -> 'consents')
    loop
      v_type := nullif(trim(v_consent ->> 'consent_type'), '');

      continue when v_type is null
        or v_type not in ('terms', 'privacy', 'guardian',
                          'marketing_email', 'marketing_sms', 'marketing_alimtalk');

      insert into public.consent_log (
        account_id, consent_type, document_version, agreed
      )
      values (
        new.id,
        v_type,
        coalesce(nullif(trim(v_consent ->> 'document_version'), ''), 'unknown'),
        coalesce((v_consent ->> 'agreed')::boolean, false)
      );
    end loop;
  end if;

  return new;
end;
$$;

comment on function public.handle_new_account() is
  'COM-002 §20. auth.users insert 시 public.account 를 함께 만든다. app_metadata.role = student 인 아이 계정은 건너뛴다.';

revoke all on function public.handle_new_account() from public, anon, authenticated;
