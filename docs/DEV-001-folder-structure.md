# DEV-001 · 폴더 구조 및 PM 소유 경로

> **Version:** 1.5 · **Updated:** 2026-09-02 · **Owner:** 세팅 담당\
> **Status:** 확정\
> **Changelog:** 문서 최하단 참조

> **문서 역할:** `COM-005 §7 프로젝트 기본 폴더 구조`의 **상세화 문서**\
> **우선순위:** 본 문서와 COM-005가 충돌하면 **COM-005가 우선**한다.
> 본 문서는 COM-005 §7이 정한 상위 폴더(`docs` / `src` / `supabase` / `public`)를
> 변경하지 않으며, 그 하위 구조만 정의한다.\
> **선행 문서:** `COM-002-data-model.md`, `COM-003-screen-ui.md`, `COM-005-development-environment.md`\
> **범위 밖:** ADM(운영/백오피스) 영역은 본 문서에서 다루지 않는다.
> (사유: COM-007 미작성 / 오너: 운영 및 백오피스 PM)

---

## 1. 전체 구조

```text
/
├─ CLAUDE.md                      # Claude Code 진입점
├─ README.md
├─ .env.example                   # 변수명만. 실제 값 금지 (COM-005 §8)
├─ .gitignore                     # .env.local 반드시 포함
├─ next.config.ts
├─ tailwind.config.ts
├─ tsconfig.json                  # paths: "@/*" → "src/*"
├─ package.json                   # npm 전용. yarn/pnpm lock 금지
│
├─ docs/                          # Source of Truth. docs/README.md 참조
│  └─ prompts/                    # AI Prompt 원문 (AI 코어 PM)
│
├─ public/
│  └─ personas/                   # friend / villain 캐릭터 에셋
│
├─ scripts/
│  └─ ops/                        # 운영 스크립트 (운영 PM)
│
├─ supabase/
│  ├─ migrations/                 # DB 변경 이력. 추가만, 기존 파일 수정 금지
│  ├─ policies/                   # RLS 정책
│  └─ seed.sql
│
└─ src/
   ├─ middleware.ts               # 세션 검증 + 부모 영역 PIN 게이트
   ├─ app/                        # §2
   ├─ components/                 # §3
   ├─ lib/                        # §4
   ├─ types/                      # §5
   └─ styles/
```

### 폴더는 필요할 때 만든다

빈 폴더를 미리 만들지 않는다. git은 빈 디렉터리를 추적하지 못하므로 `.gitkeep`
남발로 이어진다. **본 문서가 규약이고, 실제 폴더는 코드를 넣을 때 생성한다.**

---

## 2. `src/app` — Route Group을 사용자 축으로 자름

학생 영역과 부모 영역은 용어 정책(COM-003 §7), Navigation(§11), 접근 통제가
모두 다르다. 그래서 Area별이 아니라 **사용자별 3개 Route Group**으로 나누고
Area는 그 안의 폴더로 둔다.

```text
src/app/
├─ layout.tsx
├─ globals.css
│
├─ (auth)/                        # AUTH · 부모 · 미인증
│  ├─ login/
│  ├─ signup/
│  │  ├─ terms/
│  │  └─ verify/
│  └─ password/
│
├─ (student)/                     # STU + MIS · 하단 Nav 없음 · 학생 어휘
│  ├─ layout.tsx
│  ├─ onboarding/
│  │  ├─ student/
│  │  └─ persona/
│  ├─ students/
│  ├─ home/
│  │  └─ today/
│  └─ mission/
│     ├─ _components/
│     ├─ _actions.ts
│     └─ create/
│        └─ photo/
│
├─ (parent)/                      # PAR + RPT + BIL + MY · 하단 Nav 4탭
│  ├─ layout.tsx
│  ├─ pin/
│  │  └─ settings/
│  ├─ reports/
│  │  ├─ [reportId]/
│  │  └─ history/
│  ├─ billing/
│  │  ├─ subscribe/  checkout/  manage/  methods/  history/
│  └─ my/
│     ├─ students/
│     │  ├─ new/
│     │  └─ [studentId]/
│     ├─ profile/  marketing/  notifications/
│     └─ account/
│        └─ withdraw/
│           └─ confirm/
│
├─ (dev)/                         # 개발 도구 · 제품 화면 아님 · 아래 규칙 6
│  └─ prompt-lab/                 # 프롬프트 단계별 실행·검증
│     ├─ _components/
│     ├─ _access.ts               # 통과 암호 잠금
│     ├─ _actions.ts
│     ├─ _bridge.ts               # AIPM 전용 단계 연결
│     ├─ _chat.ts
│     ├─ _field-rules.ts          # 화면에서 만드는 검증 규칙 (범용)
│     ├─ _mapping.ts              # 화면에서 만드는 단계 연결 (범용)
│     └─ _paths.ts                # 점 표기 경로 읽기·쓰기
│
└─ api/                           # Server Action으로 안 되는 것만
   ├─ ai/chat/                    # 스트리밍 필요
   ├─ ai/verify/                  # Answer Verification
   ├─ ai/ocr/                     # 사진 문제 인식
   ├─ webhooks/payment/           # PG 콜백 (외부 진입)
   └─ cron/weekly-report/         # 주간 리포트 배치
```

