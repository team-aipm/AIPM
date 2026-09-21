'use client';

/**
 * 학생 등록 폼. **두 화면이 같이 쓴다**(DEV-002 §3).
 *
 * ```text
 * STU-001  첫 학생 등록   /onboarding/student        부모가 쓴다
 * MY-004   학생 추가      /parent/my/students/new    부모가 쓴다
 * ```
 *
 * 폼을 두 벌 두면 학년 검사 같은 규칙이 한쪽만 바뀐다. 달라지는 것은
 * **보낼 곳(`action`)** 뿐이라 그것만 밖에서 받는다.
 *
 * **파트너는 여기서 안 고른다.** 함께 공부할 상대를 정하는 일이라 아이가
 * 한다(COM-003 §4.2 · `STU-003`). 부모가 대신 고르면 아이는 자기가 고르지
 * 않은 상대와 시작한다.
 */

import { useActionState, useState } from 'react';
import { LOGIN_ID_PATTERN, isValidLoginId } from '@/lib/constants/student-login';
import type { IdCheck } from '@/lib/services/student-login';

export type NewStudentState = { error: string | null };

const IDLE: NewStudentState = { error: null };

const field =
  'rounded-xl border border-black/10 bg-white px-3.5 py-3 text-[15px] outline-none focus:border-meti';

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
  const [name, setName] = useState('');

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
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-meti-sub">학생 이름</span>
        <input
          name="student_name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          className={field}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-meti-sub">
          뭐라고 부를까요 <span className="font-normal">비우면 이름으로 불러요</span>
        </span>
        <input name="nickname" placeholder={name || '은재'} className={field} />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-meti-sub">생년월일</span>
        <input name="birth_date" type="date" required className={field} />
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-xs font-semibold text-meti-sub">학년</legend>
        <div className="flex gap-2">
          {[4, 5, 6].map((grade) => (
            <label
              key={grade}
              className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-black/10 bg-white py-3 text-[14px] font-semibold text-meti-ink has-checked:border-meti has-checked:bg-meti-bg"
            >
              <input
                type="radio"
                name="grade"
                value={grade}
                defaultChecked={grade === 4}
                className="sr-only"
              />
              {grade}학년
            </label>
          ))}
        </div>
        <p className="text-[11px] text-meti-sub">지금은 4~6학년만 시작할 수 있어요.</p>
      </fieldset>

      {/*
        **아이 로그인은 필수다.** 접어 두었던 것을 펼쳤다.
        부모 계정은 학생 화면에 들어가지 않으므로, 이것이 없으면 아이가
        학습을 시작할 길이 아예 없다. 접어 두면 안 채우고 지나간다.
      */}
      <fieldset className="flex flex-col gap-3 rounded-xl border border-black/10 bg-white px-3.5 py-3">
        <legend className="px-1 text-xs font-semibold text-meti-sub">
          아이가 쓸 아이디와 비밀번호
        </legend>

        <div className="flex flex-col gap-3">
          <p className="text-[12px] leading-relaxed text-meti-sub">
            아이는 이것으로 자기 기기에서 들어옵니다. 아이에게 알려주세요.
            비밀번호는 나중에 마이페이지에서 바꿀 수 있습니다.
          </p>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-meti-sub">아이 아이디</span>
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
                aria-describedby="login-id-note"
                className={`${field} min-w-0 flex-1 ${
                  status === 'taken' ? 'border-red-400' : ''
                }`}
              />
              {/* **폼을 보내는 버튼이 아니다.** type 을 안 적으면 submit 이
                  되어, 중복을 확인하려고 누른 것이 등록이 된다 */}
              <button
                type="button"
                onClick={askId}
                disabled={id === '' || asking}
                className="shrink-0 rounded-xl border border-meti px-3 text-[13px] font-bold text-meti disabled:opacity-40"
              >
                {asking ? '확인 중…' : '중복확인'}
              </button>
            </div>
            <span id="login-id-note" className="text-[11px]">
              {status === 'taken' ? (
                <b className="text-red-600">
                  이미 쓰고 있는 아이디예요. 다른 아이디로 지어주세요.
                </b>
              ) : status === 'ok' ? (
                <b className="text-emerald-700">쓸 수 있는 아이디예요.</b>
              ) : status === 'invalid' ? (
                <b className="text-red-600">
                  영문 소문자 · 숫자 · 밑줄 4~20자로 지어주세요.
                </b>
              ) : (
                <span className="text-meti-sub">
                  영문 소문자 · 숫자 · 밑줄 4~20자. 한글은 쓸 수 없어요.
                </span>
              )}
            </span>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-meti-sub">아이 비밀번호</span>
            <input
              name="login_password"
              type="password"
              minLength={6}
              autoComplete="new-password"
              required
              className={field}
            />
            <span className="text-[11px] text-meti-sub">
              6자 이상. 아이가 잊으면 마이페이지에서 바꿔주세요.
            </span>
          </label>
        </div>
      </fieldset>

      {state.error !== null && (
        <p role="alert" className="text-[13px] font-semibold text-red-600">
          {state.error}
        </p>
      )}

      {/* 겹치는 것을 알면서 누르게 두지 않는다. 확인 중일 때는 막지
          않는다 — 못 물어본 경우에도 막히면 등록할 길이 없어진다 */}
      <button
        type="submit"
        disabled={pending || status === 'taken'}
        className="rounded-xl bg-meti py-3.5 text-[15px] font-bold text-white disabled:opacity-60"
      >
        {pending ? '등록하는 중…' : submitLabel}
      </button>
    </form>
  );
}
