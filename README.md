# AIPM

초등학교 4~6학년 대상 **수학 · 메타인지 사고과정 Drill-down 학습 서비스**.
PM 4명이 하나의 저장소에서 각자 담당 폴더를 맡아 개발한다.

**스택** · Next.js 16 · TypeScript · Tailwind v4 / Supabase (Auth · PostgreSQL · Storage) / Google Gemini / Vercel / npm

---

## 처음이라면

**1. 환경 세팅** — [`docs/DEV-004-onboarding.md`](docs/DEV-004-onboarding.md)

```bash
git clone https://github.com/team-aipm/AIPM.git
cd AIPM
npm install
npm run setup     # 환경 점검 · .env.local 생성 · 다음 할 일 안내
npm run dev
```

`npm run setup`이 Node 버전, 저장소 주소, 환경변수를 점검하고 빠진 것을
알려준다. 값은 운영 PM에게 개별로 받는다.

**2. 문서 읽기** — 순서대로 3개면 시작할 수 있다

| 순서 | 문서 | 왜 |
|---|---|---|
| 1 | [`CLAUDE.md`](CLAUDE.md) | 이 저장소의 규칙. **하지 말아야 할 것**이 여기 있다 |
| 2 | [`docs/README.md`](docs/README.md) | 문서 지도. 궁금한 게 어느 문서에 있는지 |
| 3 | [`docs/DEV-001-folder-structure.md`](docs/DEV-001-folder-structure.md) §6 | **내 담당 폴더**가 어디인지 |

**3. 담당 영역 문서** — 아래 표에서 자기 작업에 해당하는 것

---

## 문서

`COM`은 "무엇을 만들 것인가"(PM 전원 합의), `DEV`는 "어디에 어떻게 둘 것인가"(PR 리뷰).

| 문서 | 다루는 것 |
|---|---|
| [`COM-001`](docs/COM-001-service-flow.md) | 서비스 흐름, 상태 전이, 학습 규칙 |
| [`COM-002`](docs/COM-002-data-model.md) | 엔티티 · 필드 · 관계 · 명명 |
| [`COM-003`](docs/COM-003-screen-ui.md) | Screen ID · State · 공통 UI · 학생/부모 어휘 |
| [`COM-004`](docs/COM-004-ai-coding-rules.md) | 코딩 · 리뷰 · 테스트 기준 — **초안** |
| [`COM-005`](docs/COM-005-development-environment.md) | 스택 · 브랜치 · 환경변수 · 배포 |
| [`COM-007`](docs/COM-007-privacy-child-data.md) | 개인정보 · 아동 데이터 — **초안** |
| [`DEV-001`](docs/DEV-001-folder-structure.md) | 폴더 구조, **PM별 소유 경로**, 명명 규칙 |
| [`DEV-002`](docs/DEV-002-routes.md) | Screen ID ↔ Route 매핑 |
| [`DEV-003`](docs/DEV-003-infra-setup.md) | Vercel · Supabase 설정과 연동 |
| [`DEV-004`](docs/DEV-004-onboarding.md) | 팀원 세팅, 도구별 준비, 첫 PR |

> **문서가 Source of Truth다.** 코드와 문서가 다르면 문서가 맞다.
> 문서가 틀렸다고 판단되면 코드를 고치지 말고 **먼저 팀에 보고**한다.

`COM-004` · `COM-007`은 초안이다. 해당 영역(코딩 규칙 · 학생 삭제 · 회원탈퇴 ·
사진 보관 · 운영자 데이터 열람)에 닿으면 **구현하지 말고 보고**한다.

---

## 폴더 구조

```text
AIPM/
├─ CLAUDE.md              Claude Code용 규칙 (원본)
├─ AGENTS.md              Codex 등 타 도구용 요약본
├─ docs/                  COM · DEV 문서. Source of Truth
├─ supabase/
│  └─ migrations/         스키마. timestamp 접두어, 추가만
└─ src/
   ├─ app/
   │  ├─ (auth)/          AUTH
   │  ├─ (student)/       STU · MIS   학생 어휘, 하단 Nav 없음
   │  ├─ (parent)/        PAR · RPT · BIL · MY   하단 Nav 4탭, PIN 게이트
   │  └─ api/             스트리밍 · 외부 콜백 · 배치만
   ├─ components/
   │  ├─ ui/              공통 UI
   │  └─ system/          Loading · 오류 · 재시도
   ├─ lib/
   │  ├─ supabase/        client(브라우저) · server(RSC) · admin(service_role)
   │  ├─ services/        COM-002 엔티티와 1:1
   │  ├─ ai/              프롬프트 · 검증 · Drill-down · 평가
   │  └─ constants/copy   학생 어휘 ↔ 부모 어휘 매핑
   ├─ types/
   └─ middleware.ts       Supabase 세션 갱신
```

**규칙 4가지**

- 한 화면에서만 쓰는 컴포넌트는 `src/components/`가 아니라 그 route의 `_components/`에
- `_actions.ts`는 `lib/services`를 호출하는 얇은 래퍼. **DB 쿼리를 직접 쓰지 않는다**
- `lib/supabase/admin.ts`(service_role)는 **서버 전용.** 클라이언트에서 import 금지
- 빈 폴더를 미리 만들지 않는다

상세는 [`DEV-001`](docs/DEV-001-folder-structure.md).

---

## 브랜치

```text
main        배포용 (Vercel Production)
└─ develop  통합 지점. 기본 브랜치
   └─ 작업 브랜치   1~2일 살고 merge 후 삭제
```

```bash
git switch develop && git pull
git switch -c mission-drilldown      # 화면·기능 단위 이름. PM 이름 금지

npm run lint && npm run build        # 둘 다 통과해야 한다

git push -u origin mission-drilldown
gh pr create --base develop          # PR 대상은 develop
```

**공통 코드는 기능 작업에 섞지 않고 단독 PR로 먼저 올린다.**

```text
package.json   src/types/database.ts   src/lib/constants/**
src/components/ui/**   supabase/migrations/**
```

merge되면 전원 `git pull`, `package.json`이 바뀌었으면 `npm install`도 다시 한다.

---

## 명령어

```bash
npm run setup      # 세팅 점검. 언제든 다시 실행할 수 있다
npm run dev        # 개발 서버
npm run build      # 프로덕션 빌드 — PR 전 필수
npm run lint       # ESLint — PR 전 필수
```

---

## 막혔을 때

| 증상 | 원인 |
|---|---|
| 저장소가 안 보인다 | 조직 초대는 수락했으나 `pm` 팀 미배정 → 운영 PM에게 요청 |
| `supabaseUrl is required` | `.env.local` 없음 또는 값 비어 있음 |
| `git push` 실패 | 구 저장소 주소 → `git remote set-url origin https://github.com/team-aipm/AIPM.git` |
| PowerShell에서 `npx` 차단 | `npx` 대신 `npx.cmd` |

더 많은 항목은 [`DEV-004 §5`](docs/DEV-004-onboarding.md).
