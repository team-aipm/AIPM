# COM-002 · 공통 데이터 구조 정의서 --- 개발용

> **Version:** 1.9 · **Updated:** 2026-09-30 · **Owner:** (미지정)\
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
│    ├── LearningReport
│    │
│    ├── ParticipationStamp      도장 (§22-1)
│    ├── LearningStreak          연속 평일 (§22-2)
│    ├── CoinLedger              코인 원장 (§22-3)
│    ├── StudentCharacter        캐릭터 소유권 (§22-4)
│    ├── RewardGoal              보상 목표 (§22-5)
│    └── TemporaryUpload         사진 임시 (§23)
│
├── Payment
├── Notification                 알림 (§24)
└── Event
```

핵심 관계: - Account 1 : N Student - Student 1 : N LearningSession -
LearningSession 1 : N Problem - Problem 1 : N Message - Problem 1 : 0..1
Evaluation - Problem 1 : 0..N LogicGap - Student 1 : 1 StudentMemory -
Student 1 : N Subscription history, 단 동시에 active 구독은 1개 -
Account 1 : N Payment - Student 1 : N LearningReport - Account/Student 1
: N Event - Student 1 : N ParticipationStamp(하루 1개) - Student 1 : 1
LearningStreak - Student 1 : N CoinLedger - Student 1 : N StudentCharacter -
Student 1 : N RewardGoal(동시 active 1개 · queued 1개) - Account 1 : N
Notification

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

  `account_name`                   TEXT                         NO 김세희               부모 이름
                                                                                        (가입 시 안 받음)

  `email`                          TEXT                        YES parent@example.com   이메일

  `phone_number`                   TEXT                         NO 01012345678          부모 휴대폰
                                                                                        (가입 시 안 받음)

  `birth_date`                     DATE                         NO 1978-05-20           부모 생년월일
                                                                                        (가입 시 안 받음)

  `account_status`                 ENUM/TEXT                   YES active               계정 상태.
                                                                                        `active` / `test`

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

Account rules: - **회원가입은 이메일 · 비밀번호 · 동의 4종만 받는다**
(2026-09-22 변경). 이름 · 휴대폰 · 생년월일은 가입 시 받지 않으며 `null`
이다. - 결제수단 및 결제 이력은 Account 기준. - 학생별 학습데이터를
Account에 직접 저장하지 않는다.

### 3-1. 이름 · 휴대폰 · 생년월일을 왜 안 받나 · **2026-09-22**

Figma 「메티_서비스」의 `부모 / 회원가입` 프레임에 그 칸들이 없다. 받는
것은 이메일 · 비밀번호 · 비밀번호 확인과 동의 4종뿐이다.

전에는 `handle_new_account` 트리거가 셋을 요구해서, 없으면 **가입을 통째로
되돌렸다.** 그래서 디자인대로 만들면 가입 자체가 되지 않았다. 같은 이유로
소셜 로그인(구글 · 카카오)도 막혀 있었다 — 그쪽도 셋을 주지 않는다.

컬럼은 지우지 않았다. 이미 가입한 사람들의 값이 들어 있고 `MY-002`(프로필)
와 `ADM` 화면이 그것을 읽는다. `null` 을 허용할 뿐이다.

**아직 답이 없는 것 둘**

- `AUTH-004` 휴대폰 인증(DEV-002 `/signup/verify`)은 무엇으로 하나.
  Figma 에 해당 프레임이 없다.
- 법정대리인 동의를 받는데 보호자를 식별할 값이 이메일뿐이어도 되나.
  COM-007 §2 의 판단이 필요하다.

마이그레이션: `20260922120000_allow_null_account_profile_fields.sql`

`account_status` 는 `active` 와 `test` 다. `test` 는 **프롬프트 랩 전용
계정**이며 테스트 학생을 매다는 자리다(§4). 집계는 이 계정을 세지 않는다.
탈퇴 관련 값은 COM-007 확정 후 enum 으로 전환한다.

### 3-2. 탈퇴와 복구 · **2026-09-30**

COM-007 이 미뤄 두었던 회원탈퇴가 정해졌다. **요청한 순간 못 들어오고,
30일 뒤에 지운다.** 그 사이에는 되돌릴 수 있다.

`account_status` 에 두 값이 늘어난다.

```text
active             쓰고 있다
test               프롬프트 랩 전용 (§3-1)
deleted_pending   탈퇴를 요청했다. 로그인 차단. 30일 안이면 복구 가능
                  (COM-007 §5 가 쓰는 이름 그대로다)
