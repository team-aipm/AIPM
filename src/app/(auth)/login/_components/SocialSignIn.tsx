'use client';

/**
 * 간편 로그인 · Figma `간편 로그인` (통합 로그인 프레임 안) · 버튼은 `소셜` (2005:3983)
 *
 * ```text
 *   또는 구분선   선 — 「보호자는 간편 로그인도 할 수 있어요」 — 선
 *   버튼 둘       56px 터치 자리 안에 44px 공식 아이콘, 간격 20. Google · 카카오
 * ```
 *
 * **아이콘은 Figma 에서 받은 공식 모양 그대로다**(`public/icons/google-sign-in.svg`
 * · `kakao-sign-in.png`). 각 사 브랜드 가이드를 따라야 하는 그림이라 손으로
 * 다시 그리지 않는다. 카카오 노랑도 그 그림 안에 들어 있어 우리 토큰에
 * 넣지 않는다.
 *
 * ## 네이버가 없다
 *
 * 2026-09-28 에 뺐다 — **Supabase 가 네이버를 Provider 로 제공하지 않는다.**
 * Figma 도 버튼을 걷었다(FIGMA-MD-AUDIT P1-9). 그런데 AUDIT §0 은 저장소
 * 결정으로 「버튼은 둔다 · 기능은 만들지 않는다」 고 적었다. 자리를 되살리려면
 * 공식 아이콘이 있어야 하는데 Figma `소셜` 컴포넌트에 네이버 변형이 없어
 * 아직 두지 않았다. 손으로 그려 넣지 않는다.
 */

import Image from 'next/image';
import { useActionState } from 'react';
import { signInWithSocial, type SocialState } from '../_actions';

const EMPTY: SocialState = { error: null };

const PROVIDERS = [
  { id: 'google', icon: '/icons/google-sign-in.svg', label: 'Google로 로그인' },
  { id: 'kakao', icon: '/icons/kakao-sign-in.png', label: '카카오로 로그인' },
] as const;

export function SocialSignIn() {
  const [state, action, pending] = useActionState(signInWithSocial, EMPTY);

  return (
    <div className="flex flex-col gap-4">
      {/* 또는 구분선 — 선이 남는 폭을 나눠 갖는다 */}
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-meti-line" />
        <span className="text-[12px] leading-[18px] text-meti-hint">
          보호자는 간편 로그인도 할 수 있어요
        </span>
        <span className="h-px flex-1 bg-meti-line" />
      </div>

      <form action={action} className="flex justify-center gap-5">
        {PROVIDERS.map(({ id, icon, label }) => (
          <button
            key={id}
            type="submit"
            name="provider"
            value={id}
            aria-label={label}
            disabled={pending}
            className="flex size-[56px] items-center justify-center rounded-full disabled:opacity-60"
          >
            <Image src={icon} alt="" width={44} height={44} className="rounded-full" />
          </button>
        ))}
      </form>

      {state.error !== null && (
        <p role="alert" className="text-center text-[14px] leading-5 text-text-secondary">
          {state.error}
        </p>
      )}
    </div>
  );
}
