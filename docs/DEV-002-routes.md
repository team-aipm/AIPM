# DEV-002 · Screen ID ↔ Route 매핑

> **Version:** 1.4 · **Updated:** 2026-09-30 · **Owner:** 운영 및 백오피스 PM\
> **Status:** 확정\
> **Changelog:** 문서 최하단 참조

> **문서 역할:** `COM-003 §4`가 정의한 35개 Screen을 실제 Next.js Route에
> 연결하는 문서\
> **우선순위:** Screen ID · 화면명 · Area는 **COM-003이 우선**한다.
> 본 문서는 Route 경로와 파일 위치만 정의한다.\
> **선행 문서:** `COM-003-screen-ui.md`, `DEV-001-folder-structure.md`

---

## 1. 원칙

1. **Route는 35개.** COM-003 §12 Screen Inventory와 1:1이다.
2. **State / Modal은 Route가 아니다.** (COM-003 §13-3) 본 문서에 나타나지 않는다.
3. Screen ID를 임의로 바꾸거나 합치지 않는다. (COM-003 §13-1)
4. 새 화면이 필요하면 Route를 먼저 만들지 말고 COM-003 변경을 제안한다.
   (COM-003 §13-9)
5. 모든 경로는 `src/app/` 기준이며 파일은 각 폴더의 `page.tsx`다.

---

## 2. AUTH · 회원/인증 (5)

부모 · 미인증 상태

| Screen ID | 화면명 | Route | 파일 |
|---|---|---|---|
| `AUTH-001` | 로그인 | `/login` | `(auth)/login/page.tsx` |
| `AUTH-002` | 회원가입 | `/signup` | `(auth)/signup/page.tsx` |
| `AUTH-003` | 약관·개인정보 동의 | **없음** · `/signup` 안의 바텀시트 | `(auth)/signup/_components/TermsSheet.tsx` |
| `AUTH-004` | 휴대폰 인증 | **미정** | — |
| `AUTH-005` | 비밀번호 찾기/재설정 | `/password` | `(auth)/password/page.tsx` |

흐름: `/login → /signup → /onboarding/student`

가입 완료는 별도 Route가 아니라 `/signup`의 완료 State다. (COM-003 §4.1)

### 2-1. AUTH-003 과 AUTH-004 · **2026-09-22**

Figma 「메티_서비스」를 화면으로 옮기면서 둘의 Route 가 없어졌다.
**Screen ID 는 그대로 둔다** — 화면이 사라진 것이 아니라 놓이는 자리가
바뀐 것이고, Screen ID 를 바꾸는 것은 COM-003 의 일이다(§13-1).

**`AUTH-003` 약관·개인정보 동의 → `/signup` 안의 바텀시트**

Figma 가 동의 4줄(이용약관 · 개인정보 · 법정대리인 · 마케팅)을 가입 폼
안에 두고, 「보기」를 누르면 본문만 바텀시트로 띄운다. 다른 화면으로
가지 않는다.

COM-003 §13-3 과 맞다 — State/Modal 은 Route 가 아니다. §1 의 원칙 2 는
그런 것이 이 문서에 나타나지 않는다고 했지만, **행을 지우면 Screen ID
매핑에 구멍이 생긴다.** 이 문서는 Screen ID ↔ Route 대응표이므로 「없음」
이라고 적는 편이 읽는 사람에게 낫다.

본문은 번들에 있다(`lib/constants/terms.ts`). 약관을 담을 테이블이
COM-002 에 없어서 가져올 곳이 없다. **법무 검토 전 초안이다.**

**`AUTH-004` 휴대폰 인증 → 미정**

Figma 에 해당 프레임이 아예 없다. 같은 개정에서 회원가입이 휴대폰을 받지
않게 되었으므로(COM-002 §3-1) **인증할 번호 자체가 없다.**

Route 를 지우지 않고 「미정」으로 둔다. 무엇으로 본인을 확인할지, 애초에
확인이 필요한지가 정해지지 않았다. 법정대리인 동의를 받는데 보호자를
식별할 값이 이메일뿐이어도 되는지는 COM-007 §2 의 판단이다.

