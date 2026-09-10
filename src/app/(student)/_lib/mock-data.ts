/**
 * METTY 프로토타입 이식용 임시 목업 데이터.
 *
 * ⚠️ 스키마 노트 (COM-002 §persona_type)
 * 현재 `persona_type`은 `friend` / `villain` 2종 ENUM이다. 이 프로토타입은
 * 6개 캐릭터(메티·헤티·큐리·포키·모노·토리) "스킨"을 보여주는데, 각 스킨은
 * 아래처럼 2개 게임플레이 모드 중 하나에 매핑된다:
 *   - friend : 메티, 큐리, 포키 (되묻기·질문·응원 — 협력형 말투)
 *   - villain: 헤티 (반박 승부 — 경쟁형 말투)
 * `character_id` 같은 스킨 필드는 아직 COM-002에 없다. 실제 반영하려면
 * COM-002 변경 제안이 먼저 필요하다 (COM-005 §10, §14-9). 그 전까지는
 * 이 파일 안에서만 쓰는 클라이언트 목업이다. 실제 세션 로직/평가에는
 * 영향을 주지 않는다 (COM-001 §4 "Persona는 말투에만 영향").
 *
 * 대화 스크립트(SCRIPTS)도 전부 하드코딩 목업이다. 실제 AI 대화는
 * `lib/ai/drilldown.ts` + `app/api/ai/**`로 대체되어야 한다.
 */

export type PersonaType = 'friend' | 'villain';

export type CharacterId = 'metty' | 'hetty' | 'quri' | 'poki' | 'mono' | 'tori';

export type Character = {
  id: CharacterId;
  personaType: PersonaType;
  ko: string;
  en: string;
  style: string;
  line: string;
  perks: [string, string];
  unlocked: boolean;
  unlockCost?: number;
  /** 캐릭터 실제 아트의 몸 색(또는 대비를 위한 포인트 색)에서 뽑은 톤.
   * 하단 탭바 FAB처럼 "이 캐릭터다"를 배경색만으로 알 수 있어야 하는
   * 자리에 쓴다. */
  accent: string;
};

export const CHARACTERS: Record<CharacterId, Character> = {
  metty: {
    id: 'metty',
    personaType: 'friend',
    ko: '메티',
    en: 'METI',
    style: '생각 코치 · 되묻기 중심',
    line: '"왜 그렇게 생각했어? 네 말로 설명해줘!"',
    perks: ['너의 생각을 들으며 함께 미션을 진행해', '한 문장 정리를 꼭 같이 써'],
    unlocked: true,
    accent: '#2BB8B0',
  },
  hetty: {
    id: 'hetty',
    personaType: 'villain',
    ko: '헤티',
    en: 'HETI',
    style: '속임수를 좋아하는 장난꾸러기',
    line: '"에이 다르잖아 그게 말이 돼?"',
    perks: ['미션 중 실수를 하거나 의심을 해', '지기 싫어하는 승부사 기질이 강해'],
    unlocked: true,
    accent: '#F0793D',
  },
  quri: {
    id: 'quri',
    personaType: 'friend',
    ko: '큐리',
    en: 'QURI',
    style: '질문 대장 · 호기심 중심',
    line: '"와! 이렇게도 생각할 수 있구나!"',
    perks: ['한 문제에서 다른 질문을 계속 찾아줘', '새로운 방법을 먼저 칭찬해'],
    unlocked: true,
    accent: '#4FBFA0',
  },
  poki: {
    id: 'poki',
    personaType: 'friend',
    ko: '포키',
    en: 'POKI',
    style: '응원 요정 · 작은 성취 축하',
    line: '"와! 잘했어! 이만큼이나 했잖아!"',
    perks: ['작은 단계마다 포인트를 더 줘', '오늘 한 일을 배지로 남겨줘'],
    unlocked: true,
    accent: '#FFC857',
  },
  mono: {
    id: 'mono',
    personaType: 'friend',
    ko: '모노',
    en: 'MONO',
    style: '집중 도우미 · 차분한 속도로 대화',
    line: '"천천히, 하나씩 같이 가보자."',
    perks: ['질문 속도를 늦춰줘', '한 번에 한 가지만 물어봐'],
    unlocked: false,
    unlockCost: 200,
    accent: '#7B6FE0',
  },
  tori: {
    id: 'tori',
    personaType: 'friend',
    ko: '토리',
    en: 'TORI',
    style: '딴생각 타이머 · 쉬는 시간 친구',
    line: '"가끔은 잠깐 딴생각도 필요해!"',
    perks: ['중간에 짧은 휴식을 제안해', '쉬는 타이머를 챙겨줘'],
    unlocked: false,
    unlockCost: 300,
    accent: '#F0829B',
  },
};

