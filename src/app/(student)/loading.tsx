/**
 * 학생 영역을 넘어가는 동안 보이는 자리.
 *
 * **누르자마자 화면이 바뀌어야 한다.** 이 파일이 없으면 다음 화면이 다
 * 준비될 때까지(Supabase 왕복 몇 번) 이전 화면이 그대로 멈춰 있고, 아이는
 * 안 눌린 줄 알고 한 번 더 누른다.
 *
 * 캐릭터는 그리지 않는다. 이 순간에는 아직 어느 친구인지 모른다 — 엉뚱한
 * 친구가 잠깐 비쳤다가 바뀌는 것이 빈 자리보다 어색하다.
 */
export default function StudentLoading() {
  return (
    <main aria-busy className="flex flex-1 flex-col gap-5 px-5 pt-4" aria-label="불러오는 중">
      <div className="flex items-center gap-3">
        <div className="size-12 animate-pulse rounded-full bg-surface-brand" />
        <div className="flex flex-col gap-2">
          <div className="h-5 w-32 animate-pulse rounded bg-meti-line" />
          <div className="h-4 w-44 animate-pulse rounded bg-meti-line" />
        </div>
      </div>
      <div className="h-[220px] animate-pulse rounded-3xl bg-surface-brand" />
      <div className="h-[96px] animate-pulse rounded-2xl bg-surface-primary shadow-card" />
    </main>
  );
}
