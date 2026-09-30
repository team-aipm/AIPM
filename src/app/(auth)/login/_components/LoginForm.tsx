'use client';

/**
 * AUTH-001 로그인 카드 · Figma `로그인 / 기본 (통합)` (478:15748)
 *
 * 이 화면에서만 쓰는 폼이라 `src/components` 가 아니라 route 의
 * `_components/` 에 둔다(DEV-001).
 *
 * 클라이언트 컴포넌트인 이유는 하나다 — **틀렸을 때 그 자리에서 알려주기
 * 위해서**다. `useActionState` 가 서버가 돌려준 오류를 들고 있는다.
 *
 * **칸은 하나다.** 부모와 아이가 같은 칸에 친다. 「보호자용」/「학생용」 을
 * 고르게 하지 않는다 — COM-003 §4.1(2026-09-14).
 *
 * 코드에 있는 State 만 입혔다.
 *
 * ```text
 *   로그인 중   125:1834   칸을 잠그고 버튼이 「로그인 중」
 *   인증 오류   1:4892     비밀번호 칸이 빨개지고 그 아래 문구
 * ```
 */

import { useActionState, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { signIn, type SignInState } from '../_actions';
import { fieldClass } from '@/components/ui/Field';
import { BrandButton } from '@/components/ui/BrandButton';
import { SocialSignIn } from './SocialSignIn';

const EMPTY: SignInState = { error: null };

const LABEL = 'text-[14px] font-semibold leading-5 text-text-primary';

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, EMPTY);
  const failed = state.error !== null;

  /**
   * **React 19 는 Action 이 끝나면 폼을 비운다.**
   *
   * 비밀번호가 지워지는 것은 맞다. 하지만 **이메일과 「로그인 유지」 까지**
   * 같이 지워진다. 비밀번호 하나 틀렸을 뿐인데 이메일을 다시 치고 체크도
   * 다시 풀어야 한다 — 특히 체크는 풀어 둔 것이 조용히 켜져서, 고른 적
   * 없는 값으로 로그인된다.
   *
   * 그래서 이 둘만 React 가 들고 있게 한다. 비밀번호는 그대로 비운다.
   */
  const [login, setLogin] = useState('');
  const [remember, setRemember] = useState(true);

  /**
   * **체크박스는 상태만으로는 안 지켜진다.**
   *
   * 글자 칸은 React 가 값을 따라가 주는데 체크박스는 아니다. `reset()` 이
   * 체크를 처음 값으로 돌려놓고, React 는 자기가 들고 있는 값이 그대로라
   * 다시 그리지 않는다. 화면만 뒤집히고 아무도 모른다 — 풀어 둔 사람이
   * 다시 눌렀을 때 이미 「유지」 로 로그인된다.
   *
   * 눈으로 확인한 증상이다. 오류로 돌아올 때마다 체크가 켜져 있었다.
   * Action 이 끝날 때(`state` 가 바뀔 때) 고른 값을 다시 씌운다.
   */
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const box = formRef.current?.elements.namedItem('remember');
    if (box instanceof HTMLInputElement) box.checked = remember;
  }, [state, remember]);

  return (
    /*
      **카드는 `div` 이고 `form` 이 아니다.** Figma 의 `Login Card` 안에는
      간편 로그인 줄까지 들어 있는데, 그건 제 나름의 Action 을 갖는 또 하나의
      `form` 이다. `form` 안에 `form` 은 넣을 수 없다.

      카드와 안쪽 `form` 이 같은 12px 간격을 쓰므로 눈에 보이는 줄 간격은
      Figma 와 같다.
    */
    <div className="flex flex-col gap-3 rounded-3xl border border-meti-line bg-surface-primary p-4">
      <form ref={formRef} action={action} className="flex flex-col gap-3">
        {/*
          **입력칸은 기다리는 동안 잠근다.** Figma `로그인 / 로그인 중` 이 칸을
          흐리게 그린다. 값은 누르는 순간 FormData 로 이미 떠났으므로 잠가도
          보내는 것에는 영향이 없다.
        */}
        <fieldset disabled={pending} className="flex flex-col gap-3">
          <label className="flex flex-col gap-2">
            {/*
              Figma 는 「이메일」 이다. 아이도 이메일로 들어오게 되면서
              (정책 v0.1 §5 · §8 · 2026-09-29) 아이디를 따로 적을 까닭이 없다.

              type 은 text 다. email 로 두면 브라우저 말풍선이 우리 문구보다
              먼저 뜬다. 확인은 Action 이 한다.
            */}
            <span className={LABEL}>이메일</span>
            <input
              name="login"
              type="text"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              placeholder="이메일을 입력해 주세요"
              className={fieldClass('card')}
            />
          </label>

          {/*
            Figma `로그인 / 인증 오류` — 비밀번호 칸이 빨개지고 그 아래에 문구가
            붙는다. 어느 쪽이 틀렸는지는 말하지 않는다(`_actions.ts`).
          */}
          <label className="flex flex-col gap-2">
            <span className={LABEL}>비밀번호</span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="비밀번호를 입력해 주세요"
              aria-invalid={failed}
              aria-describedby={failed ? 'login-error' : undefined}
              className={fieldClass('card', failed)}
            />
            {failed && (
              <span id="login-error" role="alert" className="text-[14px] leading-5 text-error-text">
                {state.error}
              </span>
            )}
          </label>

          {/* Figma `로그인 유지와 비밀번호 찾기` — 44px 줄, 양끝 정렬 */}
          <div className="flex h-[44px] items-center justify-between">
            <label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg p-2">
              {/*
                **켜 두면 브라우저를 닫아도 남고, 풀면 닫을 때 같이 끝난다.**
                고른 값은 세션이 생기기 전에 표시로 남고, 토큰을 갱신하는
                미들웨어가 그 표시를 보고 쿠키 수명을 정한다
                (`lib/constants/session-persistence.ts`).

                기본은 켜짐이다 — 전까지의 동작이 그랬다. 형제가 한 대를
                같이 쓰는 경우에 풀라고 있는 스위치다.
              */}
              <input
                type="checkbox"
                name="remember"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="size-6 rounded-md accent-button-primary"
              />
              <span className="text-[16px] leading-6 text-text-primary">로그인 유지</span>
            </label>

            <Link href="/password" className="py-3 text-[14px] leading-5 text-text-secondary">
              비밀번호 찾기
            </Link>
          </div>
        </fieldset>

        <BrandButton pending={pending}>{pending ? '로그인 중' : '로그인'}</BrandButton>
      </form>

      <SocialSignIn />
    </div>
  );
}
