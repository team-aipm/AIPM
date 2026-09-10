# COM-002 · 공통 데이터 구조 정의서 --- 개발용

> **Version:** 1.3 · **Updated:** 2026-09-09 · **Owner:** (미지정)\
> **Status:** 확정\
> **Changelog:** 문서 최하단 참조

> **문서 역할:** Claude Code 및 5개 PM이 공통으로 사용하는 데이터
> 명칭·관계·필드의 Source of Truth\
> **기준 문서:** `COM-001-service-flow.md`\
> **원칙:** 같은 의미의 데이터를 PM별로 다른 이름(`child_id`, `user_id`,
> `learner_id` 등)으로 만들지 않는다.

## 1. 전체 데이터 관계

``` text
Account
│
├── Student
│    │
│    ├── LearningSession
│    │     │
│    │     └── Problem
│    │            ├── Message
│    │            ├── Evaluation
│    │            └── LogicGap
│    │
│    ├── StudentMemory
│    ├── Subscription
│    └── LearningReport
│
├── Payment
└── Event
```

핵심 관계: - Account 1 : N Student - Student 1 : N LearningSession -
LearningSession 1 : N Problem - Problem 1 : N Message - Problem 1 : 0..1
Evaluation - Problem 1 : 0..N LogicGap - Student 1 : 1 StudentMemory -
Student 1 : N Subscription history, 단 동시에 active 구독은 1개 -
Account 1 : N Payment - Student 1 : N LearningReport - Account/Student 1
: N Event

## 2. 공통 명명 규칙

-   DB/코드 변수명: `snake_case`
-   Primary Key: `<entity>_id`
-   날짜만 저장: `_date`
-   날짜+시간: `_at`
-   Boolean: `is_...`, `has_...`, 또는 동의값은 `_opt_in`
-   상태값: `_status`
-   외래키 이름은 참조 대상 PK와 동일하게 사용
-   모든 시간은 DB에서 일관된 timezone 정책을 사용하고 UI에서 사용자
    timezone으로 표시
-   MVP에서는 실제 DB 타입을 Supabase/PostgreSQL에 맞춰 구현하되 의미를
    임의 변경하지 않는다.

## 3. Account

부모 회원. 로그인, 고객관리, 결제, 마케팅 수신의 주체.

  ---------------------------------------------------------------------------------------------------
  Field                            Type                   Required Example              Description
  -------------------------------- ------------- ----------------- -------------------- -------------
  `account_id`                     UUID                        YES uuid                 PK

  `account_name`                   TEXT                        YES 김세희               부모 이름

  `email`                          TEXT                        YES parent@example.com   이메일

  `phone_number`                   TEXT                        YES 01012345678          부모 휴대폰

  `birth_date`                     DATE                        YES 1978-05-20           부모 생년월일

  `account_status`                 ENUM/TEXT                   YES active               계정 상태

  `marketing_email_opt_in`         BOOLEAN                     YES true                 이메일 마케팅
                                                                                        동의

  `marketing_sms_opt_in`           BOOLEAN                     YES true                 SMS 마케팅
                                                                                        동의

  `marketing_alimtalk_opt_in`      BOOLEAN                     YES false                알림톡 마케팅
                                                                                        동의

  `marketing_consent_updated_at`   TIMESTAMPTZ                 YES timestamp            동의 변경
                                                                                        시점

  `created_at`                     TIMESTAMPTZ                 YES timestamp            가입 시점

  `last_login_at`                  TIMESTAMPTZ                  NO timestamp            최근 로그인
  ---------------------------------------------------------------------------------------------------

Account rules: - 부모 휴대폰 번호는 회원가입 필수. - 결제수단 및 결제
이력은 Account 기준. - 학생별 학습데이터를 Account에 직접 저장하지
않는다.

## 4. Student

