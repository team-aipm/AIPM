/**
 * 프롬프트와 입력에서 쓰는 변수.
 *
 * 대화 말고도 고정 입력값이 있다. 학년·닉네임·말투 같은 것들이다. 지금까지는
 * 입력 JSON 에 넣어 두고 프롬프트에 "student.grade 를 참고해라" 라고 설명해야
 * 했고, 모델이 제대로 집는지는 운이었다.
 *
 * ```text
 * 프롬프트     학생 이름은 {{nickname}} 이다. 말투는 {{persona}} 다.
 * 입력 JSON    { "student": { "grade": {{grade}}, "nickname": "{{nickname}}" } }
 * ```
 *
 * **원본은 바꾸지 않는다. 보낼 때만 치환한다.** 안 그러면 한 번 실행하면
 * 템플릿이 사라져 재사용을 못 한다. 서버가 받은 값은 `[보낸 프롬프트]` 에
 * 그대로 나오므로 치환이 제대로 됐는지 눈으로 확인된다.
 *
 * 따옴표는 사용자가 관리한다. 치환을 JSON 파싱 **전에** 하므로
 * `"grade": {{grade}}` 는 숫자로, `"name": "{{nickname}}"` 은 문자로 들어간다.
 * 규칙이 하나라 예측할 수 있다.
 */

export type Variable = {
  name: string;
  value: string;
};

export const BLANK_VARIABLE: Variable = { name: '', value: '' };

/**
 * 변수 묶음 하나. **세트가 곧 테스트 케이스다.**
 *
 * 말투 블록처럼 통째로 갈아끼우는 값이 있다. 빌런과 친구를 오가며 비교하려면
 * 두 벌을 나란히 둘 곳이 필요하다. 값 하나를 고치는 게 아니라 묶음을 바꾼다.
 *
 * 세트마다 이름 목록이 독립이다. 어긋나면 "정의 안 된 변수" 경고가 잡아 주므로
 * 굳이 묶지 않는다.
 */
export type VarSet = {
  name: string;
  vars: Variable[];
};

export const DEFAULT_VAR_SET: VarSet = { name: '기본', vars: [] };

/** `{{이름}}` 을 찾는다. 이름은 공백 없이 한 덩어리 */
const REF = /\{\{\s*([^{}\s]+)\s*\}\}/g;

/** 텍스트가 참조하는 변수 이름들. 중복은 없앤다 */
export function refsIn(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(REF)) found.add(match[1]);
  return [...found];
}

/**
 * 변수를 값으로 바꾼다.
 *
 * **정의되지 않은 이름은 그대로 둔다.** 빈칸으로 바꾸면 프롬프트가 망가진 채
 * 나가고, 왜 이상한지 알 수 없다. 남겨 두면 화면에서 경고할 수 있고 모델
 * 출력에도 흔적이 남는다.
 */
export function applyVars(text: string, vars: Variable[]): string {
  const table = new Map<string, string>();
  for (const item of vars) {
    const name = item.name.trim();
    if (name !== '') table.set(name, item.value);
  }
  if (table.size === 0) return text;

  return text.replace(REF, (whole, name: string) => {
    const value = table.get(name);
    return value === undefined ? whole : value;
  });
}

/** 정의된 변수 이름 집합. 빈 이름은 뺀다 */
export function definedNames(vars: Variable[]): Set<string> {
  return new Set(
    vars.map((item) => item.name.trim()).filter((name) => name !== ''),
  );
}

/** 이 텍스트들이 쓰는데 정의되지 않은 이름 */
export function undefinedRefs(texts: string[], vars: Variable[]): string[] {
  const defined = definedNames(vars);
  const missing = new Set<string>();
  for (const text of texts) {
    for (const name of refsIn(text)) {
      if (!defined.has(name)) missing.add(name);
    }
  }
  return [...missing];
}

/** 이 변수가 어디에 몇 번 쓰였는지. 화면에 `쓰인 곳` 으로 보여준다 */
export function usageOf(
  name: string,
  sources: { label: string; texts: string[] }[],
): string {
  const target = name.trim();
  if (target === '') return '';

  const parts: string[] = [];
  for (const source of sources) {
    const count = source.texts.filter((text) =>
      refsIn(text).includes(target),
    ).length;
    if (count > 0) parts.push(`${source.label} ${count}`);
  }
  return parts.length === 0 ? '안 쓰임' : parts.join(' · ');
}

/**
 * 따옴표 없이 값 자리에 놓인 `{{변수}}` 를 지금 값으로 바꾼다.
 *
 * 입력 JSON 은 **치환 전에도 유효해야 한다.** 대화가 입력 JSON 안의
 * 배열이라 대화창이 보내기 전에 입력을 읽어야 하기 때문이다.
 *
 * 안내만 하고 사용자가 손으로 고치게 두면, 저장된 설정을 쓰는 사람은
 * 매번 같은 벽을 만난다. 그래서 그 자리에서 고쳐 준다.
 *
 * **따옴표로 감싸지 않고 값으로 바꾼다.** `"grade": {{grade}}` 를
 * `"grade": "5"` 로 만들면 숫자여야 할 값이 문자가 된다. 지금 값을
 * 그대로 넣으면 `"grade": 5` 가 되어 뜻이 유지된다.
 *
 * 고칠 게 없거나 고쳐도 여전히 깨지면 `null` 을 돌려준다.
 */
export function repairBareVars(
  input: string,
  vars: Variable[],
): { text: string; replaced: string[] } | null {
  const table = new Map<string, string>();
  for (const item of vars) {
    const name = item.name.trim();
    if (name !== '') table.set(name, item.value);
  }

  const replaced: string[] = [];
  // 값 자리 = `:` `[` `,` 다음에 따옴표 없이 오는 것
  const text = input.replace(
    /([:[,]\s*)\{\{\s*([^{}\s]+)\s*\}\}/g,
    (whole, lead: string, name: string) => {
      const value = table.get(name);
      replaced.push(`{{${name}}}`);
      // 정의되지 않았으면 null 로 둔다. 빈칸으로 두면 JSON 이 또 깨진다.
      return `${lead}${value === undefined || value.trim() === '' ? 'null' : value}`;
    },
  );

  if (replaced.length === 0) return null;
  try {
    JSON.parse(text);
  } catch {
    return null;
  }
  return { text, replaced };
}
