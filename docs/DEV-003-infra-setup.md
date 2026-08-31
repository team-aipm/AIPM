# DEV-003 · 인프라 설정 및 연동 (GitHub · Vercel · Supabase)

> **Version:** 1.0 · **Updated:** 2026-08-31 · **Owner:** 운영 및 백오피스 PM\
> **Status:** 확정\
> **Changelog:** 문서 최하단 참조

> **문서 목적:** COM-005 §9(Supabase 사용 원칙)와 §11(개발/배포 환경)을
> 실제 계정 구성으로 옮긴 절차서다. 인프라 담당 PM에게 이 문서 하나만
> 전달하면 설정이 끝나도록 작성한다.

---

## 1. 계정 구성

인프라(Vercel · Supabase)와 저장소(GitHub)의 **소유 계정이 다르다.**
이 문서의 절차 대부분은 그 사실에서 나온다.

| 자산 | 소유 | Owner |
|---|---|---|
| GitHub Organization `team-aipm` | 팀 | 운영 PM + **인프라 담당 PM** |
| GitHub Repository `team-aipm/AIPM` | 조직 (private) | 조직 Owner |
| Vercel Project | **인프라 담당 PM 개인 계정** | 인프라 담당 PM |
| Supabase Project | **인프라 담당 PM 개인 계정** | 인프라 담당 PM + 운영 PM |

### 원칙 — 모든 자산에 Owner를 2명 이상 둔다

인프라가 개인 계정에 있으므로, 그 사람이 이탈하면 서비스가 멈춘다.
**Supabase Organization과 GitHub Organization에는 반드시 Owner를 2명 이상**
등록한다. Vercel은 플랜에 따라 좌석 비용이 발생하므로 팀 결정에 따른다.

---

## 2. 사전 조건

아래는 이미 완료된 상태다.

```text
GitHub Organization   team-aipm
Repository            team-aipm/AIPM  (private)
기본 브랜치            develop         ← PR의 기본 대상
배포 브랜치            main            ← Vercel Production
Team                  pm  (Write 권한)
```

조직 멤버는 **`pm` 팀에 속해야만** private 저장소에 접근할 수 있다.
초대만 하고 팀에 넣지 않으면 "저장소가 보이지 않는다"가 된다.

---

## 3. 핵심 제약 — GitHub App 설치 권한

Vercel과 Supabase는 GitHub 저장소에 접근할 때 **GitHub App**을 쓴다.
GitHub App은 **저장소를 소유한 계정(=조직)에만 설치**할 수 있고,
설치 권한은 **조직 Owner에게만** 있다.

```text
인프라 담당 PM이 조직 Member  →  설치 요청만 가능. 매번 운영 PM 호출
인프라 담당 PM이 조직 Owner   →  본인이 직접 설치·관리        ← 이 구성
```

> **그래서 인프라 담당 PM은 조직 Owner여야 한다.** 이것이 개인 저장소를
> Organization으로 옮긴 이유다.

---

## 4. Supabase 설정 절차

인프라 담당 PM이 수행한다.

### 4-1. 프로젝트 생성

| 항목 | 값 |
|---|---|
| Project name | `aipm-dev` |
| Region | **ap-northeast-2 (Seoul)** — 사용자가 국내 |
| DB Password | 생성 직후 1회만 표시. **즉시 팀 보관처에 저장** |

### 4-2. Organization에 운영 PM을 Owner로 추가

Dashboard → Organization → Team → Invite. **Role은 Owner.**
계정 이탈 대비이자 COM-007(아동 데이터) 책임 소재 문제다.

### 4-3. 키 확보

Project Settings → API 에서 3개를 확인한다.

| 키 | 배포 범위 |
|---|---|
| Project URL | 팀 전원 |
| anon (publishable) key | 팀 전원 |
| **service_role key** | **서버 코드를 다루는 PM에게만.** RLS를 통째로 우회한다 |

### 4-4. Auth 설정

- Email 확인(Confirm email) **켜기**
- Redirect URLs에 아래를 **모두** 추가한다. 빠뜨리면 로그인 리다이렉트가 깨진다.