---

## 3. STU · 학생 (5)

| Screen ID | 화면명 | Route | 파일 |
|---|---|---|---|
| `STU-001` | 첫 학생 등록 | `/onboarding/student` | `(student)/onboarding/student/page.tsx` |
| `STU-002` | 학생 선택 | `/students` | `(student)/students/page.tsx` |
| `STU-003` | Persona 선택 | `/onboarding/persona` | `(student)/onboarding/persona/page.tsx` |
| `STU-004` | 학생 HOME | `/home` | `(student)/home/page.tsx` |
| `STU-005` | 오늘의 기록 | `/home/today` | `(student)/home/today/page.tsx` |

- `STU-001`(첫 학생 등록)과 `MY-004`(학생 추가)는 **다른 Screen이므로 Route도
  분리**한다. 폼은 `components/student/StudentForm.tsx` 를 함께 쓴다.
- **`/onboarding/student` 만 부모가 연다.** 폴더는 `(student)` 지만 아이를
  만드는 화면이라 그렇다(COM-003 §4.2 사용자 칸이 「부모」). 나머지 `STU` ·
  `MIS` 는 아이 계정만 연다.
- `/home`은 COM-003 §5의 5개 State(최초 방문 / 오늘 시작 전 / 진행 중 / 오늘
  완료 / 구독 만료)를 한 Route에서 처리한다.

---

## 4. MIS · 미션 (3)

| Screen ID | 화면명 | Route | 파일 |
|---|---|---|---|
| `MIS-001` | 미션 진행 | `/mission` | `(student)/mission/page.tsx` |
| `MIS-002` | 내가 문제 내기 | `/mission/create` | `(student)/mission/create/page.tsx` |
| `MIS-003` | 사진 문제 확인 | `/mission/create/photo` | `(student)/mission/create/photo/page.tsx` |

사진 흐름:
`/mission/create → 촬영 → /mission/create/photo → 확인·수정 → 정답 검증 → Answer Lock → /mission`

`/mission` 한 Route가 흡수하는 State/Modal (COM-003 §5):
AI 생각 중 · 힌트 · 문제 완료 · 한 번 더 도전 · AI 오류 · 인터넷 끊김 ·
중간 종료 확인 · 중단 문제 재개 · 전날 미션 재개

---

## 5. PAR · 보호자 (1)

| Screen ID | 화면명 | Route | 파일 |
|---|---|---|---|
| `PAR-002` | 부모 HOME | `/parent` | `(parent)/parent/page.tsx` |

- **학생 영역 ↔ 부모 영역은 서로 건너가지 않는다** (2026-09-17 · COM-003 §4.2).
  부모 계정은 `PAR` · `RPT` · `BIL` · `MY` 와 `/onboarding/student` 만,
  아이 계정은 `STU` · `MIS` 만 연다. 링크를 지우는 것으로는 모자라므로
  화면마다 막는다 — `lib/services/viewer.ts` 의 `requireParent()` ·
  `requireChild()` 다.
- **괄호 폴더는 경로에 들어가지 않는다.** `(parent)/page.tsx` 는 `/parent`
  가 아니라 `/` 다. 실제 파일은 `(parent)/parent/page.tsx` 이며 아래 표의
  파일 경로도 그 기준이다.

---

## 6. RPT · 리포트 (3)

| Screen ID | 화면명 | Route | 파일 |
|---|---|---|---|
| `RPT-001` | 주간 성장 리포트 | `/parent/reports` | `(parent)/reports/page.tsx` |
| `RPT-002` | 리포트 상세 | `/parent/reports/[reportId]` | `(parent)/reports/[reportId]/page.tsx` |
| `RPT-003` | 지난 리포트 | `/parent/reports/history` | `(parent)/reports/history/page.tsx` |

`[reportId]`는 COM-002 §13의 `report_id`다.

---

## 7. BIL · 구독/결제 (6)

