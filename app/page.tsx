import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { getPublicCmsContent } from "@/lib/cms/content";
import { PreferencesControls } from "@/components/preferences/preferences-controls";
import { VehicleGallery } from "@/components/public/vehicle-gallery";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { settings } = await getPublicCmsContent();
  const images = settings.heroImageUrl
    ? [{ url: settings.heroImageUrl }]
    : [{ url: "/images/atelier-supercar-hero.png" }];

  return {
    title: settings.seoTitle,
    description: settings.seoDescription,
    robots: settings.sitePublished
      ? { index: true, follow: true }
      : { index: false, follow: false },
    openGraph: {
      title: settings.seoTitle,
      description: settings.seoDescription,
      type: "website",
      images,
    },
    twitter: {
      card: "summary_large_image",
      title: settings.seoTitle,
      description: settings.seoDescription,
      images,
    },
  };
}

export default async function HomePage() {
  const session = await getSession();
  const { settings, faqs, vehicles } = await getPublicCmsContent({
    draft: Boolean(session),
  });
  const style = {
    "--cms-bg": settings.backgroundColor,
    "--site-primary": settings.primaryColor,
    "--site-accent": settings.accentColor,
  } as CSSProperties;

  if (!settings.sitePublished && !session) {
    return (
      <main
        style={style}
        data-i18n
        className="public-site public-hero relative grid min-h-screen place-items-center overflow-hidden bg-[var(--site-bg)] px-6 text-cream"
      >
        <Image
          src="/images/atelier-supercar-hero.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="-z-20 object-cover opacity-35"
        />
        <div className="absolute inset-0 -z-10 bg-black/65" />
        <div className="max-w-xl text-center">
          <p className="text-xs uppercase tracking-[0.35em] text-[var(--site-primary)]">
            {settings.city}
          </p>
          <h1 className="mt-5 font-serif text-5xl">{settings.businessName}</h1>
          <p className="mt-5 text-lg text-cream/70">{settings.tagline}</p>
          <p className="mt-8 text-sm text-cream/50">
            Our new website is being prepared. Please contact us directly for assistance.
          </p>
        </div>
      </main>
    );
  }

  const whatsapp = whatsappUrl(
    settings.whatsappDisplay || settings.phone,
    settings.businessName,
  );
  const heroImage = settings.heroImageUrl || "/images/atelier-supercar-hero.png";
  const [heroLead, heroEmphasis] = splitHeadline(settings.heroTitle);

  return (
    <main data-i18n style={style} className="public-site min-h-screen bg-[var(--site-bg)] text-cream transition-colors">
      {!settings.sitePublished ? (
        <div className="bg-[var(--site-primary)] px-4 py-2 text-center text-xs font-semibold uppercase tracking-widest text-black">
          Draft preview — only signed-in staff can see this version
        </div>
      ) : null}

      <section id="top" className="public-hero relative isolate min-h-screen overflow-hidden">
        <Image
          unoptimized={heroImage.startsWith("http")}
          src={heroImage}
          alt={`${settings.businessName} luxury car rental`}
          fill
          priority
          sizes="100vw"
          className="-z-30 object-cover object-center"
        />
        <div className="absolute inset-0 -z-20 bg-[linear-gradient(90deg,rgba(10,9,8,.96)_0%,rgba(10,9,8,.72)_42%,rgba(10,9,8,.12)_100%)]" />
        <div className="absolute inset-0 -z-20 bg-[linear-gradient(0deg,rgba(10,9,8,.84)_0%,transparent_48%,rgba(10,9,8,.28)_100%)]" />

        <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-7 sm:px-10 lg:px-16">
          <a href="#top" className="flex items-center gap-3" aria-label={`${settings.businessName} home`}>
            {settings.logoUrl ? (
              <Image
                unoptimized
                src={settings.logoUrl}
                alt={`${settings.businessName} logo`}
                width={46}
                height={46}
                className="h-11 w-auto object-contain"
              />
            ) : null}
            <span className="text-xl font-semibold uppercase tracking-[0.25em] text-cream">
              {settings.businessName}
            </span>
          </a>

          <nav
            className="hidden items-center gap-8 text-xs font-medium uppercase tracking-[0.16em] text-cream/80 md:flex"
            aria-label="Primary navigation"
          >
            <a href="#fleet" className="transition-colors hover:text-[var(--site-accent)]">Fleet</a>
            <a href="#about" className="transition-colors hover:text-[var(--site-accent)]">About</a>
            {faqs.length > 0 ? <a href="#faq" className="transition-colors hover:text-[var(--site-accent)]">FAQ</a> : null}
            <a href="#contact" className="transition-colors hover:text-[var(--site-accent)]">Contact</a>
            {whatsapp ? (
              <a
                href={whatsapp}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-cream/40 px-4 py-2 transition-colors hover:border-[var(--site-primary)] hover:text-[var(--site-accent)]"
              >
                WhatsApp
              </a>
            ) : null}
            <PreferencesControls compact />
          </nav>

          <details className="group relative md:hidden">
            <summary className="flex list-none cursor-pointer flex-col gap-1.5 rounded-full border border-cream/50 p-3 text-cream marker:content-none" aria-label="Open navigation menu">
              <span className="h-px w-5 bg-current" />
              <span className="h-px w-5 bg-current" />
            </summary>
            <nav className="absolute right-0 z-50 mt-3 flex w-52 flex-col rounded-2xl border border-white/15 bg-black/90 p-3 text-sm shadow-2xl backdrop-blur-xl">
              <a href="#fleet" className="rounded-xl px-4 py-3 hover:bg-white/10">Fleet</a>
              <a href="#about" className="rounded-xl px-4 py-3 hover:bg-white/10">About</a>
              {faqs.length > 0 ? <a href="#faq" className="rounded-xl px-4 py-3 hover:bg-white/10">FAQ</a> : null}
              <a href="#contact" className="rounded-xl px-4 py-3 hover:bg-white/10">Contact</a>
              <div className="mt-2 border-t border-white/15 px-2 pt-3"><PreferencesControls compact /></div>
            </nav>
          </details>
        </header>

        <div className="mx-auto flex min-h-[calc(100vh-100px)] w-full max-w-7xl items-end px-6 pb-16 sm:px-10 sm:pb-20 lg:px-16 lg:pb-24">
          <div className="max-w-3xl">
            <p className="mb-7 flex items-center gap-4 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--site-accent)]">
              <span className="h-px w-10 bg-[var(--site-primary)]" aria-hidden="true" />
              {settings.heroEyebrow}
            </p>
            <h1 className="max-w-3xl text-pretty text-6xl font-medium leading-[0.88] tracking-[-0.045em] text-cream sm:text-8xl lg:text-9xl">
              <span className="font-sans">{heroLead}</span>{" "}
              <em className="block font-serif font-semibold text-[var(--site-accent)] sm:inline">
                {heroEmphasis}
              </em>
            </h1>
            <p className="mt-8 max-w-xl text-base leading-7 text-cream/80 sm:text-lg">
              {settings.heroSubtitle}
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <a
                href={settings.heroPrimaryHref}
                className="rounded-full bg-[var(--site-primary)] px-7 py-4 text-sm font-semibold uppercase tracking-[0.12em] text-black transition hover:brightness-110"
              >
                {settings.heroPrimaryLabel}
              </a>
              <a
                href={whatsapp || settings.heroSecondaryHref}
                target={whatsapp ? "_blank" : undefined}
                rel={whatsapp ? "noreferrer" : undefined}
                className="rounded-full border border-cream/35 px-7 py-4 text-sm font-semibold uppercase tracking-[0.12em] transition hover:border-[var(--site-primary)] hover:text-[var(--site-accent)]"
              >
                {settings.heroSecondaryLabel}
              </a>
            </div>
          </div>
        </div>
      </section>

      <section id="fleet" className="px-6 py-24 sm:px-10 lg:px-16 lg:py-32">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--site-primary)]">The fleet</p>
              <h2 className="mt-4 max-w-3xl font-serif text-5xl leading-none text-cream sm:text-7xl">
                {settings.fleetTitle}
              </h2>
            </div>
            <p className="max-w-md leading-7 text-cream/55">{settings.fleetBody}</p>
          </div>

          {vehicles.length > 0 ? (
            <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {vehicles.map((vehicle) => (
                <article key={vehicle.id} className="group overflow-hidden border border-white/10 bg-white/[0.035]">
                  <div className="relative aspect-[4/3] overflow-hidden bg-white/5">
                    <VehicleGallery photos={vehicle.photoUrls} alt={`${vehicle.make} ${vehicle.model}`} />
                  </div>
                  <div className="p-6">
                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--site-primary)]">
                      {vehicle.category} · {vehicle.year}
                    </p>
                    <h3 className="mt-3 font-serif text-3xl text-cream">{vehicle.make} {vehicle.model}</h3>
                    <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-5 text-sm">
                      <span className="text-cream/45">From</span>
                      <span>{formatMoney(Number(vehicle.dailyRate), settings.currency)} / day</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-14 border border-white/10 bg-white/[0.025] p-10 text-center text-cream/50">
              Our active fleet will appear here as soon as vehicles are published by the team.
            </div>
          )}
        </div>
      </section>

      <section id="about" className="border-y border-white/10 bg-white/[0.035] px-6 py-24 sm:px-10 lg:px-16 lg:py-32">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.75fr_1.25fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--site-primary)]">{settings.tagline}</p>
            <p className="mt-6 max-w-sm leading-7 text-cream/50">{settings.businessDescription}</p>
          </div>
          <div>
            <h2 className="max-w-4xl font-serif text-5xl leading-[0.98] text-cream sm:text-7xl">{settings.aboutTitle}</h2>
            <p className="mt-8 max-w-3xl whitespace-pre-line text-lg leading-8 text-cream/65">{settings.aboutBody}</p>
          </div>
        </div>
      </section>

      {faqs.length > 0 ? (
        <section id="faq" className="mx-auto max-w-5xl px-6 py-24 sm:px-10 lg:py-32">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--site-primary)]">Good to know</p>
          <h2 className="mt-4 font-serif text-5xl text-cream sm:text-7xl">{settings.faqTitle}</h2>
          <div className="mt-12 divide-y divide-white/10 border-y border-white/10">
            {faqs.map((faq) => (
              <details key={faq.id} className="group py-6">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-lg marker:content-none">
                  <span>{faq.question}</span>
                  <span className="text-2xl text-[var(--site-primary)] transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-4 max-w-3xl whitespace-pre-line leading-7 text-cream/60">{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>
      ) : null}

      <section id="contact" className="px-6 pb-24 sm:px-10 lg:px-16 lg:pb-32">
        <div className="mx-auto max-w-7xl border border-[var(--site-primary)]/35 bg-white/[0.035] p-8 sm:p-14 lg:p-20">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--site-primary)]">{settings.businessName}</p>
          <div className="mt-6 grid gap-10 lg:grid-cols-[1.25fr_0.75fr] lg:items-end">
            <div>
              <h2 className="max-w-3xl font-serif text-5xl leading-none text-cream sm:text-7xl">{settings.contactTitle}</h2>
              <p className="mt-7 max-w-2xl whitespace-pre-line text-lg leading-8 text-cream/60">{settings.contactBody}</p>
            </div>
            <div className="flex flex-col items-start gap-3 lg:items-end">
              {whatsapp ? (
                <a href={whatsapp} target="_blank" rel="noreferrer" className="rounded-full bg-[var(--site-primary)] px-7 py-4 font-semibold text-black transition hover:brightness-110">
                  Start on WhatsApp
                </a>
              ) : null}
              {settings.email ? <a href={`mailto:${settings.email}`} className="text-cream/65 hover:text-[var(--site-accent)]">{settings.email}</a> : null}
              {settings.phone ? <a href={`tel:${settings.phone}`} className="text-cream/65 hover:text-[var(--site-accent)]">{settings.phone}</a> : null}
              {settings.address ? <span className="max-w-xs text-left text-sm text-cream/45 lg:text-right">{settings.address}</span> : null}
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 px-6 py-8 text-xs uppercase tracking-[0.14em] text-cream/45 sm:px-10 lg:px-16">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} {settings.legalName || settings.businessName}</span>
          <span>{settings.footerText}</span>
          <span>{settings.city}, {settings.country}</span>
          {session ? <Link href="/admin" className="text-[var(--site-primary)]">Admin</Link> : null}
        </div>
      </footer>
    </main>
  );
}

function whatsappUrl(value: string | null, businessName: string) {
  const digits = value?.replace(/\D/g, "");
  return digits
    ? `https://wa.me/${digits}?text=${encodeURIComponent(`Hello ${businessName}, I would like help choosing a vehicle.`)}`
    : null;
}

function splitHeadline(value: string): [string, string] {
  const words = value.trim().split(/\s+/);
  if (words.length < 3) return [value, ""];
  return [words.slice(0, -2).join(" "), words.slice(-2).join(" ")];
}

function formatMoney(value: number, currency: string) {
  if (!/^[A-Z]{3}$/.test(currency)) return String(value);
  return new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}
