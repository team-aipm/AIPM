#!/usr/bin/env node
/**
 * 난이도가 실제로 움직이는지 본다. `npm run sim:difficulty` 로 실행한다.
 *
 * ## 무엇에 답하는가
 *
 * 「아이가 6개월 쓰면 문제 난이도가 달라지는가」. 이것은 프롬프트 품질
 * 이전의 질문이다. **레벨이 움직이지 않으면 프롬프트를 아무리 다듬어도
 * 난이도는 그대로다.**
 *
 * 실제 서비스로 확인하려면 아이 한 명이 6개월을 써야 한다. 그 사이
 * 로직을 한 번이라도 고치면 처음부터 다시다. 그래서 기록을 지어내
 * 돌려본다.
 *
 * ## 로직을 베끼지 않는다
 *
 * `decide()` 를 **그대로 import 한다.** 베껴 두면 서비스 로직을 고쳤을 때
 * 시뮬레이터만 옛날 규칙으로 돌아 「괜찮다」고 답한다. 그 답은 없느니만
 * 못하다.
 *
 * `decide()` 는 순수 함수라 DB 없이 부를 수 있다 — `difficulty.ts` 가
 * 처음부터 그렇게 떼어 둔 것을 그대로 쓴다.
 *
 * ## 학생을 어떻게 흉내내는가
 *
 * **실력과 문제 수준의 차이**가 결과를 정한다. 고정 확률로 정답을 뿌리면
 * 레벨이 천장까지 올라가고 만다. 실제로는 레벨이 오르면 문제가 어려워져
 * 정답률이 떨어지고, 거기서 멈춘다. 그 되먹임이 있어야 「이 아이가 어디서
 * 자리 잡는가」를 볼 수 있다.
 *
 *     gap = 실력 - 문제수준
 *     gap 이 클수록  처음부터 맞힐 확률↑ · 받는 도움↓
 *
 * ## 난수를 고정한다
 *
 * seed 를 주면 언제나 같은 결과가 나온다. `difficulty.ts` 가 서버에서
 * 난이도를 정하는 이유와 같다 — **같은 기록이면 같은 결과**여야 이상할 때
 * 다시 돌려볼 수 있다.
 *
 * ## 여기서 다루지 않는 것
 *
 * `student_memory.current_level` 은 시뮬레이션하지 않는다. 그 값은 06
 * DAILY ANALYZER 가 하루를 마치며 정하는데, **06 의 출력 스펙에
 * `current_level` 이 없다.** 코드는 `memory_update.current_level` 을 읽지만
 * 모델이 낼 이유가 없는 필드다. 고치기 전까지 흉내낼 대상이 없다.
 * (COM-001 §9 · COM-002 §10 변경이 필요한 사안이라 여기서 손대지 않는다)
 *
 * 여기서 보는 것은 `student.current_difficulty` 하나다.
 */

import { decide, MIN_LEVEL, MAX_LEVEL, START_LEVEL } from '../src/lib/services/difficulty.ts';

// ── 실제 서비스와 맞춘 상수 ────────────────────────────────────────
//
// 하루 문제 수는 프롬프트의 mode_status 기본값에서 가져왔다
// (target_mode_a 5 + target_mode_b 5). Support Level 범위는 COM-001 §10.
const PROBLEMS_PER_DAY = 10;
const SUPPORT_MIN = 0;
const SUPPORT_MAX = 4;

/** `updateDifficulty` 가 evaluation 을 몇 건 읽는지와 같아야 한다 */
const RECENT_WINDOW = 3;

const c = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
};

// ── 난수 ────────────────────────────────────────────────────────────

/** mulberry32. 짧고 seed 를 받으며 결과가 재현된다 */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const logistic = (x) => 1 / (1 + Math.exp(-x));

// ── 학생 ────────────────────────────────────────────────────────────

/**
 * `ability` 는 「이 아이에게 딱 맞는 문제 수준」이다. 레벨과 같은 1~5 눈금을
 * 쓰되 소수를 허용한다 — 3 과 4 사이에 있는 아이가 실제로는 가장 많다.
 *
 * `growthPerMonth` 는 6개월 동안 실력이 느는 정도다. 0 이면 「서비스를 써도
 * 늘지 않는 아이」이고, 그 경우에도 레벨이 제자리를 찾아가는지 보게 된다.
 */
