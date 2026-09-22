'use client';

/**
 * AUTH-001 로그인 카드 · Figma `통합 로그인 / 부모님`
 *
 * 이 화면에서만 쓰는 폼이라 `src/components` 가 아니라 route 의
 * `_components/` 에 둔다(DEV-001).
 *
 * 클라이언트 컴포넌트인 이유는 하나다 — **틀렸을 때 그 자리에서 알려주기
 * 위해서**다. `useActionState` 가 서버가 돌려준 오류를 들고 있는다.
 *
 * **칸은 하나다.** Figma 에는 `부모님` · `학생` 두 프레임이 있지만, 같은
 * 페이지 스티키 메모가 「부모/자녀 각각 계정이있기 때문에 로그인창에서
 * 부모학생 선택할 필요 X, 로그인창 하나로 변경해야함」 이라고 적어 뒀다.
 * COM-003 §4.1(2026-09-14) 과 같은 결론이다. 그래서 생김새는 `부모님`
 * 프레임을 따르고, 칸 이름만 아이도 읽을 수 있게 둔다.
 */

import { useActionState, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { signIn, type SignInState } from '../_actions';
import { fieldClass } from '@/components/ui/Field';
import { BrandButton } from '@/components/ui/BrandButton';
import { SocialSignIn } from './SocialSignIn';

const EMPTY: SignInState = { error: null };

/** 흰 카드 위에 올라가므로 칸이 살짝 어둡다 (`components/ui/Field.tsx`) */
const FIELD = fieldClass('card');

const LABEL = 'text-[14px] font-semibold leading-5 text-meti-ink';

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, EMPTY);

  /**
   * **React 19 는 Action 이 끝나면 폼을 비운다.**
   *
   * 비밀번호가 지워지는 것은 맞다. 하지만 **아이디와 「로그인 유지」 까지**
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
    <div className="flex flex-col gap-3 rounded-3xl border border-meti-line bg-white p-4">
      <form ref={formRef} action={action} className="flex flex-col gap-3">
        <label className="flex flex-col gap-2">
          {/*
            Figma 는 「이메일」 이다. 부모 전용 프레임이라 그렇다.

            합친 칸에는 아이의 아이디도 들어온다. 아이가 자기 아이디를 들고
            와서 「이메일」 이라고만 적힌 칸을 보면 여기가 자기 자리인지
            모른다. `_actions.ts` 는 `@` 로 둘을 가른다.
          */}
          <span className={LABEL}>아이디 또는 이메일</span>
          {/*
            type 은 text 다. email 로 두면 브라우저가 아이의 아이디를
            "@ 가 없다" 며 막는다.
          */}
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
            placeholder="이메일 또는 아이디를 입력해 주세요"
            className={FIELD}
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className={LABEL}>비밀번호</span>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="비밀번호를 입력해 주세요"
            className={FIELD}
          />
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
              className="size-6 rounded-md accent-meti"
            />
            <span className="text-[16px] leading-6 text-meti-ink">로그인 유지</span>
          </label>

          <Link href="/password" className="text-[14px] leading-5 text-meti-sub">
            비밀번호 찾기
          </Link>
        </div>

        {state.error !== null && (
          <p role="alert" className="text-[14px] leading-5 text-red-500">
            {state.error}
          </p>
        )}

        <BrandButton pending={pending}>{pending ? '들어가는 중' : '로그인'}</BrandButton>
      </form>

      <SocialSignIn />
    </div>
  );
}
