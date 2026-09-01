-- COM-002 전체 엔티티. 문서의 필드명·타입·필수여부를 그대로 옮긴다.
-- 테이블명은 COM-002 엔티티명의 snake_case 단수형이며
-- DEV-001 §4의 lib/services 파일명과 1:1로 대응한다.

-- ============================================================
-- Account (COM-002 §3) · 부모 회원
-- ============================================================
-- account_id는 Supabase Auth의 auth.users.id를 그대로 쓴다.
-- COM-002 §20 "Supabase Auth와 Account 프로필 테이블의 연결 방식" 관련 결정.
create table public.account (
  account_id                   uuid primary key references auth.users (id) on delete cascade,
  account_name                 text        not null,
  email                        text        not null,
  phone_number                 text        not null,
  birth_date                   date        not null,
  account_status               text        not null default 'active',
  marketing_email_opt_in       boolean     not null default false,
  marketing_sms_opt_in         boolean     not null default false,
  marketing_alimtalk_opt_in    boolean     not null default false,
  marketing_consent_updated_at timestamptz not null default now(),
  created_at                   timestamptz not null default now(),
  last_login_at                timestamptz
);

comment on column public.account.account_status is
  'COM-002 §3. 현재 정의된 값은 active 뿐이다. 탈퇴 관련 값은 COM-007 확정 후 enum으로 전환한다.';

create unique index account_email_key on public.account (lower(email));

-- ============================================================
-- Student (COM-002 §4) · 학습자 프로필
-- ============================================================
create table public.student (
  student_id                 uuid primary key default gen_random_uuid(),
  account_id                 uuid                    not null references public.account (account_id) on delete cascade,
  student_name               text                    not null,
  nickname                   text                    not null,
  nickname_source            public.nickname_source  not null default 'name_default',
  birth_date                 date                    not null,
  grade                      smallint                not null,
  persona_type               public.persona_type     not null,
  current_difficulty         smallint                not null,
  student_status             public.student_status   not null default 'active',
  created_at                 timestamptz             not null default now(),
  deleted_at                 timestamptz,
  learning_data_retain_until timestamptz,
  constraint student_grade_mvp_range check (grade between 4 and 6)
);

create index student_account_id_idx on public.student (account_id);

-- ============================================================
-- LearningSession (COM-002 §5) · 하루 학습 단위
-- ============================================================
create table public.learning_session (
  session_id              uuid primary key default gen_random_uuid(),
  student_id              uuid                   not null references public.student (student_id) on delete cascade,
  session_date            date                   not null,
  target_problem_count    smallint               not null default 10,
  completed_problem_count smallint               not null default 0,
  session_status          public.session_status  not null default 'active',
  started_at              timestamptz            not null default now(),
  ended_at                timestamptz,
  resumed_from_session_id uuid references public.learning_session (session_id) on delete set null
);

create index learning_session_student_date_idx
  on public.learning_session (student_id, session_date desc);

-- ============================================================
-- Problem (COM-002 §6) · 학습한 문제 1개
-- ============================================================
create table public.problem (
  problem_id         uuid primary key default gen_random_uuid(),
  session_id         uuid                   not null references public.learning_session (session_id) on delete cascade,
  student_id         uuid                   not null references public.student (student_id) on delete cascade,
  problem_source     public.problem_source  not null,
  problem_text       text                   not null,
  concept            text                   not null,
  difficulty         smallint               not null,
  learning_mode      text                   not null,
  verified_answer    jsonb,
  answer_lock_status text                   not null,
  problem_status     public.problem_status  not null default 'active',
  created_at         timestamptz            not null default now()
);

comment on column public.problem.learning_mode is
  'COM-002 §6. mode_a 예시만 있고 전체 값이 미정이다. 확정 후 enum으로 전환한다.';
comment on column public.problem.answer_lock_status is
  'COM-002 §6. locked 예시만 있고 전체 값이 미정이다. 확정 후 enum으로 전환한다.';
comment on column public.problem.verified_answer is
  'COM-002 §6. 검증 실패 시 NULL. 학생 화면에 노출 금지 (COM-003 · CLAUDE.md).';

create index problem_session_id_idx on public.problem (session_id);
create index problem_student_created_idx on public.problem (student_id, created_at desc);
create index problem_concept_idx on public.problem (concept);

-- ============================================================
-- Message (COM-002 §7) · 대화 한 턴
-- ============================================================
create table public.message (
  message_id      uuid primary key default gen_random_uuid(),
  problem_id      uuid                    not null references public.problem (problem_id) on delete cascade,
  session_id      uuid                    not null references public.learning_session (session_id) on delete cascade,
  student_id      uuid                    not null references public.student (student_id) on delete cascade,
  speaker         public.speaker          not null,
  message_text    text                    not null,
  drilldown_stage public.drilldown_stage,
  turn_number     integer                 not null,
  support_level   smallint                not null,
  created_at      timestamptz             not null default now(),
  constraint message_problem_turn_key unique (problem_id, turn_number)
);

-- COM-002 §7 "마지막 저장 Message를 기준으로 학습 복구 가능해야 함"
create index message_problem_turn_idx on public.message (problem_id, turn_number desc);

