'use client';

/**
 * MY-003 「아이 로그인」.
 *
 * 이 화면에서만 쓰므로 route 의 `_components/` 에 둔다(DEV-001).
 * 클라이언트인 이유는 하나다 — **틀렸을 때 그 자리에서 알려주기 위해서**다.
 *
 * 아직 없으면 만드는 폼, 있으면 비밀번호를 바꾸는 폼이 나온다. 로그인
 * 이메일은 만든 뒤에 바꾸지 않는다 — 아이가 겨우 외운 것을 바꾸면 다시 못
 * 들어온다.
 *
 * 생김새는 Figma `자녀 계정 상세` 의 「비밀번호 재설정」 줄과
 * `자녀 비밀번호 재설정 / 기본 · 입력 오류 · 변경 중 · 변경 완료` 다.
 * Figma 는 따로 화면이지만 **Route 를 새로 만들지 않고** 줄을 누르면 이
 * 자리에서 펼친다(COM-003 §13-3).
 */

import Image from 'next/image';
import { useActionState, useState } from 'react';
import { Field, fieldClass } from '@/components/ui/Field';
import { BrandButton } from '@/components/ui/BrandButton';
import {
  PASSWORD_MIN,
  PASSWORD_RULE_TEXT,
  isValidPassword,
} from '@/lib/constants/student-login';
import {
  makeChildLogin,
  resetChildPassword,
  type ChildLoginState,
} from '../../../_actions';
import { ChevronRight } from '../../../_components/SettingsGroup';

const EMPTY: ChildLoginState = { error: null, done: null };

/** 흰 카드 안에 놓이는 칸이다 */
const FIELD = fieldClass('card');

const CARD = 'flex flex-col rounded-2xl border border-meti-line bg-surface-primary';

/**
 * 새 비밀번호 두 칸. **확인 칸은 화면에서만 맞춰 본다** — 서버 액션은 한
 * 칸만 받는다. 부모가 아이 비밀번호를 대신 정하는 자리라 오타를 그 자리에서
 * 잡지 못하면 아이가 못 들어간다.
 */
function PasswordPair({
  label,
  password,
  confirm,
  setPassword,
  setConfirm,
}: {
  label: string;
  password: string;
  confirm: string;
  setPassword: (v: string) => void;
  setConfirm: (v: string) => void;
}) {
  const ruleBroken = password !== '' && !isValidPassword(password);
  const mismatch = confirm !== '' && confirm !== password;

  return (
    <>
      <Field
        label={label}
        hint={PASSWORD_RULE_TEXT}
        error={ruleBroken ? PASSWORD_RULE_TEXT : null}
      >
        <input
          name="password"
          type="password"
          required
          minLength={PASSWORD_MIN}
          autoComplete="new-password"
          placeholder="비밀번호 입력"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={fieldClass('card', ruleBroken)}
        />
      </Field>
      <Field label={`${label} 확인`} error={mismatch ? '비밀번호가 일치하지 않아요.' : null}>
        <input
          type="password"
          required
          autoComplete="new-password"
          placeholder="비밀번호를 다시 입력하세요"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className={fieldClass('card', mismatch)}
        />
      </Field>
    </>
  );
}

function ServerError({ state }: { state: ChildLoginState }) {
  if (state.error === null) return null;
  return (
    <p role="alert" className="text-[14px] leading-5 text-error-text">
      {state.error}
    </p>
  );
}

/** Figma `변경 완료` — 72px 원 안의 체크 */
function Done({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-4 text-center">
      <span className="flex size-[72px] items-center justify-center rounded-full bg-surface-brand">
        <Image src="/icons/check.svg" alt="" width={18} height={13} />
      </span>
      <p className="text-[20px] font-semibold leading-7 text-text-primary">{title}</p>
      <p className="text-[16px] leading-6 text-text-secondary">{body}</p>
    </div>
  );
}

