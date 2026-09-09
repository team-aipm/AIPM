# AGENTS.md

이 파일은 저장소 루트의 규칙을 읽는 AI 코딩 도구(Codex 등)를 위한 것이다.

> **원본은 `CLAUDE.md`와 `docs/`다.** 이 파일과 내용이 다르면
> `CLAUDE.md` · `docs/`가 우선한다. 이 파일은 요약이다.

---

## 작업 전 반드시 읽을 것

| 순서 | 파일 | 이유 |
|---|---|---|
| 1 | `CLAUDE.md` | 전체 규칙 원본 |
| 2 | `docs/README.md` | 문서 지도 |
| 3 | 작업 영역의 COM / DEV 문서 | 아래 표 참조 |

| 작업 | 읽을 문서 |
|---|---|
| 화면 구현 | `docs/COM-003` → `docs/DEV-002` |
| DB · 필드 | `docs/COM-002` |
| 학습 로직 · 상태 전이 | `docs/COM-001` |
| 파일을 어디에 둘지 | `docs/DEV-001` |
| 스택 · 환경변수 · 브랜치 | `docs/COM-005` |
| Vercel · Supabase 설정 | `docs/DEV-003` |

**문서를 읽지 않고 코드를 쓰지 않는다.** 이 저장소는 PM 4명이 하나의
문서 체계를 공유한다. 문서와 다르게 구현하면 다른 PM의 작업이 깨진다.

---

## 절대 하지 않을 것

문서가 틀렸다고 판단되면 **코드를 고치지 말고 변경 필요사항을 보고한다.**

### 문서 · 스키마
- COM 문서와 다르게 구현하지 않는다
- DB 스키마를 임의로 변경하지 않는다. 필드가 없으면 `COM-002` 변경을 먼저 제안
- 다른 PM의 테이블명 · 필드명을 바꾸지 않는다
- Screen ID와 화면명을 바꾸지 않는다

### 환경
- 기술 스택을 바꾸거나 새 외부 서비스를 도입하지 않는다
- `npm` 외의 Package Manager를 쓰지 않는다. `yarn.lock` · `pnpm-lock.yaml` 금지
- 별도 Backend(Python/FastAPI 등)를 만들지 않는다
- Secret을 코드나 문서에 넣지 않는다. `.env.local`은 커밋하지 않는다

### 학습 로직 (`docs/COM-001` §19)
- AI가 정답을 확신하지 못하는데 임의로 정답을 만들어 진행하지 않는다
- 학생의 시스템 오류를 오답으로 평가하지 않는다
- Persona(`friend`/`villain`)가 정답 · 평가 · 난이도 로직을 바꾸지 않는다.
  말투와 연출만 담당한다
- Student Memory를 세션 종료 시 초기화하지 않는다
- 새 학습 시작 시 과거 학습기록을 삭제하지 않는다

### UI (`docs/COM-003`)
- State/Modal을 별도 Route로 만들지 않는다
- 학생 화면에 상세 평가점수 · Logic Gap · Answer Lock 데이터를 노출하지 않는다
- `verified_answer`는 문제 진행 중에만 감춘다. 종료할 때는 정답과 해설을
  보여준다 (COM-001 §8 · COM-002 §17)
- 학생 화면에서 `needs_review`를 "실패"로, 힌트 사용을 감점으로 표현하지 않는다
- 오류를 학생의 잘못처럼 표현하지 않는다

### 미작성 문서 — 닿으면 구현하지 말고 보고
- `docs/COM-004` (초안) — 코딩 규칙 · 리뷰 기준 · 테스트 기준
- `docs/COM-007` (초안) — 학생 삭제, 회원탈퇴, 사진 보관, 운영자 데이터 열람
- `src/app/(admin)/`은 COM-007 확정 전까지 만들지 않는다

---

## 코드 배치 (`docs/DEV-001`)

```text
src/app/(auth)          AUTH
src/app/(student)       STU + MIS   ← 학생 어휘, 하단 Nav 없음
src/app/(parent)        PAR + RPT + BIL + MY   ← 부모 어휘, 하단 Nav 4탭
src/app/api             스트리밍 · 외부 콜백 · 배치만
src/components/ui       공통 UI
src/components/system   Loading · 오류 · 재시도
src/lib/services        COM-002 엔티티와 1:1
src/lib/supabase        client(브라우저) / server(RSC) / admin(service_role)
src/lib/ai              프롬프트 · 검증 · Drill-down · 평가
src/lib/constants/copy  학생 어휘 ↔ 부모 어휘 매핑
```

- 한 화면에서만 쓰는 컴포넌트는 그 route의 `_components/`에 둔다
- `_actions.ts`는 `lib/services`를 호출하는 얇은 래퍼. DB 쿼리 직접 작성 금지
- `src/lib/supabase/admin.ts`(service_role)는 **서버 전용.** 클라이언트에서 import 금지
- 빈 폴더를 미리 만들지 않는다

## 명명

- 폴더 · route: kebab-case · Component 파일: PascalCase · lib 파일: kebab-case
- DB 컬럼 · 변수: snake_case
- Migration: `YYYYMMDDHHMMSS_동사_대상.sql` (timestamp 접두어). 연번 금지

---

## 브랜치와 PR

```text
main        배포용 (Vercel Production)
└─ develop  통합 지점. 여기서 브랜치를 따고 여기로 merge   ← 기본 브랜치
```

- **PR 대상은 `develop`이다.** `main`으로 직접 PR을 열지 않는다
- 작업 브랜치는 짧게 유지하고 merge 후 삭제한다
- 공통 코드는 기능 작업에 섞지 않고 **단독 PR로 먼저** 올린다
  ```text
  package.json  src/types/database.ts  src/lib/constants/**
  src/components/ui/**  supabase/migrations/**
  ```

## 검증

PR 전에 아래가 통과해야 한다.

```bash
npm run lint
npm run build
```

## 환경변수

`.env.local`은 저장소에 없다. 실제 키가 필요한 작업은 로컬에서 사람이 확인한다.
변수 이름은 `.env.example`이 기준이며 **임의로 새 이름을 만들지 않는다.**

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
