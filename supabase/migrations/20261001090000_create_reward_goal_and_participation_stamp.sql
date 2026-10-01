-- 참여 도장 · 보상 약속 (COM-002 §22-1 · §22-5 · COM-001 §16)
--
-- 두 가지를 나눠서 준다. 섞으면 안 된다.
--
--     도장   평일 오늘의 미션 10개를 다 했을 때  하루 1개   → 부모가 약속한 보상
--     코인   미션 1개를 끝낼 때마다  10개                   → 캐릭터 해금 (이 파일 아님)
--
-- COM-002 v1.9 는 「마이그레이션은 화면을 만들 때 그 화면이 쓰는 것만 추가한다」
-- 고 정했다. 보상 화면(RWD · 학생 홈 보상 카드)이 쓰는 두 표만 만든다.
-- CoinLedger · StudentCharacter · LearningStreak 는 그 화면을 만들 때 만든다.

-- ============================================================
-- ParticipationStamp · §22-1
-- ============================================================
create table public.participation_stamp (
  stamp_id           uuid        primary key default gen_random_uuid(),
  student_id         uuid        not null references public.student (student_id) on delete cascade,
  stamp_date         date        not null,
  trigger_problem_id uuid        not null references public.problem (problem_id),
  created_at         timestamptz not null default now(),
  -- 하루에 두 개가 나올 수 없다. 새로고침 · 재시도로 불어나는 것을 DB 가 막는다.
  constraint participation_stamp_one_per_day unique (student_id, stamp_date)
);

comment on table public.participation_stamp is
  'COM-002 §22-1. 평일 오늘의 미션 10개를 다 마친 날 하루 1개. award_participation_stamp() 만 만든다.';

-- ============================================================
-- RewardGoal · §22-5
-- ============================================================
create table public.reward_goal (
  reward_goal_id     uuid        primary key default gen_random_uuid(),
  student_id         uuid        not null references public.student (student_id) on delete cascade,
  account_id         uuid        not null references public.account (account_id) on delete cascade,
  reward_name        text        not null check (length(trim(reward_name)) between 1 and 40),
  target_stamp_count integer     not null check (target_stamp_count between 1 and 365),
  reward_status      text        not null default 'queued'
                     check (reward_status in ('queued', 'active', 'achieved', 'delivered', 'cancelled')),
  activated_at       timestamptz,
  achieved_at        timestamptz,
  delivered_at       timestamptz,
  created_at         timestamptz not null default now()
);

-- 학생당 active 1개 · queued 1개까지 (§22-5)
create unique index reward_goal_one_active on public.reward_goal (student_id)
  where reward_status = 'active';
create unique index reward_goal_one_queued on public.reward_goal (student_id)
  where reward_status = 'queued';

comment on table public.reward_goal is
  'COM-002 §22-5. 부모가 아이와 약속한 보상. achieved(도장을 다 모음)와 delivered(부모가 실제로 줌)는 다르다.';

-- ============================================================
-- RLS
-- ============================================================
alter table public.participation_stamp enable row level security;
alter table public.reward_goal enable row level security;

-- 도장은 부모 · 아이 모두 읽는다. **쓰는 정책은 두지 않는다** — 아래 함수만 만든다.
create policy participation_stamp_select_own on public.participation_stamp
  for select to authenticated
  using (public.owns_student(student_id));

-- 보상은 아이도 읽는다(학생 홈 「치킨까지 도장 7개」). 정하고 고치는 것은 부모만.
create policy reward_goal_select_own on public.reward_goal
  for select to authenticated
  using (public.owns_student(student_id));

create policy reward_goal_insert_parent on public.reward_goal
  for insert to authenticated
  with check (
    account_id = auth.uid()
    and exists (select 1 from public.student s where s.student_id = reward_goal.student_id and s.account_id = auth.uid())
  );

create policy reward_goal_update_parent on public.reward_goal
  for update to authenticated
  using (account_id = auth.uid())
  with check (account_id = auth.uid());

-- ============================================================
-- 도장 지급 · 보상 달성
-- ============================================================
-- **조건을 함수가 직접 확인한다.** 부르는 쪽이 아이 세션이어도 기록이 조건을
-- 채우지 않으면 아무것도 만들지 않는다. 그래서 service_role 이 필요 없다.
--
--   1. 세션이 부르는 사람의 것이다 (부모 또는 그 아이)
--   2. 세션 날짜가 평일(월~금)이다. session_date 는 한국 날짜로 저장된다
--   3. 그 세션에서 completed · needs_review 로 끝난 문제가 목표 수 이상이다
--      system_interrupted 는 세지 않는다(COM-001 §19)
--
-- 도장이 새로 생겼으면 진행 중인 보상을 본다. 목표에 닿으면 achieved 로 바꾸고
-- 예약된 보상을 곧바로 active 로 올린다. 모은 도장은 0 으로 되돌리지 않는다 —
-- 진행도는 각 보상이 시작된 뒤에 받은 도장 수다.
create or replace function public.award_participation_stamp(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session   public.learning_session%rowtype;
  v_done      integer;
  v_last      uuid;
  v_stamp     uuid;
  v_goal      public.reward_goal%rowtype;
  v_progress  integer;
  v_achieved  uuid;
begin
  select * into v_session from public.learning_session where session_id = p_session_id;
  if not found or not public.owns_student(v_session.student_id) then
    return jsonb_build_object('stamped', false, 'reason', 'not_owner');
  end if;

  if extract(isodow from v_session.session_date) > 5 then
    return jsonb_build_object('stamped', false, 'reason', 'weekend');
  end if;

  select count(*), (array_agg(problem_id order by created_at desc))[1]
    into v_done, v_last
    from public.problem
   where session_id = p_session_id
     and problem_status in ('completed', 'needs_review');

  if v_done < v_session.target_problem_count or v_last is null then
    return jsonb_build_object('stamped', false, 'reason', 'not_finished');
  end if;

  insert into public.participation_stamp (student_id, stamp_date, trigger_problem_id)
  values (v_session.student_id, v_session.session_date, v_last)
  on conflict (student_id, stamp_date) do nothing
  returning stamp_id into v_stamp;

  if v_stamp is null then
    return jsonb_build_object('stamped', false, 'reason', 'already');
  end if;

  select * into v_goal from public.reward_goal
   where student_id = v_session.student_id and reward_status = 'active'
   for update;

  if found then
    select count(*) into v_progress from public.participation_stamp
     where student_id = v_session.student_id and created_at >= v_goal.activated_at;

    if v_progress >= v_goal.target_stamp_count then
      update public.reward_goal
         set reward_status = 'achieved', achieved_at = now()
       where reward_goal_id = v_goal.reward_goal_id;
      v_achieved := v_goal.reward_goal_id;

      -- 다음 보상은 이 도장 다음부터 센다. 이 도장은 방금 달성한 보상의 몫이다.
      update public.reward_goal
         set reward_status = 'active', activated_at = now() + interval '1 microsecond'
       where student_id = v_session.student_id and reward_status = 'queued';
    end if;
  end if;

  return jsonb_build_object('stamped', true, 'achieved_goal_id', v_achieved);
end;
$$;

comment on function public.award_participation_stamp(uuid) is
  'COM-001 §16 · COM-002 §22-1. 평일 10개를 마친 세션에 도장 1개. 조건을 직접 확인하므로 아이 세션으로 불러도 된다.';

-- Supabase 는 public 함수에 anon 실행 권한을 직접 준다. 로그인한 사람만 부른다.
revoke execute on function public.award_participation_stamp(uuid) from public, anon;
grant execute on function public.award_participation_stamp(uuid) to authenticated;
