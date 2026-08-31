# COM-005 · 개발환경 정의서

> **Version:** 2.0 · **Updated:** 2026-08-28 · **Owner:** (미지정)\
> **Status:** 확정 — **§6 브랜치 구조는 팀 추인 대기**\
> **Changelog:** 문서 최하단 참조

> **문서 목적:** 5명의 PM이 동일한 기술 스택과 실행 환경에서 Claude
> Code로 하나의 서비스를 개발하기 위한 공통 기준\
> **대상:** 프로젝트 참여 PM 및 Claude Code\
> **선행 문서:** `COM-001-service-flow.md`, `COM-002-data-model.md`,
> `COM-003-screen-ui.md`, `COM-004-ai-coding-rules.md`

------------------------------------------------------------------------

## 1. 기본 원칙

-   하나의 GitHub Repository에서 개발한다.
-   모든 팀원이 동일한 핵심 기술 스택과 Package Manager를 사용한다.
-   Frontend와 기본 Server 기능은 MVP 단계에서 별도 프로젝트로 분리하지
    않는다.
-   실제 Secret/API Key는 소스코드와 GitHub에 저장하지 않는다.
-   개발 편의를 위해 기술 스택이나 데이터 저장 방식을 PM 개인이 임의
    변경하지 않는다.
-   공통 환경 변경이 필요하면 팀 합의 후 이 문서를 먼저 수정한다.

------------------------------------------------------------------------

## 2. 기술 스택 확정안

  영역              확정 기술              사용 목적
  ----------------- ---------------------- --------------------------------------
  OS                Windows / macOS        팀원 개발 PC
  Version Control   Git                    코드 버전 관리
  Repository        GitHub                 공동 코드 저장 및 협업
  Runtime           Node.js LTS            Next.js 실행 환경
  Package Manager   npm                    패키지 설치 및 실행
  Framework         Next.js + TypeScript   화면 및 Server 기능 개발
  UI                Tailwind CSS           공통 UI 및 Responsive 구현
  Database          Supabase PostgreSQL    회원·학생·미션·평가·구독 등 데이터
  Authentication    Supabase Auth          회원 인증
  File Storage      Supabase Storage       문제 사진 등 파일 저장
  AI                Google Gemini API      문제 분석·검증·대화·평가·이미지 인식
  Deploy            Vercel                 웹 서비스 배포
  AI Coding         Claude Code            바이브코딩 개발
  Design            Figma                  화면 및 UI 디자인 공유

------------------------------------------------------------------------

## 3. MVP 시스템 구조

``` text
사용자
  ↓
Next.js
  ├─ 학생/부모 화면
  ├─ Server/API 기능
  │
  ├─ Supabase
  │   ├─ Auth
  │   ├─ PostgreSQL
  │   └─ Storage
  │
  ├─ Gemini API
  │   ├─ 문제 분석
  │   ├─ 정답 검증
  │   ├─ AI Tutor / Drill-down
  │   ├─ 평가
  │   └─ 사진 문제 인식
  │
  └─ 결제 API
      └─ PG사는 추후 확정

GitHub
  ↓
Vercel
  ↓
배포 서비스
```

### 기본 방향

MVP에서는 별도 Python/FastAPI Backend를 만들지 않는다.

Next.js 안에서: - Frontend - Server 기능 - 외부 API 호출 - Supabase 연동

을 관리한다.

별도 Backend가 반드시 필요한 상황이 확인되면 팀에서 재검토한다.

------------------------------------------------------------------------

## 4. AI 및 사진 문제 처리

### AI

기본 AI Provider: - Google Gemini API

사용 영역: - 문제 분석 - 정답 검증 - Drill-down 대화 - 학생 답변 평가 -
Logic Gap 분석 - Student Memory 생성에 필요한 분석 - 문제 사진 인식

세부 Gemini 모델과 모델별 역할은 AI 코어 경험 PM의 Prompt/AI 설계에서
별도로 확정한다.

### 사진 문제

MVP에서는 별도 OCR 서비스를 우선 도입하지 않는다.

기본 흐름:

``` text
학생 사진 촬영
→ Gemini 기반 이미지/문제 인식
→ 인식된 문제 표시
→ "내가 읽은 문제가 이게 맞아?"
→ 학생 확인 또는 수정
→ 문제 검증
→ 미션 시작
```

인식 정확도가 서비스 요구 수준에 미달하면 별도 OCR 도입을 재검토한다.

------------------------------------------------------------------------

## 5. 팀원 개발환경 설치

각 팀원은 기본적으로 다음 환경을 준비한다.

1.  Git 설치
2.  Node.js LTS 설치
3.  Claude Code 설치
4.  GitHub 접근 권한 확인
5.  Repository Clone
6.  프로젝트 폴더 이동
7.  `npm install`
8.  `.env.local` 설정
9.  `npm run dev`
10. 브라우저에서 로컬 실행 확인

### Package Manager

팀 전체에서 `npm`만 사용한다.

프로젝트 내에서 임의로 다음을 혼용하지 않는다. - yarn - pnpm

------------------------------------------------------------------------