| Screen ID | 화면명 | Route | 파일 |
|---|---|---|---|
| `BIL-001` | 구독·결제 HOME | `/parent/billing` | `(parent)/billing/page.tsx` |
| `BIL-002` | 구독 신청 | `/parent/billing/subscribe` | `(parent)/billing/subscribe/page.tsx` |
| `BIL-003` | 결제 진행 | `/parent/billing/checkout` | `(parent)/billing/checkout/page.tsx` |
| `BIL-004` | 구독 관리 | `/parent/billing/manage` | `(parent)/billing/manage/page.tsx` |
| `BIL-005` | 결제수단 관리 | `/parent/billing/methods` | `(parent)/billing/methods/page.tsx` |
| `BIL-006` | 결제내역 | `/parent/billing/history` | `(parent)/billing/history/page.tsx` |

- PG사 미확정(COM-005 §13)이므로 `/parent/billing/checkout`의 내부 구현은
  보류 상태다. Route와 상태 전이만 먼저 잡는다.
- PG 콜백은 화면이 아니라 `app/api/webhooks/payment/route.ts`가 받는다.

---

## 8. MY · 마이/설정 (10)

| Screen ID | 화면명 | Route | 파일 |
|---|---|---|---|
| `MY-001` | 마이페이지 | `/parent/my` | `(parent)/my/page.tsx` |
| `MY-002` | 학생 관리 | `/parent/my/students` | `(parent)/my/students/page.tsx` |
| `MY-003` | 학생 프로필 | `/parent/my/students/[studentId]` | `(parent)/my/students/[studentId]/page.tsx` |
| `MY-004` | 학생 추가 | `/parent/my/students/new` | `(parent)/my/students/new/page.tsx` |
| `MY-005` | 부모 회원정보 | `/parent/my/profile` | `(parent)/my/profile/page.tsx` |
| `MY-006` | 마케팅 수신설정 | `/parent/my/marketing` | `(parent)/my/marketing/page.tsx` |
| `MY-007` | 알림 설정 | `/parent/my/notifications` | `(parent)/my/notifications/page.tsx` |
| `MY-008` | 계정 관리 | `/parent/my/account` | `(parent)/my/account/page.tsx` |
| `MY-009` | 회원탈퇴 안내 | `/parent/my/account/withdraw` | `(parent)/my/account/withdraw/page.tsx` |
| `MY-010` | 회원탈퇴 확인 | `/parent/my/account/withdraw/confirm` | `(parent)/my/account/withdraw/confirm/page.tsx` |

탈퇴 흐름:
`/parent/my/account → /withdraw → /withdraw/confirm → 본인확인 → 완료 State → /login`

Next.js 라우팅 특성상 `students/new`가 `students/[studentId]`보다 먼저 매칭되므로
`studentId`로 `new`를 쓸 수 없다. UUID를 쓰므로 실제 충돌은 없다.

---

## 8-A. 2026-09-30 에 더한 Route

> 근거: COM-003 §4.9 · COM-001 §11-A · §11-2.

| Screen ID | 화면 | Route | 파일 |
|---|---|---|---|
| `STU-006` | 지난 미션 목록 | `/missions/past` | `(student)/missions/past/page.tsx` |
| `STU-007` | 학생 내 정보 | `/me` | `(student)/me/page.tsx` |
| `STU-008` | 캐릭터 목록·변경 | `/me/characters` | `(student)/me/characters/page.tsx` |
| `STU-009` | 캐릭터 해금 | `/me/characters/[characterId]` | `(student)/me/characters/[characterId]/page.tsx` |
| `PAR-003` | 자녀 학습 상세 | `/parent/students/[studentId]` | `(parent)/students/[studentId]/page.tsx` |
| `PAR-004` | 알림 센터 | `/parent/notifications` | `(parent)/notifications/page.tsx` |
| `RWD-001` | 보상 목록 | `/parent/rewards` | `(parent)/rewards/page.tsx` |
| `RWD-002` | 보상 만들기 | `/parent/rewards/new` | `(parent)/rewards/new/page.tsx` |
| `RWD-003` | 보상 상세·수정 | `/parent/rewards/[rewardGoalId]` | `(parent)/rewards/[rewardGoalId]/page.tsx` |
| `MY-011` | 보호자 비밀번호 변경 | `/parent/my/profile/password` | `(parent)/my/profile/password/page.tsx` |

