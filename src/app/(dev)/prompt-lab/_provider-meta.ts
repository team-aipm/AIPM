/**
 * 프로바이더 목록과 모델 후보. **클라이언트에서도 import 한다.**
 *
 * 실제 API 호출은 `_providers.ts`에 있고 그쪽은 `server-only`다.
 * 화면이 목록만 필요할 때 서버 전용 모듈을 끌어오지 않도록 분리했다.
 */

export const PROVIDERS = [
  { id: 'gemini', label: 'Gemini' },
  { id: 'openai', label: 'OpenAI' },
  { id: 'anthropic', label: 'Claude' },
] as const;

export type ProviderId = (typeof PROVIDERS)[number]['id'];

/**
 * 모델명은 화면에서 직접 입력한다. 아래는 자동완성 후보일 뿐이며,
 * 목록에 없는 이름을 넣으면 해당 API가 404를 돌려주고 화면이 그대로
 * 보여준다. 새 모델이 나와도 코드를 고칠 필요가 없다.
 */
export const MODEL_CANDIDATES: Record<ProviderId, string[]> = {
  gemini: [
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
  ],
  openai: [
    'gpt-5',
    'gpt-5-mini',
    'gpt-4.1',
    'gpt-4.1-mini',
    'gpt-4o',
    'gpt-4o-mini',
  ],
  anthropic: [
    'claude-opus-5',
    'claude-sonnet-5',
    'claude-fable-5',
    'claude-opus-4-8',
    'claude-sonnet-4-6',
    'claude-haiku-4-5',
  ],
};

export const DEFAULT_MODEL: Record<ProviderId, string> = {
  gemini: 'gemini-2.5-flash',
  openai: 'gpt-4.1-mini',
  anthropic: 'claude-sonnet-5',
};