실제 학습자 프로필.

  -------------------------------------------------------------------------------------------------
  Field                          Type                   Required Example        Description
  ------------------------------ ------------- ----------------- -------------- -------------------
  `student_id`                   UUID                        YES uuid           PK

  `account_id`                   UUID                        YES uuid           FK → Account

  `student_name`                 TEXT                        YES 김은재         학생 이름

  `nickname`                     TEXT                        YES 은재           AI 호칭

  `nickname_source`              ENUM/TEXT                   YES name_default   `name_default` /
                                                                                `custom`

  `birth_date`                   DATE                        YES 2015-08-27     생년월일

  `grade`                        SMALLINT                    YES 5              MVP: 4,5,6

  `persona_type`                 ENUM/TEXT                   YES friend         `friend` /
                                                                                `villain`

  `current_difficulty`           SMALLINT                    YES 3              현재 난이도

  `student_status`               ENUM/TEXT                   YES active         `active` /
                                                                                `deleted_pending`

  `created_at`                   TIMESTAMPTZ                 YES timestamp      프로필 생성

  `deleted_at`                   TIMESTAMPTZ                  NO timestamp      삭제 요청

  `learning_data_retain_until`   TIMESTAMPTZ                  NO timestamp      삭제 후 학습기록
                                                                                보관 종료

  `login_id`                     TEXT                         NO jaeun2016      아이가 로그인할 때
                                                                                입력하는 아이디.
                                                                                전체에서 유일

  `auth_user_id`                 UUID                         NO uuid           아이 계정의
                                                                                `auth.users.id`.
                                                                                FK → auth.users
  -------------------------------------------------------------------------------------------------

Student rules: - Account당 Student 수 제한 없음. - `nickname`은 필수이며
기본값은 `student_name`. - 각 Student의 학습데이터는 서로 독립. - 학생
삭제 후 학습기록은 1년 유지. - 직접 식별정보의 세부 보관/삭제 정책은
COM-007에서 최종 확정.

### 4-1. 학생 로그인 (2026-09-10 추가)

`login_id`와 `auth_user_id`는 **둘 다 선택이다.** 없으면 지금까지처럼 부모가
로그인한 기기에서 프로필을 골라 들어간다. 있으면 아이가 자기 기기에서
자기 아이디로 들어간다.

-   **부모가 만든다.** 아이는 스스로 가입하지 않는다. 만 14세 미만의 가입에는
    법정대리인 동의가 필요하다(COM-007 §2).
-   **아이에게 이메일 주소를 받지 않는다.** `login_id`를 서버가 가짜 이메일
    (`<login_id>@student.aipm.invalid`)로 바꿔 Supabase Auth에 넘긴다.
    `.invalid`는 RFC 2606이 예약한 TLD라 실제로 등록될 수 없다.
-   그래서 **아이 계정에는 메일로 비밀번호를 찾는 길이 없다.** 부모가
    MY-003에서 새로 정해 준다.
-   `login_id`는 만든 뒤 바꾸지 않는다. 아이가 외운 것을 바꾸면 다시 들어오지
    못한다.
-   두 값은 함께 생기고 함께 없어진다. 하나만 있는 상태를 두지 않는다.

RLS는 `owns_student()` 한 곳에서 갈린다. 부모(`account_id = auth.uid()`)
**또는** 본인(`auth_user_id = auth.uid()`)이면 자기 학습데이터를 읽고 쓴다.
학생 행 자체는 아이가 `persona_type`만 바꿀 수 있다 — 난이도·학년·상태를
사람이 고치면 다음 문제 선정이 어긋난다(COM-003 §9). DB 트리거
`student_self_update_guard`가 막는다.

## 5. LearningSession

하루 학습 목표를 관리하는 단위.

  ---------------------------------------------------------------------------------------------------------
  Field                       Type                   Required Example       Description
  --------------------------- ------------- ----------------- ------------- -------------------------------
  `session_id`                UUID                        YES uuid          PK

  `student_id`                UUID                        YES uuid          FK → Student

  `session_date`              DATE                        YES 2026-08-27    학습 기준일

  `target_problem_count`      SMALLINT                    YES 10            기본 목표

  `completed_problem_count`   SMALLINT                    YES 6             실제 완료

  `session_status`            ENUM/TEXT                   YES incomplete    `active/completed/incomplete`

  `started_at`                TIMESTAMPTZ                 YES timestamp     시작

  `ended_at`                  TIMESTAMPTZ                  NO timestamp     종료

  `resumed_from_session_id`   UUID                         NO uuid          이전 세션 연결
  ---------------------------------------------------------------------------------------------------------