**`/parent/my/**` 를 그대로 쓴다.** 팀 정책 문서는 `/parent/me/**` 로
적었는데, 뜻이 같고 우리 쪽은 이미 배포돼 있다. 옮기면 폴더 11개가 움직이고
얻는 것이 없다 (`FIGMA-MD-AUDIT.md` §0).

**BIL 도 §7 그대로다.** 팀 정책 문서의 `/parent/subscriptions` 계열은 쓰지
않는다. 결제 PG 가 정해지면 그때 §7 을 다시 본다(COM-005 §13).

### 헷갈리는 짝

```text
/parent/notifications      PAR-004  받은 알림을 본다
/parent/my/notifications   MY-007   무엇을 받을지 정한다

/parent/students/[id]      PAR-003  학습 현황. 읽기 중심
/parent/my/students/[id]   MY-003   계정 관리. 수정·삭제
```

두 짝 모두 **학생 세션으로 넘어가지 않는다.** 부모 계정으로 부모 화면을
볼 뿐이다.

`MY-011` 은 **이메일 가입자만** 들어온다. 카카오 · 구글 가입자가 주소로
직접 와도 `/parent/my/profile` 로 보낸다.

`/me` 와 `/parent/my` 는 다른 영역이다. 앞쪽은 아이, 뒤쪽은 부모다.
접근 제어는 §5 의 표를 따른다 — 부모 계정이 `/me` 로 오면 `/parent` 로
보낸다.

---

## 9. Route Handler (화면 아님)

| 경로 | 용도 | 오너 |
|---|---|---|
| `/api/ai/chat` | Drill-down 대화 스트리밍 | AI 코어 PM |
| `/api/ai/verify` | Answer Verification | AI 코어 PM |
| `/api/ai/ocr` | 사진 문제 인식 | AI 코어 PM |
| `/api/webhooks/payment` | PG 결제 콜백 | 과금 PM |
| `/api/cron/weekly-report` | 주간 리포트 생성 배치 | 그로스 PM |
| `/api/cron/delete-temporary-uploads` | 못 지운 임시 사진 재삭제 (COM-002 §23) | AI 코어 PM |
| `/api/cron/purge-deleted-accounts` | 30일 지난 탈퇴 계정 완전 삭제 (COM-002 §3-2) | 운영 PM |

그 외 서버 로직은 Route Handler를 만들지 않고 Server Action을 쓴다.
(DEV-001 §2 규칙 5)

---

## 9-1. Screen ID 없는 공개 Route · **2026-09-28**

화면이지만 **제품 화면이 아니다.** COM-003 §12 의 화면 수에 넣지 않는다.

| Route | 용도 | 파일 |
|---|---|---|
| `/` | 서비스 소개. **로그인한 사람은 `/parent` 또는 `/home` 으로 보낸다** | `page.tsx` |
| `/terms` | 이용약관 | `(legal)/terms/page.tsx` |
| `/privacy` | 개인정보 수집·이용 동의 | `(legal)/privacy/page.tsx` |
| `/guardian` | 법정대리인 동의 | `(legal)/guardian/page.tsx` |
| `/marketing` | 마케팅 정보 수신 동의 | `(legal)/marketing/page.tsx` |

**왜 Screen ID 를 주지 않나.** 학습 기능이 아니고 학생 어휘 · 부모 어휘
구분도 없다. COM-003 §12 의 합계를 늘리면 「만들어야 할 제품 화면」이
늘어난 것으로 읽힌다. `/prompt-lab` 이 Screen ID 없이 있는 것과 같은
자리다 — 그쪽은 개발 도구, 이쪽은 공개 문서다.

**본문은 `lib/constants/terms.ts` 한 곳에서만 온다.** 페이지에 문구를
옮겨 적지 않는다. 두 벌이 되면 가입할 때 동의한 글과 나중에 읽는 글이
달라질 수 있고, 그것은 동의를 증명해야 할 때 가장 곤란한 상태다
(COM-002 §20-B `document_version`).