const PROFILES = [
  { name: '빠른 아이', ability: 4.6, growthPerMonth: 0.15 },
  { name: '보통 아이', ability: 3.2, growthPerMonth: 0.12 },
  { name: '느린 아이', ability: 1.9, growthPerMonth: 0.10 },
  { name: '안 느는 아이', ability: 3.0, growthPerMonth: 0 },
  { name: '아주 잘하는 아이', ability: 6.0, growthPerMonth: 0 },
];

/**
 * 한 문제를 풀어 평가 한 줄을 만든다.
 *
 * 되먹임이 여기 있다. `gap` 이 음수면(문제가 실력보다 위) 처음부터 맞힐
 * 확률이 떨어지고 도움을 많이 받는다. 그러면 `decide()` 가 레벨을 내린다.
 */
function solve(random, ability, level) {
  const gap = ability - level;

  // 1.6 은 기울기다. 이 값이 크면 실력과 수준이 조금만 어긋나도 결과가
  // 확 갈리고, 작으면 뭉개진다. gap 1 에서 처음 정답률이 약 83% 가 되도록
  // 잡았다 — 「한 단계 쉬우면 대체로 맞힌다」는 감각에 맞춘다.
  const initialAccuracy = random() < logistic(gap * 1.6);

  // 도움은 gap 이 낮을수록 많이 받는다. 처음부터 맞혔으면 도움받을 일이
  // 거의 없다.
  const base = initialAccuracy ? 0.4 - gap * 0.5 : 2.4 - gap * 0.9;
  const jitter = (random() - 0.5) * 1.2;
  const supportLevel = Math.max(
    SUPPORT_MIN,
    Math.min(SUPPORT_MAX, Math.round(base + jitter)),
  );

  // 틀렸어도 스스로 바로잡을 수 있다. 이 서비스가 보려는 장면이고,
  // `decide()` 도 이것을 「버거웠다」로 세지 않는다.
  const selfCorrection = initialAccuracy ? false : random() < logistic(gap * 0.9 + 0.4);

  // 끝내 맞혔는가. 스스로 고쳤거나, 도움을 받아 도달했거나.
  const finalAccuracy = initialAccuracy || selfCorrection || random() < 0.55;

  return { initial_accuracy: initialAccuracy, final_accuracy: finalAccuracy, self_correction: selfCorrection, support_level: supportLevel };
}

/**
 * 한 아이의 기간 전체를 돌린다.
 *
 * `recent` 는 **최신이 앞**이다. `updateDifficulty` 가
 * `.order('evaluated_at', { ascending: false }).limit(3)` 으로 읽는 것과
 * 같은 순서여야 한다.
 */
function simulate(profile, options) {
  const { days, daysPerWeek, problemsPerDay, seed, variant } = options;
  const random = rng(seed);

  let level = START_LEVEL;
  const recent = [];
  const daily = []; // 그날을 마쳤을 때의 레벨
  let moves = 0; // 레벨이 바뀐 총 횟수
  let studyDays = 0;

  for (let day = 1; day <= days; day++) {
    // 매일 하지는 않는다. 주 daysPerWeek 회.
    const rest = day % 7 >= daysPerWeek;
    if (rest) {
      daily.push(level);
      continue;
    }
    studyDays++;

    const months = (day - 1) / 30;
    const ability = profile.ability + profile.growthPerMonth * months;

    for (let i = 0; i < problemsPerDay; i++) {
      recent.unshift(solve(random, ability, level));
      if (recent.length > RECENT_WINDOW) recent.length = RECENT_WINDOW;

      // 'daily' 안은 문제마다 판정하지 않는다. 하루를 마칠 때 한 번만 본다.
      if (variant === 'daily') continue;

      // **서비스와 같은 함수다.** 문제를 마칠 때마다 부른다.
      const decision = decide(recent, level);
      if (decision.move !== 'SAME') {
        moves++;
        level = decision.level;

        // 레벨이 바뀌면 앞 기록은 **다른 수준에서 푼 것**이다. 지금
        // 서비스는 창을 비우지 않아서, 한 번 움직인 직후 같은 기록으로
        // 또 움직인다. 'cooldown' 은 그것만 바꿔 본다.
        if (variant === 'cooldown') recent.length = 0;
      }
    }

    if (variant === 'daily') {
      const decision = decide(recent, level);
      if (decision.move !== 'SAME') {
        moves++;
        level = decision.level;
      }
    }

    daily.push(level);
  }

  // 마지막 30일이 얼마나 출렁였는가. 6개월을 써서 자리를 잡았다면
  // 이 값이 작아야 한다. 크면 「수준」이 아니라 그날의 운을 따라간 것이다.
  const tail = daily.slice(-30);
  const mean = tail.reduce((sum, v) => sum + v, 0) / tail.length;
  const settle = Math.sqrt(tail.reduce((sum, v) => sum + (v - mean) ** 2, 0) / tail.length);

  return { daily, finalLevel: level, movesPerDay: moves / Math.max(1, studyDays), settle };
}

