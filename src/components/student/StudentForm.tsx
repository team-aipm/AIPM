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
 *   자녀 정보    자녀 이름 · 학년   (2026-09-30 Figma 라벨이 「자녀 이름」)
 *   로그인 정보  로그인 이메일 · 비밀번호 · 비밀번호 확인
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
import {
  PASSWORD_MIN,
  PASSWORD_RULE_TEXT,
  isValidPassword,
  looksLikeEmail,
} from '@/lib/constants/student-login';
import type { IdCheck } from '@/lib/services/student-login';

export type NewStudentState = { error: string | null };

const IDLE: NewStudentState = { error: null };

/** 칸이 옅은 화면 바탕 위에 바로 놓인다 — 카드가 없다 */
const FIELD = fieldClass('page');

export function StudentForm({
  action,
  checkEmail,
  submitLabel,
}: {
  action: (prev: NewStudentState, formData: FormData) => Promise<NewStudentState>;
  /** 이 이메일을 쓸 수 있는지 묻는다. 부모 세션인지는 저쪽에서 본다 */
  checkEmail: (loginEmail: string) => Promise<IdCheck>;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, IDLE);

  /**
   * 아이디가 겹치는가. **누르면 본다.**
   *
   * 치는 동안 자동으로 묻게 했다가 되돌렸다. 「중복확인」 버튼이 우리가
   * 아는 방식이고, 부모가 누르기 전까지 서버를 부르지 않는다.
   */
  const [loginEmail, setLoginEmail] = useState('');
  /** 확인한 결과. **어느 아이디에 대한 답인지 함께 들고 있는다** */
  const [answer, setAnswer] = useState<{ id: string; got: IdCheck } | null>(null);
  const [asking, setAsking] = useState(false);

  const id = loginEmail.trim().toLowerCase();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const ruleBroken = password !== '' && !isValidPassword(password);
  const mismatch = confirm !== '' && confirm !== password;

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

    // 이메일 모양이 아닌 것은 서버까지 안 간다. 물어볼 것도 없다.
    if (!looksLikeEmail(id)) {
      setAnswer({ id, got: 'invalid' });
      return;
    }

    setAsking(true);
    try {
      setAnswer({ id, got: await checkEmail(id) });
    } catch {
      // 못 물어봤으면 아무 말도 안 한다. 누를 때 어차피 걸린다.
    } finally {
      setAsking(false);
    }
  }

  return (
    <form action={formAction} className="flex flex-col gap-7">
      <FormSection title="자녀 정보">
        <Field label="자녀 이름">
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
                초등 {grade}학년
              </option>
            ))}
          </select>
        </Field>
      </FormSection>

      <FormSection title="로그인 정보">
        <Field
          label="로그인 이메일"
          error={
            status === 'taken'
              ? '이미 메티에 가입된 이메일이에요. 다른 이메일을 입력해 주세요.'
              : status === 'invalid'
                ? '이메일 주소 형식을 확인해 주세요.'
                : null
          }
          hint={
            status === 'ok' ? (
              <b className="font-semibold text-button-primary">쓸 수 있는 이메일이에요.</b>
            ) : (
              '아이가 이미 쓰는 이메일을 넣어주세요. 아이는 이 주소로 들어옵니다.'
            )
          }
        >
          <div className="flex gap-2">
            <input
              name="login_email"
              type="email"
              value={loginEmail}
              onChange={(event) => setLoginEmail(event.target.value)}
              autoCapitalize="none"
              spellCheck={false}
              placeholder="jaeun@example.com"
              required
              className={`${fieldClass('page', status === 'taken' || status === 'invalid')} min-w-0 flex-1`}
            />
            {/* **폼을 보내는 버튼이 아니다.** type 을 안 적으면 submit 이
                되어, 중복을 확인하려고 누른 것이 등록이 된다 */}
            <button
              type="button"
              onClick={askId}
              disabled={id === '' || asking}
              className="h-[52px] shrink-0 rounded-lg border border-button-primary bg-surface-primary px-4 text-[14px] font-semibold leading-5 text-button-primary disabled:border-meti-line disabled:bg-background-primary disabled:text-disabled-text"
            >
              {asking ? '확인 중' : '중복확인'}
            </button>
          </div>
        </Field>

        {/*
          규칙 · 일치는 **치는 동안 화면에서 먼저 본다**(Figma `비밀번호 설정 /
          규칙 위반 · 확인 불일치`). 서버도 같은 규칙으로 다시 본다.
        */}
        <Field
          label="비밀번호"
          error={ruleBroken ? PASSWORD_RULE_TEXT : null}
          hint={`${PASSWORD_RULE_TEXT} 아이가 잊으면 마이페이지에서 바꿔주세요.`}
        >
          <input
            name="login_password"
            type="password"
            minLength={PASSWORD_MIN}
            autoComplete="new-password"
            required
            placeholder="비밀번호 입력"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={fieldClass('page', ruleBroken)}
          />
        </Field>

        <Field label="비밀번호 확인" error={mismatch ? '비밀번호가 일치하지 않아요.' : null}>
          <input
            name="login_password_confirm"
            type="password"
            autoComplete="new-password"
            required
            placeholder="비밀번호를 다시 입력하세요"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            className={fieldClass('page', mismatch)}
          />
        </Field>
      </FormSection>

      <p className="text-[14px] leading-5 text-text-secondary">
        아이는 이 이메일과 비밀번호로 자기 기기에서 들어옵니다. 아이에게 알려주세요.
      </p>

      {state.error !== null && (
        <p role="alert" className="text-[14px] leading-5 text-error-text">
          {state.error}
        </p>
      )}

      {/* 겹치는 것을 알면서 누르게 두지 않는다. 확인 중일 때는 막지
          않는다 — 못 물어본 경우에도 막히면 등록할 길이 없어진다 */}
      <BrandButton pending={pending} disabled={status === 'taken' || ruleBroken || mismatch}>
        {pending ? '계정 만드는 중' : submitLabel}
      </BrandButton>
    </form>
  );
}
