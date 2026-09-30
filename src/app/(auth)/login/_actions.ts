'use server';

/**
 * AUTH-001 로그인.
 *
 * **부모와 아이가 같은 칸에 친다.** 둘 다 이메일이다 (정책 v0.1 §5 · §8 ·
 * 2026-09-29 개정). 전에는 `@` 가 없으면 아이 아이디로 보고 서버가 가짜
 * 이메일로 바꿨다. 「보호자용」/「학생용」 을 고르게 하지 않는 것은 그대로다
 * — 아이가 고르는 것부터 틀린다.
 *
 * 들어간 뒤 가는 곳이 다르다.
 *
 * ```text
 *   부모   /parent     학습 현황. 보호자 화면이다
 *   아이   /home       고를 것이 없다. 자기 자신이다
 * ```
 *
 * **부모는 보호자 화면으로 보낸다.** 전에는 `/students`(STU-002 학생 선택)
 * 으로 보냈는데, 거기는 학생 어휘를 쓰는 학생 영역 화면이다. 부모가
 * 로그인해서 처음 보는 것이 「누구로 시작할까?」 이면 학습 현황 · 리포트 ·
 * 학생 관리로 가는 길을 매번 한 번 더 눌러 찾아야 한다.
 *
 * 아이에게 넘겨줄 때는 보호자 화면 아래의 「학생 화면으로」 로 간다.
 */

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { endSession } from '@/lib/supabase/sign-out';
import { EVENT, recordOnce } from '@/lib/analytics/events';
import { STUDENT_COOKIE } from '@/lib/constants/student-cookie';
import {
  REMEMBER_COOKIE,
  REMEMBER_OFF,
  untilBrowserCloses,
} from '@/lib/constants/session-persistence';
import { looksLikeEmail } from '@/lib/constants/student-login';
import { studentIdOfViewer } from '@/lib/services/student-login';

export type SignInState = { error: string | null };

/** 어느 쪽이 틀렸는지 알려주지 않는다. 아래 주석 참고 */
const WRONG = '이메일이나 아이디, 또는 비밀번호가 맞지 않습니다.';

export async function signIn(
  _prev: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const typed = String(formData.get('login') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');

  if (typed === '' || password === '') {
    return { error: '이메일과 비밀번호를 모두 입력해주세요.' };
  }

  // 이메일 모양이 아니면 Auth 를 부르지 않는다. 어차피 그런 계정이 없다.
  if (!looksLikeEmail(typed)) {
    return { error: WRONG };
  }

  const email = typed;

  /**
   * **「로그인 유지」 를 세션이 생기기 전에 정해 둔다.**
   *
   * 로그인하면 그 자리에서 쿠키가 써진다. 뒤늦게 표시를 남기면 첫 쿠키만
   * 만료시각을 달고 나가고, 갱신이 한 번 돌기 전까지 브라우저를 닫아도
   * 남아 있다. 체크를 푼 사람이 기대한 것과 다르다.
   *
   * 체크박스는 안 보내면 값이 없다(꺼짐). 기본은 켜짐이다.
   */
  const remember = formData.get('remember') !== null;

  const jar = await cookies();
  if (remember) {
    jar.delete(REMEMBER_COOKIE);
  } else {
    // 만료시각을 주지 않는다 — 이 표시도 브라우저와 함께 사라져야 한다.
    jar.set(REMEMBER_COOKIE, REMEMBER_OFF, { httpOnly: true, sameSite: 'lax', path: '/' });
  }

  const supabase = await createClient({ remember });
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error !== null) {
    // **어느 쪽이 틀렸는지 알려주지 않는다.** "그런 이메일 없음" 은 가입
    // 여부를 확인해 주는 답이라, 남의 이메일을 넣어 보며 회원인지 알아낼
    // 수 있다. 아이디도 마찬가지다 — 남의 아이 아이디를 찾아낼 수 있다.
    return { error: WRONG };
  }

  const { data: me } = await supabase.auth.getUser();
  if (me.user === null) return { error: WRONG };

  const studentId = await studentIdOfViewer(supabase, me.user.id);

  if (studentId !== null) {
    /**
     * **아이가 처음 들어왔다.**
     *
     * 부모 계정이 학생 화면에 못 들어가게 되면서(COM-003 §4.2) 「등록은
     * 했는데 아이가 한 번도 안 들어옴」 이라는 이탈 지점이 새로 생겼다.
     * 그 순간은 어느 테이블에도 안 남는다 — 여기서 안 적으면 영영 없다.
     *
     * 학생마다 한 번이다. 한 계정에 아이가 여럿이면 각자 처음이 있다.
     */
    await recordOnce(supabase, EVENT.childLoginFirst, { studentId });

    // 아이다. 고를 것이 없으므로 자기 자신을 쿠키에 넣고 바로 홈으로
    // 보낸다. 홈과 미션 화면은 이 쿠키만 보므로 손댈 것이 없다.
    //
    // **「로그인 유지」 를 껐으면 이 쿠키도 같이 사라져야 한다.** 세션은
    // 끊겼는데 「지금 보고 있는 학생」 만 30일 남아 있으면 앞뒤가 안 맞는다.
    const stay = { httpOnly: true, sameSite: 'lax' as const, path: '/', maxAge: 60 * 60 * 24 * 30 };
    jar.set(STUDENT_COOKIE, studentId, remember ? stay : untilBrowserCloses(stay));
    redirect('/home');
  }

  // 부모다. 가입 순간에는 세션이 없어 남길 수 없었던 것을 여기서 남긴다.
  // **아이 로그인은 가입이 아니므로 세지 않는다** — 퍼널이 어긋난다.
  await recordOnce(supabase, EVENT.signupCompleted, { accountId: me.user.id });

  // redirect 는 예외를 던져 흐름을 끊는다. try 안에 두면 안 된다.
  redirect('/parent');
}