각 폴더에 대응하는 Screen ID는 `DEV-002-routes.md`를 따른다.
`(dev)/`는 예외다. Screen ID가 없고 DEV-002에도 넣지 않는다.

### 규칙

1. **제품 Route 수는 35개.** COM-003 §12의 Screen Inventory와 1:1로 맞춘다.
   `(dev)/`는 이 수에 포함하지 않는다.
2. **State / Modal은 절대 Route로 만들지 않는다.** (COM-003 §13-3)
   예: `MIS-001`의 `AI 생각 중`, `힌트`, `중간 종료 확인`은 전부
   `mission/page.tsx` 내부 상태다.
3. **화면 전용 코드는 그 화면 옆에 둔다.** `_components/`, `_actions.ts` 등
   언더스코어 폴더는 Route로 잡히지 않는다. 이 규칙이 PM 간 merge conflict를
   가장 크게 줄인다.
4. **`_actions.ts`에 비즈니스 로직을 쓰지 않는다.** `lib/services`를 호출만
   하는 얇은 래퍼로 유지한다.
5. **`api/`는 최소로 둔다.** 스트리밍, 외부 콜백, 배치처럼 Server Action으로
   불가능한 경우만 Route Handler를 만든다.
6. **`(dev)/`는 개발 도구 전용이다.** 만드는 프로그램이 아니라 만들기 위해
   쓰는 프로그램을 둔다. Screen ID·COM-003 용어 정책·Navigation이 적용되지
   않는다. 대신 다음을 지킨다.
   - **잠그고 연다.** 개발 서버에서는 그냥 열리고, 배포본에서는 전용
     환경변수(예: `PROMPT_LAB_PASSCODE`)가 있어야 열린다. 변수가 없으면
     `notFound()`. 열어두는 쪽이 아니라 닫는 쪽으로 실패한다
   - page와 Server Action **양쪽 모두**에서 확인한다. Server Action은
     별도 엔드포인트로 노출되므로 page만 막으면 뚫린다
   - `export const dynamic = 'force-dynamic'`. 없으면 빌드 시점 결과가
     구워져서 나중에 환경변수를 넣어도 반영되지 않는다
   - **배포본에서 서버의 모델 API 키를 대신 써 주지 않는다.** 각자 자기
     키를 화면에 넣는다. 개인 키로 무제한 호출되는 것을 막는다
   - 학생·부모 데이터를 읽거나 쓰지 않는다
   - 여기 코드가 `(student)` · `(parent)`에서 import되지 않는다
   - **이 프로젝트 전용 규격을 도구의 기본 동작으로 만들지 않는다.**
     prompt-lab 은 다른 AI 서비스를 만들 때도 쓰는 범용 도구다. AIPM
     규격(`_bridge.ts`, `lib/ai/schema-check.ts`)은 골라 쓰는 프리셋으로
     두고, 같은 일을 화면에서 직접 정의하는 길을 함께 둔다
     (`_field-rules.ts` · `_mapping.ts`). 프리셋이 없어도 도구가
     제 기능을 해야 한다

---

## 3. `src/components` — 공유되는 것만

```text
src/components/
├─ ui/          # COM-003 §6 · PrimaryButton, SecondaryButton, ConfirmModal,
│               #   Toast, Loading, EmptyState
├─ system/      # COM-003 §6 · AILoading, NetworkError, APIError,
│               #   RetryAction, OfflineState
├─ student/     # 2개 이상의 학생 화면이 쓰는 것만
└─ parent/      # ParentBottomNav, StudentCard, SubscriptionBadge, ReportSection
```

