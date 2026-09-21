import { notFound } from 'next/navigation';

import { hasGeminiApiKey } from '@/lib/gemini/client';
import { AIPM_PRESET } from '@/lib/ai/prompts/stages';
import { VAR_SET_PRESET } from '@/lib/ai/prompts/variables';
import { allowServerApiKey, isUnlocked } from './_access';
import { PromptLab } from './_components/PromptLab';

/**
 * 프롬프트 실험실. **개발 도구다. 제품 화면이 아니다.**
 *
 * 단계를 자유롭게 추가·삭제·이름 변경할 수 있는 범용 도구다.
 * 이 프로젝트의 7단계는 "프리셋"으로 들어 있을 뿐이다.
 *
 * - COM-003의 Screen ID가 없다. DEV-002의 Route 표에도 넣지 않는다.
 * - 개발 서버에서는 그냥 열린다.
 * - 배포본에서는 **운영자만** 열린다(`admin_user`). 아니면 404다.
 *   어드민 왼쪽 메뉴의 「프롬프트랩」으로 들어온다 (`_access.ts`)
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
 * 이게 없으면 빌드 시점에 결과가 구워진다. 누가 보고 있는지는 요청마다
 * 다르므로 404 인지 아닌지를 빌드 때 정할 수 없다.
 */
export const dynamic = 'force-dynamic';

export default async function PromptLabPage() {
  // 운영자가 아니면 없는 화면처럼 군다. 암호를 묻지 않는다.
  if (!(await isUnlocked())) notFound();

  return (
    <PromptLab
      preset={AIPM_PRESET}
      varPreset={VAR_SET_PRESET}
      hasEnvApiKey={allowServerApiKey() && hasGeminiApiKey()}
    />
  );
}