## 6. Git / Branch

Repository는 1개를 사용한다.

### 브랜치 구조

| Branch | 역할 | 수명 |
|---|---|---|
| `main` | 배포용. Vercel Production | 영구 |
| `develop` | 통합 지점. 모든 작업이 여기로 모임 | 영구 |
| 작업 브랜치 | 화면·기능 단위 작업 | **1~2일. merge 후 삭제** |

```text
main                    ← develop이 안정되면 merge
└─ develop              ← 모든 작업의 통합 지점
   ├─ mission-drilldown     ← 짧게 살고 사라짐
   ├─ billing-checkout
   └─ auth-signup
```

### 원칙

-   `main`에서 직접 바이브코딩하지 않는다.
-   PM별 고정 Branch를 두지 않는다. **담당은 Branch가 아니라
    담당 폴더(`DEV-001 §6` PM별 소유 경로)로 정한다.**
-   작업 브랜치는 오래 유지하지 않는다. 장수 Branch는 통합 비용을 키운다.
-   작업 브랜치는 `develop`에서 따고 `develop`으로 Merge한다.
-   `develop` → `main` Merge는 안정 시점에만 수행한다.
-   공통 코드(`package.json`, `src/types/database.ts`,
    `src/lib/constants/**`, `src/components/ui/**`,
    `supabase/migrations/**`)의 변경은 기능 작업에 섞지 않고
    **단독으로 먼저 Merge**한 뒤 전원이 Pull한다.
-   세부 협업 규칙은 `COM-004-ai-coding-rules.md` 및 팀 가이드를 따른다.

> **참고:** v1.0에서는 PM별 고정 Branch 5개(`pm-account`, `pm-ai`,
> `pm-billing`, `pm-admin`, `pm-growth`)를 사용했다. 장수 Branch의 통합
> 비용 문제로 v2.0에서 `main` + `develop` 구조로 변경했다.
> 담당 구분은 `DEV-001 §6`의 소유 경로가 대체한다.

------------------------------------------------------------------------

## 7. 프로젝트 기본 폴더 구조

초기 기본 구조는 다음을 사용한다.

``` text
/
├─ docs/
│  ├─ COM-001-service-flow.md
│  ├─ COM-002-data-model.md
│  ├─ COM-003-screen-ui.md
│  ├─ COM-004-ai-coding-rules.md
│  └─ COM-005-development-environment.md
│
├─ src/
│  ├─ app/
│  ├─ components/
│  ├─ lib/
│  └─ types/
│
├─ supabase/
│  └─ migrations/
│
├─ public/
├─ .env.example
├─ .gitignore
├─ package.json
└─ README.md
```

### 역할

#### `/docs`

서비스의 공통 개발 기준 문서.

Claude Code는 주요 작업 전 COM 문서를 확인한다.

#### `/src/app`

Next.js의 실제 페이지/Route 및 기능 영역.

#### `/src/components`

재사용 UI Component.

#### `/src/lib`

Supabase, Gemini, 외부 API 등 공통 연동 코드.

#### `/src/types`

공통 TypeScript Type.

#### `/supabase/migrations`

DB 구조 변경 이력.

DB를 임의로 직접 변경하고 기록을 남기지 않는 방식은 사용하지 않는다.

#### `/public`

서비스에서 사용하는 정적 이미지 등의 파일.

------------------------------------------------------------------------

## 8. 환경변수

실제 Secret 값은 `.env.local`에 저장한다.

예상 기본 환경변수:

``` text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

GEMINI_API_KEY=
```

향후 필요한 경우:

``` text
PAYMENT_...=
SMS_...=
KAKAO_...=
```

등이 추가될 수 있다.

### 규칙

-   `.env.local`은 GitHub에 Commit하지 않는다.
-   `.gitignore`에 포함한다.
-   실제 API Key를 MD 문서에 기록하지 않는다.
-   실제 API Key를 Claude 프롬프트에 불필요하게 입력하지 않는다.
-   팀에는 `.env.example`만 공유한다.
-   `.env.example`에는 변수 이름만 기록하고 실제 값은 넣지 않는다.
-   환경변수 이름을 PM별로 임의 생성하지 않는다.
-   새 환경변수가 필요하면 공통 이름을 합의한다.

------------------------------------------------------------------------

## 9. Supabase 사용 원칙

Supabase는 다음 세 영역을 담당한다.

### Auth

-   부모 Account 인증

### PostgreSQL

예: - Account - Student - Mission / Session - Problem - Message -
Evaluation - Logic Gap - Subscription - Payment - Report - Marketing
Consent

실제 Table/Field는 `COM-002-data-model.md`를 Source of Truth로 한다.

### Storage

예: - 학생이 촬영한 문제 사진 - 서비스 운영에 필요한 사용자 생성 파일

파일의 보관기간·삭제·아동 데이터 정책은 `COM-007`에서 확정한다.

------------------------------------------------------------------------

## 10. 데이터 구조 변경 규칙

Claude Code 또는 PM이 개발 중 필요한 Field가 없다고 판단해도 즉시 DB에
추가하지 않는다.

