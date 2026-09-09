/**
 * 사용자가 화면에서 직접 만드는 검증 규칙.
 *
 * `lib/ai/schema-check.ts` 의 AIPM 규칙은 이 프로젝트 전용이라 다른
 * 프로젝트에서는 쓸 수 없다. 이 파일은 **어느 프로젝트에서든** 쓰도록
 * 필드 단위 규칙을 표로 받아 검사한다.
 *
 * 잡으려는 것은 LLM 파이프라인의 단골 실패다.
 *
 * ```text
 * enum 을 대문자로 냈다            허용값
 * 필드가 통째로 빠졌다              필수
 * "없음"을 null 이 아니라 0 으로 냈다  타입 + null 허용
 * 점수가 범위를 벗어났다             최소 / 최대
 * 학생에게 보이면 안 되는 말이 섞였다   금지어
 * ```
 *
 * AIPM 규칙과 **함께** 돌아간다. 하나를 고르면 다른 하나를 못 쓰는
 * 구조가 아니다.
 */

import type { Check } from '@/lib/ai/schema-check';
import { getPath, parsePath, preview } from '@/lib/ai/pipeline/paths';

export type FieldType =
  | 'any'
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'array'
  | 'object';

export const FIELD_TYPES: { id: FieldType; label: string }[] = [
  { id: 'any', label: '아무거나' },
  { id: 'string', label: '문자' },
  { id: 'number', label: '숫자' },
  { id: 'integer', label: '정수' },
  { id: 'boolean', label: '참/거짓' },
  { id: 'array', label: '목록' },
  { id: 'object', label: '객체' },
];

export type FieldRule = {
  /** 점 표기 경로. `logic_gaps[].gap_type` 처럼 배열 전체도 된다 */
  path: string;
  required: boolean;
  type: FieldType;
  /** null 을 허용할지. 켜면 값이 null 이어도 타입 검사를 건너뛴다 */
  nullable: boolean;
  /** 쉼표로 나눈 허용값. 비우면 검사하지 않는다 */
  allowed: string;
  /** 숫자면 값, 문자면 글자 수, 목록이면 개수. 비우면 검사하지 않는다 */
  min: string;
  max: string;
};

export type CustomRules = {
  fields: FieldRule[];
  /** 쉼표로 나눈 금지어. 출력 원문 전체에서 대소문자 무시하고 찾는다 */
  banned: string;
};

export const EMPTY_RULES: CustomRules = { fields: [], banned: '' };

export const BLANK_FIELD_RULE: FieldRule = {
  path: '',
  required: true,
  type: 'any',
  nullable: false,
  allowed: '',
  min: '',
  max: '',
};

/** 규칙이 하나라도 채워져 있는지. 비어 있으면 검사를 돌리지 않는다 */
export function hasRules(rules: CustomRules): boolean {
  return (
    rules.banned.trim() !== '' ||
    rules.fields.some((rule) => rule.path.trim() !== '')
  );
}

/**
 * 규칙을 돌린다.
 *
 * `parsed` 가 null 이면(= JSON 이 아니면) 필드 검사는 건너뛰고 금지어만
 * 본다. 평문 단계에서도 금지어는 의미가 있기 때문이다.
 */
export function checkFieldRules(
  rules: CustomRules,
  parsed: unknown,
  raw: string,
): Check[] {
  const checks: Check[] = [];

  for (const rule of rules.fields) {
    const path = rule.path.trim();
    if (path === '') continue;
    if (parsed === null || parsed === undefined) continue;

    const segments = parsePath(path);
    if (segments === null) {
      checks.push({ label: path, level: 'warn', detail: '경로 형식이 올바르지 않습니다.' });
      continue;
    }

    const found = getPath(parsed, segments);
    if (!found.exists) {
      checks.push(
        rule.required
          ? { label: path, level: 'fail', detail: '필수인데 없습니다.' }
          : { label: path, level: 'pass', detail: '없음 (선택)' },
      );
      continue;
    }

    // `[]` 로 여러 값을 잡았으면 하나씩 본다. 하나라도 틀리면 실패다.
    const values = path.includes('[]') && Array.isArray(found.value) ? found.value : [found.value];
    const problems: string[] = [];

    values.forEach((value, index) => {
      const where = values.length > 1 ? `[${index}] ` : '';
      for (const message of checkValue(rule, value)) problems.push(`${where}${message}`);
    });

    checks.push(
      problems.length === 0
        ? { label: path, level: 'pass', detail: preview(found.value) }
        : { label: path, level: 'fail', detail: problems.join(' / ') },
    );
  }

  const banned = splitList(rules.banned);
  if (banned.length > 0) {
    const lower = raw.toLowerCase();
    const hit = banned.filter((word) => lower.includes(word.toLowerCase()));
    checks.push(
      hit.length === 0
        ? { label: '금지어', level: 'pass', detail: `${banned.length}개 확인` }
        : { label: '금지어', level: 'fail', detail: `${hit.join(', ')} 가 들어 있습니다.` },
    );
  }

  return checks;
}

/** 값 하나를 규칙에 비춰 본다. 문제가 없으면 빈 배열. */
function checkValue(rule: FieldRule, value: unknown): string[] {
  const problems: string[] = [];

  if (value === null) {
    if (!rule.nullable) problems.push('null 인데 null 을 허용하지 않습니다.');
    return problems;
  }

  const actual = typeOf(value);
  if (rule.type !== 'any') {
    const ok =
      rule.type === 'integer'
        ? typeof value === 'number' && Number.isInteger(value)
        : rule.type === actual;
    if (!ok) problems.push(`${labelOf(rule.type)}이어야 하는데 ${labelOf(actual)}입니다.`);
  }

  const allowed = splitList(rule.allowed);
  if (allowed.length > 0) {
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    if (!allowed.includes(text)) {
      problems.push(`허용값이 아닙니다: ${preview(value, 20)}`);
    }
  }

  // 숫자는 값, 문자는 글자 수, 목록은 개수를 잰다.
  const size = sizeOf(value);
  if (size !== null) {
    const min = toNumber(rule.min);
    const max = toNumber(rule.max);
    const unit = typeof value === 'number' ? '' : typeof value === 'string' ? '자' : '개';
    if (min !== null && size < min) problems.push(`${min}${unit} 이상이어야 합니다 (${size}${unit}).`);
    if (max !== null && size > max) problems.push(`${max}${unit} 이하여야 합니다 (${size}${unit}).`);
  }

  return problems;
}

function sizeOf(value: unknown): number | null {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return [...value].length;
  if (Array.isArray(value)) return value.length;
  return null;
}

function typeOf(value: unknown): FieldType {
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'object';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'string') return 'string';
  return 'any';
}

function labelOf(type: FieldType): string {
  return FIELD_TYPES.find((item) => item.id === type)?.label ?? type;
}

function toNumber(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

export function splitList(text: string): string[] {
  return text
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item !== '');
}
