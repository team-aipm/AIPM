'use client';

/**
 * 자녀 계정 생성 폼 · Figma `자녀 계정 생성`
 *
 * **두 화면이 같이 쓴다**(DEV-002 §3).
 *
 * ```text
 * STU-001  첫 학생 등록   /onboarding/student        부모가 쓴다
 * MY-004   학생 추가      /parent/my/students/new    부모가 쓴다
 * ```
 *
 * 폼을 두 벌 두면 학년 검사 같은 규칙이 한쪽만 바뀐다. 달라지는 것은
 * **보낼 곳(`action`)** 뿐이라 그것만 밖에서 받는다.
 *
 * ## Figma 대로 바꾼 것 (2026-09-22)
 *
 * ```text
 *   자녀 정보    이름 또는 별명 · 학년
 *   로그인 정보  아이디 · 비밀번호 · 비밀번호 확인
 * ```
 *
 * - **생년월일 칸을 없앴다.** 디자인에 없고 쓰는 곳도 없다. 난이도는
 *   `grade` 가 정한다(COM-002 §4-2).
 * - **이름과 별명이 한 칸이 됐다.** DB 는 둘 다 `not null` 이라 같은 값을
 *   양쪽에 넣는다(`student-registration.ts`).
 * - **비밀번호 확인이 생겼다.** 부모가 아이 비밀번호를 대신 정하는 자리라
 *   오타를 그 자리에서 잡지 못하면 아이가 못 들어간다.
 * - 학년은 라디오 셋에서 **고르는 칸** 으로 바꿨다. Figma 가 펼치는 칸이다.
 *
 * **파트너는 여기서 안 고른다.** 함께 공부할 상대를 정하는 일이라 아이가
 * 한다(COM-003 §4.2 · `STU-003`). 부모가 대신 고르면 아이는 자기가 고르지
 * 않은 상대와 시작한다.
 */

import { useActionState, useState } from 'react';
import { Field, fieldClass } from '@/components/ui/Field';
import { FormSection } from '@/components/ui/FormSection';
import { BrandButton } from '@/components/ui/BrandButton';
import { LOGIN_ID_PATTERN, isValidLoginId } from '@/lib/constants/student-login';
import type { IdCheck } from '@/lib/services/student-login';

export type NewStudentState = { error: string | null };

const IDLE: NewStudentState = { error: null };

/** 칸이 옅은 화면 바탕 위에 바로 놓인다 — 카드가 없다 */
const FIELD = fieldClass('page');

