'use client';

import { useActionState, useState } from 'react';
import { addStudent, type NewStudentState } from '../_actions';
import { LOGIN_ID_PATTERN } from '@/lib/constants/student-login';

const IDLE: NewStudentState = { error: null };

const field =
  'rounded-xl border border-black/10 bg-white px-3.5 py-3 text-[15px] outline-none focus:border-meti';

export function StudentForm() {
  const [state, action, pending] = useActionState(addStudent, IDLE);
  const [name, setName] = useState('');

  return (
    <form action={action} className="flex flex-col gap-4">
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
        아이 로그인은 **선택**이다. 접어 두는 이유가 있다 — 등록을 마치는 데
        꼭 필요한 것처럼 보이면 부모가 여기서 멈춘다. 열어야 나온다.
      */}
      <details className="rounded-xl border border-black/10 bg-white px-3.5 py-3">
        <summary className="cursor-pointer text-xs font-semibold text-meti-sub">
          아이가 직접 로그인하게 하기 <span className="font-normal">선택</span>
        </summary>

        <div className="mt-3 flex flex-col gap-3">
          <p className="text-[12px] leading-relaxed text-meti-sub">
            아이디와 비밀번호를 정해주면 아이가 자기 기기에서 들어올 수 있어요.
            지금 비워두어도 나중에 마이페이지에서 만들 수 있습니다.
          </p>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-meti-sub">아이 아이디</span>
            <input
              name="login_id"
              type="text"
              autoCapitalize="none"
              spellCheck={false}
              pattern={LOGIN_ID_PATTERN.source}
              placeholder="jaeun2016"
              className={field}
            />
            <span className="text-[11px] text-meti-sub">
              영문 소문자 · 숫자 · 밑줄 4~20자. 한글은 쓸 수 없어요.
            </span>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-meti-sub">아이 비밀번호</span>
            <input
              name="login_password"
              type="password"
              minLength={6}
              autoComplete="new-password"
              className={field}
            />
            <span className="text-[11px] text-meti-sub">
              6자 이상. 아이가 잊으면 마이페이지에서 바꿔주세요.
            </span>
          </label>
        </div>
      </details>

      {state.error !== null && (
        <p role="alert" className="text-[13px] font-semibold text-red-600">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-meti py-3.5 text-[15px] font-bold text-white disabled:opacity-60"
      >
        {pending ? '등록하는 중…' : '다음'}
      </button>
    </form>
  );
}