Rules: - 하루 기본 목표는 10문제. - 학생 중간 종료 가능. - 다음날 이전
세션을 이어갈 수 있음. - 새 세션을 시작해도 이전 기록은 유지.

## 6. Problem

학생이 학습한 문제 1개.

  Field                  Type            Required Example      Description
  ---------------------- ------------- ---------- ------------ ----------------------
  `problem_id`           UUID                 YES uuid         PK
  `session_id`           UUID                 YES uuid         FK → LearningSession
  `student_id`           UUID                 YES uuid         FK → Student
  `problem_source`       ENUM/TEXT            YES ai           `ai/text/photo`
  `problem_text`         TEXT                 YES 24 ÷ 4 × 2   확정 문제
  `concept`              TEXT                 YES 혼합계산     핵심 개념
  `difficulty`           SMALLINT             YES 3            문제 난이도
  `learning_mode`        ENUM/TEXT            YES mode_a       내부 모드
  `verified_answer`      TEXT/JSONB         YES\* 12           검증된 정답
  `answer_lock_status`   ENUM/TEXT            YES locked       검증 상태
  `problem_status`       ENUM/TEXT            YES completed    상태
  `created_at`           TIMESTAMPTZ          YES timestamp    생성

`problem_status`: - `active` - `completed` - `needs_review` -
`system_interrupted` - `verification_failed` - `abandoned`

`learning_mode`: - `mode_a` (학생이 답과 이유를 설명) - `mode_b` (AI가
의도오답을 제시하고 학생이 오류를 찾음)

`answer_lock_status`: - `locked` (검증 완료) - `recheck` (재검증 필요) -
`invalid_problem` (문제 자체가 부적합)

`difficulty`: 1\~5. 3 = 학년 중간 난이도.

Rules: - `verified_answer`는 학습 시작 전에 검증되어야 한다. - 검증 실패
문제는 평가 학습에 사용하지 않는다. - 문제 진행 중에는 학생에게 노출하지
않으며, 종료 시점에만 정답 안내로 사용한다(§17, COM-001 §8). - 사진 입력은 학생 확인 후
`problem_text`를 확정한다. - `answer_lock_status`가 `invalid_problem`이면
`problem_status`를 `verification_failed`로 둔다. - 세 값의 판정 기준은
`prompts/logic-auditor.md`의 Prompt 02에서
정의한다.

## 7. Message

학생-AI 대화의 한 턴.

  Field               Type            Required Example       Description
  ------------------- ------------- ---------- ------------- ----------------------
  `message_id`        UUID                 YES uuid          PK
  `problem_id`        UUID                 YES uuid          FK → Problem
  `session_id`        UUID                 YES uuid          FK → LearningSession
  `student_id`        UUID                 YES uuid          FK → Student
  `speaker`           ENUM/TEXT            YES student       `student/ai/system`
  `message_text`      TEXT                 YES 12가 답이야   실제 메시지
  `drilldown_stage`   ENUM/TEXT             NO reasoning     현재 사고 단계
  `turn_number`       INTEGER              YES 4             문제 내 순서
  `support_level`     SMALLINT             YES 1             해당 턴 도움 수준
  `created_at`        TIMESTAMPTZ          YES timestamp     저장 시점

`drilldown_stage`: - `judgment` - `reasoning` - `rule` - `transfer` -
`reflection`

Rules: - 대화 턴마다 즉시 저장. - 마지막 저장 Message를 기준으로 학습
복구 가능해야 함.

## 8. Evaluation

문제 단위 사고능력 평가.

  Field                Type            Required Example     Description
  -------------------- ------------- ---------- ----------- ----------------
  `evaluation_id`      UUID                 YES uuid        PK
  `problem_id`         UUID                 YES uuid        FK → Problem
  `student_id`         UUID                 YES uuid        FK → Student
  `initial_accuracy`   BOOLEAN               NO false       최초 정답
  `reasoning_score`    SMALLINT             YES 2           이유 설명
  `rule_score`         SMALLINT             YES 2           규칙 이해
  `self_correction`    BOOLEAN              YES true        스스로 수정
  `transfer_score`     SMALLINT              NO 1           전이
  `reflection_score`   SMALLINT              NO 2           성찰
  `support_level`      SMALLINT             YES 1           최종 도움 수준
  `final_accuracy`     BOOLEAN              YES true        최종 정답
  `evaluated_at`       TIMESTAMPTZ          YES timestamp   평가 시점