**한 화면에서만 쓰는 컴포넌트는 `components/`가 아니라 그 route의
`_components/`에 둔다.** 이 규칙이 없으면 `components/`가 전원의 공용 충돌
지점이 된다.

`ui/`와 `system/`을 합치면 COM-003 §6의 공통 Component 11개가 된다.

---

## 4. `src/lib` — COM-002 엔티티와 서비스 파일을 1:1로

```text
src/lib/
├─ supabase/
│  ├─ client.ts          # 브라우저. anon key
│  ├─ server.ts          # RSC / Server Action
│  └─ admin.ts           # service_role. 서버 전용
│
├─ gemini/
│  ├─ client.ts
│  └─ models.ts          # 모델 라우팅 (COM-005 §13 · 미확정)
│
├─ ai/
│  ├─ prompts/           # docs/prompts와 1:1. 실행 템플릿
│  ├─ answer-verification.ts   # Answer Lock 생성 / 검증 실패 처리
│  ├─ drilldown.ts             # 판단·근거·규칙·전이·성찰, 최대 5회
│  ├─ evaluation.ts
│  ├─ persona.ts               # 말투만. 정답/평가/난이도 미개입
│  ├─ problem-select.ts        # 취약 4 : 현재 4 : 복습 2
│  ├─ schema-check.ts          # AI 출력 ↔ COM-002 스키마 검증
│  └─ student-memory.ts
│
├─ services/             # 파일명 = COM-002 엔티티명
│  ├─ account.ts              ├─ student.ts
│  ├─ learning-session.ts     ├─ problem.ts
│  ├─ message.ts              ├─ evaluation.ts
│  ├─ logic-gap.ts            ├─ student-memory.ts
│  ├─ subscription.ts         ├─ payment.ts
│  ├─ learning-report.ts      └─ event.ts
│
├─ auth/
│  ├─ session.ts
│  └─ parent-pin.ts      # PAR-001 게이트
│
├─ analytics/
│  └─ events.ts          # COM-002 §14의 이벤트명 16개 상수화
│
├─ errors/
│  ├─ codes.ts
│  ├─ retry.ts           # AI/API 자동 재시도 (COM-001 §17)
│  └─ recovery.ts        # 턴 단위 자동저장 복구 (COM-001 §12)
│
├─ constants/
│  ├─ screens.ts         # Screen ID 상수
│  ├─ enums.ts           # problem_status, subscription_status 등
│  └─ copy.ts            # 학생 어휘 / 부모 어휘 매핑
│
└─ utils/                # date, format, cn
```

### `lib/constants/copy.ts`를 따로 두는 이유

COM-003 §7의 어휘 변환(`학습 → 미션`, `needs_review → 한 번 더 도전`)이 화면마다
하드코딩되면 반드시 어긋난다. **DB 상태값 → 학생 문구 / 부모 문구** 매핑을 한
곳에 고정한다.

### `lib/services`의 책임

- DB 접근과 도메인 규칙은 여기서만 한다.
- 다른 PM의 데이터를 바꿔야 하면 그 PM의 서비스 파일을 **호출**한다.
  직접 테이블을 UPDATE하지 않는다. (COM-002 §17)

---

## 5. `src/types`

```text
src/types/
├─ database.ts    # Supabase 자동 생성. 손으로 수정 금지
├─ domain/        # account.ts, student.ts, problem.ts … (엔티티별)
├─ ai.ts          # AI 출력 JSON 스키마. 키는 COM-002 필드명과 일치 (§17)
└─ ui.ts          # ScreenId, AreaId, State 타입
```

---

## 6. 담당과 소유 경로

**담당은 Branch가 아니라 이 표가 정한다.** (COM-005 §6 v2.0)
브랜치는 `main` + `develop` + 단기 작업 브랜치만 두므로, "누가 무엇을 쓰는가"는
전적으로 폴더 소유로 결정된다.

### 두 트랙

PM 4명이 두 트랙으로 나뉜다. 각 트랙 안에서는 **공동 소유**다.

| 트랙 | 인원 | 맡는 역할 |
|---|---|---|
| **AI 코어** | 2명 | 학습 경험 · Drill-down · 평가 |
| **서비스** | 2명 | 회원·유입 · 과금 · 운영/백오피스 · 그로스 |

**트랙 밖을 수정하는 PR은 해당 트랙의 리뷰를 받는다.**
같은 트랙 안에서는 서로 자유롭게 수정하되, 작업 전에 무엇을 건드리는지
공유한다. 공동 소유는 "아무나 고쳐도 된다"가 아니라 "둘 다 책임진다"는 뜻이다.

