/**
 * PAR-002 부모 HOME · `/parent` (DEV-002)
 *
 * "등록 학생들의 현황 확인"(COM-003). 최근 7일을 센다.
 *
 * **부모 어휘로 쓴다.** 학생 화면의 「미션」 이 여기서는 「학습」 이고,
 * 「한 번 더 도전」 이 「추가 학습 필요」 다 — 변환은 `copy.ts` 한 곳에서만
 * 한다.
 *
 * 상세 평가점수는 부모에게 보여도 된다(COM-003). 다만 **고칠 수는 없다** —
 * 난이도 · Logic Gap · Student Memory 를 사람이 손대면 다음 문제 선정이
 * 어긋난다(COM-003 §9 · COM-007 §8).
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { listStudents } from '@/lib/services/student';
import { summarize, type StudentSummary } from '@/lib/services/parent-summary';
import { GAP_DEFINITIONS } from '@/lib/ai/taxonomy';
import { TERMS } from '@/lib/constants/copy';
import { PartnerFace } from '@/components/ui/PartnerFace';

export const metadata = { title: '학습 현황 · 메티' };

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-semibold text-meti-sub">{label}</span>
      <span className="text-[15px] font-extrabold text-meti-ink">{value}</span>
    </div>
  );
}

/** 0~2 를 사람이 읽는 말로. 숫자만 두면 무엇에 대한 2 인지 알 수 없다 */
function level(value: number | null): string {
  if (value === null) return '—';
  if (value >= 1.6) return `잘함 (${value.toFixed(1)})`;
  if (value >= 0.8) return `보통 (${value.toFixed(1)})`;
  return `도움 필요 (${value.toFixed(1)})`;
}

function StudentCard({ summary }: { summary: StudentSummary }) {
  return (
    <li className="flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm">
      <header className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-meti-bg">
          <PartnerFace persona={summary.persona} size={36} />
        </span>
        <div className="flex flex-col">
          <p className="text-[15px] font-bold text-meti-ink">{summary.nickname}</p>
          <p className="text-[12px] text-meti-sub">초등 {summary.grade}학년 · 최근 7일</p>
        </div>
      </header>

      {summary.solved === 0 ? (
        <p className="text-[13px] leading-relaxed text-meti-sub">
          최근 7일 동안 학습 기록이 없습니다.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="학습한 문제" value={`${summary.solved}개`} />
            <Stat label="완료" value={`${summary.completed}개`} />
            <Stat
              label={TERMS.learningResult.parent === '학습 결과' ? '추가 학습 필요' : '추가'}
              value={`${summary.needsReview}개`}
            />
          </div>

          <div className="grid grid-cols-3 gap-3 border-t border-black/5 pt-4">
            <Stat label="근거 설명" value={level(summary.reasoning)} />
            <Stat label="규칙 적용" value={level(summary.rule)} />
            <Stat
              label="스스로 고침"
              value={`${summary.selfCorrected}회`}
            />
          </div>

          {summary.gaps.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-black/5 pt-4">
              <p className="text-[12px] font-bold text-meti-sub">자주 막힌 부분</p>
              <ul className="flex flex-col gap-1.5">
                {summary.gaps.slice(0, 3).map((gap) => (
                  <li key={gap.type} className="flex items-baseline justify-between gap-3">
                    <span className="text-[13px] leading-relaxed text-meti-ink">
                      {GAP_DEFINITIONS[gap.type]}
                    </span>
                    <span className="shrink-0 text-[12px] font-bold text-meti-sub">
                      {gap.count}회
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </li>
  );
}

export default async function ParentHomePage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (auth.user === null) redirect('/login');

  const students = await listStudents(supabase);
  const summaries = await Promise.all(
    students.map((student) =>
      summarize(supabase, {
        student_id: student.student_id,
        nickname: student.nickname,
        grade: student.grade,
        persona_type: student.persona_type,
      }),
    ),
  );

  return (
    <main className="flex flex-1 flex-col gap-4 px-5 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-extrabold text-meti-ink">학습 현황</h1>
        <p className="text-[13px] text-meti-sub">
          아이가 어떻게 생각했는지를 봅니다. 점수를 매기는 화면이 아닙니다.
        </p>
      </header>

      {summaries.length === 0 ? (
        <p className="rounded-2xl bg-white p-5 text-[14px] leading-relaxed text-meti-sub shadow-sm">
          등록된 학생이 없습니다.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {summaries.map((summary) => (
            <StudentCard key={summary.studentId} summary={summary} />
          ))}
        </ul>
      )}

      <Link
        href="/students"
        className="text-center text-[13px] font-semibold text-meti-sub underline"
      >
        학생 화면으로
      </Link>
    </main>
  );
}