-- ============================================================
-- Evaluation (COM-002 §8) · 문제 1개당 최대 1건
-- ============================================================
create table public.evaluation (
  evaluation_id    uuid primary key default gen_random_uuid(),
  problem_id       uuid        not null unique references public.problem (problem_id) on delete cascade,
  student_id       uuid        not null references public.student (student_id) on delete cascade,
  initial_accuracy boolean     not null,
  reasoning_score  smallint    not null,
  rule_score       smallint    not null,
  self_correction  boolean     not null,
  transfer_score   smallint    not null,
  reflection_score smallint    not null,
  support_level    smallint    not null,
  final_accuracy   boolean     not null,
  evaluated_at     timestamptz not null default now()
);

comment on table public.evaluation is
  'COM-002 §8. 점수 범위와 계산식은 §20 미확정이라 CHECK 제약을 두지 않았다. 확정 후 추가한다.';

create index evaluation_student_idx on public.evaluation (student_id, evaluated_at desc);

-- ============================================================
-- LogicGap (COM-002 §9) · 사고 오류
-- ============================================================
create table public.logic_gap (
  logic_gap_id uuid primary key default gen_random_uuid(),
  student_id   uuid            not null references public.student (student_id) on delete cascade,
  problem_id   uuid            not null references public.problem (problem_id) on delete cascade,
  gap_type     public.gap_type not null,
  concept      text            not null,
  description  text            not null,
  resolved     boolean         not null default false,
  detected_at  timestamptz     not null default now()
);

create index logic_gap_student_type_idx on public.logic_gap (student_id, gap_type);
create index logic_gap_problem_idx on public.logic_gap (problem_id);

-- ============================================================
-- StudentMemory (COM-002 §10) · Student 1 : 1
-- ============================================================
create table public.student_memory (
  memory_id             uuid primary key default gen_random_uuid(),
  student_id            uuid        not null unique references public.student (student_id) on delete cascade,
  current_level         smallint    not null,
  weak_concepts         jsonb       not null default '[]'::jsonb,
  review_concepts       jsonb       not null default '[]'::jsonb,
  recurring_logic_gaps  jsonb       not null default '[]'::jsonb,
  reasoning_level       smallint    not null,
  transfer_level        smallint    not null,
  average_support_level numeric     not null,
  updated_at            timestamptz not null default now()
);

comment on table public.student_memory is
  'COM-002 §10. 세션 종료 시 삭제하지 않는다. JSONB 내부 schema는 §20 미확정.';

-- ============================================================
-- Subscription (COM-002 §11) · Student에 귀속, 결제는 Account
-- ============================================================
create table public.subscription (
  subscription_id         uuid primary key default gen_random_uuid(),
  student_id              uuid                       not null references public.student (student_id) on delete cascade,
  account_id              uuid                       not null references public.account (account_id) on delete cascade,
  subscription_status     public.subscription_status not null default 'trial',
  trial_started_at        timestamptz,
  trial_ends_at           timestamptz,
  subscription_started_at timestamptz,
  current_period_ends_at  timestamptz,
  next_billing_at         timestamptz,
  grace_period_ends_at    timestamptz,
  cancelled_at            timestamptz
);

-- COM-002 §11 "동시에 active 구독은 1개"
create unique index subscription_one_live_per_student
  on public.subscription (student_id)
  where subscription_status in ('trial', 'active', 'payment_failed', 'reactivated');

create index subscription_account_idx on public.subscription (account_id);

-- ============================================================
-- Payment (COM-002 §12)
-- ============================================================
create table public.payment (
  payment_id      uuid primary key default gen_random_uuid(),
  account_id      uuid                  not null references public.account (account_id) on delete restrict,
  student_id      uuid                  not null references public.student (student_id) on delete restrict,
  subscription_id uuid                  not null references public.subscription (subscription_id) on delete restrict,
  amount          numeric(12, 2)        not null,
  currency        text                  not null default 'KRW',
  payment_status  public.payment_status not null default 'pending',
  payment_method  text,
  paid_at         timestamptz,
  failed_at       timestamptz,
  refunded_at     timestamptz
);

comment on table public.payment is
  'COM-002 §18 · 결제는 법정 보관 대상이라 상위 삭제 시 CASCADE하지 않는다. PG transaction ID 저장 방식은 §20 미확정.';

create index payment_account_idx on public.payment (account_id);
create index payment_subscription_idx on public.payment (subscription_id);

-- ============================================================
-- LearningReport (COM-002 §13)
-- ============================================================
create table public.learning_report (
  report_id    uuid primary key default gen_random_uuid(),
  student_id   uuid               not null references public.student (student_id) on delete cascade,
  report_type  public.report_type not null,
  period_start date               not null,
  period_end   date               not null,
  summary_data jsonb              not null,
  generated_at timestamptz        not null default now()
);

create index learning_report_student_period_idx
  on public.learning_report (student_id, report_type, period_end desc);

-- ============================================================
-- Event (COM-002 §14) · 분석용 행동 이벤트
-- ============================================================
create table public.event (
  event_id         uuid primary key default gen_random_uuid(),
  account_id       uuid references public.account (account_id) on delete set null,
  student_id       uuid references public.student (student_id) on delete set null,
  session_id       uuid references public.learning_session (session_id) on delete set null,
  event_name       text        not null,
  event_properties jsonb       not null default '{}'::jsonb,
  created_at       timestamptz not null default now()
);

comment on column public.event.event_name is
  'COM-002 §14의 이벤트명 16개. 상수는 src/lib/analytics/events.ts에서 관리한다 (DEV-001 §4).';

create index event_name_created_idx on public.event (event_name, created_at desc);
create index event_student_idx on public.event (student_id, created_at desc);
