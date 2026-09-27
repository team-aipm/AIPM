-- 테스트 학생을 진짜 아이와 가른다 (COM-002 §3 · §4)
--
-- 프롬프트 랩이 돌린 결과를 실제 학습 데이터로 남기려 한다. 그러면
-- 테스트용 학생이 `student` 에 생기는데, **지금은 진짜 아이와 구별할
-- 방법이 없다.** `student_status` 가 `active | deleted_pending` 둘뿐이다.
--
-- 이미 벌어져 있다 — `테스트학생` 이 `active` 로 진짜 아이 다섯과 같은
-- 줄에 있고, 집계도 배치도 그 아이를 진짜로 센다.
--
-- ## 값 하나로 절반이 막힌다
--
-- `.eq('student_status','active')` 를 쓰는 곳은 **코드를 고치지 않아도**
-- 자동으로 제외된다. 비용이 새는 자리가 여기다.
--
--     api/batch/weekly-report   매주 학생마다 AI 를 부른다
--     admin-metrics.blockedStudents()
--
-- 남는 것은 `funnel()` 의 집계들이고, 그쪽은 같은 PR 에서 명시적으로
-- 거른다.
--
-- ## account 는 왜 안 바꾸나
--
-- `account_status` 는 TEXT 라 값을 늘리는 데 마이그레이션이 필요 없다
-- (COM-002 §3 주석 참고 — 탈퇴 값이 COM-007 에서 확정되면 그때 enum 으로
-- 전환한다). 랩 전용 계정은 `account_status = 'test'` 로 둔다.
--
-- ## 되돌리기
--
-- 랩 전용 account 하나에 테스트 학생을 전부 매단다. 그 account 를 지우면
-- `on delete cascade` 로 세션·문제·대화·평가·기억·리포트가 함께 사라진다.
-- 다만 `event` 는 `on delete set null` 이라 행이 남는다.
--
-- enum 값은 지울 수 없다. 되돌리려면 새 마이그레이션으로 타입을 다시
-- 만들어야 하므로, 값을 늘리는 것 자체가 되돌리기 어려운 변경이다.

alter type public.student_status add value if not exists 'test';

comment on column public.student.student_status is
  'COM-002 §4. test 는 프롬프트 랩이 만든 학생이다. 집계·배치에서 제외한다.';

comment on column public.account.account_status is
  'COM-002 §3. 현재 정의된 값은 active 와 test 다. test 는 랩 전용 계정이다. '
  '탈퇴 관련 값은 COM-007 확정 후 enum으로 전환한다.';