// ── 실행 ────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const out = { days: 180, daysPerWeek: 5, problemsPerDay: PROBLEMS_PER_DAY, runs: 200, seed: 1, trace: false, json: false, variant: 'current', compare: false };
  for (const arg of argv) {
    const [key, value] = arg.replace(/^--/, '').split('=');
    if (key === 'help' || key === 'h') return { help: true };
    if (key === 'trace') out.trace = true;
    else if (key === 'json') out.json = true;
    else if (key === 'compare') out.compare = true;
    else if (key === 'variant' && value !== undefined) out.variant = value;
    else if (key in out && value !== undefined && typeof out[key] === 'number') out[key] = Number(value);
  }
  return out;
}

/**
 * 판정을 언제 어떻게 부르는가. **`decide()` 자체는 건드리지 않는다.**
 * 셋 다 부르는 쪽만 다르므로, COM-001 §9 를 고치지 않고도 비교할 수 있다.
 */
const VARIANTS = {
  current: '지금 그대로 · 문제마다 판정, 창 유지',
  cooldown: '움직인 직후 창 비우기 · 문제마다 판정',
  daily: '하루에 한 번만 판정',
};

const HELP = `
${c.bold('난이도 시뮬레이터')}

  npm run sim:difficulty -- [옵션]

  --days=180          돌릴 기간. 기본 180일(약 6개월)
  --daysPerWeek=5     주 몇 회 학습하는가
  --problemsPerDay=10 하루 문제 수
  --runs=200          유형마다 몇 명을 돌릴까. 결과가 흔들려서 여러 명을 본다
  --seed=1            난수 씨앗. 같으면 결과가 같다
  --trace             유형마다 한 명의 날짜별 레벨을 함께 찍는다
  --json              사람이 읽는 표 대신 JSON 으로
  --variant=current   판정을 언제 부르는가. current | cooldown | daily
  --compare           세 방식을 나란히 비교한다 (decide() 는 그대로 둔 채)

  예) 3개월만, 주 3회
      npm run sim:difficulty -- --days=90 --daysPerWeek=3
`;

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/**
 * 한글은 터미널에서 두 칸을 차지한다. `padEnd` 는 글자 수를 세므로
 * 한글이 섞인 표는 어긋난다. 실제 폭으로 맞춘다.
 */
const width = (s) => [...s].reduce((n, ch) => n + (/[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹯＀-｠￠-￦]/.test(ch) ? 2 : 1), 0);
const pad = (s, n) => s + ' '.repeat(Math.max(0, n - width(s)));
const lpad = (s, n) => ' '.repeat(Math.max(0, n - width(s))) + s;

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(HELP);
    return;
  }
  if (!(options.variant in VARIANTS)) {
    console.error(`  알 수 없는 variant: ${options.variant}. 가능: ${Object.keys(VARIANTS).join(', ')}`);
    process.exitCode = 1;
    return;
  }
  if (options.compare) {
    compare(options);
    return;
  }

  const results = measure(options);
  report(results, options);
}

/** 한 방식으로 모든 유형을 돌린다 */
function measure(options) {
  return PROFILES.map((profile) => {
    const runs = [];
    for (let i = 0; i < options.runs; i++) {
      runs.push(simulate(profile, { ...options, seed: options.seed + i * 7919 }));
    }

    // 개월별 평균 레벨
    const checkpoints = [30, 60, 90, 120, 150, 180]
      .filter((d) => d <= options.days)
      .map((d) => ({
        day: d,
        level: runs.reduce((sum, r) => sum + r.daily[d - 1], 0) / runs.length,
      }));

    const finals = runs.map((r) => r.finalLevel);
    const distribution = {};
    for (let l = MIN_LEVEL; l <= MAX_LEVEL; l++) {
      distribution[l] = finals.filter((f) => f === l).length;
    }

    const movedRatio = runs.filter((r) => r.movesPerDay > 0).length / runs.length;

    return {
      profile,
      checkpoints,
      distribution,
      movedRatio,
      movesPerDay: runs.reduce((sum, r) => sum + r.movesPerDay, 0) / runs.length,
      settle: runs.reduce((sum, r) => sum + r.settle, 0) / runs.length,
      finalMedian: median(finals),
      sample: runs[0],
    };
  });
}

