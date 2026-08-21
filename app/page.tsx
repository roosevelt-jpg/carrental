import Image from "next/image";
import { headers } from "next/headers";

function getTenant(host: string | null) {
  const hostname = (host ?? "").split(":")[0].toLowerCase();
  const parts = hostname.split(".");

  if (parts.length >= 3 && parts.at(-2) === "myflynai" && parts.at(-1) === "com") {
    return parts[0];
  }

  return null;
}

export default async function Home() {
  const host = (await headers()).get("host");
  const tenant = getTenant(host) ?? "carrental";

  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-ink">
      <Image
        src="/images/carrental-hero.png"
        alt="Luxury car driving along a coastal mountain road"
        fill
        priority
        sizes="100vw"
        className="-z-20 object-cover object-center"
      />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(16,14,12,.94)_0%,rgba(16,14,12,.7)_42%,rgba(16,14,12,.12)_100%)]" />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(0deg,rgba(16,14,12,.8)_0%,transparent_45%,rgba(16,14,12,.2)_100%)]" />

      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-7 sm:px-10 lg:px-16">
        <a href="#top" className="text-xl font-semibold tracking-[0.28em] text-cream" aria-label="Drivn home">
          DRIVN<span className="align-top text-xs text-gold">+</span>
        </a>
        <nav className="hidden items-center gap-8 text-xs font-medium uppercase tracking-[0.16em] text-cream/80 md:flex" aria-label="Primary navigation">
          <a href="#fleet" className="transition-colors hover:text-gold-2">Our fleet</a>
          <a href="#story" className="transition-colors hover:text-gold-2">Our story</a>
          <a href="#contact" className="transition-colors hover:text-gold-2">Contact</a>
          <a href="/admin" className="rounded-full border border-cream/40 px-4 py-2 transition-colors hover:border-gold hover:text-gold-2">Admin</a>
        </nav>
        <button type="button" className="rounded-full border border-cream/50 p-3 text-cream md:hidden" aria-label="Open navigation menu">
          <span className="block h-px w-5 bg-current" />
          <span className="mt-1.5 block h-px w-5 bg-current" />
        </button>
      </header>

      <section id="top" className="mx-auto flex min-h-[calc(100vh-96px)] w-full max-w-7xl items-end px-6 pb-16 sm:px-10 sm:pb-20 lg:px-16 lg:pb-24">
        <div className="max-w-2xl">
          <p className="mb-7 flex items-center gap-4 text-xs font-semibold uppercase tracking-[0.2em] text-gold-2">
            <span className="h-px w-10 bg-gold" aria-hidden="true" />
            Your {tenant} journey starts here
          </p>
          <h1 className="max-w-xl text-pretty text-6xl font-medium leading-[0.87] tracking-[-0.04em] text-cream sm:text-8xl lg:text-9xl">
            Go your<br /><em className="font-serif font-semibold">own way.</em>
          </h1>
          <p className="mt-8 max-w-md text-base leading-7 text-cream/80 sm:text-lg">
            Beautiful cars, thoughtfully delivered. Rent the feeling of freedom without the friction.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <a href="#fleet" className="rounded-full bg-gold px-7 py-4 text-sm font-semibold uppercase tracking-[0.12em] text-ink transition-colors hover:bg-gold-2">Explore the fleet</a>
            <span className="text-xs uppercase tracking-[0.14em] text-cream/60">Serving the road less ordinary</span>
          </div>
        </div>
      </section>

      <section id="fleet" className="bg-ink px-6 py-24 sm:px-10 lg:px-16">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">The fleet</p>
            <h2 className="mt-3 text-5xl text-cream sm:text-6xl">Choose your feeling.</h2>
          </div>
          <p className="max-w-sm leading-7 text-muted">From effortless city miles to weekends that deserve a wider horizon, find the car that changes the journey.</p>
        </div>
      </section>

      <section id="story" className="border-t border-line bg-panel px-6 py-20 sm:px-10 lg:px-16">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Welcome to {tenant}</p>
          <h2 className="mt-4 max-w-3xl text-5xl text-cream sm:text-7xl">A better way to get there.</h2>
        </div>
      </section>

      <footer id="contact" className="flex flex-col gap-4 bg-ink px-6 py-8 text-xs uppercase tracking-[0.14em] text-muted sm:flex-row sm:items-center sm:justify-between sm:px-10 lg:px-16">
        <span>© 2026 Drivn+</span>
        <span>{tenant}.myflynai.com</span>
      </footer>
    </main>
  );
}
