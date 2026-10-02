export default function ProductLoading() {
  return (
    <main className="mx-auto max-w-7xl px-4 pt-4 pb-14 md:px-6 lg:px-8" aria-busy="true">
      <p className="sr-only" role="status">
        Memuat produk...
      </p>
      <div
        aria-hidden
        className="mt-12 grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-12"
      >
        <div className="aspect-square animate-pulse rounded-2xl bg-muted" />
        <div className="flex flex-col gap-4">
          <span className="h-8 w-11/12 animate-pulse rounded-lg bg-muted" />
          <span className="h-6 w-1/3 animate-pulse rounded-lg bg-muted" />
          <div className="mt-4 flex gap-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} className="size-11 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
          <span className="mt-4 h-[52px] animate-pulse rounded-full bg-muted" />
        </div>
      </div>
    </main>
  );
}