### AI 코어 트랙

```text
app/(student)/home/**
app/(student)/mission/**
app/(dev)/**                 개발 도구. §2 규칙 6
app/api/ai/**
lib/ai/**  ·  lib/gemini/**
lib/services/{learning-session,problem,message,evaluation,logic-gap,student-memory}.ts
components/student/**
docs/prompts/**
```

### 서비스 트랙

네 역할을 2명이 함께 맡는다. 역할별로 경로를 구분해 두는 이유는
소유자를 나누기 위해서가 아니라, **어느 COM 문서를 봐야 하는지**를
알려주기 위해서다.

| 역할 | 경로 | 참조 문서 |
|---|---|---|
| 회원 · 유입 | `app/(auth)/**`<br>`app/(student)/onboarding/**`, `app/(student)/students/**`<br>`app/(parent)/my/**` (marketing 제외)<br>`lib/services/{account,student}.ts`<br>`lib/auth/**` | COM-001 · COM-003 |
| 과금 | `app/(parent)/billing/**`<br>`app/api/webhooks/payment/**`<br>`lib/services/{subscription,payment}.ts` | COM-002 §11~12 |
| 운영 · 백오피스 | `components/system/**`<br>`lib/errors/**`<br>`scripts/ops/**` | COM-007 확정 후 |
| 그로스 | `app/(parent)/reports/**`, `app/(parent)/my/marketing/**`<br>`app/api/cron/**`<br>`lib/analytics/**`<br>`lib/services/{learning-report,event}.ts` | COM-002 §13~14 |

> `src/app/(admin)/`은 COM-007이 확정되기 전까지 만들지 않는다.

### 세팅 담당 — 한시적

프로젝트 초기 환경 구축(저장소 · Vercel · Supabase · 문서 체계 · 스키마)은
**한시적 역할**이며 위 두 트랙에 속하지 않는다. 세팅이 끝나면 아래 경로와
책임을 두 트랙에 인계한다.

```text
src/middleware.ts        docs/DEV-*.md        supabase/migrations/**
```

인계 항목과 절차는 `DEV-003 §12`를 따른다. **인계가 끝나기 전까지 이
경로들은 세팅 담당이 유지한다.**

### 공통 영역 — 변경 시 합의 필요

```text
docs/COM-*.md
src/types/database.ts
src/lib/constants/**
src/components/ui/**
supabase/migrations/**
.env.example  ·  package.json  ·  tsconfig.json  ·  next.config.ts
```

이 목록이 COM-002 §17("다른 PM의 테이블/필드명 임의 변경 금지")과 COM-005
§10("문서 → DB → 코드")을 폴더 차원에서 강제하는 장치다.

### 공통 코드 변경 절차

브랜치를 어떻게 나누든 공통 코드는 같은 규칙을 따른다.

```text
❌  기능 작업에 공통 파일 변경을 끼워 넣는다
    "결제 화면 구현" PR 안에 types/database.ts 수정이 섞여 있음
    → 다른 PM들이 모르는 사이에 공통 타입이 바뀐다

✅  공통 변경을 단독으로 먼저 Merge → 전원 Pull → 그 다음 기능 작업
```

| 파일 | 문제 | 운영 방법 |
|---|---|---|
| `supabase/migrations/**` | 동시 작업 시 번호 충돌 | timestamp 접두어 사용 (§7) |
| `src/types/database.ts` | 각자 생성하면 매번 diff 발생 | migration Merge 후 **운영 PM 1명이 생성해 커밋**. 나머지는 Pull만 |
| `package.json` | 의존성 추가가 겹침 | 추가 전 팀 공지 → 단독 PR → 전원 `npm install` |
| `src/lib/constants/**` | 여러 명이 동시에 상수 추가 | 파일을 잘게 유지 (`enums` / `copy` / `screens` 분리) |
| `src/components/ui/**` | 같은 컴포넌트를 각자 만듦 | 새 공통 컴포넌트는 만들기 전에 공지 |

### 미배정

- `app/(parent)/pin/**` (PAR-001, PAR-003) — 회원·유입 PM과 운영 PM 중
  결정 필요
- ADM 영역 — COM-007 확정 후 결정 (오너는 운영 및 백오피스 PM)

---

## 7. 명명 규칙

