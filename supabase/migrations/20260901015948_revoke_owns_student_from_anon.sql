-- Supabase database linter 0028 · anon_security_definer_function_executable
--
-- 20260831090200_enable_rls_policies.sql 은
--   revoke all on function public.owns_student(uuid) from public;
-- 를 실행했지만 anon 의 EXECUTE 는 남아 있었다.
--
-- Supabase 는 public 스키마의 새 함수에 anon · authenticated 역할로
-- EXECUTE 를 직접 부여한다. PUBLIC 의사역할에서 revoke 해도 역할별
-- grant 는 취소되지 않는다.
--
-- 영향: 로그인 없이 /rest/v1/rpc/owns_student 호출이 가능했다.
-- anon 은 auth.uid() 가 null 이라 함수가 항상 false 를 반환하므로
-- 데이터가 노출되지는 않았다. 다만 RLS 를 우회하는 security definer
-- 함수이고 아동 데이터 소유 판별에 쓰이므로 닫는다.
--
-- authenticated 의 EXECUTE 는 유지한다. RLS 정책이 호출 주체의 권한으로
-- 이 함수를 실행하므로 제거하면 학습 데이터 접근이 전부 막힌다.
-- (linter 0029 경고는 의도된 상태다.)

revoke execute on function public.owns_student(uuid) from anon;

comment on function public.owns_student(uuid) is
  'COM-002 §19-4. RLS 소유관계 판별. authenticated 전용이며 anon 호출을 막았다.';
