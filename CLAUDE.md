# CLAUDE.md

> **Version:** 1.1 · **Updated:** 2026-08-31 · **Owner:** 운영 및 백오피스 PM

Claude Code가 이 프로젝트에서 작업할 때 따르는 규칙이다.
상세 기준은 `docs/`의 COM / DEV 문서에 있으며, **이 파일과 문서가 충돌하면
문서가 우선**한다.

> 저장소 루트의 `AGENTS.md`는 Codex 등 다른 AI 도구를 위한 **요약본**이다.
> 이 파일이 원본이므로, 규칙을 고칠 때는 `AGENTS.md`도 함께 갱신한다.

---

## 프로젝트

초등학교 4~6학년 수학 · 메타인지 사고과정 Drill-down 학습 서비스.
PM 4명이 하나의 GitHub Repository에서 개발한다. 담당은 브랜치가 아니라
`DEV-001 §6`의 소유 경로가 정한다.

**스택:** Next.js + TypeScript + Tailwind / Supabase (Auth · PostgreSQL ·
Storage) / Google Gemini API / Vercel / npm

---

## 작업 전 반드시 확인

| 작업 | 확인할 문서 |
|---|---|
| 무엇이든 | `docs/README.md` (문서 지도) |
| 화면 구현 | `COM-003` → `DEV-002` (Screen ID와 Route) |
| DB / 필드 | `COM-002` |
| 학습 로직 · 상태 전이 | `COM-001` |
| 파일을 어디에 둘지 | `DEV-001` |
| 스택 · 환경변수 | `COM-005` |

---

## 절대 하지 않을 것

### 문서 · 스키마
- COM 문서와 다르게 구현하지 않는다. 문서가 틀렸다고 판단되면 **코드를 고치지
  말고 변경 필요사항을 먼저 보고**한다. (COM-005 §10, §14-9)
- DB 스키마를 임의로 변경하지 않는다. 필드가 없으면 COM-002 변경을 먼저
  제안한다. (COM-002 §19-8)
- 다른 PM의 테이블명·필드명을 바꾸지 않는다. (COM-002 §17)
- Screen ID와 화면명을 바꾸지 않는다. (COM-003 §13-1)

### 환경
- 기술 스택을 임의로 바꾸거나 새 외부 서비스를 도입하지 않는다. (COM-005 §14)
- `npm` 외의 Package Manager를 쓰지 않는다. yarn/pnpm lock 파일 금지.
- 별도 Backend(Python/FastAPI 등)를 만들지 않는다. (COM-005 §3)
- Secret을 코드나 문서에 넣지 않는다. `.env.local`만 사용하고 커밋하지 않는다.

### 학습 로직 (COM-001 §19)
- AI가 정답을 확신하지 못하는데 임의로 정답을 만들어 학습을 진행하지 않는다.
- 학생의 시스템 오류를 오답으로 평가하지 않는다.
  (`system_interrupted`는 정답률·완료 문제 수에 반영 안 함)
- Persona(`friend`/`villain`)가 정답·평가·난이도·검증 로직을 바꾸지 않는다.
  말투와 연출만 담당한다.
- Student Memory를 세션 종료 시 초기화하지 않는다.
- 새 학습 시작 시 과거 학습기록을 삭제하지 않는다.
- 학생별 구독을 Account 전체 구독으로 바꾸지 않는다.
- 무료체험 시작일을 회원가입일로 바꾸지 않는다. (학생의 **최초 학습 시작** 시점)

### UI (COM-003)
- State/Modal을 별도 Route로 만들지 않는다. (§13-3)
- 학생 화면에 상세 평가점수와 Logic Gap을 노출하지 않는다.
- `verified_answer`는 **문제 진행 중에만** 감춘다. 문제를 종료할 때는 정답과
  해설을 보여준다. (COM-001 §8 종료 안내 · COM-002 §17)
- Answer Lock 데이터는 어느 시점에도 학생에게 노출하지 않는다.
- 학생 화면에서 `needs_review`를 "실패"로 표현하지 않는다.
- 학생 화면에서 힌트 사용을 감점으로 표현하지 않는다.
- 오류를 학생의 잘못처럼 표현하지 않는다.

---

## 코드 배치 (DEV-001)

```text
src/app/(auth)      AUTH
src/app/(student)   STU + MIS   ← 학생 어휘, 하단 Nav 없음
src/app/(parent)    PAR + RPT + BIL + MY   ← 하단 Nav 4탭, PIN 게이트
src/app/api         스트리밍 · 외부 콜백 · 배치만
src/components/ui       공통 UI
src/components/system   Loading · 오류 · 재시도
src/lib/services        COM-002 엔티티와 1:1
src/lib/ai              프롬프트 · 검증 · Drill-down · 평가
src/lib/constants/copy  학생 어휘 ↔ 부모 어휘 매핑
```

- 한 화면에서만 쓰는 컴포넌트는 `src/components/`가 아니라 그 route의
  `_components/`에 둔다.
- `_actions.ts`는 `lib/services`를 호출하는 얇은 래퍼로 유지한다.
  DB 쿼리를 직접 쓰지 않는다.
- 빈 폴더를 미리 만들지 않는다.
- `src/app/(admin)/`은 COM-007 확정 전까지 만들지 않는다.

---

## 용어 (COM-003 §7)

같은 상태를 학생과 부모에게 다르게 표현한다. 변환은
`src/lib/constants/copy.ts` 한 곳에서만 한다.

| DB / 내부 | 학생 화면 | 부모 화면 |
|---|---|---|
| 학습 | 미션 / 도전 | 학습 |
| 학습 시작 | 미션 시작하기 | 학습 시작 |
| 학습 결과 | 오늘의 기록 | 학습 결과 |
| `needs_review` | 한 번 더 도전 | 추가 학습 필요 |
| `Evaluation`, `LogicGap` | **노출 안 함** | 사고능력 / 자주 막힌 부분 |

---

## 명명

- 폴더·route: kebab-case
- Component 파일: PascalCase
- lib 파일: kebab-case
- DB 컬럼·변수: snake_case (COM-002 §2)
- Migration: `YYYYMMDDHHMMSS_동사_대상.sql` (timestamp 접두어). 연번 금지.
  기존 파일 수정 금지 · 추가만

## 브랜치 (COM-005 §6)

```text
main        배포용
└─ develop  통합 지점. 작업은 여기서 브랜치를 따고 여기로 merge
```

- PM별 고정 브랜치는 없다. 담당은 `DEV-001 §6`의 소유 경로가 정한다.
- 담당은 **AI 코어 트랙(2인)** 과 **서비스 트랙(2인)** 으로 나뉜다.
  트랙 밖을 수정하는 PR은 해당 트랙의 리뷰를 받는다.
- 공통 코드(`package.json`, `types/database.ts`, `lib/constants/**`,
  `components/ui/**`, `supabase/migrations/**`)는 기능 작업에 섞지 않고
  단독으로 먼저 merge한다.

---

## 미작성 문서

작업 중 아래 영역에 닿으면 **구현하지 말고 보고**한다.

| 문서 | 막고 있는 것 |
|---|---|
| `COM-004` (초안) | 코딩 규칙 · 리뷰 기준 · 테스트 기준 |
| `COM-007` (초안) | 학생 삭제, 회원탈퇴, 사진 보관, 운영자 데이터 열람 |

ADM(운영/백오피스) 영역은 COM-007 → COM-002 → COM-003 순으로 확정된 뒤에
착수한다.

---

## 명령어

```bash
npm install
npm run dev
```
