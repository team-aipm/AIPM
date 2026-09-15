# DEV-002 · Screen ID ↔ Route 매핑

> **Version:** 1.0 · **Updated:** 2026-08-28 · **Owner:** 운영 및 백오피스 PM\
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
| `AUTH-003` | 약관·개인정보 동의 | `/signup/terms` | `(auth)/signup/terms/page.tsx` |
| `AUTH-004` | 휴대폰 인증 | `/signup/verify` | `(auth)/signup/verify/page.tsx` |
| `AUTH-005` | 비밀번호 찾기/재설정 | `/password` | `(auth)/password/page.tsx` |

흐름: `/login → /signup → /signup/terms → /signup/verify → /onboarding/student`

가입 완료는 별도 Route가 아니라 `/signup/verify`의 완료 State다. (COM-003 §4.1)

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
  분리**한다. 내부 폼 컴포넌트는 공유할 수 있다.
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

- 학생 영역 ↔ 부모 영역은 별도 확인 없이 오간다.
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

## 9. Route Handler (화면 아님)

| 경로 | 용도 | 오너 |
|---|---|---|
| `/api/ai/chat` | Drill-down 대화 스트리밍 | AI 코어 PM |
| `/api/ai/verify` | Answer Verification | AI 코어 PM |
| `/api/ai/ocr` | 사진 문제 인식 | AI 코어 PM |
| `/api/webhooks/payment` | PG 결제 콜백 | 과금 PM |
| `/api/cron/weekly-report` | 주간 리포트 생성 배치 | 그로스 PM |

그 외 서버 로직은 Route Handler를 만들지 않고 Server Action을 쓴다.
(DEV-001 §2 규칙 5)

---

## 10. 합계 검증

| Area | COM-003 §12 | 본 문서 Route |
|---|---|---|
| AUTH | 5 | 5 |
| STU | 5 | 5 |
| MIS | 3 | 3 |
| PAR | 3 | 3 |
| RPT | 3 | 3 |
| BIL | 6 | 6 |
| MY | 10 | 10 |
| ADM | 4 | 5 |
| **합계** | **39** | **40** |

> ADM 이 하나 더 많다. `ADM-005` 가 목록과 상세 두 Route 를 쓴다 —
> 서로 다른 Screen 이며 State/Modal 을 Route 로 만든 것이 아니다.

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
3. `consent_log` 를 쌓는 지점 → 가입 시점이 맞는지 COM-007 과 대조

---

## Changelog

| Version | Date | 변경 내용 | 작성 |
|---|---|---|---|
| — | 2026-09-10 | **보호자 PIN 삭제** (PAR-001 · PAR-003). 괄호 폴더가 경로에 들어가지 않는다는 점을 명시하고 PAR-002 파일 경로를 실제와 맞춤 | — |
| 1.0 | 2026-08-28 | 최초 작성. COM-003 35개 Screen의 Route 매핑 확정 | — |
