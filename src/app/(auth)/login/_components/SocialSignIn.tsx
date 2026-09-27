'use client';

/**
 * 간편 로그인 · Figma `간편 로그인` (통합 로그인 프레임 안, order 4)
 *
 * ```text
 *   또는 구분선   선 — 「또는 간편하게 로그인」 — 선
 *   동그라미 둘   56px, 간격 20. G · K
 * ```
 *
 * **동그라미 안은 글자다.** 디자인에도 로고가 아니라 `G` · `K` 가 들어
 * 있고, 스티키에 「소셜 버튼은 추후 각 소셜에 맞춰 변경예정」 이라고 적혀
 * 있다. 진짜 로고는 각 사의 브랜드 가이드를 따라야 해서, 받기 전에 비슷한
 * 것을 그려 넣지 않는다.
 *
 * 카카오 노랑은 우리 색이 아니라 그 회사 색이라 토큰으로 만들지 않았다.
 * `globals.css` 는 메티의 색만 갖는다.
 *
 * ## 네이버를 뺐다 (2026-09-28)
 *
 * Figma 에는 `N` 이 있었지만 **Supabase 가 네이버를 Provider 로 제공하지
 * 않는다.** 구글·카카오와 달리 문서 자체가 없다. 버튼만 두면 누르는
 * 사람에게 영영 안 되는 길을 보여주는 셈이다.
 *
 * 붙이려면 OAuth 를 직접 구현해야 한다 — 그건 「소셜 버튼 하나 추가」가
 * 아니라 별도 작업이다. 하기로 정하면 그때 되살린다.
 */

import { useActionState } from 'react';
import { signInWithSocial, type SocialState } from '../_actions';

const EMPTY: SocialState = { error: null };

const CIRCLE =
  'flex size-[56px] items-center justify-center rounded-full text-[18px] font-bold leading-7';

const PROVIDERS = [
  { id: 'google', mark: 'G', label: '구글로 로그인', className: 'border border-meti-line bg-white text-meti-ink' },
  { id: 'kakao', mark: 'K', label: '카카오로 로그인', className: 'bg-[#FFC857] text-[#3E2D05]' },
] as const;

export function SocialSignIn() {
  const [state, action, pending] = useActionState(signInWithSocial, EMPTY);

  return (
    <div className="flex flex-col gap-4">
      {/* 또는 구분선 — 선이 남는 폭을 나눠 갖는다 */}
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-meti-line" />
        <span className="text-[12px] leading-[18px] text-meti-hint">또는 간편하게 로그인</span>
        <span className="h-px flex-1 bg-meti-line" />
      </div>

      <form action={action} className="flex justify-center gap-5">
        {PROVIDERS.map(({ id, mark, label, className }) => (
          <button
            key={id}
            type="submit"
            name="provider"
            value={id}
            aria-label={label}
            disabled={pending}
            className={`${CIRCLE} ${className} disabled:opacity-60`}
          >
            {mark}
          </button>
        ))}
      </form>

      {state.error !== null && (
        <p role="alert" className="text-center text-[14px] leading-5 text-meti-sub">
          {state.error}
        </p>
      )}
    </div>
  );
}
