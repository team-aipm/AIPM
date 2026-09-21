/**
 * ADM-001 대시보드 · `/admin`
 *
 * **집계만 본다.** 개인정보도 대화 원문도 없다(COM-007 §7-1).
 */

import { notFound } from 'next/navigation';
import { currentAdmin } from '@/lib/services/admin';
import {
  funnel,
  blockedStudents,
  aiHealth,
  CHILD_LOGIN_SINCE,
} from '@/lib/services/admin-metrics';

export const metadata = { title: 'AIPM 운영 · 대시보드' };

/**
 * 서버가 보고 있어야 하는 이름들.
 *
 * **값을 화면에 내보내지 않는다.** 있는지 없는지만 본다 — 없으면 AI 호출과
 * 배치가 조용히 실패하는데, 그걸 알아내려면 지금까지 런타임 로그를 뒤져야
 * 했다(2026-09-10).
 */
const ENV_KEYS = [
  'GEMINI_API_KEY',
  'CRON_SECRET',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;

function Card({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-black/10 bg-white p-4">
      <span className="text-[12px] font-semibold text-neutral-500">{label}</span>
      <span className="text-[24px] font-extrabold leading-none">{value}</span>
      {sub !== undefined && <span className="text-[11px] text-neutral-400">{sub}</span>}
    </div>
  );
}

export default async function AdminDashboard() {
  const ctx = await currentAdmin();
  if (ctx === null) notFound();

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
  const count = async (table: 'account' | 'student' | 'learning_session' | 'problem') => {
    const { count: n } = await ctx.db.from(table).select('*', { count: 'exact', head: true });
    return n ?? 0;
  };

  const [accounts, students] = await Promise.all([count('account'), count('student')]);

  const { count: todaySessions } = await ctx.db
    .from('learning_session')
    .select('*', { count: 'exact', head: true })
    .eq('session_date', today);

  const { count: todayProblems } = await ctx.db
    .from('problem')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', `${today}T00:00:00+09:00`);

  const { count: needsReview } = await ctx.db
    .from('problem')
    .select('*', { count: 'exact', head: true })
    .eq('problem_status', 'needs_review');

  const { count: interrupted } = await ctx.db
    .from('problem')
    .select('*', { count: 'exact', head: true })
    .in('problem_status', ['system_interrupted', 'verification_failed']);

  const [steps, blocked, ai] = await Promise.all([
    funnel(ctx.db),
    blockedStudents(ctx.db),
    aiHealth(ctx.db),
  ]);

  // 앞 칸 대비 몇 %가 남았나. 첫 칸은 견줄 앞이 없다.
  const rate = (index: number): string | null => {
    if (index === 0) return null;
    const before = steps[index - 1].value;
    if (before === 0) return null;
    return `${Math.round((steps[index].value / before) * 100)}%`;
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-[18px] font-extrabold">대시보드</h1>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card label="회원(부모)" value={String(accounts)} />
        <Card label="학생" value={String(students)} />
        <Card label="오늘 세션" value={String(todaySessions ?? 0)} sub={today} />
        <Card label="오늘 문제" value={String(todayProblems ?? 0)} />
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card label="needs_review" value={String(needsReview ?? 0)} sub="누적" />
        <Card
          label="집계 제외"
          value={String(interrupted ?? 0)}
          sub="system_interrupted · verification_failed"
        />
      </section>

      {/*
        **퍼널.** 어디서 멈추는지를 본다.

        여섯 칸 중 다섯은 테이블에서 세므로 지금까지의 사실이 그대로
        들어간다. 「아이 첫 로그인」만 이벤트라 쌓기 시작한 날부터다 —
        그 사실을 칸 밑에 적는다. 안 적으면 0 을 「아무도 안 들어왔다」로
        읽는다.
      */}
      <section className="flex flex-col gap-3 rounded-lg border border-black/10 bg-white p-4">
        <h2 className="text-[12px] font-bold text-neutral-500">가입 → 학습 퍼널</h2>

        <ol className="flex flex-wrap items-stretch gap-2">
          {steps.map((step, index) => (
            <li
              key={step.label}
              className="flex min-w-[116px] flex-1 flex-col gap-1 rounded border border-black/10 px-3 py-2"
            >
              <span className="text-[11px] font-semibold text-neutral-500">{step.label}</span>
              <span className="text-[20px] font-extrabold leading-none">{step.value}</span>
              <span className="text-[11px] text-neutral-400">
                {step.since !== null
                  ? `${step.since}부터`
                  : rate(index) !== null
                    ? `앞 칸의 ${rate(index)}`
                    : ' '}
              </span>
            </li>
          ))}
        </ol>

        {blocked > 0 && (
          <p className="rounded bg-amber-50 px-3 py-2 text-[12px] leading-relaxed text-amber-800">
            <b>아이디가 없는 학생 {blocked}명.</b> 부모 계정은 학생 화면에
            들어가지 않으므로 이 아이들은 학습을 시작할 방법이 없습니다.
            학생 프로필(MY-003)에서 부모가 아이디를 만들어 주어야 합니다.
          </p>
        )}
      </section>

      {/*
        **AI 가 제대로 도는가.** 이건 이벤트 말고는 셀 방법이 없다 —
        호출이 깨지면 학생에게는 다시 말해 달라고 하고 넘어가므로
        `problem` 에도 `message` 에도 흔적이 없다.
      */}
      <section className="flex flex-col gap-3 rounded-lg border border-black/10 bg-white p-4">
        <h2 className="text-[12px] font-bold text-neutral-500">
          AI 상태 · 최근 {ai.days}일
        </h2>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Card
            label="호출 실패"
            value={String(ai.callTotal)}
            sub="단계 프롬프트 호출이 깨진 횟수"
          />
          <Card
            label="정답 검증 실패"
            value={String(ai.verification)}
            sub="AI 가 확신 못 해 접은 문제"
          />
        </div>

        {ai.calls.length === 0 ? (
          <p className="text-[12px] text-neutral-400">
            실패가 없습니다. {CHILD_LOGIN_SINCE}부터 쌓기 시작했습니다.
          </p>
        ) : (
          <ul className="flex flex-col gap-1 text-[13px]">
            {ai.calls.map((row) => (
              <li key={row.stage} className="flex items-baseline justify-between gap-3">
                <code className="text-[12px]">{row.stage}</code>
                <span className="font-semibold">{row.count}회</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2 rounded-lg border border-black/10 bg-white p-4">
        <h2 className="text-[12px] font-bold text-neutral-500">서버 환경변수</h2>
        <p className="text-[11px] text-neutral-400">
값은 보여주지 않습니다. 서버가 그 이름을 보고 있는지만 확인합니다 —
          없으면 AI 호출과 배치가 조용히 실패합니다.
        </p>
        <ul className="flex flex-col gap-1 text-[13px]">
          {ENV_KEYS.map((key) => (
            <li key={key} className="flex items-center gap-2">
              <span
                className={
                  process.env[key] === undefined || process.env[key] === ''
                    ? 'font-bold text-red-600'
                    : 'font-bold text-green-700'
                }
              >
                {process.env[key] === undefined || process.env[key] === '' ? '없음' : '있음'}
              </span>
              <code className="text-[12px]">{key}</code>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-[12px] leading-relaxed text-neutral-500">
        여기 있는 값은 모두 집계입니다. 개인정보와 대화 원문은 이 화면에
        나오지 않습니다(COM-007 §7-1).
      </p>
    </div>
  );
}
