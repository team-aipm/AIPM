import Link from 'next/link';

import { TERMS, TERMS_ORDER, type TermsKey } from '@/lib/constants/terms';

/**
 * 약관 한 편을 공개 주소로 보여 준다.
 *
 * ## 왜 공개 주소가 필요한가
 *
 * 가입 폼의 바텀시트(`signup/_components/TermsSheet.tsx`)는 **가입하는
 * 사람만** 본다. 이미 가입한 사람이 다시 읽을 길이 없고, 밖에서 링크로
 * 걸 수도 없다.
 *
 * 당장 막고 있던 것은 구글 OAuth 다 — 동의 화면을 게시하려면 개인정보
 * 처리방침과 이용약관의 **공개 URL** 을 요구한다. 그것 말고도 동의한
 * 내용을 언제든 다시 볼 수 있어야 하는 것이 맞다.
 *
 * ## 본문은 한 곳에서만 온다
 *
 * `lib/constants/terms.ts` 를 그대로 읽는다. 여기에 문구를 옮겨 적지
 * 않는다 — 두 벌이 되면 가입 때 동의한 글과 나중에 읽는 글이 달라질 수
 * 있고, 그건 동의를 증명해야 할 때 가장 곤란한 상태다.
 *
 * `version` 을 화면에 적는 이유도 같다. `consent_log.document_version` 에
 * 남는 값과 눈으로 맞춰볼 수 있어야 한다(COM-002 §20-B).
 */
export function Document({ doc }: { doc: TermsKey }) {
  const found = TERMS[doc];

  return (
    <main className="mx-auto flex w-full max-w-[720px] flex-1 flex-col gap-6 px-5 py-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-[22px] font-bold leading-8 text-meti-ink">{found.title}</h1>
        <p className="text-[13px] leading-5 text-meti-hint">
          버전 {found.version}
          {found.required ? ' · 필수 동의' : ' · 선택 동의'}
        </p>
      </header>

      {/*
        `whitespace-pre-wrap` 으로 원문 줄바꿈을 그대로 살린다. 조문이
        「제1조 (목적)」 처럼 줄로 나뉘어 있어서, 문단으로 다시 쪼개면
        원문과 모양이 달라진다. **동의한 글과 같은 모양이어야 한다.**
      */}
      <article className="whitespace-pre-wrap text-[15px] leading-[26px] text-meti-sub">
        {found.body}
      </article>

      <nav className="mt-2 flex flex-col gap-3 border-t border-meti-line pt-6">
        <p className="text-[13px] leading-5 text-meti-hint">다른 문서</p>
        <ul className="flex flex-wrap gap-x-4 gap-y-2">
          {TERMS_ORDER.filter((key) => key !== doc).map((key) => (
            <li key={key}>
              <Link
                href={`/${key}`}
                className="text-[14px] leading-5 text-meti-ink underline underline-offset-4"
              >
                {TERMS[key].title}
              </Link>
            </li>
          ))}
        </ul>
        <Link
          href="/"
          className="mt-2 text-[14px] leading-5 text-meti-hint underline underline-offset-4"
        >
          메티 홈으로
        </Link>
      </nav>
    </main>
  );
}