```text
http://localhost:3000/**
https://*.vercel.app/**        ← Preview 배포용
https://<프로덕션 도메인>/**     ← 도메인 확정 후 추가
```

### 4-5. RLS

**테이블을 만들 때마다 RLS를 켠다.** COM-007이 초안이더라도
"RLS 없는 테이블은 만들지 않는다"를 규칙으로 둔다.
Dashboard의 Security Advisor로 주기적으로 점검한다.

### 4-6. Storage

- 학생 문제 사진 버킷은 **private**
- 공개 URL을 쓰지 않고 **signed URL**로 접근한다
- 보관기간·삭제 정책은 **COM-007 확정 전까지 정하지 않는다.** 버킷만 만든다

---

## 5. Vercel 설정 절차

### 5-1. 프로젝트 Import

1. Vercel → Add New… → Project → Import Git Repository
2. GitHub 연결 (인프라 담당 PM 본인 계정)
3. 목록에 `team-aipm/AIPM`이 **안 보이는 것이 정상이다.** 아직 App이
   설치되지 않았다. 하단 **"Adjust GitHub App Permissions"**를 눌러
   `team-aipm` 조직에 Vercel App을 설치하고 `AIPM`을 선택한다
4. Framework는 Next.js 자동 감지. Root Directory는 기본값

### 5-2. Production Branch 변경 — 가장 먼저 확인할 것

저장소 **기본 브랜치는 `develop`**이다. Vercel은 기본 브랜치를 Production
Branch로 잡으므로, 그대로 두면 **`develop` push가 곧바로 프로덕션 배포**가
된다.

```text
Project Settings → Git → Production Branch → main 으로 변경
```

### 5-3. 환경변수 등록

Settings → Environment Variables. **세 스코프를 분리해서 입력한다.**

MVP 기간에는 세 스코프 모두 `aipm-dev`를 가리켜도 된다.
prod 분리 시점에 **Production 스코프만** 교체하면 되도록 처음부터 나눠 둔다.

`SUPABASE_SERVICE_ROLE_KEY`와 `GEMINI_API_KEY`는 **Sensitive**로 표시한다.

> 환경변수를 바꾸면 **재배포해야 반영된다.** 값만 바꾸고 왜 안 되냐는
> 상황이 반드시 한 번은 나온다.

### 5-4. Preview 배포

`develop`으로 향하는 PR마다 Preview URL이 생성된다. 기획 확인과 리뷰의
주된 수단이다. (COM-005 §11)

Vercel 계정이 없는 팀원에게 Preview를 보여주려면
Settings → Deployment Protection 조정이 필요하다.

### 5-5. Vercel ↔ Supabase 연동은 수동으로

Vercel Marketplace의 Supabase Integration은 `POSTGRES_*` 등
**약속하지 않은 환경변수를 여러 개 자동 생성**한다. COM-005 §8
("환경변수 이름을 임의 생성하지 않는다")과 충돌하므로 쓰지 않는다.
§5-3처럼 **값을 직접 입력**한다.

---

## 6. 환경변수

이름은 `.env.example`이 Source of Truth다. 새 변수는 팀 합의 후
`.env.example`을 먼저 고친다. (COM-005 §8)

| 변수 | 출처 | 로컬 | Vercel |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL | `.env.local` | 3스코프 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | `.env.local` | 3스코프 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role | `.env.local` | Sensitive |
| `GEMINI_API_KEY` | Google AI Studio | `.env.local` | Sensitive |

- `.env.local`은 커밋하지 않는다
- 실제 키를 MD 문서·이슈·PR·채팅에 붙여넣지 않는다
- 키 전달은 비밀번호 관리 도구 등 안전한 경로로 한다

---

## 7. 운영 규칙

### 7-1. Studio에서 스키마를 직접 고치지 않는다

5명이 각자 대시보드에서 테이블을 고치면 현재 스키마를 아무도 모르게 되고,
코드와 DB가 조용히 어긋난다. COM-005 §10의 `문서 → DB → 코드` 순서가
이를 막는 장치다.

```text
COM-002 수정 합의
  → npx supabase migration new <동사_대상>
  → PR → develop merge
  → 운영 PM이 supabase db push
  → 운영 PM이 types 재생성 후 커밋
  → 전원 pull
```