``` text
필요 데이터 발견
→ COM-002 확인
→ 기존 데이터로 해결 가능한지 확인
→ 불가능하면 팀에 변경 제안
→ 합의
→ COM-002 수정
→ Migration 작성
→ DB 반영
→ 코드 반영
```

원칙:

> **문서 → DB → 코드 순서**

------------------------------------------------------------------------

## 11. 개발 / 배포 환경

### Local

팀원 PC에서:

``` text
npm install
npm run dev
```

을 통해 실행한다.

### Production

기본 배포: - GitHub - Vercel

배포 환경의 Secret은 Vercel Environment Variables에서 관리한다.

Production Secret을 코드에 직접 입력하지 않는다.

### Preview

가능한 경우 Pull Request 단위의 Vercel Preview를 활용해 팀원이 기능을
확인할 수 있도록 한다.

------------------------------------------------------------------------

## 12. Responsive 기준

개발 기준은 Mobile First이다.

우선순위: 1. 모바일 2. 태블릿 3. PC

모바일을 우선하는 이유: - 학생 접근성 - 문제 사진 촬영 - 대화형 UI -
보호자 모바일 사용

기기별로 기능 자체가 달라지지 않도록 하고 동일한 정보구조를
Responsive하게 확장한다.

------------------------------------------------------------------------

## 13. 지금 확정하지 않는 기술

다음은 현재 COM-005에서 강제로 확정하지 않는다.

-   결제 PG사
-   Gemini 세부 모델별 Router
-   별도 OCR Provider
-   Analytics Provider
-   SMS/알림톡 발송 Provider
-   Production 모니터링 Provider

필요 시 담당 PM이 후보를 검토하고 팀에서 확정한다.

확정 후 공통 환경에 영향을 주면 COM-005를 업데이트한다.

------------------------------------------------------------------------

## 14. Claude Code 환경 규칙

Claude Code는 개발 시: 1. `/docs`의 COM 문서를 먼저 확인한다. 2. 현재
PM의 담당 범위를 확인한다. 3. 기존 기술 스택을 임의 변경하지 않는다. 4.
npm 이외의 Package Manager를 임의 도입하지 않는다. 5. 별도 Backend를
임의 생성하지 않는다. 6. DB Schema를 임의 변경하지 않는다. 7. Secret을
코드에 삽입하지 않는다. 8. 새로운 외부 서비스를 임의 도입하지 않는다. 9.
공통 환경 변경이 필요하면 먼저 이유와 영향범위를 보고한다.

세부 개발 제약은 `COM-004-ai-coding-rules.md`를 따른다.

------------------------------------------------------------------------

## 15. 신규 팀원 실행 확인 체크리스트

-   [ ] Git 설치
-   [ ] Node.js LTS 설치
-   [ ] Claude Code 설치
-   [ ] GitHub Repository 접근 가능
-   [ ] Repository Clone 완료
-   [ ] 자신의 PM Branch 확인
-   [ ] `npm install` 성공
-   [ ] `.env.local` 설정
-   [ ] `npm run dev` 성공
-   [ ] 브라우저에서 서비스 접속 확인
-   [ ] `/docs` COM 문서 확인
-   [ ] 실제 Secret이 Git에 포함되지 않았는지 확인

------------------------------------------------------------------------

## 16. COM-005 완료 기준

다음이 모두 확정되면 COM-005를 완료한 것으로 본다.

-   기술 스택 확정
-   Node.js + npm 기준 확정
-   GitHub / Branch 구조 연결
-   Next.js + TypeScript + Tailwind 기준 확정
-   Supabase Auth / PostgreSQL / Storage 기준 확정
-   Gemini API 기준 확정
-   Vercel 배포 기준 확정
-   프로젝트 기본 폴더 구조 확정
-   `.env.local` / `.env.example` 규칙 확정
-   DB Migration 원칙 확정
-   Mobile First 원칙 확정
-   팀원 Local 실행 절차 확정
-   Claude Code 환경 변경 제한 규칙 확정

------------------------------------------------------------------------

## 17. 다음 공통 작업

다음 단계:

**COM-007 · 개인정보 / 아동 데이터 정책**

주요 결정 예정 항목: - 부모/학생 개인정보 수집 범위 - 학생 생년월일 -
문제 사진 - AI 대화내용 - 학습기록 - 학생 프로필 삭제 - 회원탈퇴 -
데이터 보관기간 - 마케팅 수신동의 - 생일 프로모션 데이터 사용 - AI
Provider로 전달되는 데이터 범위

------------------------------------------------------------------------

## Changelog

| Version | Date | 변경 내용 | 작성 |
|---|---|---|---|
| 1.0 | 2026-08-28 | `docs/` 이관 및 문서 헤더 도입. **본문 변경 없음** | — |
| 2.0 | 2026-08-28 | **§6 브랜치 구조 변경.** PM별 고정 Branch 5개 → `main` + `develop` + 단기 작업 Branch. 담당 구분은 DEV-001 §6 소유 경로로 이관. 공통 코드 선행 Merge 원칙 추가 | — |
