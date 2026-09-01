-- COM-002 §19-3 · 상태값을 DB enum으로 구현한다.
-- enum을 쓰는 이유: supabase gen types가 TypeScript union 타입을 만들어 준다.
-- 값 추가는 ALTER TYPE ... ADD VALUE 로 가능하다. 값 제거는 어려우므로
-- 문서에 정의된 값만 만든다.

-- COM-002 §4
create type public.nickname_source as enum ('name_default', 'custom');
create type public.persona_type    as enum ('friend', 'villain');
create type public.student_status  as enum ('active', 'deleted_pending');

-- COM-002 §5
create type public.session_status as enum ('active', 'completed', 'incomplete');

-- COM-002 §6
create type public.problem_source as enum ('ai', 'text', 'photo');
create type public.problem_status as enum (
  'active',
  'completed',
  'needs_review',
  'system_interrupted',
  'verification_failed',
  'abandoned'
);

-- COM-002 §7
create type public.speaker         as enum ('student', 'ai', 'system');
create type public.drilldown_stage as enum (
  'judgment', 'reasoning', 'rule', 'transfer', 'reflection'
);

-- COM-002 §9 · "초기" gap_type. 추가 시 ALTER TYPE ADD VALUE 로 확장한다.
create type public.gap_type as enum (
  'knowledge_gap',
  'evidence_gap',
  'rule_gap',
  'inference_gap',
  'transfer_gap',
  'monitoring_gap'
);

-- COM-002 §11
create type public.subscription_status as enum (
  'trial', 'active', 'payment_failed', 'expired', 'cancelled', 'reactivated'
);

-- COM-002 §12
create type public.payment_status as enum (
  'pending', 'paid', 'failed', 'refunded', 'partially_refunded'
);

-- COM-002 §13
create type public.report_type as enum ('daily_student', 'weekly_parent');

-- 다음 3개는 COM-002에 예시값만 있고 전체 값이 정의되어 있지 않다.
--   account_status      'active' 만 예시. 탈퇴 관련 값은 COM-007에서 확정
--   answer_lock_status  'locked' 만 예시. COM-001에 상태 목록 없음
--   learning_mode       'mode_a' 만 예시. "내부 모드"로만 기술됨
-- 임의로 값을 만들지 않고 TEXT로 두었다. 값이 확정되면 후속 migration에서
-- enum으로 전환한다. (CLAUDE.md · COM-002 §19-8)
