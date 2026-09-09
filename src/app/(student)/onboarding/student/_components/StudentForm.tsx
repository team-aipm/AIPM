'use client';

import { useActionState, useState } from 'react';
import { addStudent, type NewStudentState } from '../_actions';

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