export const CHARACTER_IMG: Record<CharacterId, { front: string; wave: string; think: string; celebrate: string }> = {
  metty: {
    front: '/characters/metty_01_front-mttn80yx-s9em.png',
    wave: '/characters/metty_02_wave-mttgmra0-yqak.png',
    think: '/characters/metty_01_front-mttn80yx-s9em.png',
    celebrate: '/characters/metty_04_celebrate-mtth0j8r-ywx6.png',
  },
  hetty: {
    front: '/characters/hetty_02_wave-mtth3vtg-tszh.png',
    wave: '/characters/hetty_02_wave-mtth3vtg-tszh.png',
    think: '/characters/hetty_03_think-mttnfx1s-nt1t.png',
    celebrate: '/characters/hetty_02_wave-mttnklya-ajkj.png',
  },
  quri: {
    front: '/characters/quri_03_think-mttnjlg0-hx93.png',
    wave: '/characters/quri_03_think-mtth0y1k-98t5.png',
    think: '/characters/quri_03_think-mttnjlg0-hx93.png',
    celebrate: '/characters/quri_04_celebrate-mttnatrq-xs6s.png',
  },
  poki: {
    front: '/characters/poki_01_front-mttnk6bc-tb73.png',
    wave: '/characters/poki_02_wave-mtth1pil-h6fl.png',
    think: '/characters/poki_03_think-mttgncjq-jcpx.png',
    celebrate: '/characters/poki_02_wave-mtth1pil-h6fl.png',
  },
  mono: {
    front: '/characters/mono_04_celebrate-mtth1766-fq53.png',
    wave: '/characters/mono_04_celebrate-mtth1766-fq53.png',
    think: '/characters/mono_04_celebrate-mtth1766-fq53.png',
    celebrate: '/characters/mono_04_celebrate-mtth32fo-kvgt.png',
  },
  tori: {
    front: '/characters/tori_01_front-mtth2cut-o3ox.png',
    wave: '/characters/tori_01_front-mtth2cut-o3ox.png',
    think: '/characters/tori_01_front-mtth2cut-o3ox.png',
    celebrate: '/characters/tori_01_front-mtth2cut-o3ox.png',
  },
};

export const GROUP_IMG = '/characters/--mttncerl-8sgr.png';
export const LOGO_IMG = '/characters/meti-logo2.png';

export type ChatStep = {
  me?: 'attach';
  bot?: string[];
  chips?: string[];
  input?: boolean;
};