`reasoning_score` · `rule_score` · `transfer_score` ·
`reflection_score`: 0\~2. `support_level`: 0\~4.

`initial_accuracy` · `transfer_score` · `reflection_score`가 NULL을 허용한다. Drill-down이
조기 종료되어(COM-001 §7) 전이·성찰을 묻지 않은 경우가 정상적으로
발생하며, 이때 `0`은 "적용하지 못함"을 뜻하므로 쓸 수 없다.

Rules: - 시스템 오류 문제에는 정상 Evaluation을 만들지 않는다. - 점수
범위는 0\~2이며 세부 판정 기준은 `prompts/logic-auditor.md` Prompt 04에서
정의한다. - 묻지 않은 전이·성찰은 `0`이 아니라 NULL로 둔다. - 관찰하지 못한 최초 정답은 `false`가 아니라 NULL로 둔다. `false`는 "틀렸다"를 뜻한다. MODE B는 학생이 AI의 오류를 찾는 구조라 "최초 정답"이 성립하지 않는 경우가 정상적으로 생긴다. - `support_level`은 턴별로는 오르내릴 수 있으며(`Message`), 한 문제의 최종값(`Evaluation`)은 그 문제에서 나온 값의 **최대값**이며 서버가 계산한다. - NULL은
평균·추이 계산에서 제외한다. 0으로 치환하지 않는다. -
`support_level`은 벌점이 아니라 도움 의존도 지표다. - 학생 화면에는
상세 점수를 그대로 노출하지 않는다.

## 9. LogicGap

학생의 사고 오류를 구조화한 데이터.

  Field            Type            Required Example                       Description
  ---------------- ------------- ---------- ----------------------------- -------------------------
  `logic_gap_id`   UUID                 YES uuid                          PK
  `student_id`     UUID                 YES uuid                          FK → Student
  `problem_id`     UUID                 YES uuid                          FK → Problem
  `gap_type`       ENUM/TEXT            YES rule_gap                      오류 유형
  `concept`        TEXT                 YES 혼합계산                      관련 개념
  `description`    TEXT                 YES 같은 우선순위에서 순서 오류   요약
  `resolved`       BOOLEAN              YES true                          해당 문제에서 해결 여부
  `detected_at`    TIMESTAMPTZ          YES timestamp                     발견 시점

초기 `gap_type`: - `knowledge_gap` - `evidence_gap` - `rule_gap` -
`inference_gap` - `transfer_gap` - `monitoring_gap`

## 10. StudentMemory

학생의 장기 학습 상태 요약.

  Field                     Type            Required Example     Description
  ------------------------- ------------- ---------- ----------- ----------------------
  `memory_id`               UUID                 YES uuid        PK
  `student_id`              UUID                 YES uuid        FK → Student, UNIQUE
  `current_level`           SMALLINT             YES 3           현재 종합 수준
  `weak_concepts`           JSONB                YES \[...\]     취약 개념
  `review_concepts`         JSONB                YES \[...\]     복습 필요 개념
  `recurring_logic_gaps`    JSONB                YES \[...\]     반복 사고오류
  `reasoning_level`         SMALLINT             YES 3           이유 설명 수준
  `transfer_level`          SMALLINT             YES 2           전이 수준
  `average_support_level`   NUMERIC              YES 1.4         도움 의존도
  `updated_at`              TIMESTAMPTZ          YES timestamp   최근 갱신

`current_level` · `reasoning_level` · `transfer_level`: 1\~5.
`current_level` 3 = 학년 중간 수준.

3개 JSONB의 내부 schema와 갱신 규칙은 `prompts/logic-auditor.md` Prompt 05에서
정의한다.

Rules: - 세션 종료 후 삭제하지 않는다. - 새 문제 생성 시 핵심 입력
데이터로 사용한다. - 첫날 학습 결과로 초기 생성한다. - 이후
Evaluation/LogicGap을 바탕으로 갱신한다. - 전체 원문 대화를
StudentMemory에 복사하지 않는다. - 학생 1명당 1행을 유지한다.

## 11. Subscription

