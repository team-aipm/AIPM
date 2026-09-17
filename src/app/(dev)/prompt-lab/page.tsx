import { notFound } from 'next/navigation';

import { AIPM_PRESET } from '@/lib/ai/prompts/stages';
import { VAR_SET_PRESET } from '@/lib/ai/prompts/variables';
import { allowServerApiKey, isConfigured, isUnlocked } from './_access';
import { Gate } from './_components/Gate';
import { PromptLab } from './_components/PromptLab';

/**
 * 프롬프트 실험실. **개발 도구다. 제품 화면이 아니다.**
 *
 * 단계를 자유롭게 추가·삭제·이름 변경할 수 있는 범용 도구다.
 * 이 프로젝트의 7단계는 "프리셋"으로 들어 있을 뿐이다.
 *
 * - COM-003의 Screen ID가 없다. DEV-002의 Route 표에도 넣지 않는다.
 * - 개발 서버에서는 그냥 열린다.
 * - 배포본에서는 `PROMPT_LAB_PASSCODE` 가 있어야 열린다. 없으면 404다.
 *   (`_access.ts`)
 * - 화면에서 고친 프롬프트는 서버에 저장되지 않는다. 확정된 문구는 사람이
 *   docs/prompts/logic-auditor.md 에 반영하고 PR을 올린다.
 */
export const metadata = {
  title: 'Prompt Lab',
  // 팀 내부 도구다. 검색에 잡힐 이유가 없다.
  robots: { index: false, follow: false },
};

/**
 * 매 요청마다 렌더한다.
 *
 * 이게 없으면 빌드 시점에 결과가 구워진다. 빌드할 때 환경변수가 없으면
 * 404 페이지가 그대로 굳어서, 나중에 Vercel 에 PROMPT_LAB_PASSCODE 를
 * 넣어도 열리지 않는다. 잠금 판단과 쿠키 확인은 요청 시점에 해야 한다.
 */
export const dynamic = 'force-dynamic';

export default async function PromptLabPage() {
  if (!isConfigured()) notFound();
  if (!(await isUnlocked())) return <Gate />;

  return (
    <PromptLab
      preset={AIPM_PRESET}
      varPreset={VAR_SET_PRESET}
      hasEnvApiKey={allowServerApiKey()}
    />
  );
}