### 7-2. Supabase CLI

```bash
npm i -D supabase                       # 전역 대신 repo 고정. 5명 버전 통일
npx supabase link --project-ref <ref>
npx supabase db push
```

Docker 없이도 `migration new` · `db push` · `gen types`는 동작한다.
Docker가 필요한 것은 `db diff`와 로컬 스택 `start`뿐이다.

### 7-3. `src/types/database.ts`

```bash
npx supabase gen types typescript --linked > src/types/database.ts
```

**운영 PM 1명만** 실행해 커밋한다. 각자 생성하면 매번 diff가 발생한다.
(DEV-001 §6 공통 코드 변경 절차)

### 7-4. Migration 명명

`YYYYMMDDHHMMSS_동사_대상.sql`. 연번 금지. 한번 merge된 파일은 수정하지
않고 새 파일을 추가한다. (DEV-001 §7)

---

## 8. 무료 플랜에서 실제로 걸리는 것

### Supabase Free

| 항목 | 내용 |
|---|---|
| 자동 일시정지 | **7일간 DB 활동이 적으면 정지.** 방학·연휴에 걸린다. 데이터는 90일 보존, 대시보드에서 재개 |
| Storage 1GB | **문제 사진 테스트가 빠르게 소진한다.** 정리 담당을 정한다 |
| DB 500MB / MAU 5만 / Egress 5GB | 개발 단계에는 충분 |
| 백업 다운로드 불가 | 시드 데이터는 repo의 SQL로 관리해야 복구 가능 |
| 브랜칭 미지원 | Pro 전용. migration 파일 기반 운영이 유일한 안전장치 |
| 프로젝트 수 | 계정 전체 2개 |

### GitHub Free

private 저장소에는 **브랜치 보호·룰셋을 걸 수 없다.** (Team 플랜 필요)
즉 `main` 직접 push를 기술적으로 막을 수 없다.

완화책으로 `vercel.json`에서 `main`의 자동 배포를 끈다. 실수로 push되어도
서비스는 나가지 않고, 프로덕션 배포는 Vercel에서 명시적으로 Promote할 때만
일어난다.

```json
{
  "git": {
    "deploymentEnabled": { "main": false }
  }
}
```

---

## 9. 신규 팀원 로컬 세팅

```bash
git clone https://github.com/team-aipm/AIPM.git
cd AIPM
npm install
cp .env.example .env.local     # 값은 인프라 담당 PM에게 받는다
npm run dev
```

기존에 `neoseya7/AIPM`을 clone해 둔 경우 remote를 갱신한다.

```bash
git remote set-url origin https://github.com/team-aipm/AIPM.git
```

---

## 10. 리스크와 대비

| 리스크 | 대비 |
|---|---|
| 인프라 담당 PM 이탈 | Supabase Organization에 운영 PM을 **Owner**로 등록. DB 비밀번호·service_role 키를 2명 이상 보관 |
| GitHub App 접근 해제 시 배포 중단 | 조직 Owner 2명 체제 유지 |
| `main` 직접 push | `vercel.json`으로 자동 배포 차단 (§8) |
| 개발 데이터와 학생 실데이터 혼재 | 실사용자 유입 **전에** prod 프로젝트 분리 (§11) |
| Preview URL 외부 유출 | Deployment Protection 유지 |

---

## 11. 아직 정하지 않은 것

| 항목 | 조건 |
|---|---|
| prod Supabase 분리 시점 | 실제 학생 데이터 수집 전. Pro 전환 필요 |
| Storage 보관·삭제 정책 | **COM-007 확정 후** |
| 커스텀 도메인 | 서비스명 확정 후 |
| 결제 PG 환경변수 | COM-005 §13 미확정 |
| Supabase GitHub Integration (migration 자동 배포) | 스키마 안정화 후 전환 검토 |

---

## Changelog

| Version | Date | 변경 내용 | 작성 |
|---|---|---|---|
| 1.0 | 2026-08-31 | 최초 작성. GitHub Organization 전환 및 Vercel·Supabase가 별도 계정에 위치하는 구성 반영 | — |