학생별 이용권 상태.

  ---------------------------------------------------------------------------------------
  Field                       Type                   Required Example       Description
  --------------------------- ------------- ----------------- ------------- -------------
  `subscription_id`           UUID                        YES uuid          PK

  `student_id`                UUID                        YES uuid          FK → Student

  `account_id`                UUID                        YES uuid          결제 부모

  `subscription_status`       ENUM/TEXT                   YES trial         상태

  `trial_started_at`          TIMESTAMPTZ                  NO timestamp     최초 학습
                                                                            시작

  `trial_ends_at`             TIMESTAMPTZ                  NO timestamp     +14일

  `subscription_started_at`   TIMESTAMPTZ                  NO timestamp     유료 시작

  `current_period_ends_at`    TIMESTAMPTZ                  NO timestamp     현 결제기간
                                                                            종료

  `next_billing_at`           TIMESTAMPTZ                  NO timestamp     다음 결제

  `grace_period_ends_at`      TIMESTAMPTZ                  NO timestamp     실패 후 +3일

  `cancelled_at`              TIMESTAMPTZ                  NO timestamp     해지 신청
  ---------------------------------------------------------------------------------------

상태: - `trial` - `active` - `payment_failed` - `expired` -
`cancelled` - `reactivated`

Rules: - 무료체험은 Student의 최초 학습 시작 시 시작. - Student별 최초
1회, 14일. - 구독은 Student에 귀속. - 결제는 부모 Account가 수행. - 결제
실패 유예기간은 3일. - expired 후 신규 학습은 차단하되 기록/리포트
조회는 허용.

## 12. Payment

실제 결제 거래.

  Field               Type            Required Example     Description
  ------------------- ------------- ---------- ----------- ---------------
  `payment_id`        UUID                 YES uuid        PK
  `account_id`        UUID                 YES uuid        결제자
  `student_id`        UUID                 YES uuid        이용 학생
  `subscription_id`   UUID                 YES uuid        대상 구독
  `amount`            NUMERIC              YES 9900        결제 금액
  `currency`          TEXT                 YES KRW         통화
  `payment_status`    ENUM/TEXT            YES paid        상태
  `payment_method`    TEXT                  NO card        결제수단 유형
  `paid_at`           TIMESTAMPTZ           NO timestamp   성공 시점
  `failed_at`         TIMESTAMPTZ           NO timestamp   실패 시점
  `refunded_at`       TIMESTAMPTZ           NO timestamp   환불 시점

`payment_status`: - `pending` - `paid` - `failed` - `refunded` -
`partially_refunded`

## 13. LearningReport

학생/학부모에게 제공하는 결과 요약.

  Field            Type            Required Example         Description
  ---------------- ------------- ---------- --------------- --------------
  `report_id`      UUID                 YES uuid            PK
  `student_id`     UUID                 YES uuid            FK → Student
  `report_type`    ENUM/TEXT            YES weekly_parent   유형
  `period_start`   DATE                 YES 2026-08-24      시작
  `period_end`     DATE                 YES 2026-08-30      종료
  `summary_data`   JSONB                YES {...}           지표/요약
  `generated_at`   TIMESTAMPTZ          YES timestamp       생성

`report_type`: - `daily_student` - `weekly_parent`

Rules: - 학생용은 단순하고 긍정적인 학습 요약. - 학부모용은 변화·반복
패턴 중심. - 구독 종료 후 기존 리포트 조회 가능.

## 14. Event

서비스 분석 및 Growth용 행동 이벤트.

  Field                Type            Required Example             Description
  -------------------- ------------- ---------- ------------------- -------------
  `event_id`           UUID                 YES uuid                PK
  `account_id`         UUID                  NO uuid                회원
  `student_id`         UUID                  NO uuid                학생
  `session_id`         UUID                  NO uuid                세션
  `event_name`         TEXT                 YES problem_completed   이벤트명
  `event_properties`   JSONB                YES {...}               추가 정보
  `created_at`         TIMESTAMPTZ          YES timestamp           발생 시점

초기 공통 이벤트명: - `signup_completed` - `student_created` -
`persona_selected` - `first_learning_started` - `problem_started` -
`problem_completed` - `problem_needs_review` - `session_completed` -
`session_ended_early` - `session_resumed` - `trial_started` -
`trial_ended` - `subscription_started` - `payment_failed` -
`subscription_expired` - `weekly_report_generated`