/** 캐릭터별 대화 트리 — 실제 AI 세션(lib/ai/drilldown.ts)으로 교체될 자리. */
export const SCRIPTS: Record<CharacterId, ChatStep[]> = {
  metty: [
    { bot: ['좋아! 오늘 막힌 문제 하나 가져와 볼래? 사진으로 올려도 되고 직접 써도 돼.'], chips: ['📷 사진으로 올릴게', '직접 쓸래'] },
    { me: 'attach', bot: ['오~ 분수 나눗셈이구나. 바로 풀지 말고 하나만 물어볼게.', '이 문제에서 제일 헷갈리는 게 뭐야?'], chips: ['÷를 왜 ×로 바꾸는지', '분수를 왜 뒤집는지', '어디서 막혔는지 모르겠어'] },
    { bot: ['그 부분만 좁혀서 파보자. 2/5로 나눈다는 건, 2/5를 몇 번 담는 걸까?'], chips: ['몇 개 들어가는지 세는 것', '나누기라서 작아지는 것'] },
    { bot: ['좋아. 그럼 1 안에 2/5는 몇 개 들어가?'], chips: ['2개랑 조금 더', '2개', '1개'] },
    { bot: ['맞았어! 정확히 2.5개, 그러니까 5/2야.', '그래서 ÷ 2/5 가 × 5/2 로 바뀌는 거지. 이제 네 말로 설명해줄래?'], input: true },
    { bot: ['정확해. 방금 네가 나를 가르친 거야 😳', '마지막! 오늘 알아낸 걸 한 문장으로 써서 보내줘.'], input: true },
    { bot: ['좋아, 이 문장 기억창고에 넣어둘게. 다음에 헷갈리면 꺼내 보자!', 'reward'], chips: ['오늘 미션 마무리하기', '한 문제 더 하기', '도감 보러 가기'] },
  ],
  hetty: [
    { bot: ['왔구나! 오늘은 내가 먼저 풀어볼게.', '내 풀이에서 실수를 찾아내면 네가 이기는 거야. 할 수 있겠어?'], chips: ['좋아, 붙어보자', '자신 없는데…'] },
    { me: 'attach', bot: ['자 봐라. 이 정도면 완벽하지?', 'solution'], chips: ['어? 뭔가 이상한데', '맞는 것 같아'] },
    { bot: ['어디가 이상한데? 줄을 눌러서 짚어봐.'], chips: ['2번째 줄', '3번째 줄', '잘 모르겠어'] },
    { bot: ['에이~ 우연히 맞춘 거 아니야?', '그 줄이 왜 틀렸는지 말로 설명해봐. 그래야 인정할게.'], input: true },
    { bot: ['…크흠. 인정. 1라운드는 네가 이겼다.', '그럼 이건 어때? 나눗셈인데 답이 더 커졌잖아. 그게 말이 돼?'], chips: ['1보다 작은 수로 나누면 커져', '나눗셈은 항상 작아져'] },
    { bot: ['윽! 반박 성공이야. 오늘은 내가 졌다 🙃', 'reward'], chips: ['오늘 미션 마무리하기', '한 판 더 하기', '도감 보러 가기'] },
  ],
  quri: [
    { bot: ['안녕! 나 궁금한 게 엄청 많아.', '어제 배운 소수 곱셈, 지금 얼마나 알 것 같아?'], chips: ['완전 알아', '반쯤 알아', '거의 몰라'] },
    { bot: ['솔직해서 좋다! 그럼 0.3 × 0.4는 얼마일 것 같아? 계산하지 말고 먼저 예측해봐.'], chips: ['0.12', '1.2', '0.012'] },
    { bot: ['왜 그렇게 생각했어? 계산 말고 이유를 말해줘.'], input: true },
    { bot: ['와! 그렇게도 생각할 수 있구나.', '그럼 0.3은 1보다 작으니까 결과는 0.4보다 커질까, 작아질까?'], chips: ['작아져', '커져'] },
    { bot: ['그렇지! 지금 네가 스스로 설명한 이게 바로 메타인지야.', 'reward'], chips: ['오늘 미션 마무리하기', '한 문제 더 하기', '도감 보러 가기'] },
  ],
  poki: [
    { bot: ['왔다! 오늘도 만나서 기뻐 ✨', '오늘은 딱 한 걸음만 가보자. 뭐부터 할래?'], chips: ['막힌 문제 보기', '쉬운 것부터'] },
    { me: 'attach', bot: ['좋아 좋아! 이 문제, 먼저 아는 것만 말해줄래? 하나도 괜찮아.'], input: true },
    { bot: ['와! 그거 벌써 절반이야 🎉', '그럼 다음 한 칸. 2/5를 뒤집으면 뭐가 될까?'], chips: ['5/2', '2/5 그대로'] },
    { bot: ['정답! 오늘 두 칸 갔어. 마지막으로 배운 걸 한 문장으로 써줘!'], input: true },
    { bot: ['최고야! 이만큼이나 했잖아 🥳', 'reward'], chips: ['오늘 미션 마무리하기', '한 문제 더 하기', '도감 보러 가기'] },
  ],
  mono: [
    { bot: ['천천히 가보자. 오늘 막힌 문제 하나만 골라볼까?'], chips: ['좋아'] },
  ],
  tori: [
    { bot: ['가끔은 쉬어가도 괜찮아. 오늘은 뭐부터 해볼까?'], chips: ['좋아'] },
  ],
};

