'use server';

/**
 * AUTH-002 회원가입 · 부모 기본정보 입력 (COM-003)
 *
 * **`account` 를 직접 insert 하지 않는다.** `auth.users` 에 걸린 트리거가
 * 같은 트랜잭션에서 `public.account` 를 함께 만든다(COM-002 §20 ·
 * `20260901023250_create_account_on_auth_signup.sql`). 그래서 여기서 할 일은
 * **트리거가 기다리는 값을 `options.data` 에 실어 보내는 것**뿐이다.
 *
 * 그 셋(`account_name` · `phone_number` · `birth_date`)이 없으면 트리거가
 * 가입을 통째로 되돌린다. 대시보드의 `Add user` 로 계정이 안 만들어지던
 * 이유가 이것이다 — 그 창에는 셋을 넣을 자리가 없다.
 */

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/**
 * **이 파일에서 상수를 내보내면 안 된다.** `'use server'` 파일은 async
 * 함수만 내보낼 수 있다. 타입은 지워지므로 괜찮지만, 값은 실행할 때
 * 터진다 — 빌드는 통과한다. 처음 값은 부르는 쪽에서 만든다.
 */
export type SignUpState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  /** 확인 메일을 보냈다. 링크를 눌러야 로그인된다(DEV-003 §4-4) */
  | { status: 'sent'; email: string };

const text = (form: FormData, key: string): string =>
  String(form.get(key) ?? '').trim();

const checked = (form: FormData, key: string): boolean => form.get(key) === 'on';

export async function signUp(
  _prev: SignUpState,
  formData: FormData,
): Promise<SignUpState> {
  const email = text(formData, 'email');
  const password = String(formData.get('password') ?? '');
  const accountName = text(formData, 'account_name');
  const phoneNumber = text(formData, 'phone_number');
  const birthDate = text(formData, 'birth_date');

  if (
    email === '' ||
    password === '' ||
    accountName === '' ||
    phoneNumber === '' ||
    birthDate === ''
  ) {
    return { status: 'error', message: '빈 칸을 모두 채워주세요.' };
  }

  if (password.length < 8) {
    return { status: 'error', message: '비밀번호는 8자 이상으로 해주세요.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        account_name: accountName,
        phone_number: phoneNumber,
        birth_date: birthDate,
        marketing_email_opt_in: checked(formData, 'marketing_email_opt_in'),
        marketing_sms_opt_in: checked(formData, 'marketing_sms_opt_in'),
        marketing_alimtalk_opt_in: checked(formData, 'marketing_alimtalk_opt_in'),
      },
    },
  });

  if (error !== null) {
    return { status: 'error', message: '가입을 마치지 못했습니다. 잠시 후 다시 해주세요.' };
  }

  // 확인이 꺼진 환경이면 세션이 바로 생긴다. 그때는 곧장 들어간다.
  if (data.session !== null) redirect('/students');

  // **이미 가입된 이메일도 같은 화면을 보여준다.** Supabase 는 그 경우
  // identities 를 빈 배열로 돌려준다. "이미 가입됨" 이라고 알려주면 남의
  // 이메일을 넣어 보며 회원인지 알아낼 수 있다.
  return { status: 'sent', email };
}
