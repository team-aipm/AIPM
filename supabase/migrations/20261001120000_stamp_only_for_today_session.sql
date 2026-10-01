-- 지난 미션으로는 도장을 채우지 않는다 (COM-001 §11-2 · §11-A)
--
-- 20261001090000 의 award_participation_stamp 는 「평일 세션이 10개를 채웠다」
-- 만 봤다. 지난 미션(못 끝낸 평일을 7일 안에 이어 하기)을 만들면서 구멍이
-- 생긴다 — 월요일 세션을 수요일에 마저 채우면 월요일 도장이 나간다.
--
-- 문서는 「1~9개에서는 주지 않는다. 지난 미션과 주말 학습으로는 못 채운다」
-- 고 정했다. 세션 날짜가 오늘(한국 날짜)일 때만 준다. 나머지는 그대로다.

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

  -- **오늘 세션만.** 지난 미션(7일 안에 이어 하는 못 끝낸 날)을 다 채워도
  -- 그날 도장은 주지 않는다(COM-001 §11-2 · §11-A). 세션 날짜는 한국 날짜다.
  if v_session.session_date <> (now() at time zone 'Asia/Seoul')::date then
    return jsonb_build_object('stamped', false, 'reason', 'not_today');
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

-- 교체해도 권한은 남지만, 복원 · 이전 때 되살아나는 일이 있어 다시 적어 둔다.
revoke execute on function public.award_participation_stamp(uuid) from public, anon;
grant execute on function public.award_participation_stamp(uuid) to authenticated;
