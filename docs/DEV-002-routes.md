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
| **합계** | **35** | **35** |

---

## 11. 미확정 · ADM Area

**현재 운영 및 백오피스 PM의 담당 화면이 0개다.** COM-001 §18은 이 PM의 범위를
"오류, 중단 세션, 상태 관리, 운영 예외"로 정의했으나 COM-003에 해당 Area가
없다.

### 상태

| 항목 | 상태 |
|---|---|
| 오너 | 운영 및 백오피스 PM (COM-001 §18, COM-005 §6 `pm-admin`) |
| Area ID | 미정 (`ADM` 후보) |
| Route prefix | 미정 (`/admin` 후보) |
| MVP 포함 여부 | **미정 — 팀 합의 필요** |

### 선행 조건 (순서 중요)

```text
COM-007   운영자의 아동 학습기록·AI 대화·문제 사진 열람 범위 확정
   ↓
COM-002   AdminUser / AuditLog 엔티티 도입 여부 결정
   ↓
COM-003   ADM Area 및 Screen ID 정의 (§3 Area 목록, §12 합계 갱신)
   ↓
DEV-002   Route 매핑 추가
```

COM-003부터 손대면 COM-007 결과에 따라 화면이 폐기될 수 있다.

### MVP 잠정 운영 방식

ADM 화면 없이 **Supabase Studio 조회 + `scripts/ops/` 스크립트**로 처리한다.
Studio에서의 직접 데이터 수정은 하지 않고, 상태 변경이 필요하면 기록이 남는
스크립트를 통한다. (COM-005 §10과 같은 취지)

이 기간 동안 운영 PM의 소유 범위는 화면이 아니라 `components/system/**`,
`lib/errors/**`, `src/middleware.ts`, `scripts/ops/**`다. (DEV-001 §6)

### 팀 논의 안건

1. MVP에 어드민 화면이 필요한가, Supabase Studio로 충분한가
2. 필요하다면 최소 화면은 무엇인가
   (후보: 학생/계정 조회, 구독·결제 상태 조회, AI 오류·검증실패 로그, 중단 세션 현황)
3. 운영자가 아동 학습기록·AI 대화·문제 사진을 열람할 수 있는가 → COM-007 선행
4. 어드민 권한 등급을 둘 것인가 (전체 / 읽기전용 / CS)
5. 감사 로그를 남길 것인가 → COM-002에 `AuditLog` 추가 여부
6. 어드민의 쓰기 작업은 각 PM 서비스 레이어 경유를 강제할 것인가
7. ADM Area ID · Screen ID 체계를 COM-003에 추가할 것인가

---

## Changelog

| Version | Date | 변경 내용 | 작성 |
|---|---|---|---|
| — | 2026-09-10 | **보호자 PIN 삭제** (PAR-001 · PAR-003). 괄호 폴더가 경로에 들어가지 않는다는 점을 명시하고 PAR-002 파일 경로를 실제와 맞춤 | — |
| 1.0 | 2026-08-28 | 최초 작성. COM-003 35개 Screen의 Route 매핑 확정 | — |
