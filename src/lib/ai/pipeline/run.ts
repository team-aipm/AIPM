/**
 * 한 단계를 부른다.
 *
 * 개발 도구는 사람이 버튼을 눌러 단계를 돌린다. 제품은 학생이 말할 때마다
 * 서버가 대신 돌려야 한다. **부르는 사람만 다르고 하는 일은 같다** —
 * 프롬프트를 만들고, 모델을 부르고, JSON 으로 읽고, 다음 입력으로 옮긴다.
 *
 * 프롬프트는 `AIPM_PRESET` 에서 가져온다(`lib/ai/prompts/stages.ts`).
 * 도구에서 고친 글은 브라우저에만 있으므로 제품은 코드의 프리셋을 쓴다.
 */

import { callGemini } from '@/lib/gemini/client';
import { COMMON_RULES } from '@/lib/ai/prompts/common-rules';
import { AIPM_PRESET, type StagePreset } from '@/lib/ai/prompts/stages';
import { personaBlock } from '@/lib/ai/prompts/variables';
import { parseOutput } from '@/lib/ai/pipeline/chat';

/**
 * 제품이 쓰는 모델.
 *
 * 도구에서는 단계마다 고를 수 있지만 제품은 하나로 간다. 바꿀 일이 생기면
 * 여기 한 줄이다.
 *
 * 단가는 100만 토큰당 입력 $0.25 · 출력 $1.5 다(2026-09-01 확인).
 * `gemini-3.6-flash` 의 1/6 · 1/5 다.
 *
 * **프롬프트는 `gemini-3.6-flash` 로 다듬었다.** 같은 프롬프트라도 모델이
 * 바뀌면 지키는 정도가 달라진다 — 특히 JSON 형식과 "보기를 네 개 낸다"
 * 같은 세부 규칙이다. 이상하게 굴면 프롬프트가 아니라 이 줄을 먼저 의심한다.
 */
export const MODEL = 'gemini-3.1-flash-lite';

export type StageName =
  | '01 SESSION HOST'
  | '02 MODE A'
  | '03 MODE B'
  | '04 HINT'
  | '05 EVALUATOR'
  | '06 DAILY ANALYZER';

export type RunResult =
  | { ok: true; output: Record<string, unknown>; raw: string; elapsedMs: number }
  | { ok: false; error: string; raw: string | null; elapsedMs: number };

export function stageOf(name: StageName): StagePreset {
  const stage = AIPM_PRESET.find((s) => s.name === name);
  // 프리셋에 없는 이름을 부르는 건 코드 잘못이다. 조용히 넘어가면 화면이
  // 빈 채로 뜨고 왜 그런지 알 수 없다.
  if (stage === undefined) throw new Error(`단계를 찾지 못했습니다: ${name}`);
  return stage;
}

/**
 * 단계 하나를 돌리고 JSON 을 돌려준다.
 *
 * **던지지 않는다.** 모델은 흔하게 실패한다(과부하 · JSON 깨짐). 부르는
 * 쪽이 그 사실을 보고 재시도하거나 학생에게 다시 말해 달라고 해야 한다.
 */
export async function runStage(
  name: StageName,
  inputJson: string,
  persona: 'friend' | 'villain' = 'friend',
): Promise<RunResult> {
  const stage = stageOf(name);

  // **치환을 빠뜨리면 모델이 `{{persona_block}}` 이라는 글자를 그대로 읽는다.**
  // 말투 지시가 통째로 사라지는데 JSON 은 멀쩡히 나오므로 눈에 안 띈다.
  const prompt = stage.prompt.replaceAll('{{persona_block}}', personaBlock(persona));

  const result = await callGemini({
    model: MODEL,
    // 공통 규칙이 앞에 온다. 단계 프롬프트가 그 위에서 자기 역할만 맡는다.
    system: `${COMMON_RULES}\n\n${prompt}`,
    input: inputJson,
    forceJsonMimeType: stage.outputMode === 'json',
  });

  if (!result.ok) {
    return { ok: false, error: result.error, raw: null, elapsedMs: result.elapsed_ms };
  }

  const parsed = parseOutput(result.text);
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      ok: false,
      error: 'JSON 으로 읽지 못했습니다',
      raw: result.text,
      elapsedMs: result.elapsed_ms,
    };
  }

  return {
    ok: true,
    output: parsed as Record<string, unknown>,
    raw: result.text,
    elapsedMs: result.elapsed_ms,
  };
}
