/** Figma `불러오는 중` 의 `Loading Skeleton`. 제목은 화면마다 다르다 */
export function LoadingSkeleton({ title }: { title?: string }) {
  return (
    <main aria-busy className="flex flex-1 flex-col gap-5 px-5 py-6">
      {title !== undefined && (
        <h1 className="text-[24px] leading-8 font-bold text-text-primary">{title}</h1>
      )}
      <div className="flex animate-pulse flex-col gap-3">
        <div className="h-5 w-[180px] rounded-2xl bg-meti-line" />
        <div className="h-28 rounded-2xl bg-meti-line" />
        <div className="h-28 rounded-2xl bg-meti-line" />
        <div className="h-5 w-[220px] rounded-2xl bg-meti-line" />
      </div>
    </main>
  );
}
