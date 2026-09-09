-- 문제 사진 보관소. COM-007 §3-1 · §4-3 (2026-09-10)
--
-- 사진은 아동 개인정보가 아니라 **학습 자료**로 분류한다(§3-1). 찍히는 것은
-- 교재의 문제이지 아이가 아니다. 그래도 아무나 열어보게 두지 않는다 —
-- 비공개 버킷이고, 자기 학생의 폴더만 읽고 쓸 수 있다.
--
-- 경로는 `<student_id>/<uuid>.<ext>` 다. 첫 칸이 학생 id 라서 정책이 그것만
-- 보면 되고, 학생을 지울 때 폴더째 지울 수 있다(§4-3).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'problem-photos',
  'problem-photos',
  false,
  5242880,                                    -- 5MB. 초등학생 휴대폰 사진 한 장
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do nothing;

-- 자기 학생의 폴더만. owns_student 는 이미 있는 함수다
-- (20260831090200_enable_rls_policies.sql).
create policy problem_photo_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'problem-photos'
    and public.owns_student(((storage.foldername(name))[1])::uuid)
  );

create policy problem_photo_select_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'problem-photos'
    and public.owns_student(((storage.foldername(name))[1])::uuid)
  );

-- 인식에 실패한 사진은 그 자리에서 지운다(§4-3). 그래서 삭제 정책이 필요하다.
create policy problem_photo_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'problem-photos'
    and public.owns_student(((storage.foldername(name))[1])::uuid)
  );

comment on policy problem_photo_select_own on storage.objects is
  'COM-007 §7. 운영자는 이 경로로 사진을 볼 수 없다. 부모 계정 세션만 자기 학생 폴더를 연다.';