## 15. 핵심 연결키

  Key                 사용 목적
  ------------------- ---------------------------------
  `account_id`        부모 회원/결제/마케팅 연결
  `student_id`        학생별 모든 학습·체험·구독 연결
  `session_id`        하루 학습 세션 연결
  `problem_id`        문제·대화·평가·Logic Gap 연결
  `subscription_id`   학생 구독과 결제 연결

## 16. 데이터 생성 주체

  데이터            주요 생성 주체
  ----------------- -------------------
  Account           회원 및 유입 PM
  Student           회원 및 유입 PM
  LearningSession   AI 코어 경험 PM
  Problem           AI 코어 경험 PM
  Message           AI 코어 경험 PM
  Evaluation        AI 코어 경험 PM
  LogicGap          AI 코어 경험 PM
  StudentMemory     AI 코어 경험 PM
  Subscription      과금 및 수익화 PM
  Payment           과금 및 수익화 PM
  LearningReport    AI + Growth
  Event             전 PM 공통

## 17. 공통 개발 규칙

-   다른 PM의 테이블/필드명을 임의로 변경하지 않는다.
-   새로운 공통 필드가 필요하면 COM-002를 먼저 수정하고 공유한다.
-   동일한 의미의 데이터를 별도 테이블에 중복 저장하지 않는다.
-   화면 표시용 문구와 DB 상태값을 혼동하지 않는다.
    -   예: 학생에게 "다음에 더 연습해보자"라고 보여도 DB는
        `needs_review`.
-   AI 출력 JSON의 키는 가능하면 이 문서의 필드명과 맞춘다.
-   JSONB는 구조가 자주 변하거나 목록/요약에 적합한 데이터에 제한적으로
    사용한다.
-   검색·관계·상태판단에 자주 쓰는 값은 별도 컬럼으로 둔다.
-   `verified_answer`는 **문제가 진행 중인 동안** 학생에게 노출하지
    않는다. 문제를 종료할 때는 정답과 해설로 보여준다.
    (COM-001 §8 종료 안내)
-   Answer Lock 데이터(`answer_lock_status` 등)는 어느 시점에도 학생에게
    노출하지 않는다. 검증 상태는 내부 값이다.
-   시스템 오류 데이터는 학습능력 평가에 섞지 않는다.

## 18. 삭제 및 보관

-   Student 프로필 삭제 시 `student_status = deleted_pending`.
-   `deleted_at` 기록.
-   학습기록은 삭제 요청 후 1년간 유지.
-   `learning_data_retain_until = deleted_at + 1 year`.
-   1년 이후 실제 삭제/익명화 방식은 COM-007에서 확정.
-   결제/법정 보관 데이터는 별도 법적 보관정책을 따른다.

## 19. Claude Code 구현 지침

Claude Code는 이 문서를 기준으로: 1. Supabase/PostgreSQL 테이블을
설계한다. 2. PK/FK와 필요한 unique/index 제약을 만든다. 3. enum은
프로젝트 정책에 맞춰 DB enum 또는 check constraint로 구현한다. 4. RLS가
필요한 사용자 데이터는 부모 Account와 Student 소유관계를 기준으로
설계한다. 5. migration 파일을 생성한다. 6. TypeScript 타입을 DB 스키마와
일치시킨다. 7. API/Server Action에서 공통 필드명을 그대로 사용한다. 8.
스키마 변경이 필요하면 임의 변경하지 말고 COM-002 변경 필요사항을 먼저
보고한다.

## 20. 구현 전 추가 확정이 필요한 세부사항

COM-002의 논리 구조는 확정하되, 실제 구현 전에 다음은 별도 결정
가능하다. - Supabase Auth와 `Account` 프로필 테이블의 정확한 연결 방식 -
결제 PG사 및 PG transaction ID 저장 방식 - OCR 원본 이미지 저장 위치와
보관기간 - 수학 교육과정 concept taxonomy - RLS 세부 정책 - COM-007
개인정보/아동 데이터 삭제·보관 세부정책

이 항목들은 본 문서의 핵심 관계를 변경하지 않는 범위에서 후속 문서에서
확정한다.

