# DEV-003 · 인프라 설정 및 연동 (GitHub · Vercel · Supabase)

> **Version:** 1.2 · **Updated:** 2026-08-31 · **Owner:** 세팅 담당\
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
| Vercel Project `aipm` | **운영 PM의 Vercel Pro 팀** | 운영 PM |
| Supabase Project | **인프라 담당 PM 개인 계정** | 인프라 담당 PM + 운영 PM |

### 원칙 — 모든 자산에 Owner를 2명 이상 둔다

Supabase가 개인 계정에 있으므로, 그 사람이 이탈하면 DB에 접근할 수 없다.
**Supabase Organization과 GitHub Organization에는 반드시 Owner를 2명 이상**
등록한다.

### Vercel이 운영 PM 계정에 있는 이유

Vercel **Hobby(무료) 플랜은 GitHub Organization이 소유한 private 저장소를
배포할 수 없다.** Pro가 필요하다. 저장소를 public으로 바꾸면 무료로 가능하지만
`docs/`의 기획 산출물 전체가 공개되므로 택하지 않았다.

운영 PM의 Vercel 팀이 이미 Pro이므로 **추가 지출 없이** private을 유지한다.
대신 배포 운영은 운영 PM이 맡고, 인프라 담당 PM은 Supabase를 맡는다.

> Vercel Pro는 멤버당 과금이다. 팀원을 Vercel 팀에 초대하면 좌석 비용이
> 늘어난다. 팀원은 Vercel 계정 없이 GitHub PR과 Preview URL로 확인한다.

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

### 담당 분담

| 영역 | 담당 |
|---|---|
| GitHub 조직 · 저장소 · 문서 | 운영 PM |
| **Vercel 배포 · 환경변수** | **운영 PM** |
| **Supabase 프로젝트 · 스키마 · Storage** | **인프라 담당 PM** |
| Migration 반영 · `types/database.ts` 생성 | 운영 PM (DEV-001 §6) |

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

**Vercel App은 이미 `team-aipm` 조직에 설치되어 있다.** Supabase의 GitHub
Integration을 나중에 켤 때 같은 절차가 다시 필요하다. (§11)

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

## 5. Vercel

### 5-1. 현재 상태 — 이미 구성 완료

운영 PM의 Vercel Pro 팀에 프로젝트가 생성되어 있고, `main` 브랜치가
프로덕션으로 배포된다. **인프라 담당 PM이 따로 할 일은 없다.**

| 항목 | 값 |
|---|---|
| Team | `neoseya-navercom's projects` (Pro) |
| Project | `aipm` |
| 연결 저장소 | `team-aipm/AIPM` (private) |
| Production Branch | **`main`** |
| Framework | Next.js (자동 감지) |

```text
Production   https://aipm-six.vercel.app
Dashboard    https://vercel.com/neoseya-navercoms-projects/aipm
```

### 5-2. 배포 트리거

| 대상 | 결과 |
|---|---|
| `main`에 push / merge | **Production 배포** |
| `develop` 및 작업 브랜치 push | Preview 배포 |
| `develop`로 향하는 PR | PR별 Preview URL 생성 |

저장소 기본 브랜치는 `develop`이지만 Production Branch는 `main`이다.
`develop`에 merge해도 서비스는 나가지 않는다. (COM-005 §6)

### 5-3. 환경변수 등록 — 운영 PM 수행

Settings → Environment Variables. **세 스코프를 분리해서 입력한다.**

MVP 기간에는 세 스코프 모두 `aipm-dev`를 가리켜도 된다.
prod 분리 시점에 **Production 스코프만** 교체하면 되도록 처음부터 나눠 둔다.

`SUPABASE_SERVICE_ROLE_KEY`와 `GEMINI_API_KEY`는 **Sensitive**로 표시한다.

> 환경변수를 바꾸면 **재배포해야 반영된다.** 값만 바꾸고 왜 안 되냐는
> 상황이 반드시 한 번은 나온다.

### 5-4. 팀원의 Preview 확인

Vercel Pro는 **멤버당 과금**이므로 팀원을 Vercel 팀에 초대하지 않는다.
팀원은 GitHub PR에 붙는 Preview URL로 확인한다.

Vercel 계정이 없는 팀원에게 Preview가 보이지 않으면
Settings → Deployment Protection을 조정한다.

### 5-5. 실행 리전

현재 기본값은 `iad1`(미국 워싱턴)이다. 사용자가 국내이므로
Settings → Functions에서 **`icn1`(서울)**로 변경하는 것을 검토한다.
정적 페이지에는 영향이 없고 Server Action·API Route의 응답 속도에 영향을 준다.

### 5-6. Vercel ↔ Supabase 연동은 수동으로

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