function Create({ studentId }: { studentId: string }) {
  const [state, action, pending] = useActionState(makeChildLogin, EMPTY);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const ready = isValidPassword(password) && confirm === password;

  if (state.done !== null) {
    return <Done title={state.done} body="아이는 이 이메일과 비밀번호로 자기 기기에서 들어옵니다." />;
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <p className="text-[14px] leading-5 text-meti-hint">
        아이가 자기 기기에서 들어올 수 있게 로그인 이메일과 첫 비밀번호를 정해주세요.
        로그인 이메일은 나중에 바꿀 수 없습니다.
      </p>

      <input type="hidden" name="student_id" value={studentId} />

      <Field
        label="로그인 이메일"
        hint="아이가 이미 쓰는 이메일을 넣어주세요. 아이는 이 주소로 들어옵니다."
      >
        <input
          name="login_email"
          type="email"
          required
          autoCapitalize="none"
          spellCheck={false}
          placeholder="jaeun@example.com"
          className={FIELD}
        />
      </Field>

      <PasswordPair
        label="첫 비밀번호"
        password={password}
        confirm={confirm}
        setPassword={setPassword}
        setConfirm={setConfirm}
      />

      <ServerError state={state} />

      <BrandButton pending={pending} disabled={!ready}>
        {pending ? '만드는 중' : '로그인 만들기'}
      </BrandButton>
    </form>
  );
}

function Reset({ studentId, name }: { studentId: string; name: string }) {
  const [state, action, pending] = useActionState(resetChildPassword, EMPTY);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const ready = isValidPassword(password) && confirm === password;

  if (state.done !== null) {
    return (
      <Done
        title={`${name}의 비밀번호를 바꿨어요`}
        body="자녀는 다음 로그인부터 새 비밀번호를 사용해요."
      />
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <p className="text-[14px] leading-5 text-meti-hint">
        아이 계정에는 메일로 비밀번호를 찾는 길이 없습니다. 잊었다면 여기서 새로
        정해주세요.
      </p>

      <input type="hidden" name="student_id" value={studentId} />

      <PasswordPair
        label="새 비밀번호"
        password={password}
        confirm={confirm}
        setPassword={setPassword}
        setConfirm={setConfirm}
      />

      <ServerError state={state} />

      <BrandButton pending={pending} disabled={!ready}>
        {pending ? '바꾸는 중' : '비밀번호 변경'}
      </BrandButton>
    </form>
  );
}

export function ChildLoginSection({
  studentId,
  loginEmail,
  name,
}: {
  studentId: string;
  loginEmail: string | null;
  name: string;
}) {
  // 줄을 눌러야 폼이 펼쳐진다. 상세 화면에 들어오자마자 비밀번호 칸이
  // 보이면 바꿔야 하는 것처럼 읽힌다. 로그인이 없을 때는 처음부터 편다 —
  // 없으면 아이가 들어올 방법이 없다(COM-003 §4.1).
  const [open, setOpen] = useState(loginEmail === null);

  return (
    <section className={CARD}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-14 items-center gap-2 py-1.5 pl-4 pr-3 text-left"
      >
        <span className="flex flex-1 flex-col">
          <span className="text-[14px] font-semibold leading-5 text-text-primary">
            {loginEmail === null ? '아이 로그인 만들기' : '비밀번호 재설정'}
          </span>
          <span className="text-[14px] leading-5 text-meti-hint">
            {loginEmail === null
              ? '아이가 자기 기기에서 들어올 수 있게 해요.'
              : '학생 로그인 비밀번호를 바꿔요.'}
          </span>
        </span>
        <span className={`transition-transform ${open ? 'rotate-90' : ''}`}>
          <ChevronRight size={24} />
        </span>
      </button>

      {open && (
        <div className="border-t border-meti-line p-4">
          {loginEmail === null ? (
            <Create studentId={studentId} />
          ) : (
            <Reset studentId={studentId} name={name} />
          )}
        </div>
      )}
    </section>
  );
}
