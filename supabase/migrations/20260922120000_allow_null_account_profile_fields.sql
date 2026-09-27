-- 회원가입에서 부모 이름 · 휴대폰 · 생년월일을 받지 않는다 (COM-002 §3 개정)
--
-- ## 왜 고치나
--
-- Figma 「메티_서비스」 의 `부모 / 회원가입` 프레임이 **이메일 · 비밀번호 ·
-- 비밀번호 확인 · 동의 4종** 만 받는다. 이름 · 휴대폰 · 생년월일 칸이 없다.
--
-- 지금 트리거는 그 셋이 없으면 예외를 던져 **가입을 통째로 되돌린다.**
-- 그래서 디자인대로 만들면 가입 자체가 안 된다. 같은 이유로 소셜 로그인도
-- 막혀 있었다 — 구글 · 카카오는 그 셋을 주지 않는다.
--
-- ## 컬럼을 지우지 않는다
--
-- `null` 을 허용할 뿐이다. 이미 가입한 사람들의 값이 들어 있고, 부모 화면
-- (`MY-002` 프로필) 과 운영자 화면(`ADM`) 이 그것을 읽는다. 지우면 그 값이
-- 사라지고 화면 두 곳이 같이 무너진다.
--
-- 나중에 다시 받기로 하면 채우면 된다. 지운 값은 돌아오지 않는다.
--
-- ## 남는 문제 — **휴대폰**
--
-- COM-002 §3 Account rules 에 「부모 휴대폰 번호는 회원가입 필수」 라고 적혀
-- 있었다. 그 줄도 이 변경과 함께 고친다. 다만 아래 둘은 **아직 답이 없다.**
--
--   - `AUTH-004` 휴대폰 인증 (DEV-002 `/signup/verify`) 은 무엇으로 하나.
--     Figma 에 그 프레임이 없다.
--   - 법정대리인 동의를 받는데 보호자를 식별할 값이 이메일뿐이어도 되나.
--     COM-007 §2 의 판단이 필요하다.
--
-- 둘은 이 마이그레이션이 정하지 않는다. 화면이 막히지 않게 하는 것까지다.

alter table public.account
  alter column account_name drop not null,
  alter column phone_number drop not null,
  alter column birth_date   drop not null;

comment on column public.account.account_name is
  '부모 이름. 회원가입에서 받지 않는다(2026-09-22). MY-002 에서 채울 수 있다.';
comment on column public.account.phone_number is
  '부모 휴대폰. 회원가입에서 받지 않는다(2026-09-22). AUTH-004 미확정.';
comment on column public.account.birth_date is
  '부모 생년월일. 회원가입에서 받지 않는다(2026-09-22).';

-- ============================================================
-- 트리거 — 필수 검사를 걷어내고, 동의 이력을 같은 트랜잭션에서 남긴다
-- ============================================================
--
-- **동의를 앱에서 따로 insert 하지 않는다.** 이메일 확인이 켜져 있으면
-- 가입 직후 세션이 없어 `consent_log` 의 RLS(`to authenticated`) 를 통과하지
-- 못한다. 통과하더라도 요청이 둘로 나뉘어, 두 번째가 실패하면 **동의 없이
-- 가입된 계정** 이 남는다. 그건 COM-007 이 허용할 수 없는 상태다.
--
-- account 를 트리거로 만드는 이유(§20)와 똑같다. 여기서 함께 만든다.

create or replace function public.handle_new_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta    jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_consent jsonb;
  v_type    text;
begin
  -- 아이 계정이면 여기서 끝난다. 부모 프로필이 없는 것이 정상이다.
  -- (20260910070000_skip_account_for_student_login.sql)
  if v_meta ->> 'role' = 'student'
     and new.email like '%@student.aipm.invalid' then
    return new;
  end if;

  -- **필수 검사를 하지 않는다.** 없으면 없는 대로 넣는다.
  -- `nullif(trim(...), '')` 이 빈 문자열도 null 로 만든다 — 빈 칸이 이름으로
  -- 저장되면 화면에 이름 없는 사람이 생긴다.
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

  -- 동의 이력. `options.data.consents` 로 온다.
  --
  --   "consents": [
  --     { "consent_type": "terms",     "document_version": "2026-09-22", "agreed": true },
  --     { "consent_type": "privacy",   ... },
  --     { "consent_type": "guardian",  ... },
  --     { "consent_type": "marketing", ... }   ← 선택. 거절도 행으로 남긴다
  --   ]
  --
  -- **철회도 행으로 남긴다**(COM-002 §20-B). `agreed = false` 를 지우지
  -- 않는 이유는, 동의하지 않았다는 사실 자체가 증명해야 할 것이기 때문이다.
  if jsonb_typeof(v_meta -> 'consents') = 'array' then
    for v_consent in select * from jsonb_array_elements(v_meta -> 'consents')
    loop
      v_type := nullif(trim(v_consent ->> 'consent_type'), '');

      -- 모르는 값은 버린다. 앱이 보내는 값이라 무엇이든 실릴 수 있다.
      -- COM-002 §20-B 의 `consent_type` 목록이 기준이다.
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
  'COM-002 §20. auth.users insert 시 public.account 와 consent_log 를 함께 만든다. 아이 계정(role=student)은 건너뛴다.';

revoke all on function public.handle_new_account() from public, anon, authenticated;
