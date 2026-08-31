# DEV-004 · 팀원 온보딩

> **Version:** 1.0 · **Updated:** 2026-08-31 · **Owner:** 운영 및 백오피스 PM\
> **Status:** 확정\
> **Changelog:** 문서 최하단 참조

> **문서 목적:** 새로 합류한 PM이 이 문서 하나로 로컬 환경을 세팅하고
> 첫 PR까지 올릴 수 있게 한다. 인프라 설정은 `DEV-003`이 담당한다.

---

## 1. 준비물

| 항목 | 버전 | 확인 |
|---|---|---|
| Node.js | **20 이상** | `node --version` |
| npm | Node에 포함 | `npm --version` |
| Git | 아무 최신 버전 | `git --version` |
| GitHub 계정 | — | `team-aipm` 조직 초대 수락 |

**npm만 쓴다.** yarn · pnpm 금지다. lock 파일이 갈리면 5명이 서로 다른
의존성으로 작업하게 된다. (COM-005 §5)

---

## 2. 공통 세팅 — 전원 동일

어떤 AI 도구를 쓰든 이 단계는 같다.

```bash
git clone https://github.com/team-aipm/AIPM.git
cd AIPM
npm install
npm run setup
```

`npm run setup`은 점검과 안내만 한다. 파일을 고치는 것은 `.env.local`
생성 하나뿐이며 이미 있으면 건드리지 않는다. 무엇이 빠졌는지와 어떻게
해결하는지를 출력하므로, 막히면 그 출력을 그대로 팀에 공유하면 된다.

### 환경변수

```bash
cp .env.example .env.local
```

`.env.local`을 열어 값을 채운다. **값은 운영 PM에게 개별로 받는다.**

| 변수 | 누가 받나 | 팀 공통인가 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | 전원 | ✅ 동일해야 함 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 전원 | ✅ 동일해야 함 |
| `SUPABASE_SERVICE_ROLE_KEY` | 서버 로직 담당만 | ✅ 동일해야 함 |
| `GEMINI_API_KEY` | AI 코어 담당 | ❌ **각자 발급 권장** |

