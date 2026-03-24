export default function RouteLoadingFallback() {
  return (
    <div className="h-full overflow-y-auto bg-surface">
      <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col gap-5 px-4 py-6 md:py-8">
        <div className="glass-card rounded-2xl p-5 md:p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-4 w-24 rounded bg-fill" />
            <div className="h-8 w-48 rounded bg-fill" />
            <div className="h-4 w-64 max-w-full rounded bg-fill" />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="glass-card rounded-2xl p-5">
            <div className="animate-pulse space-y-3">
              <div className="h-5 w-28 rounded bg-fill" />
              <div className="h-24 rounded-2xl bg-fill" />
              <div className="h-24 rounded-2xl bg-fill" />
            </div>
          </div>
          <div className="glass-card rounded-2xl p-5">
            <div className="animate-pulse space-y-3">
              <div className="h-5 w-20 rounded bg-fill" />
              <div className="h-10 rounded-xl bg-fill" />
              <div className="h-10 rounded-xl bg-fill" />
              <div className="h-10 rounded-xl bg-fill" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