export function StudentForm({
  action,
  checkId,
  submitLabel,
}: {
  action: (prev: NewStudentState, formData: FormData) => Promise<NewStudentState>;
  /** 아이디를 쓸 수 있는지 묻는다. 부모 세션인지는 저쪽에서 본다 */
  checkId: (loginId: string) => Promise<IdCheck>;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, IDLE);

  /**
   * 아이디가 겹치는가. **누르면 본다.**
   *
   * 치는 동안 자동으로 묻게 했다가 되돌렸다. 「중복확인」 버튼이 우리가
   * 아는 방식이고, 부모가 누르기 전까지 서버를 부르지 않는다.
   */
  const [loginId, setLoginId] = useState('');
  /** 확인한 결과. **어느 아이디에 대한 답인지 함께 들고 있는다** */
  const [answer, setAnswer] = useState<{ id: string; got: IdCheck } | null>(null);
  const [asking, setAsking] = useState(false);

  const id = loginId.trim().toLowerCase();

  /**
   * 지금 칸에 적힌 아이디의 답. **렌더에서 셈한다.**
   *
   * 답을 아이디와 함께 들고 있으므로 그새 글자가 바뀌었으면 답이 사라진다.
   * 이게 없으면 확인해 놓고 다른 아이디로 고쳤는데 「쓸 수 있어요」가
   * 그대로 남는다.
   */
  const status: IdCheck | null = answer !== null && answer.id === id ? answer.got : null;

  async function askId() {
    if (id === '' || asking) return;

    // 글자 수가 안 맞는 것은 서버까지 안 간다. 물어볼 것도 없다.
    if (!isValidLoginId(id)) {
      setAnswer({ id, got: 'invalid' });
      return;
    }

    setAsking(true);
    try {
      setAnswer({ id, got: await checkId(id) });
    } catch {
      // 못 물어봤으면 아무 말도 안 한다. 누를 때 어차피 걸린다.
    } finally {
      setAsking(false);
    }
  }

  return (
    <form action={formAction} className="flex flex-col gap-7">
      <FormSection title="자녀 정보">
        <Field label="이름 또는 별명">
          {/*
            **한 칸이 DB 두 칸으로 간다.** `student_name` 과 `nickname` 이
            둘 다 `not null` 이라 같은 값을 넣고, 무엇을 기본으로 썼는지
            `nickname_source` 에 남긴다(COM-002 §4-2).
          */}
          <input name="student_name" required placeholder="은재" className={FIELD} />
        </Field>

        <Field label="학년" htmlFor="grade" hint="지금은 4~6학년만 시작할 수 있어요.">
          {/*
            **고르는 칸을 쓴다.** Figma 가 펼치는 칸이고, 기기가 제 방식대로
            열어 준다 — 화살표도 기기 것이라 아이콘 파일이 필요 없다.
          */}
          <select id="grade" name="grade" defaultValue="4" className={FIELD}>
            {[4, 5, 6].map((grade) => (
              <option key={grade} value={grade}>
                {grade}학년
              </option>
            ))}
          </select>
        </Field>
      </FormSection>

      <FormSection title="로그인 정보">
        <Field
          label="아이디"
          error={
            status === 'taken'
              ? '이미 쓰고 있는 아이디예요. 다른 아이디로 지어주세요.'
              : status === 'invalid'
                ? '영문 소문자 · 숫자 · 밑줄 4~20자로 지어주세요.'
                : null
          }
          hint={
            status === 'ok' ? (
              <b className="text-meti">쓸 수 있는 아이디예요.</b>
            ) : (
              '영문 소문자 · 숫자 · 밑줄 4~20자. 한글은 쓸 수 없어요.'
            )
          }
        >
          <div className="flex gap-2">
            <input
              name="login_id"
              type="text"
              value={loginId}
              onChange={(event) => setLoginId(event.target.value)}
              autoCapitalize="none"
              spellCheck={false}
              pattern={LOGIN_ID_PATTERN.source}
              placeholder="jaeun2016"
              required
              className={`${fieldClass('page', status === 'taken' || status === 'invalid')} min-w-0 flex-1`}
            />
            {/* **폼을 보내는 버튼이 아니다.** type 을 안 적으면 submit 이
                되어, 중복을 확인하려고 누른 것이 등록이 된다 */}
            <button
              type="button"
              onClick={askId}
              disabled={id === '' || asking}
              className="h-[52px] shrink-0 rounded-lg border border-meti px-4 text-[14px] font-semibold text-meti disabled:border-meti-line disabled:text-meti-off"
            >
              {asking ? '확인 중' : '중복확인'}
            </button>
          </div>
        </Field>

        <Field label="비밀번호" hint="6자 이상. 아이가 잊으면 마이페이지에서 바꿔주세요.">
          <input
            name="login_password"
            type="password"
            minLength={6}
            autoComplete="new-password"
            required
            placeholder="비밀번호 입력"
            className={FIELD}
          />
        </Field>

        <Field label="비밀번호 확인">
          <input
            name="login_password_confirm"
            type="password"
            autoComplete="new-password"
            required
            placeholder="비밀번호를 다시 입력하세요"
            className={FIELD}
          />
        </Field>
      </FormSection>

      <p className="text-[14px] leading-5 text-meti-sub">
        아이는 이 아이디와 비밀번호로 자기 기기에서 들어옵니다. 아이에게 알려주세요.
      </p>

      {state.error !== null && (
        <p role="alert" className="text-[14px] leading-5 text-red-500">
          {state.error}
        </p>
      )}

      {/* 겹치는 것을 알면서 누르게 두지 않는다. 확인 중일 때는 막지
          않는다 — 못 물어본 경우에도 막히면 등록할 길이 없어진다 */}
      <BrandButton pending={pending} disabled={status === 'taken'}>
        {pending ? '계정 만드는 중' : submitLabel}
      </BrandButton>
    </form>
  );
}