| 대상 | 규칙 | 예 |
|---|---|---|
| 폴더 · route | kebab-case | `mission/create/photo` |
| Component 파일 | PascalCase | `PersonaAvatar.tsx` |
| lib · util 파일 | kebab-case | `student-memory.ts` |
| Server Action 파일 | `_actions.ts` | `mission/_actions.ts` |
| DB 컬럼 · 변수 | snake_case (COM-002 §2) | `student_id`, `trial_ends_at` |
| TypeScript 타입 | PascalCase | `StudentMemory` |
| 상수 | UPPER_SNAKE (값은 소문자) | `PROBLEM_COMPLETED = 'problem_completed'` |
| Migration | `YYYYMMDDHHMMSS_동사_대상.sql` | `20260828143000_create_learning_session.sql` |

### Migration 규칙

- **연번(`0001`, `0002` …)을 쓰지 않는다.** 여러 명이 병렬로 작업하면 반드시
  번호가 겹친다. Supabase 표준인 **timestamp 접두어**를 쓴다.
  ```bash
  supabase migration new create_learning_session
  # → supabase/migrations/20260828143000_create_learning_session.sql
  ```
- 한번 Merge된 파일은 **수정하지 않고 새 파일을 추가**한다.
- 스키마 변경 전 COM-002를 먼저 고친다. (COM-005 §10)
- Migration이 Merge된 뒤 `src/types/database.ts`는 운영 PM 1명이 재생성해
  커밋한다. 각자 생성하지 않는다. (§6 공통 코드 변경 절차)

---

## 8. Import 규칙

```text
app/       →  components, lib, types   (가능)
components →  lib, types               (가능)
lib/services → lib/supabase, lib/gemini, types  (가능)
lib        →  components               (금지)
lib        →  app                      (금지)
```

- `lib/supabase/admin.ts`(service_role)는 **서버 전용**이다. `'use client'`
  파일에서 import 금지.
- 절대경로 `@/`를 사용한다. 상대경로 `../../`는 같은 폴더 밖으로 나가지 않는다.

---

## 9. 금지사항

- COM-005 §7의 상위 폴더 4개를 임의 변경하지 않는다.
- 빈 폴더를 미리 만들지 않는다.
- 다른 PM의 소유 경로를 리뷰 없이 수정하지 않는다.
- `_actions.ts`에 DB 쿼리를 직접 쓰지 않는다.
- 화면 하나에서만 쓰는 컴포넌트를 `src/components/`에 올리지 않는다.
- State/Modal을 별도 Route로 만들지 않는다.
- `src/app/(admin)/`을 COM-007 확정 전에 생성하지 않는다.

---

## Changelog

| Version | Date | 변경 내용 | 작성 |
|---|---|---|---|
| 1.0 | 2026-08-28 | 최초 작성. COM-005 §7 하위 구조 상세화 | — |
| 1.1 | 2026-08-28 | §6 PM별 Branch 표기 제거(담당은 소유 경로가 결정) + 공통 코드 변경 절차 추가. §7 Migration 명명을 연번 → timestamp 접두어로 변경 | — |
| 1.2 | 2026-08-31 | §6을 5역할 개인 소유 → **2트랙 공동 소유**로 개편(AI 코어 2인 · 서비스 2인). 세팅 담당을 한시적 역할로 명시하고 인계 대상을 DEV-003 §12로 연결 | — |
| 1.5 | 2026-09-02 | §2 규칙 6에 **범용성 제약** 추가. AIPM 규격을 도구의 기본 동작으로 만들지 않고 프리셋으로 둔다. 화면에서 직접 정의하는 `_field-rules.ts` · `_mapping.ts` · `_paths.ts` 를 폴더 트리에 추가 | — |
| 1.4 | 2026-09-01 | §2 규칙 6을 "배포본에서 404"에서 **환경변수 기반 잠금**으로 변경. prompt-lab 을 팀이 웹에서 쓰기로 함. `force-dynamic` 필요성과 배포본에서 서버 API 키를 쓰지 않는다는 규칙 추가 | — |
| 1.3 | 2026-09-01 | §2에 `(dev)/` Route Group 추가. §6 AI 코어 트랙 소유 경로에 `app/(dev)/**` 추가. 개발 도구 전용이며 Screen ID가 없고 제품 Route 35개에 포함하지 않는다. 지켜야 할 제약 3가지를 규칙 6으로 명시. §4에 `lib/ai/schema-check.ts` 추가 | — |