/** 사람이 읽는 표 */
function report(results, options) {
  if (options.json) {
    // `sample` 은 사람이 눈으로 볼 때만 쓰는 한 명짜리 궤적이다. 날짜만큼
    // 길어서 JSON 에 넣으면 나머지가 안 보인다.
    const forJson = results.map((r) => {
      const copy = { ...r };
      delete copy.sample;
      return copy;
    });
    console.log(JSON.stringify({ options, results: forJson }, null, 2));
    return;
  }

  console.log('');
  console.log(c.bold('  난이도 시뮬레이터') + c.dim(`  ·  ${options.days}일 · 주 ${options.daysPerWeek}회 · 하루 ${options.problemsPerDay}문제 · 유형마다 ${options.runs}명`));
  console.log(c.dim(`  src/lib/services/difficulty.ts 의 decide() 를 그대로 사용. 시작 레벨 ${START_LEVEL}`));
  console.log(c.dim(`  판정 방식: ${VARIANTS[options.variant]}`));
  console.log('');

  const months = results[0].checkpoints.map((cp) => `${cp.day / 30}개월`);
  console.log(c.dim('  ' + pad('유형', 18) + pad('실력', 8) + months.map((m) => lpad(m, 8)).join('') + lpad('최종', 8) + lpad('하루이동', 10) + lpad('막달출렁', 10)));
  console.log(c.dim('  ' + '─'.repeat(18 + 8 + months.length * 8 + 28)));

  for (const r of results) {
    const cells = r.checkpoints.map((cp) => lpad(cp.level.toFixed(2), 8)).join('');
    const moves = r.movedRatio === 0 ? c.red(lpad('없음', 10)) : lpad(r.movesPerDay.toFixed(1) + '회', 10);
    // 0.5 는 「마지막 30일 동안 레벨이 한 칸 안팎으로 계속 오간다」는 뜻이다
    const settleText = lpad(r.settle.toFixed(2), 10);
    console.log(
      '  ' + pad(r.profile.name, 18) +
      pad(String(r.profile.ability), 8) +
      cells +
      lpad(String(r.finalMedian), 8) +
      moves +
      (r.settle >= 0.5 ? c.yellow(settleText) : settleText),
    );
  }

  console.log('');
  console.log(c.dim('  최종 레벨 분포 (' + options.runs + '명 중)'));
  console.log(c.dim('  ' + pad('유형', 18) + [1, 2, 3, 4, 5].map((l) => lpad(`Lv${l}`, 7)).join('')));
  for (const r of results) {
    const cells = [1, 2, 3, 4, 5]
      .map((l) => {
        const n = r.distribution[l];
        const text = lpad(String(n), 7);
        return n === 0 ? c.dim(text) : n > options.runs / 2 ? c.green(text) : text;
      })
      .join('');
    console.log('  ' + pad(r.profile.name, 18) + cells);
  }

  if (options.trace) {
    console.log('');
    console.log(c.dim('  한 명의 날짜별 레벨 (10일 간격)'));
    for (const r of results) {
      const marks = r.sample.daily
        .map((l, i) => ({ l, i }))
        .filter(({ i }) => i % 10 === 0)
        .map(({ l }) => l)
        .join(' ');
      console.log('  ' + pad(r.profile.name, 18) + c.dim(marks));
    }
  }

  // ── 결론 ──
  //
  // 「움직이는가」가 이 도구의 존재 이유다. 표만 던지고 끝내면 읽는 사람이
  // 매번 같은 계산을 다시 한다.
  console.log('');
  const stuck = results.filter((r) => r.movedRatio < 0.5);
  const spread = new Set(results.map((r) => r.finalMedian)).size;

  if (stuck.length === results.length) {
    console.log('  ' + c.red('레벨이 움직이지 않는다.') + ' 모든 유형이 시작 레벨에 머문다.');
  } else if (spread === 1) {
    console.log('  ' + c.yellow('움직이기는 하는데 유형이 갈리지 않는다.') + ' 실력이 달라도 같은 레벨로 수렴한다.');
  } else {
    console.log('  ' + c.green('레벨이 실력에 따라 갈린다.') + ` 최종 레벨이 ${spread}가지로 나뉜다.`);
  }
  if (stuck.length > 0 && stuck.length < results.length) {
    console.log('  ' + c.dim('다만 다음 유형은 절반 이상이 제자리다: ' + stuck.map((s) => s.profile.name).join(', ')));
  }

  // 갈리는 것과 자리를 잡는 것은 다른 문제다. 6개월을 썼는데도 마지막
  // 달에 레벨이 계속 오르내린다면, 그것은 「수준」이 아니라 그날의 운이다.
  const restless = results.filter((r) => r.settle >= 0.5);
  if (restless.length > 0) {
    console.log('');
    console.log('  ' + c.yellow('마지막 달에도 레벨이 출렁인다: ') + restless.map((r) => `${r.profile.name}(${r.settle.toFixed(2)})`).join(', '));
    console.log('  ' + c.dim(`하루 ${options.problemsPerDay}문제인데 판단 창이 ${RECENT_WINDOW}문제다. 하루에도 여러 번 움직인다.`));
  }
  console.log('');
  console.log(c.dim('  student_memory.current_level 은 여기서 다루지 않는다. 06 이 그 값을'));
  console.log(c.dim('  내지 않아 실제로도 움직이지 않는다 — 파일 맨 위 주석 참고.'));
  console.log('');
}

