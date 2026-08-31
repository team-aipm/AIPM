#!/usr/bin/env node
/**
 * 팀원 로컬 세팅 점검 스크립트. `npm run setup`으로 실행한다.
 *
 * 하는 일은 점검과 안내뿐이다. 파일을 고치는 것은 .env.local 생성 하나뿐이며,
 * 이미 있으면 건드리지 않는다. (DEV-004 §2)
 */

import { existsSync, readFileSync, copyFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_URL = 'https://github.com/team-aipm/AIPM.git';
const REQUIRED_NODE_MAJOR = 20;

const ENV_KEYS = [
  { key: 'NEXT_PUBLIC_SUPABASE_URL', required: true, note: '팀 전체가 동일해야 함' },
  { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', required: true, note: '팀 전체가 동일해야 함' },
  { key: 'SUPABASE_SERVICE_ROLE_KEY', required: false, note: '서버 로직 담당만' },
  { key: 'GEMINI_API_KEY', required: false, note: 'AI 코어 담당. 각자 발급' },
];

let problems = 0;
let warnings = 0;

const c = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
};

const ok = (msg, detail) => console.log(`  ${c.green('OK')}   ${msg}${detail ? c.dim('  ' + detail) : ''}`);
const warn = (msg, how) => { warnings++; console.log(`  ${c.yellow('!!')}   ${msg}`); if (how) console.log(`       ${c.dim('→ ' + how)}`); };
const fail = (msg, how) => { problems++; console.log(`  ${c.red('XX')}   ${msg}`); if (how) console.log(`       ${c.dim('→ ' + how)}`); };
const section = (t) => console.log(`\n${c.bold(t)}`);

const sh = (cmd) => {
  try {
    return execSync(cmd, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return null;
  }
};

console.log(`\n${c.bold('AIPM 로컬 세팅 점검')}`);
console.log(c.dim('상세 안내는 docs/DEV-004-onboarding.md'));

// ── 1. 실행 환경 ────────────────────────────────────────────
section('1. 실행 환경');

const nodeMajor = Number(process.versions.node.split('.')[0]);
if (nodeMajor >= REQUIRED_NODE_MAJOR) {
  ok(`Node.js v${process.versions.node}`);
} else {
  fail(
    `Node.js v${process.versions.node} — ${REQUIRED_NODE_MAJOR} 이상이 필요합니다`,
    'https://nodejs.org 에서 LTS 버전을 설치하세요',
  );
}

for (const lock of ['yarn.lock', 'pnpm-lock.yaml', 'bun.lockb']) {
  if (existsSync(join(ROOT, lock))) {
    fail(
      `${lock} 이 있습니다 — 이 프로젝트는 npm만 씁니다 (COM-005 §5)`,
      `${lock} 을 지우고 node_modules 를 지운 뒤 npm install 하세요`,
    );
  }
}

if (existsSync(join(ROOT, 'node_modules'))) {
  ok('node_modules');
} else {
  fail('의존성이 설치되지 않았습니다', 'npm install');
}

// ── 2. 저장소 연결 ──────────────────────────────────────────
section('2. 저장소');

const remote = sh('git remote get-url origin');
if (!remote) {
  warn('git remote origin 이 없습니다', `git remote add origin ${REPO_URL}`);
} else if (remote.includes('team-aipm/AIPM')) {
  ok('origin', remote);
} else {
  fail(
    `origin 이 다른 주소를 가리킵니다 — ${remote}`,
    `git remote set-url origin ${REPO_URL}`,
  );
}

const branch = sh('git rev-parse --abbrev-ref HEAD');
if (branch === 'main') {
  warn(
    'main 브랜치에 있습니다 — main은 배포용입니다 (COM-005 §6)',
    'git switch develop 후 작업 브랜치를 만드세요',
  );
} else if (branch) {
  ok('현재 브랜치', branch);
}

// ── 3. 환경변수 ────────────────────────────────────────────
section('3. 환경변수');

const envPath = join(ROOT, '.env.local');
const examplePath = join(ROOT, '.env.example');

if (!existsSync(envPath)) {
  if (existsSync(examplePath)) {
    copyFileSync(examplePath, envPath);
    warn(
      '.env.local 을 .env.example 에서 새로 만들었습니다 — 값이 비어 있습니다',
      '운영 PM에게 값을 받아 채우세요. 이 파일은 커밋하지 않습니다',
    );
  } else {
    fail('.env.local 과 .env.example 이 모두 없습니다', 'develop 최신본을 pull 하세요');
  }
}

if (existsSync(envPath)) {
  const raw = readFileSync(envPath, 'utf8');
  const values = new Map();
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) values.set(m[1], m[2].trim());
  }

  for (const { key, required, note } of ENV_KEYS) {
    const v = values.get(key);
    if (v) {
      ok(key, note);
    } else if (required) {
      fail(`${key} 값이 비어 있습니다`, `운영 PM에게 요청하세요 (${note})`);
    } else {
      warn(`${key} 값이 비어 있습니다 — ${note}`, '담당이 아니면 비워둬도 됩니다');
    }
  }

  // 팀 전체가 같은 DB를 봐야 한다. URL 형식만 가볍게 확인한다.
  const url = values.get('NEXT_PUBLIC_SUPABASE_URL');
  if (url && !/^https:\/\/[a-z0-9]+\.supabase\.co\/?$/.test(url)) {
    warn(
      'NEXT_PUBLIC_SUPABASE_URL 형식이 예상과 다릅니다',
      'https://<ref>.supabase.co 형태여야 합니다',
    );
  }
}

// ── 결과 ──────────────────────────────────────────────────
console.log('');
if (problems === 0 && warnings === 0) {
  console.log(c.green('세팅 완료. npm run dev 로 시작하세요.'));
} else if (problems === 0) {
  console.log(c.yellow(`확인할 항목 ${warnings}건. 담당 영역이 아니면 넘어가도 됩니다.`));
  console.log('npm run dev 로 시작할 수 있습니다.');
} else {
  console.log(c.red(`해결해야 할 항목 ${problems}건${warnings ? `, 확인할 항목 ${warnings}건` : ''}.`));
  console.log('위 안내를 따른 뒤 npm run setup 을 다시 실행하세요.');
}

console.log(`
${c.bold('다음에 읽을 것')}
  1. CLAUDE.md                      이 저장소의 규칙. 하지 말아야 할 것
  2. docs/README.md                 문서 지도
  3. docs/DEV-001 §6                내 담당 폴더

${c.bold('PR 전 필수')}
  npm run lint && npm run build
`);

process.exit(problems > 0 ? 1 : 0);
