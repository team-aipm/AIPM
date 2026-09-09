import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { runStage, stageOf } from '@/lib/ai/pipeline/run';
import { getPath, parsePath, setPath } from '@/lib/ai/pipeline/paths';

/**
 * 주간 성장 리포트 (07 WEEKLY REPORT · RPT-001)
 *
 *   GET /api/batch/weekly-report     매주 월요일 04:00 KST
 *
 * 지난 한 주(월~일)를 학생마다 한 건씩 만든다. **하루 총평(06)이 있는
 * 날만 센다** — 학습이 없던 날을 0 으로 넣으면 "안 한 주" 와 "못 한 주" 가
 * 같아진다.
 *
 * 세션이 없는 작업이라 `service_role` 을 쓴다(DEV-001 §8). 그래서
 * `CRON_SECRET` 을 아는 요청만 받는다.
 */

export const dynamic = 'force-dynamic';
/** 학생이 늘면 한 번에 다 못 돈다. 다음 주에 또 돌므로 이번 주 것만 채운다 */
export const maxDuration = 300;

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (secret === undefined || secret.trim() === '') return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

const write = (json: unknown, path: string, value: unknown): unknown => {
  const segments = parsePath(path);
  return segments === null ? json : setPath(json, segments, value);
};

const read = (json: unknown, path: string): unknown => {
  const segments = parsePath(path);
  return segments === null ? undefined : getPath(json, segments).value;
};

/** 지난주 월요일 ~ 일요일. 서울 기준 */
function lastWeek(): { start: string; end: string } {
  const fmt = (date: Date) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(date);

  const now = new Date();
  const seoulDow = Number(
    new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', weekday: 'short' })
      .format(now)
      .replace(/Sun|Mon|Tue|Wed|Thu|Fri|Sat/, (d) =>
        String(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(d)),
      ),
  );

  const thisMonday = new Date(now);
  // 일요일(0)이면 6일 전이 이번 주 월요일이다.
  thisMonday.setDate(now.getDate() - ((seoulDow + 6) % 7));

  const start = new Date(thisMonday);
  start.setDate(thisMonday.getDate() - 7);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  return { start: fmt(start), end: fmt(end) };
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { start, end } = lastWeek();

  const { data: students, error: studentError } = await supabase
    .from('student')
    .select('student_id, grade')
    .eq('student_status', 'active');

  if (studentError !== null) {
    console.error(`[weekly-report] 학생 목록 실패: ${studentError.message}`);
    return NextResponse.json({ error: 'list failed' }, { status: 500 });
  }

  let made = 0;
  let skipped = 0;

  for (const student of students ?? []) {
    // 이미 만들었으면 다시 만들지 않는다. 같은 주의 리포트가 두 벌 생기면
    // 부모 화면에 같은 기간이 두 번 나온다.
    const { data: already } = await supabase
      .from('learning_report')
      .select('report_id')
      .eq('student_id', student.student_id)
      .eq('report_type', 'weekly_parent')
      .eq('period_start', start)
      .limit(1)
      .maybeSingle();

    if (already !== null) {
      skipped += 1;
      continue;
    }

    const { data: dailies } = await supabase
      .from('learning_report')
      .select('period_start, summary_data')
      .eq('student_id', student.student_id)
      .eq('report_type', 'daily_student')
      .gte('period_start', start)
      .lte('period_start', end)
      .order('period_start', { ascending: true });

    const days = dailies ?? [];
    // 한 주 동안 하루도 마치지 못했으면 리포트를 만들지 않는다.
    // 없는 것을 그럴듯하게 채우지 않는다(RPT-001 「데이터 부족」 State).
    if (days.length === 0) {
      skipped += 1;
      continue;
    }

    const { data: problems } = await supabase
      .from('problem')
      .select('learning_mode, evaluation(self_correction, support_level)')
      .eq('student_id', student.student_id)
      .gte('created_at', `${start}T00:00:00+09:00`)
      .lte('created_at', `${end}T23:59:59+09:00`);

    const rows = problems ?? [];
    const evaluations = rows
      .map((row) => (Array.isArray(row.evaluation) ? row.evaluation[0] : row.evaluation))
      .filter((item): item is NonNullable<typeof item> => item !== null && item !== undefined);

    const corrected = evaluations.filter((item) => item.self_correction).length;
    const supports = evaluations.map((item) => item.support_level);

    const stage = stageOf('07 WEEKLY REPORT');
    let input: unknown = JSON.parse(stage.sampleInput);
    input = write(input, 'student.student_id', student.student_id);
    input = write(input, 'student.grade', student.grade);
    input = write(
      input,
      'payload.daily_summaries',
      days.map((day) => ({
        date: day.period_start,
        ...(typeof day.summary_data === 'object' && day.summary_data !== null
          ? ((read(day.summary_data, 'daily_summary') as object) ?? {})
          : {}),
      })),
    );
    input = write(input, 'payload.weekly_metrics', {
      total_problems: rows.length,
      mode_a_count: rows.filter((row) => row.learning_mode === 'mode_a').length,
      mode_b_count: rows.filter((row) => row.learning_mode === 'mode_b').length,
      // 평가가 없으면 비율도 없다. 0 으로 채우지 않는다.
      self_correction_rate:
        evaluations.length === 0 ? null : corrected / evaluations.length,
      average_support_level:
        supports.length === 0
          ? null
          : supports.reduce((sum, value) => sum + value, 0) / supports.length,
      total_hint_count: 0,
    });

    const result = await runStage('07 WEEKLY REPORT', JSON.stringify(input, null, 2));
    if (!result.ok) {
      console.error(`[weekly-report] ${student.student_id} 실패: ${result.error}`);
      continue;
    }

    const { error: saveError } = await supabase.from('learning_report').insert({
      student_id: student.student_id,
      report_type: 'weekly_parent',
      period_start: start,
      period_end: end,
      summary_data: result.output as never,
    });

    if (saveError !== null) {
      console.error(`[weekly-report] ${student.student_id} 저장 실패: ${saveError.message}`);
      continue;
    }

    await supabase.from('event').insert({
      event_name: 'weekly_report_generated',
      student_id: student.student_id,
      event_properties: { period_start: start, period_end: end } as never,
    });

    made += 1;
  }

  console.log(`[weekly-report] ${start}~${end} · ${made}건 생성 · ${skipped}건 건너뜀`);
  return NextResponse.json({ periodStart: start, periodEnd: end, made, skipped });
}