export async function signOut(): Promise<void> {
  await endSession();
  redirect('/login');
}

// ============================================================
// 간편 로그인 (Figma `간편 로그인` · 구글 · 카카오)
// ============================================================

export type SocialState = { error: string | null };

/**
 * **아직 실제로 들어가지지 않는다.** 누르면 이유를 알려준다.
 *
 * `signInWithOAuth` 를 부르지 않는 것은 게을러서가 아니다. 부르면 사람을
 * 구글까지 보냈다가 **에러를 들고 돌아오게** 된다. 막는 것이 셋이다.
 *
 * 막는 것이 셋이었다. **둘이 풀렸다.**
 *
 * ```text
 *   1. 자격증명    Supabase 대시보드에 Client ID/Secret 이 없다.
 *                  Secret 이라 코드나 문서에 넣지 않는다(CLAUDE.md).
 *                  → 남아 있다. 구글·카카오에서 앱을 만들어 넣어야 한다.
 *
 *   2. 네이버      Supabase 가 제공하는 Provider 목록에 없다.
 *                  → 화면에서 뺐다(2026-09-28). 붙이려면 OAuth 를 직접
 *                    구현해야 하고, 그건 별도 작업이다.
 *
 *   3. account     트리거가 account_name · phone_number · birth_date 를
 *                  요구해 신규 가입이 롤백됐다.
 *                  → **풀렸다.** 가입 폼이 그 셋을 안 받게 되면서 트리거도
 *                    필수 검사를 버렸다(20260922120000).
 * ```
 *
 * 남은 것은 1번과 **돌아오는 길**이다. OAuth 는 `?code=` 를 달고 돌아오는데
 * 그것을 세션으로 바꿀 자리가 아직 없다. `/password` 는 사람이 새 비밀번호를
 * 치는 순간에 바꾸지만, 로그인은 누를 것이 없어 같은 수를 못 쓴다.
 * DEV-002 §9 에 외부 콜백용 Route Handler 한 줄을 더하는 것이 가장 곧다 —
 * `/api/webhooks/payment` 가 이미 같은 부류로 들어 있다.
 *
 * 그때까지는 누르면 이유를 알려준다. 자격증명 없이 `signInWithOAuth` 를
 * 부르면 사람을 구글까지 보냈다가 **에러를 들고 돌아오게** 된다.
 */
export async function signInWithSocial(
  _prev: SocialState,
  formData: FormData,
): Promise<SocialState> {
  const provider = String(formData.get('provider') ?? '');
  const name = provider === 'google' ? '구글' : '카카오';

  // **잘못한 것처럼 적지 않는다.** 아직 우리가 안 만든 것이다.
  return { error: `${name} 로그인은 아직 준비 중이에요. 아이디로 들어와 주세요.` };
}
