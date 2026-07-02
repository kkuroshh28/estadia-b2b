/** Skeleton loader del área de app — nunca spinners genéricos. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="space-y-3">
        <div className="esqueleto h-9 w-72" />
        <div className="esqueleto h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="esqueleto h-28" />
        <div className="esqueleto h-28" />
        <div className="esqueleto h-28" />
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <div className="esqueleto h-64" />
        <div className="esqueleto h-64" />
        <div className="esqueleto h-64" />
      </div>
    </div>
  );
}