deleted            30일이 지났다. 개인정보와 학습데이터를 지웠다
```

| Field | Type | Required | Description |
|---|---|---|---|
| `deleted_at` | TIMESTAMPTZ | NO | 탈퇴를 **요청한** 시각 |
| `purge_at` | TIMESTAMPTZ | NO | 실제로 지우는 시각. `deleted_at + 30일` |

- **지우는 일은 배치가 한다**(`/api/cron/purge-deleted-accounts`).
  요청 순간에 지우면 되돌릴 수 없다.
- 부모가 탈퇴하면 **연결된 아이 전부**가 같은 절차를 밟는다(§4-3).
- 결제 기록은 법이 보관하라고 한 것이라 함께 지우지 않는다.
  운영 데이터와 **분리해서** 남긴다(COM-007).

**휴대폰 본인확인은 아직 없다.** 팀이 정한 정책은 탈퇴 · 결제수단 변경 같은
중요한 행동에 재인증을 요구하지만, 본인확인 수단 계약이 없다(CLAUDE.md
미작성 문서). 지금은 **비밀번호를 다시 받는 것**까지만 한다.

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

  `birth_date`                   DATE                         NO 2015-08-27     생년월일
                                                                               (등록 시 안 받음)

  `grade`                        SMALLINT                    YES 5              MVP: 4,5,6

  `persona_type`                 ENUM/TEXT                   YES friend         `friend` /
                                                                                `villain`

  `learning_grade`               SMALLINT                    YES 5              지금 푸는 학년.
                                                                                1\~7 (7 = 중1)

  `current_difficulty`           SMALLINT                    YES 3              그 학년 안에서의
                                                                                난이도 1\~5

  `student_status`               ENUM/TEXT                   YES active         `active` /
                                                                                `deleted_pending` /
                                                                                `test`

  `created_at`                   TIMESTAMPTZ                 YES timestamp      프로필 생성

  `deleted_at`                   TIMESTAMPTZ                  NO timestamp      삭제 요청

  `learning_data_retain_until`   TIMESTAMPTZ                  NO timestamp      삭제 후 학습기록
                                                                                보관 종료

  `login_email`                  TEXT                         NO jaeun@              아이가 로그인할 때
                                                                 example.com     쓰는 이메일.
                                                                                전체에서 유일

  `auth_user_id`                 UUID                         NO uuid           아이 계정의
                                                                                `auth.users.id`.
                                                                                FK → auth.users
  -------------------------------------------------------------------------------------------------

Student rules: - Account당 Student 수 제한 없음. - `nickname`은 필수이며
기본값은 `student_name`. - **`birth_date`는 등록할 때 받지 않는다**
(2026-09-22 개정). - 각 Student의 학습데이터는 서로 독립. - 학생 삭제 후
학습기록은 1년 유지. - 직접 식별정보의 세부 보관/삭제 정책은 COM-007에서
최종 확정.

### 4-2. 생년월일을 왜 안 받나 · **2026-09-22**

Figma 「메티_서비스」의 `자녀 계정 생성` 프레임이 다섯 칸만 받는다.

```text
자녀 정보    이름 또는 별명 · 학년
로그인 정보  아이디 · 비밀번호 · 비밀번호 확인
```

생년월일 칸이 없다. **쓰는 곳도 없다** — 난이도와 문제 범위를 정하는 것은
`grade`이고(DB CHECK 4~6), `birth_date`로 하는 일이 없다.

아이의 생년월일은 COM-007이 말하는 아동 개인정보다. 쓰지 않을 값을 받아
두면 지켜야 할 것만 늘어난다. 받지 않는 것이 가장 확실한 보호다.

**화면은 이름 칸이 하나인데 DB는 둘이다.** `student_name`과 `nickname`이
모두 `not null`이라, 한 값을 양쪽에 넣고 `nickname_source`를
`name_default`로 남긴다. 스키마는 그대로 둔다.

마이그레이션: `20260922130000_allow_null_student_birth_date.sql`

### `grade` 와 `learning_grade` 는 다른 값이다 (2026-09-28 추가)

```text
grade            실제 학년.      4~6. 부모가 고치기 전에는 안 움직인다
learning_grade   지금 푸는 학년.  1~7 (7 = 중1). 학습에 따라 움직인다
```

**결손이 있는 아이에게 제 학년 문제만 주면 아무것도 되지 않는다.**
4학년 아이가 4학년 레벨 1 에서도 계속 막히면 3학년으로, 더 막히면 2학년
으로 내려간다. 바닥은 1학년 레벨 1 (`1 + 1` 수준)이다.

반대쪽도 막지 않는다. 6학년 레벨 5 를 뚫으면 중1 로 올라간다. 천장은
중1 레벨 5 다 — 그 위가 실제로 필요한지 아직 모르기 때문에 거기서 멈춘다
(COM-001 §9).

**대상은 그대로 초등 4\~6학년이다.** `grade` 의 `4~6` 제약을 건드리지
않는다. 넓힌 것은 문제를 고르는 범위뿐이다.

**학생에게 보이지 않는다.** 5학년 아이가 「너는 4학년 문제를 푸는 중」
이라고 알게 되면 안 된다. 부모 화면에도 넣지 않는다 — COM-003 이 현재
난이도를 「부모/학생 모두 수정 불가」 로 두고 화면에도 내보내지 않는다.

`student_status = 'test'` 는 **프롬프트 랩이 만든 학생**이다. 진짜 아이가
아니다.

랩에서 돌린 결과를 실제 학습 데이터(`learning_session` · `problem` ·
`evaluation`)로 남기려면 학생 행이 필요한데, 그것을 진짜 아이와 구별할
방법이 없으면 집계와 배치가 테스트를 진짜로 센다. 주간 리포트 배치는
학생마다 AI 를 부르므로 **실제 비용이 나간다.**

- **집계와 배치는 `test` 를 제외한다.** `.eq('student_status','active')` 를
  쓰는 곳은 자동으로 빠진다. 상태를 안 보고 세는 집계
  (`admin-metrics.funnel()`)는 명시적으로 거른다
- **새 집계를 더할 때도 빼야 한다.** 빠뜨려도 오류가 나지 않고 숫자만
  조용히 커진다
- 운영자 목록(`ADM-005`)에는 **그대로 보인다.** 상태 칸이 있어 구별되고,
  운영자는 DB 에 있는 것을 다 볼 수 있어야 한다
- 테스트 학생은 **랩 전용 Account 하나**(`account_status = 'test'`)에 매단다.
  그 Account 를 지우면 `on delete cascade` 로 학습 데이터가 함께 사라진다.
  단 `Event` 는 `on delete set null` 이라 행이 남는다

### 4-1. 학생 로그인 (2026-09-29 개정)

`login_email`과 `auth_user_id`는 **등록할 때 반드시 받는다**.
아이는 자기 이메일로 자기 기기에서 들어간다.

**아이디를 없애고 이메일로 바꿨다**(정책 v0.1 §5 · §7 · §8). 로그인 화면이
부모와 아이 공통이므로, 한 칸에 이메일 하나만 받는 편이 단순하다.

-   **부모가 입력한다.** 아이는 스스로 가입하지 않는다. 만 14세 미만의
    가입에는 법정대리인 동의가 필요하다(COM-007 §2).
-   **아이가 이미 쓰는 이메일을 넣는다.** 없으면 부모가 먼저 만들어 주어야
    한다 — 초등 4\~6학년에게 이메일이 없는 경우가 적지 않다.
-   **확인 메일을 보내지 않는다.** 부모가 입력한 주소를 그대로 믿는다.
    아이가 메일함을 열어야 하는 절차를 두면 흐름이 길어지고, 아이 계정에는
    애초에 메일로 할 일이 없다.
-   **아이는 스스로 비밀번호를 재설정하지 못한다**(정책 §8). 실제 이메일이
    생겼지만 `/password`가 아이 계정이면 메일을 보내지 않는다. 부모가
    MY-003에서 새로 정해 준다.
-   두 값은 함께 생기고 함께 없어진다. 하나만 있는 상태를 두지 않는다.

**DB 는 nullable 로 둔다.** 아직 로그인이 없는 학생이 있어서 `NOT NULL` 로
조이면 그 행이 깨진다. 막는 자리는 등록 화면과 서버(`STU-001` · `MY-004`)다.
남아 있는 학생은 `MY-003`에서 만들어 준다.

#### 아이 계정을 어떻게 가려내나

`auth.users` 만 보고는 부모와 아이를 가릴 수 없다. 전에는 가짜 이메일
도메인(`@student.aipm.invalid`)이 표식이었는데 그것이 없어졌다.

**`app_metadata.role = 'student'`** 로 가린다. `handle_new_account` 트리거가
이것을 보고 아이에게는 `account`(부모 프로필)를 만들지 않는다.

`app_metadata` 는 `service_role` 만 쓸 수 있고 아이 계정은 서버가
`auth.admin.createUser` 로만 만든다. **전보다 튼튼하다** — 함께 보던
`user_metadata.role` 은 누구나 가입 요청에 실을 수 있었다.

RLS는 `owns_student()` 한 곳에서 갈린다. 부모(`account_id = auth.uid()`)
**또는** 본인(`auth_user_id = auth.uid()`)이면 자기 학습데이터를 읽고 쓴다.
학생 행 자체는 아이가 `persona_type`만 바꿀 수 있다 — 난이도·학년·상태를
사람이 고치면 다음 문제 선정이 어긋난다(COM-003 §9). DB 트리거
`student_self_update_guard`가 막는다.

### 4-3. 캐릭터 · 학년 확인 · 삭제 · **2026-09-30**

| Field | Type | Required | Description |
|---|---|---|---|
| `active_character_id` | TEXT | YES | 지금 함께하는 캐릭터. `meti`/`heti`/`quri`/`poki`/`tori`/`mono` |
| `grade_confirmed_at` | TIMESTAMPTZ | NO | 부모가 학년을 확인해 준 시각 |
| `deleted_at` | TIMESTAMPTZ | NO | 삭제를 **요청한** 시각 |
| `purge_at` | TIMESTAMPTZ | NO | `deleted_at + 30일` |

`student_status` 에 두 값이 늘어난다(§4 의 `active`/`test` 에 더해서).

```text
pending            등록만 됐고 아직 한 번도 안 들어왔다
active             쓰고 있다
test               프롬프트 랩 전용
deleted_pending   삭제를 요청했다. 로그인 차단
deleted            30일이 지났다
```

- **캐릭터는 아이가 고른다.** 부모는 바꾸지 못한다.
  `active_character_id` 는 `StudentCharacter`(§22-4)에 소유권이 있는 것만
  가리킬 수 있다.
- **삭제를 되돌리는 것은 부모만 할 수 있다.** 아이는 못 들어오므로
  스스로 되돌릴 방법이 없다.
- `nickname` · `nickname_source` 는 **남겨 두되 새로 쓰지 않는다.** 폼이
  이름 한 칸만 받으므로 같은 값이 양쪽에 들어간다(§4-2). 컬럼을 지우면
  배포된 코드가 먼저 깨진다.

**학생 로그인 이메일은 `student.login_email` 그대로다**(§4-1). 팀 정책
문서는 별도 `StudentLoginIdentity` 테이블과 인증번호 · 메티 이메일 발급을
제안했지만, 도메인과 메일 수신 설정이 없어 **부모가 직접 입력하는 방식을
유지한다**(`FIGMA-MD-AUDIT.md` §0).

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

### 5-1. 세션의 종류와 기한 · **2026-09-30**

전에는 세션이 「오늘 한 묶음」 하나였다. 지난 미션과 주말 자유학습이
생기면서 **어떤 묶음인지 구분해야** 도장과 코인을 맞게 줄 수 있다.

| Field | Type | Required | Description |
|---|---|---|---|
| `session_type` | ENUM/TEXT | YES | `daily` / `past` / `weekend_free` / `extra` |
| `target_problem_count` | SMALLINT | YES | `daily` 는 10 |
| `eligible_until` | TIMESTAMPTZ | NO | 지난 미션으로 이어갈 수 있는 기한 |

```text
daily          월~금 오늘의 미션 10개. 학생·날짜당 1개뿐이다
past           못 끝낸 daily 를 7일 안에 이어서 하는 것
weekend_free   토·일. 새 미션은 안 나오고 지난 것과 가져온 것만
extra          그 밖
```

- **`daily` 는 평일에만 만든다.** 주말에 새 10개를 내지 않는다.
- `past` · `weekend_free` · `extra` 는 **그날의 기본 10개에 안 들어간다.**
  도장에도 코인에도 반영하지 않는다(§22).
- `eligible_until` 은 `session_date + 7일`이다. 지나면 `expired` 다.

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

`difficulty`: 1\~5. **`Student.learning_grade` 안에서의 상대값**이다(§4).
학년이 다르면 같은 숫자라도 다른 문제다 — 4학년 5 와 6학년 5 는 다르다.

| 레벨 | 기준 |
|---|---|
| 1 | 한 단계. 식이 그대로 주어지고 수가 작다 |
| 2 | 두 단계 이상이거나 순서를 지켜야 한다 |
| 3 | **그 학년의 평균.** 짧은 문장제. 식을 한 줄로 세운다 |
| 4 | 조건이 둘 이상. 식을 세우기 전에 정리해야 한다 |
| 5 | 두 단원을 엮는다. 중간값을 먼저 구해야 답이 나온다 |

**예시를 적지 않는다.** 예시를 박으면 그것이 출제 기준이 되는데, 학년
범위를 벗어난 예시 하나가 들어가면 그 학년 문제가 통째로 어긋난다.
위 기준은 학년과 무관하므로 1학년부터 중1까지 그대로 쓴다.

전에는 「3 = 학년 중간 난이도」 한 줄뿐이었다. 1·2·4·5 가 정의되지
않아 **AI 가 「레벨 4」 를 매번 다르게 해석했다.**

Rules: - `verified_answer`는 학습 시작 전에 검증되어야 한다. - 검증 실패
문제는 평가 학습에 사용하지 않는다. - 문제 진행 중에는 학생에게 노출하지
않으며, 종료 시점에만 정답 안내로 사용한다(§17, COM-001 §8). - 사진 입력은 학생 확인 후
`problem_text`를 확정한다. - `answer_lock_status`가 `invalid_problem`이면
`problem_status`를 `verification_failed`로 둔다. - 세 값의 판정 기준은
`prompts/logic-auditor.md`의 Prompt 02에서
정의한다.

### 6-1. 무엇을 셀 것인가 · **2026-09-30**

도장과 코인을 주려면 **이 문제가 오늘의 기본 10개인지**를 문제 행이 스스로
알고 있어야 한다. 세션 종류만 보면 나중에 세션 종류가 바뀌었을 때 이미 준
코인이 흔들린다.

| Field | Type | Required | Description |
|---|---|---|---|
| `counts_toward_daily` | BOOLEAN | YES | 오늘의 기본 10개에 드는가 |
| `coin_eligible` | BOOLEAN | YES | 코인을 줄 수 있는 문제인가 |
| `completed_at` | TIMESTAMPTZ | NO | 실제로 끝난 시각 |

- 두 값은 **문제를 만들 때 정하고 그 뒤로 바꾸지 않는다.**
- `completed` · `needs_review` 만 「참여 완료」로 센다. `system_interrupted`
  · `verification_failed` · `abandoned` 는 세지 않는다(COM-001 §19).
- **`learning_mode` 는 그대로다.** 팀 정책 문서는 `learning_flow`
  (`student_solves` / `student_teaches` / `guided_solve`) 라고 부르는데,
  우리 컬럼 `learning_mode` 의 MODE A · MODE B 와 같은 것이다. 이름을
  바꾸지 않는다(§17). 대화 중 「잘 모르겠어」로 함께 풀기로 넘어가는 것은
  **같은 문제 안에서** 일어난다 — 새 문제를 만들지 않는다.

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
  `is_hint`           BOOLEAN              YES false         04 HINT 가 준 말
  `created_at`        TIMESTAMPTZ          YES timestamp     저장 시점

`drilldown_stage`: - `judgment` - `reasoning` - `rule` - `transfer` -
`reflection`

Rules: - 대화 턴마다 즉시 저장. - 마지막 저장 Message를 기준으로 학습
복구 가능해야 함.

`is_hint` (2026-09-10 추가): 04 HINT 가 준 말에만 `true`. 다음 Hint 요청에
`hint_history`로 넘겨 **같은 말을 되풀이하지 않게** 한다. 05 EVALUATOR 의
`hint_count`도 여기서 센다.

`support_level`로는 Hint를 가려낼 수 없다 — MODE A·B의 보통 턴도 도움
수준을 함께 남긴다. `drilldown_stage`도 아니다. 그 값은 사고 단계이지
「이 말이 Hint였다」가 아니다.

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

`current_level` 은 **하루를 마칠 때 서버가 계산한다.** 그날 낸 문제들의
`Problem.difficulty` 중앙값이다. AI(06 DAILY ANALYZER)의 출력에서 받지
않는다 — 같은 기록이면 언제나 같은 결과여야 한다(COM-001 §9 · §10).

`Student.current_difficulty`(§4)와 헷갈리지 않는다. 그쪽은 문제를 마칠
때마다 움직이는 **지금 내보낼 문제의 수준**이고, 이쪽은 하루에 한 번
정하는 **요즘 어디쯤인가**다. 역할이 다르므로 합치지 않는다.

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

추가 (2026-09-17): - `child_login_first` - `ai_call_failed` -
`answer_verification_failed`

셋을 더한 이유가 각각 다르다.

  ------------------------------- --------------------------------------------
  `child_login_first`             부모가 등록한 아이가 **처음으로 자기
                                  계정으로 들어온 순간.** 부모 계정이 학생
                                  화면에 못 들어가게 되면서(COM-003 §4.2)
                                  「등록은 했는데 아이가 한 번도 안 들어옴」
                                  이라는 이탈 지점이 새로 생겼다. 학생당 한
                                  번만 남는다

  `ai_call_failed`                단계 프롬프트 호출이 실패했다. 학생에게는
                                  다시 말해 달라고 하고 넘어가므로 **아무 데도
                                  안 남는다.** 어느 단계가 · 왜 · 얼마나 자주
                                  깨지는지는 이것 말고 알 길이 없다

  `answer_verification_failed`    AI 가 정답을 확신하지 못해 문제를 접었다
                                  (`problem_status = verification_failed`).
                                  학생 잘못이 아니라 우리 쪽 품질 문제다
                                  (COM-001 §19)
  ------------------------------- --------------------------------------------

**`event_properties` 에는 식별자와 숫자·코드만 넣는다.** 대화 원문 · 문제
내용 · 이름은 넣지 않는다. 한 번 들어가면 빼기 어렵고, 운영자는 집계만
본다(COM-007 §7-1).

**이미 다른 테이블에 있는 사실은 이벤트로 또 남기지 않는다**(§17). 힌트
사용은 `message.is_hint`, Drill-down 과 스스로 고침은 `evaluation`, 모드
A/B 는 `problem.learning_mode` 가 이미 들고 있다. 두 벌로 두면 반드시
어긋난다 — 이벤트 기록은 실패해도 조용히 넘어가도록 만들어져 있어서
(`lib/analytics/events.ts`) 가끔 빠지기 때문이다. 어긋난 뒤에는 어느 쪽이
맞는지 판단할 근거가 없다. **이벤트는 어느 테이블에도 안 남는 사실에만
쓴다.**

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

## 22. 보상 · 코인 · 캐릭터 (2026-09-30 추가)

> 근거: `meti-core-learning-mechanism.md` §7 · `FIGMA-MD-AUDIT.md` P0-5 ·
> P1-1 · P1-5. 이 영역은 전에 문서에 아예 없었다.

두 가지를 나눠서 준다. **섞으면 안 된다.**

```text
도장   평일 오늘의 미션 10개를 다 했을 때  하루 1개   → 부모가 약속한 보상
코인   미션 1개를 끝낼 때마다  10개 (하루 100)        → 캐릭터 해금
```

아이가 중간에 그만두면 **한 것만큼의 코인은 남고, 도장은 안 준다.**
9개까지 했다고 해서 도장을 주면 「10개」라는 약속이 의미를 잃는다.

### 22-1. ParticipationStamp

| Field | Type | Required | Description |
|---|---|---|---|
| `stamp_id` | UUID | YES | PK |
| `student_id` | UUID | YES | FK → Student |
| `stamp_date` | DATE | YES | 기준일 |
| `trigger_problem_id` | UUID | YES | 10개째를 채운 문제 |
| `created_at` | TIMESTAMPTZ | YES | 지급 시각 |

- `student_id + stamp_date` 는 **UNIQUE**. 하루에 두 개가 나올 수 없다.
- 월~금의 `daily` 세션에서 `counts_toward_daily` 인 문제 10개가 모두
  `completed` 또는 `needs_review` 가 된 **그 순간에만** 만든다.
- 1~9개에서는 만들지 않는다. 지난 미션과 주말 학습으로는 채울 수 없다.

### 22-2. LearningStreak

| Field | Type | Required | Description |
|---|---|---|---|
| `student_id` | UUID | YES | PK · FK → Student |
| `current_weekday_streak` | INTEGER | YES | 지금 이어진 평일 수 |
| `last_stamp_date` | DATE | NO | 마지막 도장일 |
| `updated_at` | TIMESTAMPTZ | YES | 갱신 시각 |

- 토 · 일은 **건너뛴다.** 주말에 안 했다고 끊기지 않는다.
- 공휴일 달력은 MVP 에서 쓰지 않는다.
- **끊긴 것을 실패처럼 보여주지 않는다**(CLAUDE.md · COM-003).
  연속기록은 곁들이는 정보지 평가가 아니다.

### 22-3. CoinLedger

**원장이다. 고치지 않고 행을 더한다.** 잘못 준 코인은 음수 행으로 바로잡는다
— 지운 자리는 나중에 아무도 설명하지 못한다.

| Field | Type | Required | Description |
|---|---|---|---|
| `coin_ledger_id` | UUID | YES | PK |
| `student_id` | UUID | YES | FK → Student |
| `problem_id` | UUID | NO | 지급 사유. **UNIQUE** |
| `character_id` | TEXT | NO | 해금 사유 |
| `idempotency_key` | TEXT | NO | 해금 중복 방지. **UNIQUE** |
| `amount` | INTEGER | YES | 지급 `+10`, 해금은 음수 |
| `reason` | TEXT | YES | `daily_problem_completed` / `character_unlock` / `adjustment` |
| `occurred_at` | TIMESTAMPTZ | YES | 발생 시각 |

- `problem_id` 가 UNIQUE 라서 **같은 문제로 두 번 받을 수 없다.**
  새로고침이나 재시도로 코인이 불어나는 일을 DB 가 막는다.
- 지급은 `coin_eligible` 이고 `completed`/`needs_review` 인 문제에만.
  `system_interrupted` 에는 주지 않는다 — 아이 잘못이 아니지만, 하지 않은
  학습을 셀 수도 없다. **대신 정답률에도 반영하지 않는다**(COM-001 §19).
- 학생 · 날짜별 지급 합계는 **최대 100** 이다.
- **완료 보너스는 없다.** 전에 있던 「+30」 은 없앴다(`FIGMA-MD-AUDIT` P1-5).
- 잔액은 이 표의 합이다. 따로 들고 있지 않는다 — 두 곳에 두면 어긋난다.

### 22-4. StudentCharacter

| Field | Type | Required | Description |
|---|---|---|---|
| `student_character_id` | UUID | YES | PK |
| `student_id` | UUID | YES | FK → Student |
| `character_id` | TEXT | YES | `meti`/`heti`/`quri`/`poki`/`tori`/`mono` |
| `unlock_source` | TEXT | YES | `default` / `coin` |
| `coin_price` | INTEGER | YES | **해금 당시** 가격. 기본은 0 |
| `unlocked_at` | TIMESTAMPTZ | YES | 소유 시작 |

```text
메티 · 헤티   기본 제공 (학생을 만들 때 default 로 두 행을 만든다)
큐리            500 코인
포키            800 코인
토리          1,200 코인
모노          2,000 코인
```

- `student_id + character_id` 는 **UNIQUE**.
- `coin_price` 를 **그때 값으로 박아 둔다.** 가격을 올리면 예전에 산 아이의
  기록이 따라 바뀌면 안 된다.
- 잔액 확인 · 음수 `CoinLedger` · 이 행 만들기를 **한 트랜잭션**으로 한다.
  실패하면 코인이 줄지 않는다. 두 번 눌러도 한 번만 빠진다
  (`idempotency_key`).
- 해금은 **영구**다. 되돌리지 않는다.
- 캐릭터는 말투와 연출만 담당한다. **정답 · 평가 · 난이도를 바꾸지 않는다**
  (CLAUDE.md · COM-001 §19).

### 22-5. RewardGoal

부모가 아이와 **약속한** 보상이다. 서비스가 정하는 것이 아니다.

| Field | Type | Required | Description |
|---|---|---|---|
| `reward_goal_id` | UUID | YES | PK |
| `student_id` | UUID | YES | FK → Student |
| `account_id` | UUID | YES | 정한 보호자 |
| `reward_name` | TEXT | YES | 약속한 것 |
| `target_stamp_count` | INTEGER | YES | 목표 도장 수. 1~365 |
| `reward_status` | TEXT | YES | `queued`/`active`/`achieved`/`delivered`/`cancelled` |
| `activated_at` | TIMESTAMPTZ | NO | 시작 |
| `achieved_at` | TIMESTAMPTZ | NO | 도장을 다 모은 시각 |
| `delivered_at` | TIMESTAMPTZ | NO | 실제로 준 시각 |

- 학생당 `active` 1개 · `queued` 1개까지.
- **`achieved` 와 `delivered` 는 다르다.** 도장을 다 모은 것과 부모가
  실제로 사 준 것은 같은 날이 아니다.
- 달성하면 `queued` 가 곧바로 `active` 가 되고 **도장은 계속 쌓인다.**
  0 으로 되돌리지 않는다 — 아이가 모은 것을 뺏는 셈이 된다.
- 진행 중인 목표의 **이름은 고칠 수 있지만 목표 수는 못 고친다.**
- 365 까지 저장은 되고, 100 이 넘으면 화면이 「오래 걸려요」라고 **말만**
  한다. 막지 않는다.
- `delivered` 로 바꾸는 것은 부모만 한다.

---

## 23. TemporaryUpload · 사진은 남기지 않는다 (2026-09-30 추가)

> 근거: `meti-core-learning-mechanism.md` §4 · COM-007 · `FIGMA-MD-AUDIT` P0-3.

**사진은 입력 수단이지 학습기록이 아니다.** 아이가 찍은 종이에는 이름 ·
학교 · 다른 문제까지 같이 찍힌다. 그래서 글자를 뽑아내고 **바로 지운다.**

| Field | Type | Required | Description |
|---|---|---|---|
| `upload_id` | UUID | YES | PK |
| `student_id` | UUID | YES | FK → Student |
| `storage_path` | TEXT | YES | 비공개 임시 경로 |
| `upload_status` | TEXT | YES | `processing`/`confirmed`/`failed`/`cancelled`/`deleted` |
| `expires_at` | TIMESTAMPTZ | YES | 강제 만료 |
| `deleted_at` | TIMESTAMPTZ | NO | 실제로 지운 것을 확인한 시각 |

- 아이가 **확인 · 실패 · 취소한 직후** 지운다. 셋 다 지운다.
- 못 지운 것이 남으면 배치가 다시 지운다
  (`/api/cron/delete-temporary-uploads`).
- **`Problem` 에 사진 경로를 저장하지 않는다.** 아이가 확인한 텍스트와
  구조화 데이터만 남는다.
- 도형 · 그래프를 제대로 구조화하지 못하면 **학습을 시작하지 않고**
  다시 찍거나 글로 쓰라고 안내한다. 반쪽짜리로 진행하면 엉뚱한 것을
  가르치게 된다.
- **학습 대화 중에는 사진을 받지 않는다**(MVP). 미션을 가져올 때만이다.

---

## 24. Notification · 알림 (2026-09-30 추가)

`Event`(§14)와 다르다. **`Event` 는 우리가 보려고 남기는 기록이고,
`Notification` 은 부모에게 실제로 보낸 것**이다.

| Field | Type | Required | Description |
|---|---|---|---|
| `notification_id` | UUID | YES | PK |
| `account_id` | UUID | YES | 받는 보호자 |
| `student_id` | UUID | NO | 어느 아이 얘기인지 |
| `notification_type` | TEXT | YES | `weekly_report`/`reward_achieved`/`trial_ending`/`payment` … |
| `title` | TEXT | YES | |
| `body` | TEXT | YES | |
| `read_at` | TIMESTAMPTZ | NO | 읽은 시각 |
| `created_at` | TIMESTAMPTZ | YES | |

`NotificationPreference` 는 무엇을 받을지 정하는 것이다.

| Field | Type | Required | Description |
|---|---|---|---|
| `account_id` | UUID | YES | PK · FK → Account |
| `weekly_report_on` | BOOLEAN | YES | |
| `reward_on` | BOOLEAN | YES | |
| `learning_summary_on` | BOOLEAN | YES | |
| `updated_at` | TIMESTAMPTZ | YES | |

- **결제와 구독 알림은 끄지 못한다.** 돈이 나가는 일이다.
- **아이에게는 마케팅을 보내지 않는다.** 동의도 받지 않는다.
- 알림 센터(`/parent/notifications`)와 알림 설정
  (`/parent/my/notifications`)은 다른 화면이다(DEV-002).

---

## 25. 마케팅 동의는 두 채널이다 (2026-09-30 변경)

전에는 셋이었다 — 이메일 · SMS · 알림톡. **카카오 알림톡은 뺀다.**
보낼 기능이 없는데 미리 동의를 받아 두는 것은 받아 놓고 안 쓰는 개인정보다.

```text
marketing_email_opt_in      쓴다
marketing_sms_opt_in        쓴다
marketing_alimtalk_opt_in   컬럼은 두고 화면에서 안 받는다. 기본 false
```

- **기본값은 둘 다 미동의**다. 체크를 미리 켜 두지 않는다.
- 가입 화면에서 채널별로 따로 고른다. 한 줄로 묶지 않는다.
- 동의하지 않아도 가입과 서비스 이용을 막지 않는다.
- 나중에 알림톡을 실제로 보내게 되면 그때 `marketing_kakao` 동의를 새로
  받는다. 지금 받아 둔 것으로 보내지 않는다.
- `ConsentLog`(§20-B)에는 **거절도 행으로 남긴다.** 동의하지 않았다는
  사실 자체가 증명해야 할 것이다.

**지금 코드는 아직 한 칸이다 · 맞춰야 할 것.** `(auth)/signup/_actions.ts`
의 `metadataFor` 가 체크박스 하나를 읽어 세 값을 같이 켠다. 화면을 두
칸으로 나눌 때 함께 고친다 — 컬럼은 그대로 두고 `alimtalk` 은 `false` 로
둔다.

---

## Changelog

| Version | Date | 변경 내용 | 작성 |
|---|---|---|---|
| 1.9 | 2026-09-30 | **팀 정책 반영 · 엔티티 8개 추가.** §22 보상(`ParticipationStamp`·`LearningStreak`·`CoinLedger`·`StudentCharacter`·`RewardGoal`) · §23 `TemporaryUpload` · §24 `Notification`·`NotificationPreference` · §25 마케팅 2채널. `Account` 에 §3-2 탈퇴/복구(30일), `Student` 에 §4-3 `active_character_id`·`grade_confirmed_at`·삭제, `LearningSession` 에 §5-1 `session_type`, `Problem` 에 §6-1 `counts_toward_daily`·`coin_eligible` 을 더했다. **`StudentLoginIdentity` 는 만들지 않는다** — 아이 이메일은 부모가 직접 입력하는 `student.login_email` 그대로다(`FIGMA-MD-AUDIT` §0). `nickname` 컬럼은 남긴다. 마이그레이션은 화면을 만들 때 그 화면이 쓰는 것만 추가한다 | — |
| 1.8 | 2026-09-29 | §4 `login_id` **제거**, `login_email` **추가**(유일). 아이도 이메일로 로그인한다 — 로그인 화면이 부모·아이 공통이므로 한 칸에 이메일 하나만 받는다(정책 v0.1 §5·§7·§8). §4-1 재작성: 부모가 **아이가 이미 쓰는 이메일**을 입력하고, 확인 메일은 보내지 않으며, 아이는 스스로 재설정하지 못한다. 아이 판별을 가짜 이메일 도메인에서 **`app_metadata.role`** 로 옮겼다 — `service_role` 만 쓸 수 있어 누구나 실을 수 있던 `user_metadata.role` 보다 튼튼하다. 기존 아이 로그인 5개는 초기화했고 **학습기록은 남겼다**. COM-007 §2-2 와 함께 변경 | — |
| 1.7 | 2026-09-26 | §4 `student_status` 에 **`test`** 추가(enum 마이그레이션), §3 `account_status` 에 **`test`** 명시(TEXT 라 마이그레이션 없음). 프롬프트 랩이 만든 학생·계정을 진짜와 가른다 — 없으면 집계가 부풀려지고 주간 리포트 배치가 테스트 학생마다 AI 를 불러 **실제 비용이 나간다**. `.eq('student_status','active')` 를 쓰는 곳은 자동 제외되고, 상태를 안 보던 `admin-metrics.funnel()` 6개 집계는 명시적으로 걸렀다. 운영자 목록에는 그대로 보인다. 되돌리기는 랩 전용 Account 삭제(cascade) — 단 `Event` 는 `on delete set null` 이라 남는다. 필드·관계 변경 없음 | — |
| 1.6 | 2026-09-26 | §10 `current_level` 을 **누가 채우는지** 명시. 하루를 마칠 때 **서버가** 그날 `Problem.difficulty` 중앙값으로 정한다. 전에는 06 DAILY ANALYZER 의 `memory_update.current_level` 을 읽게 돼 있었으나 **06 의 출력 스펙에 그 필드가 없어** 아무도 채우지 않았다 — 운영 중 학생 5명 전원이 시작값 3 에 머물러 있었다. `Student.current_difficulty`(§4)와의 역할 구분도 함께 적었다. 필드·타입·관계 변경 없음. COM-001 §9 와 함께 변경 | — |
| 1.5 | 2026-09-17 | §14 이벤트명 3개 추가: `child_login_first`(계정 분리로 새로 생긴 이탈 지점) · `ai_call_failed` · `answer_verification_failed`(둘 다 어느 테이블에도 안 남는 AI 품질 신호). **`event_properties` 에 원문·이름을 넣지 않는다**는 규칙과, **다른 테이블에 있는 사실은 이벤트로 중복 저장하지 않는다**(§17)는 규칙을 §14 본문에 명시. 필드·타입·관계 변경 없음 | — |
| 1.4 | 2026-09-17 | §4-1 `login_id`·`auth_user_id` **선택 → 등록 시 필수**. 부모 계정이 학생 화면에 들어가지 않게 되어(COM-003 §4.2 함께 개정), 아이디가 없으면 그 아이가 학습을 시작할 길이 없다. **DB 는 nullable 그대로** — 이전에 아이디 없이 등록된 행이 있어 `NOT NULL` 로 조이지 않는다. 막는 자리는 등록 화면과 서버다. 필드·타입·관계 변경 없음 | — |
| — | 2026-09-10 | §20-B 추가: `AdminUser` · `AuditLog` · `ConsentLog` (COM-007 §13). ADM 영역의 선행 조건 | — |
| — | 2026-09-22 | §4 `birth_date` Required `YES` → **`NO`**. Figma `자녀 계정 생성` 이 이름·학년·아이디·비밀번호·비밀번호 확인만 받는다. 난이도는 `grade` 가 정하고 `birth_date` 로 하는 일이 없다 — 쓰지 않을 아동 정보는 받지 않는다(COM-007). 컬럼은 지우지 않았다 | — |
| — | 2026-09-22 | §3 `account_name` · `phone_number` · `birth_date` Required `YES` → **`NO`**. Figma 「메티_서비스」 `부모 / 회원가입` 이 이메일·비밀번호·동의 4종만 받는다. `handle_new_account` 가 셋을 요구해 가입을 롤백하던 것을 풀고, 동의 4종을 같은 트랜잭션에서 `ConsentLog` 에 남기도록 했다. 컬럼은 지우지 않았다 — `MY-002`·`ADM` 이 읽는다. **`AUTH-004` 휴대폰 인증과 COM-007 §2 보호자 식별은 미정** | — |
| — | 2026-09-10 | §20-A **변경 제안** 추가: MODE B 의 의도적 오답을 담을 칸 3개(`ai_wrong_answer` · `ai_wrong_reasoning` · `target_misconception`). 승인 전이므로 본문 §6 은 그대로 | — |
| 1.3 | 2026-09-09 | §17 `verified_answer` 노출 금지를 **"문제가 진행 중인 동안"** 으로 한정. 종료 시점에는 정답·해설로 보여준다(COM-001 §8 종료 안내). Answer Lock 데이터는 시점과 무관하게 계속 비노출 — 검증 상태는 내부 값이다. §8 Rules에도 같은 단서 추가 | — |
| 1.0 | 2026-08-28 | `docs/` 이관 및 문서 헤더 도입. **본문 변경 없음** | — |
| 1.2 | 2026-09-09 | §8 `initial_accuracy` Required {YES} → `NO`. 관찰하지 못한 최초 정답을 `false`가 아닌 NULL 로 둔다 — MODE B 는 학생이 AI 오류를 찾는 구조라 "최초 정답"이 성립하지 않는 경우가 정상적으로 생긴다. `support_level` 최종값은 턴별 값의 최대값이며 서버가 계산한다는 규칙 추가. LOGIC AUDITOR 프롬프트 v3.0 과 맞춤 (Issue #28) | — |
| 1.1 | 2026-09-01 | PM 전원 합의로 미정 값 5건 확정. §6에 `learning_mode`(`mode_a`/`mode_b`) · `answer_lock_status`(`locked`/`recheck`/`invalid_problem`) 값 목록과 `difficulty` 1\~5 추가. §8 점수 범위 0\~2 확정 및 예시값을 범위 안으로 수정(3·4 → 2·2·1·2), **`transfer_score`·`reflection_score`의 Required를 `YES` → `NO`** (Drill-down 조기 종료 시 `0`과 구분). §10 레벨 1\~5 명시, JSONB schema를 `prompts/logic-auditor.md` Prompt 05로 위임. §20에서 확정 3건 이관. **엔티티·필드·관계 변경 없음** | — |