### 확정된 항목 (v1.1)

-   **StudentMemory JSON 내부 세부 schema** →
    `prompts/logic-auditor.md` Prompt 05
-   **평가 점수의 정확한 범위와 계산식** → 범위 0\~2 확정. 판정 기준은
    `prompts/logic-auditor.md` Prompt 04, 레벨 환산은 Prompt 05

-   **`Evaluation.transfer_score` · `reflection_score`의 Required** →
    `NO`로 확정. §8 참조

## 20-A. 변경 제안 · MODE B 의 의도적 오답을 담을 자리 (2026-09-10)

> **Status:** 승인 (2026-09-10). §6 본문에 반영했고 마이그레이션은
> `20260910011500_add_mode_b_wrong_answer_to_problem.sql` 이다.

### 무엇이 없나

MODE B 는 학생이 문제를 가져오고 **AI 가 일부러 틀리게 푼 뒤 학생이 그
오류를 잡아내는** 방식이다(COM-001). 프롬프트 03 은 그 오답을 입력으로
다시 받는다.

```text
payload.problem.ai_wrong_answer        AI 가 만든 의도적 오답
payload.problem.ai_wrong_reasoning     왜 그렇게 틀렸는지 (내부)
payload.problem.target_misconception   겨냥한 오개념 (내부)
```

`problem` 테이블에는 이 셋을 담을 칸이 없다. `verified_answer` 는 검증된
**정답**이라 여기에 섞을 수 없다(§6 · §17).

### 없으면 무슨 일이 생기나

**AI 가 자기가 만든 오답을 다음 턴에 잊는다.** 그러면 "내 풀이에서 틀린
곳을 찾아봐" 를 이어갈 수 없고, 남는 차이는 "문제를 누가 내느냐" 뿐이라
MODE A 와 같아진다. 개발 도구에서 2026-09-09 에 실제로 겪은 증상이며,
그때는 도구가 값을 이월하도록 고쳐서 해결했다. **제품은 새로고침을 넘어
살아남아야 하므로 DB 가 필요하다.**

### 제안

`Problem` (§6) 에 세 칸을 더한다. 모두 선택(NULL 허용)이며 MODE A 에서는
비어 있다.

| Field | Type | Required | Description |
|---|---|---|---|
| `ai_wrong_answer` | JSONB | NO | MODE B 에서 AI 가 만든 의도적 오답 |
| `ai_wrong_reasoning` | TEXT | NO | 그 오답의 논리. **내부 값** |
| `target_misconception` | TEXT | NO | 겨냥한 오개념. **내부 값** |

- 셋 다 **학생 화면에 노출하지 않는다.** `verified_answer` 와 같은 취급이다
  (§17). 문제를 마칠 때 보여주는 것은 정답과 해설이지 이 값이 아니다.
- 부모 화면에도 내보내지 않는다. 리포트가 읽을 값이 아니다.
- MODE A 문제에서는 NULL 이다. NOT NULL 로 두면 A 가 못 들어온다.

### 왜 지금

이 칸이 없으면 **MODE B 를 제품에 붙일 수 없다.** MIS-002(내가 문제 내기)가
막혀 있다.

---

## 20-B. 변경 · 운영자 · 감사 로그 · 동의 이력 (2026-09-10)

> **Status:** 승인. 마이그레이션은
> `20260910040000_create_admin_and_audit.sql` 이다.

COM-007 §13 이 요청한 세 가지다. 없으면 ADM 영역을 만들 수 없다.

### AdminUser

운영자와 권한 등급. **부모 계정과 별개다** — 같은 `auth.users` 를 쓰되 이
표에 없으면 어드민이 아니다. 부모가 스스로 운영자가 될 수 없다.

| Field | Type | Required | Description |
|---|---|---|---|
| `admin_id` | UUID | YES | PK · FK → `auth.users` |
| `admin_name` | TEXT | YES | 운영자 이름 |
| `email` | TEXT | YES | |
| `admin_role` | ENUM | YES | `full` / `cs` / `readonly` (COM-007 §7-2) |
| `is_active` | BOOLEAN | YES | 차단하면 false |
| `last_seen_at` | TIMESTAMPTZ | NO | |

### AuditLog