`AUTH-003`(§2-1)과 겹치지 않는다. 그쪽은 **가입 폼 안에서 동의를 받는
자리**이고, 이쪽은 **누구나 읽을 수 있는 공개 주소**다. 같은 본문을 서로
다른 목적으로 보여 준다.

### 왜 지금 만들었나

구글 OAuth 동의 화면을 게시하려면 **애플리케이션 홈페이지 · 개인정보
처리방침 · 서비스 약관의 공개 URL 셋**을 요구한다. 가입 폼의 바텀시트는
URL 이 없어 쓸 수 없었다.

`/` 도 같은 이유로 소개 화면이 됐다. 전에는 `/login` 으로 넘기기만 해서,
구글 심사자와 처음 온 부모에게 무엇을 하는 서비스인지 알려 줄 자리가
없었다.

---

## 10. 합계 검증

| Area | COM-003 §12 | 본 문서 Route |
|---|---|---|
| AUTH | 5 | 3 |
| STU | 9 | 9 |
| MIS | 3 | 3 |
| PAR | 5 | 5 |
| RPT | 3 | 3 |
| BIL | 6 | 6 |
| MY | 11 | 11 |
| RWD | 3 | 3 |
| ADM | 4 | 5 |
| **합계** | **49** | **48** |

> ADM 이 하나 더 많다. `ADM-005` 가 목록과 상세 두 Route 를 쓴다 —
> 서로 다른 Screen 이며 State/Modal 을 Route 로 만든 것이 아니다.
>
> AUTH 는 둘 적다. `AUTH-003` 은 `/signup` 안의 바텀시트가 되었고
> `AUTH-004` 는 미정이다(§2-1). Screen 은 그대로 5개다.

---

## 11. ADM · 운영/백오피스 (4)

### 상태 · **2026-09-15 확정**

| 항목 | 상태 |
|---|---|
| 오너 | 운영 및 백오피스 PM (COM-001 §18, COM-005 §6 `pm-admin`) |
| Area ID | `ADM` |
| Route prefix | `/admin` |
| MVP 포함 여부 | **포함** — 화면 4개 |

선행 조건 넷을 모두 채웠다.

```text
COM-007 §7      운영자 열람 범위 · 마스킹 · 감사        확정
   ↓
COM-002 §20-B   admin_user · audit_log · consent_log   확정
   ↓
COM-003 §4.8    ADM Area 및 Screen ID                  확정
   ↓
DEV-002         Route 매핑                              ← 여기
```

### Route 매핑

| Screen ID | Route | 파일 |
|---|---|---|
| `ADM-001` | `/admin` | `src/app/(admin)/admin/page.tsx` |
| `ADM-004` | `/admin/accounts` | `.../admin/accounts/page.tsx` |
| `ADM-005` | `/admin/students` | `.../admin/students/page.tsx` |
| `ADM-005` | `/admin/students/[studentId]` | `.../admin/students/[studentId]/page.tsx` |
| `ADM-012` | `/admin/operators` | `.../admin/operators/page.tsx` |

`(admin)`은 괄호 폴더라 경로에 세그먼트를 더하지 않는다. 그래서 안쪽에
`admin/`을 한 번 더 둔다 — `(parent)` 가 `parent/` 를 두는 것과 같다.

**권한이 없으면 404다.** 로그인한 사람이 `admin_user` 에 없거나
`is_active` 가 false 면 route 자체가 없는 것처럼 군다. 「권한이
없습니다」는 여기 무엇이 있다는 것을 알려주는 답이다.

`ADM-005`가 Route 둘을 쓴다. 목록과 상세는 서로 다른 Screen 이며,
State/Modal 을 Route 로 만들지 않는다는 COM-003 §13-3 과 무관하다.

### 아직 없는 Route

| Screen ID | 왜 |
|---|---|
| `ADM-008` | CS 문의를 담을 테이블이 COM-002 에 없다(COM-003 §4.8) |

