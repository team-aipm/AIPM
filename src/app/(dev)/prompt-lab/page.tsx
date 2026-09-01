import { notFound } from 'next/navigation';

import { hasGeminiApiKey } from '@/lib/gemini/client';
import { AIPM_PRESET } from '@/lib/ai/prompts/stages';
import { PromptLab } from './_components/PromptLab';

/**
 * 프롬프트 실험실. **개발 서버 전용 도구다. 제품 화면이 아니다.**
 *
 * 단계를 자유롭게 추가·삭제·이름 변경할 수 있는 범용 도구다.
 * 이 프로젝트의 6단계는 "프리셋"으로 들어 있을 뿐이다.
 *
 * - COM-003의 Screen ID가 없다. DEV-002의 Route 표에도 넣지 않는다.
 * - NODE_ENV가 production이면 404. 배포된 어디에서도 열리지 않는다.
 * - 화면에서 고친 프롬프트는 서버에 저장되지 않는다. 확정된 문구는 사람이
 *   docs/prompts/logic-auditor.md 에 반영하고 PR을 올린다.
 */
export const metadata = {
  title: 'Prompt Lab (dev)',
};

export default function PromptLabPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  return <PromptLab preset={AIPM_PRESET} hasEnvApiKey={hasGeminiApiKey()} />;
}
