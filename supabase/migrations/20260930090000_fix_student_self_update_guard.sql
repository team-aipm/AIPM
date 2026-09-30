-- 아이가 자기 행을 고칠 때의 검사에서 지운 칸을 뺀다
--
-- `20260929020044_child_login_by_email` 이 `student.login_id` 를 지웠는데
-- `guard_student_self_update()` 가 그 칸을 아직 비교하고 있었다. plpgsql 은
-- 칸 이름을 실행할 때 찾으므로 migration 은 통과했고, **아이 세션으로
-- student 를 고치는 모든 요청**이 거기서 멈췄다.
--
--     record "new" has no field "login_id"
--
-- 부모와 service_role 은 앞에서 통과하므로 아이만 걸린다. 깨져 있던 것:
--
--     STU-003  아이가 파트너를 바꾼다
--     MIS-001  난이도 자동 조정 (이것은 이 검사가 원래 막는 일이다 — 아래)
--
-- ## 목록을 지금 칸에 맞춘다
--
--     login_id        뺀다    · 없는 칸
--     login_email     넣는다  · 아이 로그인 이메일. 부모가 정한다(COM-002 §4)
--     learning_grade  넣는다  · 20260928050105 에서 생겼는데 목록에 빠져
--                              아이가 자기 학년을 고칠 수 있었다
--
-- 난이도(`current_difficulty` · `learning_grade`)는 계속 막는다. 사람이
-- 고치면 다음 문제 선정이 어긋난다(COM-003 §9). 서버가 계산한 값을 어떻게
-- 쓸지는 이 migration 이 정하지 않는다.

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
  or new.login_email              is distinct from old.login_email
  or new.student_name             is distinct from old.student_name
  or new.nickname                 is distinct from old.nickname
  or new.nickname_source          is distinct from old.nickname_source
  or new.birth_date               is distinct from old.birth_date
  or new.grade                    is distinct from old.grade
  or new.learning_grade           is distinct from old.learning_grade
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