- `.env.local`은 **절대 커밋하지 않는다.** `.gitignore`에 등록되어 있다
- 값을 단톡방에 올리지 않는다. 나간 사람도 계속 볼 수 있다
- Supabase 값 3개가 다르면 서로 다른 DB를 보게 된다
- `GEMINI_API_KEY`는 무료 키를 5명이 공유하면 요청 한도를 서로 잡아먹는다.
  각자 [Google AI Studio](https://aistudio.google.com)에서 발급받는다

### 실행

```bash
npm run dev     # http://localhost:3000
```

세팅이 끝난 뒤에도 `npm run setup`은 언제든 다시 실행할 수 있다.
공통 코드를 pull한 뒤 무엇이 어긋났는지 확인할 때 쓴다.

---

## 3. AI 도구별 준비

### Claude Code

```bash
npm install -g @anthropic-ai/claude-code
cd AIPM
claude
```

터미널이 부담스러우면 데스크톱 앱(Mac/Windows), VS Code · JetBrains 확장,
웹(claude.ai/code) 중 편한 것을 쓴다. **모두 같은 `CLAUDE.md`를 읽는다.**

추가 설정은 없다. 저장소를 열면 규칙이 적용된다.

### GPT Codex

저장소를 연결해 브랜치를 따고 PR을 만든다. 루트의 **`AGENTS.md`**를 읽는다.

**연결 시 조직 Owner 승인이 필요하다.** `team-aipm/AIPM`은 조직 소유
private 저장소이므로, GitHub App 설치를 조직 Owner가 승인해야 한다.

```text
Codex에서 team-aipm/AIPM 연결 시도
  → GitHub이 조직 설치 승인 요청
  → 조직 Owner(운영 PM 또는 인프라 담당 PM)가 승인
```

**Codex 실행 환경에 Secret을 등록하지 않는다.** 화면·컴포넌트 작업은 키
없이 가능하다. 실제 DB 연결이 필요한 검증은 로컬에서 사람이 한다.
`SUPABASE_SERVICE_ROLE_KEY`를 외부 실행 환경에 두는 것은 COM-007 관점에서
부담이 크다.

### 공통 — 도구가 무엇이든

`CLAUDE.md`와 `AGENTS.md`는 **요약**이다. 작업 전 해당 COM / DEV 문서를
직접 읽는다. 규칙이 서로 다르면 `docs/`가 우선한다.

---

## 4. 브랜치와 첫 PR

```text
main        배포용 (Vercel Production)
└─ develop  통합 지점. 기본 브랜치
   └─ 작업 브랜치   1~2일 살고 merge 후 삭제
```

```bash
git switch develop
git pull
git switch -c mission-drilldown      # 화면·기능 단위 이름. PM 이름 금지

# 작업 후
npm run lint
npm run build                        # 둘 다 통과해야 한다

git push -u origin mission-drilldown
gh pr create --base develop          # PR 대상은 develop
```

- **`main`으로 직접 PR을 열지 않는다.** `main` merge는 배포 시점에만 한다
- 담당은 브랜치가 아니라 `DEV-001 §6`의 **소유 경로**가 정한다
- 자기 소유 경로 밖을 수정하는 PR은 해당 오너의 리뷰를 받는다

### 공통 코드는 단독 PR로 먼저

```text
package.json            src/types/database.ts
src/lib/constants/**    src/components/ui/**
supabase/migrations/**
```

기능 작업에 섞지 않는다. 단독으로 먼저 merge하고 **전원이 pull한 뒤**
기능 작업을 이어간다. `package.json`이 바뀌었으면 `npm install`도 다시 한다.
(DEV-001 §6)

---

## 5. 자주 막히는 지점

| 증상 | 원인 | 해결 |
|---|---|---|
| 저장소가 안 보인다 | 조직 초대는 수락했으나 `pm` 팀에 없음 | 운영 PM에게 팀 배정 요청 |
| `git push`가 실패한다 | `neoseya7/AIPM` 시절 remote | `git remote set-url origin https://github.com/team-aipm/AIPM.git` |
| `supabaseUrl is required` | `.env.local` 없음 또는 값 비어 있음 | §2 환경변수 확인 |
| 로그인 세션이 자꾸 풀린다 | `src/middleware.ts` 누락 | `develop` 최신본을 pull |
| 다른 사람 화면엔 있는 데이터가 없다 | Supabase URL이 서로 다름 | 값 3개가 같은지 대조 |
| Windows에서 `LF will be replaced by CRLF` | 줄바꿈 변환 경고 | 무시해도 된다 |
| `npm install` 후 빌드가 깨진다 | 공통 코드 변경을 pull하지 않음 | `git pull` 후 `npm install` |

---

## 6. 체크리스트

```text
[ ] team-aipm 조직 초대 수락
[ ] pm 팀에 배정되어 저장소가 보임
[ ] git clone 완료
[ ] npm install 완료
[ ] .env.local 값 입력 완료
[ ] npm run dev 로 http://localhost:3000 확인
[ ] AI 도구에서 저장소를 열고 CLAUDE.md / AGENTS.md 적용 확인
[ ] docs/README.md 와 자기 담당 영역의 COM / DEV 문서 통독
[ ] DEV-001 §6 에서 자기 소유 경로 확인
```

---

## 7. 더 읽을 것

| 궁금한 것 | 문서 |
|---|---|
| 전체 규칙 | `CLAUDE.md` |
| 문서 지도 | `docs/README.md` |
| 내 담당 폴더가 어디인가 | `DEV-001 §6` |
| 이 화면의 URL이 뭔가 | `DEV-002` |
| Supabase · Vercel은 누가 관리하나 | `DEV-003` |
| 브랜치 규칙 상세 | `COM-005 §6` |

---

## Changelog

| Version | Date | 변경 내용 | 작성 |
|---|---|---|---|
| 1.0 | 2026-08-31 | 최초 작성. Claude Code 4명 · GPT Codex 1명 구성 반영 | — |