여러 명이 각자 대시보드에서 테이블을 고치면 현재 스키마를 아무도 모르게 되고,
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
npm i -D supabase                       # 전역 대신 repo 고정. 전원 버전 통일
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
| 인프라 담당 PM 이탈 | Supabase Organization에 운영 PM을 **Owner**로 등록. DB 비밀번호·service_role 키를 2명 이상 보관. Vercel은 운영 PM 계정이라 영향 없음 |
| GitHub App 접근 해제 시 배포 중단 | 조직 Owner 2명 체제 유지 |
| 운영 PM의 Vercel Pro 해지 | Hobby로 내려가면 조직 private 저장소를 배포할 수 없다. 해지 전 대안(저장소 공개 / 담당자 Pro)을 먼저 정한다 |
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

## 12. 세팅 담당 인계

초기 환경 구축은 한시적 역할이다. 세팅이 끝나면 아래 항목의 담당자가
사라지므로, **종료 전에 인계 대상을 지정해야 한다.** (DEV-001 §6)

### 계정 · 권한

| 항목 | 현재 | 인계 후 | 상태 |
|---|---|---|---|
| GitHub 조직 Owner | 세팅 담당 + 인프라 담당 | 인프라 담당이 유지 | ✅ 이미 2명 |
| Supabase 조직 Owner | 세팅 담당 + 인프라 담당 | 인프라 담당이 유지 | ✅ 이미 2명 |
| **Vercel 프로젝트** | **세팅 담당 개인 Pro 팀** | **미정** | ⚠️ **결정 필요** |

### ⚠️ Vercel — 세팅 종료 전에 반드시 정할 것

Vercel 프로젝트가 세팅 담당의 **개인 Pro 계정**에 있다. 이 계정을 쓴 이유는
Hobby 플랜이 GitHub Organization 소유의 private 저장소를 배포할 수 없기
때문이다. (§1)

세팅 담당이 빠지면 **팀이 관리할 수 없는 계정에 프로덕션 배포가 남는다.**
아래 중 하나를 선택해야 한다.

| 선택지 | 비용 | private 유지 |
|---|---|---|
| 세팅 담당이 Pro 팀과 배포 책임만 계속 유지 | 기존 그대로 | ✅ |
| 다른 PM이 Pro를 결제하고 프로젝트 이전 | 유료 | ✅ |
| 저장소를 public으로 전환하고 Hobby로 이전 | 0원 | ❌ 기획 산출물 공개 |
| GitHub Actions + Vercel CLI로 직접 배포 | 0원 | ✅ 구성 복잡도 상승 |

### 운영 책임

세팅 담당이 수행하던 정기 작업이다. **한 명을 지정한다.**

| 작업 | 근거 | 인계 대상 |
|---|---|---|
| `supabase db push` 실행 | §7-1 | 미정 |
| `src/types/database.ts` 생성 후 커밋 | §7-3 · DEV-001 §6 | 미정 |
| Vercel 환경변수 등록 · 갱신 | §5-3 | 미정 |
| 새 팀원에게 `.env.local` 값 전달 | §6 | 미정 |
| Supabase Storage 테스트 파일 정리 | §8 | 미정 |

> `types/database.ts`는 **한 명만** 생성해 커밋한다. 여러 명이 생성하면
> 매번 diff가 발생한다. 인계 대상을 반드시 1명으로 정한다.

### 소유 경로

| 경로 | 인계 대상 |
|---|---|
| `src/middleware.ts` | 미정 — 세션 갱신 로직이라 AI 코어 트랙이 적합 |
| `supabase/migrations/**` | 공통 영역. `db push` 담당자가 관리 |
| `docs/DEV-*.md` | 미정 — 개발 절차 문서 |

### 인계 완료 조건

```text
[ ] Vercel 배포 주체 확정 및 이전(또는 유지) 완료
[ ] db push · types 생성 담당 1명 지정
[ ] Vercel 환경변수 접근 권한 인계
[ ] .env.local 값과 DB 비밀번호를 2명 이상이 보관
[ ] src/middleware.ts · docs/DEV-*.md 소유 트랙 지정
[ ] 위 내용을 DEV-001 §6과 이 문서에 반영
```

---

## Changelog

| Version | Date | 변경 내용 | 작성 |
|---|---|---|---|
| 1.0 | 2026-08-31 | 최초 작성. GitHub Organization 전환 및 Vercel·Supabase가 별도 계정에 위치하는 구성 반영 | — |
| 1.1 | 2026-08-31 | **Vercel을 운영 PM의 기존 Pro 팀으로 확정.** Hobby는 조직 private 저장소를 배포할 수 없어 저장소 공개 대신 Pro 활용을 택함. 프로젝트 생성 완료 상태 및 담당 분담 반영 | — |
| 1.2 | 2026-08-31 | §12 세팅 담당 인계 절 추가. Vercel 프로젝트가 개인 계정에 있어 세팅 종료 전 결정이 필요함을 명시 | — |