### 그동안 어떻게 했나

ADM 화면이 없던 동안에는 Supabase Studio 조회로 버텼다. 이제 조회는 화면이
맡는다. **Studio 에서 직접 데이터를 고치지 않는다** — 상태를 바꿔야 하면
기록이 남는 경로를 쓴다(COM-005 §10과 같은 취지).

운영 PM 의 소유 범위에 `src/app/(admin)/**` 와 `lib/services/admin.ts` 가
더해진다. 기존의 `components/system/**` · `lib/errors/**` ·
`src/middleware.ts` 는 그대로다(DEV-001 §6).

### 남은 논의

1. `ADM-008`(CS 문의 · 대화 열람)을 만들 것인가 → COM-002 에 문의 테이블 필요
2. 결제·정산 화면 → COM-005 §13 에서 PG 확정 뒤
3. `consent_log` 를 쌓는 지점 → **가입 시점으로 구현했다**(2026-09-22).
   `handle_new_account` 트리거가 `account` 와 같은 트랜잭션에서 남긴다 —
   앱에서 나눠 넣으면 동의 없이 가입된 계정이 생길 수 있다. 그 지점이
   맞는지는 COM-007 과 아직 대조하지 않았다

---

## Changelog

| Version | Date | 변경 내용 | 작성 |
|---|---|---|---|
| 1.4 | 2026-09-30 | **§8-A 추가 · Route 10개.** 지난 미션 · 학생 내 정보 · 캐릭터 2 · 자녀 학습 상세 · 알림 센터 · 보상 3 · 비밀번호 변경. cron 2개(`delete-temporary-uploads` · `purge-deleted-accounts`). **`/parent/my/**` 와 §7 BIL 은 그대로 둔다** — 팀 정책 문서의 `/parent/me/**` · `/parent/subscriptions` 를 따르지 않는 이유를 §8-A 에 적었다. §10 합계 38 → 48 | — |
| 1.3 | 2026-09-28 | **§9-1 추가 — Screen ID 없는 공개 Route.** `/`(서비스 소개) · `/terms` · `/privacy` · `/guardian` · `/marketing`. 구글 OAuth 동의 화면을 게시하려면 홈페이지 · 개인정보처리방침 · 이용약관의 **공개 URL** 이 필요한데, 가입 폼의 바텀시트(`AUTH-003`)는 URL 이 없어 쓸 수 없었다. 본문은 `lib/constants/terms.ts` 한 곳에서만 읽는다. COM-003 §12 합계는 늘리지 않는다 — 제품 화면이 아니다. `/` 는 로그인한 사람을 전과 같이 `/parent`·`/home` 으로 보낸다 | — |
| 1.2 | 2026-09-22 | **§2 `AUTH-003` · `AUTH-004` 의 Route 를 걷어냈다**(§2-1 추가). Figma 가 약관 동의를 가입 폼 안에 두고 본문만 바텀시트로 띄운다 — `/signup/terms` 는 COM-003 §13-3 과 어긋났다. 휴대폰 인증은 회원가입이 휴대폰을 받지 않게 되면서(COM-002 §3-1) 인증할 번호가 없어져 **미정**으로 둔다. Screen ID 는 그대로다. 흐름 줄과 §10 합계(AUTH 5 → 3)를 함께 맞췄다 | — |
| 1.1 | 2026-09-17 | **학생 ↔ 부모 영역을 계정으로 가른다**(§3 · §5 · COM-003 §4.2). 전에는 "별도 확인 없이 오간다" 였다. `/onboarding/student` 만 학생 Area 에 있으면서 부모가 연다. Route 추가·삭제·개명 없음 | — |
| — | 2026-09-10 | **보호자 PIN 삭제** (PAR-001 · PAR-003). 괄호 폴더가 경로에 들어가지 않는다는 점을 명시하고 PAR-002 파일 경로를 실제와 맞춤 | — |
| 1.0 | 2026-08-28 | 최초 작성. COM-003 35개 Screen의 Route 매핑 확정 | — |
