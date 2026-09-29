export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col px-4 py-6">
      <header className="flex items-center justify-between">
        <span className="text-lg font-bold tracking-tight">Sportswear Store</span>
      </header>

      <section className="flex flex-1 flex-col items-start justify-center gap-4 py-12">
        <h1 className="text-3xl leading-tight font-bold sm:text-5xl">
          Perlengkapan olahraga untuk setiap langkahmu
        </h1>
        <p className="max-w-prose text-neutral-600">
          Katalog produk segera hadir. Halaman ini masih placeholder.
        </p>
      </section>
    </main>
  );
}
