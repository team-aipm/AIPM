/**
 * prompt-lab 에서 다듬은 결과를 **코드로 옮기기 위한 내보내기**.
 *
 * 화면에서 좋은 결과를 얻어도 그대로 두면 사라진다. 복사·붙여넣기로
 * 옮기기엔 항목이 많고, 가장 값어치 있는 것(실제 입출력 사례)은 손으로
 * 남기기 너무 번거로워 결국 아무도 안 남긴다.
 *
 * 네 가지를 뽑는다.
 *
 * ```text
 * 1  파이프라인 설정   lib/ai/prompts/stages.ts 를 갈아끼울 TypeScript
 * 2  골든 케이스       회귀 테스트의 재료가 되는 실제 입출력
 * 3  검증 규칙         화면의 표를 런타임 검증 코드로
 * 4  실행 명세         단계 전이·반복·실패 처리를 적을 빈칸 표
 * ```
 *
 * 4번만 빈칸이다. **그 판단은 사람 머릿속에 있고 도구가 알 수 없다.**
 * 화면에서 [입력으로] 를 손으로 누르며 내리던 결정이라, 표만 만들어 주고
 * 채우는 건 사람이 한다.
 */

import type { Check, CheckRuleId, OutputMode } from '@/lib/ai/schema-check';
import type { CustomRules, FieldRule } from './_field-rules';
import type { MapRow } from './_mapping';
import { hasRouting, type Routing } from './_routing';
import type { Variable } from './_vars';

/** 내보내기가 필요로 하는 단계 정보. 화면 상태에서 이만큼만 뽑아 온다 */
export type ExportStage = {
  name: string;
  note: string;
  prompt: string;
  sampleInput: string;
  inputMode: OutputMode;
  outputMode: OutputMode;
  checkRule: CheckRuleId | null;
  historyKey: string;
  replyKey: string;
  useCommonPrompt: boolean;
  forceJsonMimeType: boolean;
  /** 공통 설정을 따르면 그 값이 이미 채워져 들어온다 */
  provider: string;
  model: string;
  temperature: string;
  maxTokens: string;
  topP: string;
  ownSettings: boolean;
  rules: CustomRules;
  mapping: MapRow[];
  routing: Routing;
};

/**
 * 잘 나온 한 번의 호출을 그대로 남긴 것.
 *
 * **출력 문자열을 비교하는 용도가 아니다.** LLM 은 같은 입력에도 매번
 * 다르게 답하므로 `===` 로 보면 매번 실패한다. `checks` 를 통과하는지,
 * 핵심 필드가 기대 범위인지로 본다.
 */
export type GoldenCase = {
  stage: string;
  model: string;
  params: { temperature: string; maxTokens: string; topP: string };
  /** 변수까지 치환된 systemInstruction 전문 */
  system: string;
  input: string;
  output: string;
  checks: Check[];
  /** 이 케이스가 무엇을 지키는지. 사람이 적는다 */
  note: string;
  at: string;
};

const HEAD = (title: string, lines: string[]): string =>
  ['/**', ` * ${title}`, ' *', ...lines.map((l) => ` * ${l}`), ' */'].join('\n');

