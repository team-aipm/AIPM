import { notFound } from 'next/navigation';

import { hasGeminiApiKey } from '@/lib/gemini/client';
import { STAGES } from '@/lib/ai/prompts/stages';
import { PromptLab } from './_components/PromptLab';

/**
 * 프롬프트 실험실. **개발 서버 전용 도구다. 제품 화면이 아니다.**
 *
 * - COM-003의 Screen ID가 없다. DEV-002의 Route 표에도 넣지 않는다.
 * - NODE_ENV가 production이면 404. 배포된 어디에서도 열리지 않는다.
 * - 화면에서 고친 프롬프트는 저장되지 않는다. 확정된 문구는 사람이
 *   docs/prompts/logic-auditor.md 에 반영하고 PR을 올린다.
 */
export const metadata = {
  title: 'Prompt Lab · AIPM (dev)',
};

export default function PromptLabPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  return <PromptLab stages={STAGES} hasApiKey={hasGeminiApiKey()} />;
}