/**
 * 세 방식을 나란히 놓는다.
 *
 * 보는 것은 둘이다. **갈리는가**(실력이 다른 아이가 다른 레벨에 가는가)와
 * **자리를 잡는가**(마지막 달에 안 출렁이는가). 둘 다 돼야 쓸 만하다 —
 * 갈리기만 하고 출렁이면 그날의 운이고, 안 출렁이는데 안 갈리면 그냥
 * 고정값이다.
 */
function compare(options) {
  console.log('');
  console.log(c.bold('  판정 방식 비교') + c.dim(`  ·  ${options.days}일 · 주 ${options.daysPerWeek}회 · 하루 ${options.problemsPerDay}문제 · 유형마다 ${options.runs}명`));
  console.log(c.dim('  decide() 는 셋 다 같다. 부르는 쪽만 다르다.'));
  console.log('');

  const rows = [];
  for (const [variant, label] of Object.entries(VARIANTS)) {
    const results = measure({ ...options, variant });
    // 갈림: 실력 순서대로 최종 레벨이 벌어진 폭
    const levels = results.map((r) => r.checkpoints.at(-1).level);
    const range = Math.max(...levels) - Math.min(...levels);
    rows.push({
      variant,
      label,
      range,
      settle: results.reduce((sum, r) => sum + r.settle, 0) / results.length,
      movesPerDay: results.reduce((sum, r) => sum + r.movesPerDay, 0) / results.length,
      levels,
    });
  }

  console.log(c.dim('  ' + pad('방식', 34) + lpad('갈림폭', 9) + lpad('출렁임', 9) + lpad('하루이동', 10)));
  console.log(c.dim('  ' + '─'.repeat(62)));
  for (const r of rows) {
    const best = r.settle === Math.min(...rows.map((x) => x.settle));
    const settleText = lpad(r.settle.toFixed(2), 9);
    console.log(
      '  ' + pad(r.label, 34) +
      lpad(r.range.toFixed(2), 9) +
      (best ? c.green(settleText) : r.settle >= 0.5 ? c.yellow(settleText) : settleText) +
      lpad(r.movesPerDay.toFixed(1) + '회', 10),
    );
  }

  console.log('');
  console.log(c.dim('  유형별 6개월 뒤 평균 레벨'));
  console.log(c.dim('  ' + pad('방식', 34) + PROFILES.map((p) => lpad(p.name.slice(0, 6), 12)).join('')));
  for (const r of rows) {
    console.log('  ' + pad(r.label, 34) + r.levels.map((l) => lpad(l.toFixed(2), 12)).join(''));
  }

  console.log('');
  console.log(c.dim('  갈림폭 = 가장 잘하는 유형과 가장 못하는 유형의 6개월 뒤 레벨 차이. 클수록 좋다.'));
  console.log(c.dim('  출렁임 = 마지막 30일 레벨의 표준편차. 작을수록 자리를 잡은 것이다.'));
  console.log('');
}

main();
