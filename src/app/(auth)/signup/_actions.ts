'use server';

/**
 * AUTH-002 회원가입 · Figma `부모 / 회원가입`
 *
 * **받는 것은 넷뿐이다** — 이메일 · 비밀번호 · 비밀번호 확인 · 동의 4종.
 * 이름 · 휴대폰 · 생년월일은 2026-09-22 에 뺐다(COM-002 §3-1). 디자인에
 * 그 칸이 없고, 트리거가 그 셋을 요구하는 바람에 디자인대로 만들면 가입이
 * 통째로 롤백되던 문제가 있었다.
 *
 * **`account` 도 `consent_log` 도 직접 insert 하지 않는다.** `auth.users`
 * 에 걸린 트리거가 같은 트랜잭션에서 셋을 함께 만든다(COM-002 §20 ·
 * `20260922120000_allow_null_account_profile_fields.sql`). 앱에서 나눠
 * 넣으면 **동의 없이 가입된 계정** 이 남을 수 있고, 그건 COM-007 이
 * 허용하지 않는 상태다.
 *
 * 그래서 여기서 할 일은 **트리거가 기다리는 값을 `options.data` 에 실어
 * 보내는 것** 뿐이다.
 */

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { REQUIRED_TERMS, TERMS, TERMS_ORDER, type TermsKey } from '@/lib/constants/terms';

/**
 * **이 파일에서 상수를 내보내면 안 된다.** `'use server'` 파일은 async
 * 함수만 내보낼 수 있다. 타입은 지워지므로 괜찮지만, 값은 실행할 때
 * 터진다 — 빌드는 통과한다. 처음 값은 부르는 쪽에서 만든다.
 */
export type SignUpState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  /** 이미 가입된 이메일. 화면이 「로그인하기」 를 내민다 */
  | { status: 'taken' }
  /** 확인 메일을 보냈다. 링크를 눌러야 로그인된다(DEV-003 §4-4) */
  | { status: 'sent'; email: string }
  /** 확인이 꺼져 있어 곧바로 세션이 생겼다. Figma `가입이 끝났어요` */
  | { status: 'done' };

const EMAIL = /^[^\s@]+@[^\s@.]+\.[^\s@]+$/;

export async function signUp(
  _prev: SignUpState,
  formData: FormData,
): Promise<SignUpState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('password_confirm') ?? '');

  if (email === '') {
    return { status: 'error', message: '가입에 사용하실 이메일 주소를 입력해 주세요.' };
  }

  if (!EMAIL.test(email)) {
    return { status: 'error', message: '이메일 형식이 올바르지 않아요. 다시 확인해 주세요.' };
  }

  if (password === '' || confirm === '') {
    return { status: 'error', message: '비밀번호를 두 칸 모두 입력해 주세요.' };
  }

  if (password.length < 8) {
    return { status: 'error', message: '비밀번호는 8자 이상으로 해주세요.' };
  }

  if (password !== confirm) {
    return { status: 'error', message: '비밀번호가 일치하지 않아요. 다시 입력해 주세요.' };
  }

  const agreed = new Set(
    TERMS_ORDER.filter((key) => formData.get(`agree_${key}`) !== null),
  );

  if (REQUIRED_TERMS.some((key) => !agreed.has(key))) {
    return { status: 'error', message: '필수 항목에 모두 동의해 주세요.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: metadataFor(agreed) },
  });

  if (error !== null) {
    return { status: 'error', message: '가입을 마치지 못했습니다. 잠시 후 다시 해주세요.' };
  }

  /**
   * **이미 가입된 이메일인지 알려준다.** Supabase 는 그 경우 `identities`
   * 를 빈 배열로 돌려준다.
   *
   * 전까지는 알려주지 않았다 — 남의 이메일을 넣어 보며 회원인지 알아낼 수
   * 있기 때문이다. Figma 가 「이미 가입된 이메일이에요. 로그인해 주세요.」
   * 를 그리면서 그 판단이 뒤집혔다.
   *
   * **로그인 화면은 여전히 알려주지 않는다**(`login/_actions.ts`). 그쪽은
   * 아이 아이디까지 섞여 있어 새는 범위가 다르다.
   */
  if ((data.user?.identities ?? []).length === 0) {
    return { status: 'taken' };
  }

  // 확인이 꺼진 환경이면 세션이 바로 생긴다(DEV-003 §4-4).
  // Figma 는 그때 「가입이 끝났어요」 를 보여주고 자녀 계정 만들기로 잇는다.
  if (data.session !== null) return { status: 'done' };

  return { status: 'sent', email };
}

/**
 * 트리거가 읽는 값.
 *
 * 마케팅은 화면에서 한 줄인데 COM-002 §3 은 셋을 갖는다. 같은 값으로 셋을
 * 채우고, 수단별로 끄는 것은 `MY` 에서 하게 둔다(`/parent/my/marketing`).
 *
 * **거절도 함께 보낸다.** `consent_log` 는 철회도 행으로 남긴다
 * (COM-002 §20-B) — 동의하지 않았다는 사실 자체가 증명해야 할 것이다.
 */
function metadataFor(agreed: Set<TermsKey>) {
  const marketing = agreed.has('marketing');

  return {
    marketing_email_opt_in: marketing,
    marketing_sms_opt_in: marketing,
    marketing_alimtalk_opt_in: marketing,
    consents: TERMS_ORDER.flatMap((key) =>
      TERMS[key].consentTypes.map((consent_type) => ({
        consent_type,
        document_version: TERMS[key].version,
        agreed: agreed.has(key),
      })),
    ),
  };
}

/** Figma `가입이 끝났어요` 의 「자녀 계정 만들기」 (DEV-002 §2 흐름) */
export async function goToFirstStudent(): Promise<void> {
  redirect('/onboarding/student');
}