/** 여러 줄 문자열을 백틱 템플릿으로. 백틱과 ${ 를 막는다 */
function backtick(text: string): string {
  return '`' + text.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${') + '`';
}

function quote(text: string): string {
  return JSON.stringify(text);
}

// ══════════════════════════════════════════════════════════════════════
// 1 · 파이프라인 설정 → TypeScript
// ══════════════════════════════════════════════════════════════════════

/**
 * `lib/ai/prompts/stages.ts` 를 그대로 갈아끼울 수 있는 파일을 만든다.
 *
 * 모델과 파라미터는 `StagePreset` 에 없는 값이라 `STAGE_RUNTIME` 으로
 * 따로 뺀다. 프리셋은 "무엇을 물을지", 런타임은 "어떻게 부를지"다.
 */
export function toStagesTs(
  stages: ExportStage[],
  commonPrompt: string,
  vars: Variable[],
): string {
  const usedVars = vars.filter((v) => v.name.trim() !== '');

  const preset = stages
    .map((stage) =>
      [
        '  {',
        `    name: ${quote(stage.name)},`,
        `    note: ${quote(stage.note)},`,
        `    prompt: ${backtick(stage.prompt)},`,
        `    sampleInput: ${backtick(stage.sampleInput)},`,
        `    inputMode: ${quote(stage.inputMode)},`,
        `    outputMode: ${quote(stage.outputMode)},`,
        `    checkRule: ${stage.checkRule === null ? 'null' : quote(stage.checkRule)},`,
        `    historyKey: ${quote(stage.historyKey)},`,
        `    replyKey: ${quote(stage.replyKey)},`,
        '  },',
      ].join('\n'),
    )
    .join('\n');

  const runtime = stages
    .map((stage) =>
      [
        '  {',
        `    name: ${quote(stage.name)},`,
        `    provider: ${quote(stage.provider)},`,
        `    model: ${quote(stage.model || '(프로바이더 기본값)')},`,
        `    temperature: ${stage.temperature === '' ? 'null' : stage.temperature},`,
        `    maxTokens: ${stage.maxTokens === '' ? 'null' : stage.maxTokens},`,
        `    topP: ${stage.topP === '' ? 'null' : stage.topP},`,
        `    forceJson: ${stage.forceJsonMimeType},`,
        `    useCommonPrompt: ${stage.useCommonPrompt},`,
        '  },',
      ].join('\n'),
    )
    .join('\n');

  return [
    HEAD('prompt-lab 에서 내보낸 파이프라인 설정', [
      `내보낸 시각: ${new Date().toISOString()}`,
      '',
      'docs/prompts/logic-auditor.md 가 Source of Truth 다. 이 파일은',
      '실행 템플릿이며, 문서를 고치면 여기도 함께 고친다.',
      '',
      '파라미터가 null 이면 그 항목을 API 로 보내지 않는다는 뜻이다.',
      '빈칸과 0 은 다르다.',
    ]),
    '',
    "import type { CheckRuleId, OutputMode } from '@/lib/ai/schema-check';",
    '',
    '/** 공통 프롬프트. useCommonPrompt 인 단계의 프롬프트 앞에 붙는다 */',
    `export const COMMON_RULES = ${backtick(commonPrompt)};`,
    '',
    ...(usedVars.length > 0
      ? [
          HEAD('프롬프트가 참조하는 변수', [
            '화면에서는 손으로 넣었다. 코드에서는 DB 에서 읽어 채운다.',
            '어디서 채울지는 사람이 정해야 한다.',
            '',
            ...usedVars.map((v) => `{{${v.name.trim()}}}  ←  ?`),
          ]),
          'export const PROMPT_VARIABLES = [',
          ...usedVars.map((v) => `  ${quote(v.name.trim())},`),
          '] as const;',
          '',
        ]
      : []),
    '/** 무엇을 물을지 */',
    'export const STAGE_PRESET: StagePreset[] = [',
    preset,
    '];',
    '',
    HEAD('어떻게 부를지', [
      'StagePreset 에 없는 값이다. 프롬프트와 호출 설정을 나눠 둔다.',
      '이름으로 STAGE_PRESET 과 짝짓는다.',
    ]),
    'export const STAGE_RUNTIME = [',
    runtime,
    '] as const;',
    '',
    'export type StagePreset = {',
    '  name: string;',
    '  note: string;',
    '  prompt: string;',
    '  sampleInput: string;',
    '  inputMode: OutputMode;',
    '  outputMode: OutputMode;',
    '  checkRule: CheckRuleId | null;',
    '  historyKey: string;',
    '  replyKey: string;',
    '};',
    '',
  ].join('\n');
}

// ══════════════════════════════════════════════════════════════════════
// 2 · 골든 케이스 → JSON
// ══════════════════════════════════════════════════════════════════════

export function toCasesJson(cases: GoldenCase[]): string {
  return JSON.stringify(
    {
      note:
        '회귀 테스트용 사례. 출력 문자열을 비교하지 말 것 — LLM 은 같은 ' +
        '입력에도 매번 다르게 답한다. checks 를 통과하는지, 핵심 필드가 ' +
        '기대 범위인지로 본다.',
      exported_at: new Date().toISOString(),
      count: cases.length,
      cases,
    },
    null,
    2,
  );
}

// ══════════════════════════════════════════════════════════════════════
// 3 · 검증 규칙 → 코드
// ══════════════════════════════════════════════════════════════════════

function ruleLiteral(rule: FieldRule): string {
  return [
    '      {',
    `        path: ${quote(rule.path.trim())},`,
    `        required: ${rule.required},`,
    `        type: ${quote(rule.type)},`,
    `        nullable: ${rule.nullable},`,
    `        allowed: ${quote(rule.allowed)},`,
    `        min: ${quote(rule.min)},`,
    `        max: ${quote(rule.max)},`,
    '      },',
  ].join('\n');
}

/**
 * 화면의 표를 그대로 코드로 옮긴다.
 *
 * 검사 로직은 `_field-rules.ts` 의 `checkFieldRules` 를 그대로 쓰면 된다.
 * 여기서 뽑는 건 **규칙 데이터**뿐이다. 로직을 두 벌 만들 이유가 없다.
 */
export function toRulesTs(stages: ExportStage[]): string {
  const withRules = stages.filter(
    (stage) =>
      stage.rules.fields.some((rule) => rule.path.trim() !== '') ||
      stage.rules.banned.trim() !== '',
  );

  if (withRules.length === 0) {
    return [
      HEAD('검증 규칙이 없다', [
        '화면의 [검증 규칙] 탭에 아무것도 적혀 있지 않다.',
        '내보낼 것이 없다.',
      ]),
      '',
    ].join('\n');
  }

  const blocks = withRules
    .map((stage) => {
      const fields = stage.rules.fields
        .filter((rule) => rule.path.trim() !== '')
        .map(ruleLiteral)
        .join('\n');
      return [
        `  ${quote(stage.name)}: {`,
        '    fields: [',
        fields,
        '    ],',
        `    banned: ${quote(stage.rules.banned)},`,
        '  },',
      ].join('\n');
    })
    .join('\n');

  return [
    HEAD('prompt-lab 에서 내보낸 검증 규칙', [
      `내보낸 시각: ${new Date().toISOString()}`,
      '',
      '검사 로직은 새로 만들지 말고 checkFieldRules 를 그대로 쓴다.',
      '여기 있는 건 규칙 데이터뿐이다.',
      '',
      '  const checks = checkFieldRules(STAGE_RULES[stageName], parsed, raw);',
      '  const failed = checks.filter((c) => c.level === "fail");',
      '',
      '최소·최대는 숫자면 값, 문자면 글자 수, 목록이면 개수다.',
      '허용값이 비어 있으면 그 항목은 검사하지 않는다.',
    ]),
    '',
    "import type { CustomRules } from '@/app/(dev)/prompt-lab/_field-rules';",
    '',
    'export const STAGE_RULES: Record<string, CustomRules> = {',
    blocks,
    '};',
    '',
  ].join('\n');
}

// ══════════════════════════════════════════════════════════════════════
// 4 · 실행 명세 → 문서 (빈칸)
// ══════════════════════════════════════════════════════════════════════

/**
 * 단계 전이·반복·실패 처리를 적을 표를 만든다.
 *
 * **빈칸은 도구가 채울 수 없다.** 화면에서 [입력으로] 를 손으로 누르며
 * 내리던 판단이라 사람 머릿속에만 있다. 단계 구성과 이미 정해진 것만
 * 채워 두고 나머지는 비워 둔다.
 *
 * 이 표가 채워지지 않으면 코드를 쓸 때 그 부분을 지어내게 된다.
 */
export function toSpecMd(stages: ExportStage[], commonPrompt: string): string {
  const rows = stages.map((stage, index) => {
    // 분기 규칙이 있으면 그게 진짜 "다음" 이다. 없을 때만 줄 순서를 쓴다.
    const next = hasRouting(stage.routing)
      ? stage.routing.rows
          .filter((row) => row.to.trim() !== '')
          .map((row) =>
            row.equals.trim() === ''
              ? `그밖 → ${row.to.trim()}`
              : `\`${stage.routing.from.trim()}\` = ${row.equals.trim()} → ${row.to.trim()}`,
          )
          .join('<br>')
      : (stages[index + 1]?.name ?? '(마지막)');
    const mapped =
      stage.mapping.length > 0
        ? stage.mapping
            .filter((row) => row.to.trim() !== '')
            .map((row) => `\`${row.to.trim()}\``)
            .join(' ')
        : stage.checkRule
          ? `프리셋 \`${stage.checkRule}\``
          : '—';
    return `| ${stage.name} | ${next} | | | ${mapped} | |`;
  });

  const varNames = new Set<string>();
  for (const stage of [...stages]) {
    for (const match of stage.prompt.matchAll(/\{\{\s*([^{}\s]+)\s*\}\}/g)) {
      varNames.add(match[1]);
    }
  }
  for (const match of commonPrompt.matchAll(/\{\{\s*([^{}\s]+)\s*\}\}/g)) {
    varNames.add(match[1]);
  }

  return [
    '# 파이프라인 실행 명세 (초안)',
    '',
    `> prompt-lab 에서 내보냄 · ${new Date().toISOString()}`,
    '> **빈칸은 도구가 채울 수 없습니다.** 화면에서 [입력으로] 를 손으로',
    '> 누르며 내리던 판단이라 사람 머릿속에만 있습니다.',
    '',
    '이 표가 채워지지 않으면 코드를 쓸 때 그 부분을 지어내게 됩니다.',
    '특히 COM-001 §19 의 금지사항을 어기기 쉽습니다 — "AI 가 정답을',
    '확신하지 못하는데 임의로 만들어 진행하지 않는다".',
    '',
    '## 1. 단계 전이',
    '',
    '| 단계 | 다음 | 반복 조건 | 종료 조건 | 다음으로 넘기는 값 | 실패 시 |',
    '|---|---|---|---|---|---|',
    ...rows,
    '',
    '**채울 때 참고**',
    '',
    '- 반복 조건 · 종료 조건 — `COM-001 §7` 은 "최대 5회, 확인된 단계는',
    '  건너뜀, 충분하면 조기 종료" 라고만 정했습니다. **출력의 어떤 값을',
    '  보고 판단할지**는 아직 없습니다',
    '- 실패 시 — `COM-001 §17` 은 "자동 재시도 · 현재 턴까지 저장 ·',
    '  [다시 해보기]/[나중에 하기]" 방향만 줍니다. **몇 번 · 몇 초 ·',
    '  검증 실패도 재시도 대상인지**는 정해야 합니다',
    '',
    '## 2. 저장 시점',
    '',
    '| 단계 | 쓰는 엔티티 | 언제 쓰나 | 중간에 끊기면 |',
    '|---|---|---|---|',
    ...stages.map((stage) => `| ${stage.name} | | | |`),
    '',
    '`COM-002` 가 엔티티를 정의하지만 **쓰기 시점**은 코드 설계입니다.',
    '`COM-001 §12` 는 "대화 턴 단위 자동 저장" 이라고 했습니다.',
    '',
    '## 3. 변수를 어디서 채우나',
    '',
    varNames.size === 0
      ? '프롬프트가 참조하는 변수가 없습니다.'
      : [
          '| 변수 | 채울 곳 |',
          '|---|---|',
          ...[...varNames].map((name) => `| \`{{${name}}}\` | |`),
        ].join('\n'),
    '',
    '화면에서는 손으로 넣었습니다. 코드에서는 DB 에서 읽어 채웁니다.',
    '',
    '## 4. 스트리밍',
    '',
    '| 단계 | 스트리밍 필요 | 필요하면 검증은 언제 |',
    '|---|---|---|',
    ...stages.map((stage) => `| ${stage.name} | | |`),
    '',
    '스트리밍하면 **JSON 이 다 오기 전에는 검증을 못 합니다.** 잘못된',
    '출력이 이미 화면에 나간 뒤가 됩니다. `DEV-002` 는 `/api/ai/chat` 을',
    '"스트리밍 필요" 로 잡아 두었습니다.',
    '',
    '## 5. 응답 시간 목표',
    '',
    '| 단계 | 지금 걸리는 시간 | 목표 |',
    '|---|---|---|',
    ...stages.map((stage) => `| ${stage.name} | | |`),
    '',
    'prompt-lab 이 호출마다 소요 시간을 보여줍니다. 그 숫자로 목표를',
    '정하면 됩니다. 아이가 기다리는 화면(03)이 특히 중요합니다.',
    '',
  ].join('\n');
}