**마스킹 해제와 대화 원문 열람은 반드시 남긴다**(COM-007 §7-3). 누가 ·
언제 · 무엇을 · 왜 봤는지가 없으면 열람 규칙은 글일 뿐이다.

| Field | Type | Required | Description |
|---|---|---|---|
| `audit_id` | UUID | YES | PK |
| `admin_id` | UUID | YES | FK → `AdminUser`. **on delete restrict** |
| `action` | TEXT | YES | `unmask` · `view_messages` 등 |
| `target_type` | TEXT | YES | `account` · `student` · `problem` … |
| `target_id` | TEXT | YES | |
| `reason` | TEXT | NO | 마스킹 해제는 필수 |

지우거나 고칠 수 없다. RLS 에 update · delete 정책을 두지 않는다.

### ConsentLog

약관은 개정되므로 **버전이 함께 남아야 한다**(COM-007 §11).

| Field | Type | Required | Description |
|---|---|---|---|
| `consent_id` | UUID | YES | PK |
| `account_id` | UUID | YES | FK → `Account` |
| `consent_type` | TEXT | YES | `terms` · `privacy` · `guardian` · `marketing_*` |
| `document_version` | TEXT | YES | 동의한 약관의 버전 |
| `agreed` | BOOLEAN | YES | 철회도 행으로 남긴다 |

---

## 21. 완료 조건

-   모든 PM이 공통 entity와 ID 이름에 합의
-   Account ↔ Student 관계 확정
-   Student ↔ 학습데이터 관계 확정
-   Student별 무료체험/구독 구조 확정
-   Account 결제 구조 확정
-   Problem ↔ Message ↔ Evaluation ↔ LogicGap 연결 확정
-   StudentMemory의 역할 확정
-   Report/Event 구조 확정
-   COM-001의 모든 핵심 흐름을 저장할 수 있는 데이터 구조가 존재

---

## Changelog

| Version | Date | 변경 내용 | 작성 |
|---|---|---|---|
| — | 2026-09-10 | §20-B 추가: `AdminUser` · `AuditLog` · `ConsentLog` (COM-007 §13). ADM 영역의 선행 조건 | — |
| — | 2026-09-10 | §20-A **변경 제안** 추가: MODE B 의 의도적 오답을 담을 칸 3개(`ai_wrong_answer` · `ai_wrong_reasoning` · `target_misconception`). 승인 전이므로 본문 §6 은 그대로 | — |
| 1.3 | 2026-09-09 | §17 `verified_answer` 노출 금지를 **"문제가 진행 중인 동안"** 으로 한정. 종료 시점에는 정답·해설로 보여준다(COM-001 §8 종료 안내). Answer Lock 데이터는 시점과 무관하게 계속 비노출 — 검증 상태는 내부 값이다. §8 Rules에도 같은 단서 추가 | — |
| 1.0 | 2026-08-28 | `docs/` 이관 및 문서 헤더 도입. **본문 변경 없음** | — |
| 1.2 | 2026-09-09 | §8 `initial_accuracy` Required {YES} → `NO`. 관찰하지 못한 최초 정답을 `false`가 아닌 NULL 로 둔다 — MODE B 는 학생이 AI 오류를 찾는 구조라 "최초 정답"이 성립하지 않는 경우가 정상적으로 생긴다. `support_level` 최종값은 턴별 값의 최대값이며 서버가 계산한다는 규칙 추가. LOGIC AUDITOR 프롬프트 v3.0 과 맞춤 (Issue #28) | — |
| 1.1 | 2026-09-01 | PM 전원 합의로 미정 값 5건 확정. §6에 `learning_mode`(`mode_a`/`mode_b`) · `answer_lock_status`(`locked`/`recheck`/`invalid_problem`) 값 목록과 `difficulty` 1\~5 추가. §8 점수 범위 0\~2 확정 및 예시값을 범위 안으로 수정(3·4 → 2·2·1·2), **`transfer_score`·`reflection_score`의 Required를 `YES` → `NO`** (Drill-down 조기 종료 시 `0`과 구분). §10 레벨 1\~5 명시, JSONB schema를 `prompts/logic-auditor.md` Prompt 05로 위임. §20에서 확정 3건 이관. **엔티티·필드·관계 변경 없음** | — |