export const SOL_LINES = [
  { n: '1', t: '3/4 ÷ 2/5' },
  { n: '2', t: '= 3/4 × 2/5', bad: true },
  { n: '3', t: '= 6/20 = 3/10' },
];

/**
 * 상점(Shop) 아이템 목업.
 *
 * `key`가 `CharacterId`면 캐릭터 해금, 아니면(bg/sticker) 꾸미기 아이템이다.
 * 실제로는 COM-002에 "구매 가능한 캐릭터/아이템" 테이블이 없다 — 여기서도
 * 화면 시연용 클라이언트 상태(`use-student-state.ts`의 `owned`)만 갱신한다.
 */
export type ShopItem = {
  key: CharacterId | 'bg' | 'sticker';
  name: string;
  desc: string;
  cost: number;
  icon: 'character' | 'moon' | 'sparkle';
};

export const SHOP_ITEMS: ShopItem[] = [
  { key: 'mono', name: '모노 해금', desc: '집중 도우미 · 차분한 속도로 대화', cost: 200, icon: 'character' },
  { key: 'tori', name: '토리 해금', desc: '딴생각 타이머 · 쉬는 시간 친구', cost: 300, icon: 'character' },
  { key: 'bg', name: '메티 밤하늘 배경', desc: '대화 화면 배경을 바꿔줘', cost: 80, icon: 'moon' },
  { key: 'sticker', name: '생각 스티커 5종', desc: '리포트에 붙이는 칭찬 스티커', cost: 50, icon: 'sparkle' },
];

/**
 * 미션 캘린더 · 주간 리포트 목업.
 *
 * COM-002 §Evaluation의 `reasoning_score`/`self_correction`/`rule_score`/
 * `transfer_score`를 학생 어휘로 옮긴 값들이다 (COM-003 §4.5 "내부 데이터 →
 * 부모 표현" 표와 동일 원칙을 학생 화면에도 적용). 실제로는 학생별
 * `LearningReport`(report_type: daily_student — COM-002 §377)에서 집계되어야
 * 한다.
 */
export type CalendarDay = { date: number; status: 'done' | 'partial' | 'none' | 'future'; doneCount: number };

export const CALENDAR_DAYS: CalendarDay[] = [
  { date: 1, status: 'done', doneCount: 3 },
  { date: 2, status: 'done', doneCount: 3 },
  { date: 3, status: 'partial', doneCount: 1 },
  { date: 4, status: 'done', doneCount: 3 },
  { date: 5, status: 'partial', doneCount: 1 },
  { date: 6, status: 'none', doneCount: 0 },
  { date: 7, status: 'done', doneCount: 3 },
  { date: 8, status: 'partial', doneCount: 2 },
];

export const CALENDAR_FIRST_WEEKDAY = 2; // 1일 = 화요일
export const CALENDAR_TOTAL_DAYS = 30;
export const CALENDAR_TODAY = 8;
export const MISSION_TITLES = ['오늘 알고 싶은 것 정하기', '메티랑 생각 대화', '배운 걸 한 문장으로 쓰기'];
export const MISSION_SUBS = ['궁금한 걸 한 줄로 적어', '문제를 올리고 오답 찾기', '기억창고에 저장돼'];

export type WeeklyMetric = { name: string; val: string; pct: number; note: string };

export const WEEKLY_METRICS: WeeklyMetric[] = [
  { name: '이유 설명하기', val: '82%', pct: 82, note: '풀기 전 답을 미리 그려봤어' },
  { name: '스스로 바로잡기', val: '12번', pct: 70, note: '지난주보다 4번 늘었어' },
  { name: '규칙 찾아내기', val: '9/11', pct: 81, note: '메티 오답도 8번이나 잡아냈어' },
  { name: '새로운 문제에 적용하기', val: '5일', pct: 71, note: '학습 끝에 한 문장 정리 완료' },
];

export const WEEKLY_ACTIVITY = [
  { day: '월', pct: 44 },
  { day: '화', pct: 68 },
  { day: '수', pct: 30 },
  { day: '목', pct: 82 },
  { day: '금', pct: 56 },
  { day: '토', pct: 12 },
  { day: '일', pct: 24 },
];
