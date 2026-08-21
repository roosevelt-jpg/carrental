import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getPublicCmsContent } from "@/lib/cms/content";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { settings } = await getPublicCmsContent();
  return {
    title: settings.seoTitle,
    description: settings.seoDescription,
    robots: settings.sitePublished ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: {
      title: settings.seoTitle,
      description: settings.seoDescription,
      type: "website",
      ...(settings.heroImageUrl ? { images: [{ url: settings.heroImageUrl }] } : {}),
    },
  };
}

export default async function HomePage() {
  const session = await getSession();
  const { settings, faqs, vehicles } = await getPublicCmsContent({ draft: Boolean(session) });
  const style = {
    "--site-bg": settings.backgroundColor,
    "--site-primary": settings.primaryColor,
    "--site-accent": settings.accentColor,
  } as CSSProperties;

  if (!settings.sitePublished && !session) {
    return (
      <main style={style} className="min-h-screen bg-[var(--site-bg)] px-6 text-cream grid place-items-center">
        <div className="max-w-xl text-center">
          <p className="text-xs uppercase tracking-[0.35em] text-[var(--site-primary)]">{settings.city}</p>
          <h1 className="mt-5 font-serif text-5xl">{settings.businessName}</h1>
          <p className="mt-5 text-lg text-cream/70">{settings.tagline}</p>
          <p className="mt-8 text-sm text-cream/50">Our new website is being prepared. Please contact us directly for assistance.</p>
        </div>
      </main>
    );
  }

  const whatsapp = whatsappUrl(settings.whatsappDisplay || settings.phone, settings.businessName);
  return (
    <main style={style} className="min-h-screen bg-[var(--site-bg)] text-cream">
      {!settings.sitePublished ? <div className="bg-[var(--site-primary)] px-4 py-2 text-center text-xs font-semibold uppercase tracking-widest text-black">Draft preview — only signed-in staff can see this version</div> : null}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[color:var(--site-bg)]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
          <a href="#top" className="flex items-center gap-3">
            {settings.logoUrl ? <Image unoptimized src={settings.logoUrl} alt={`${settings.businessName} logo`} width={44} height={44} className="h-11 w-auto object-contain" /> : null}
            <span className="font-serif text-2xl text-[var(--site-accent)]">{settings.businessName}</span>
          </a>
          <nav className="hidden items-center gap-8 text-sm text-cream/70 md:flex">
            <a href="#fleet">Fleet</a><a href="#about">About</a><a href="#faq">FAQ</a><a href="#contact">Contact</a>
          </nav>
          {whatsapp ? <a href={whatsapp} target="_blank" rel="noreferrer" className="rounded-full bg-[var(--site-primary)] px-5 py-2.5 text-sm font-semibold text-black">WhatsApp</a> : null}
        </div>
      </header>

      <section id="top" className="relative isolate min-h-[78vh] overflow-hidden">
        {settings.heroImageUrl ? <Image unoptimized priority fill sizes="100vw" src={settings.heroImageUrl} alt="" className="-z-20 object-cover opacity-45" /> : null}
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/85 via-black/55 to-black/15" />
        <div className="mx-auto flex min-h-[78vh] max-w-7xl items-center px-6 py-24 lg:px-10">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.35em] text-[var(--site-accent)]">{settings.heroEyebrow}</p>
            <h1 className="mt-6 max-w-2xl font-serif text-5xl leading-[0.98] sm:text-7xl lg:text-8xl">{settings.heroTitle}</h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-cream/70">{settings.heroSubtitle}</p>
            <div className="mt-10 flex flex-wrap gap-3">
              <a href={settings.heroPrimaryHref} className="rounded-full bg-[var(--site-primary)] px-7 py-3.5 font-semibold text-black">{settings.heroPrimaryLabel}</a>
              <a href={whatsapp || settings.heroSecondaryHref} target={whatsapp ? "_blank" : undefined} rel={whatsapp ? "noreferrer" : undefined} className="rounded-full border border-white/25 px-7 py-3.5 font-semibold">{settings.heroSecondaryLabel}</a>
            </div>
          </div>
        </div>
      </section>

      <section id="about" className="mx-auto grid max-w-7xl gap-10 px-6 py-24 lg:grid-cols-[0.8fr_1.2fr] lg:px-10">
        <p className="text-xs uppercase tracking-[0.32em] text-[var(--site-primary)]">{settings.tagline}</p>
        <div><h2 className="font-serif text-4xl sm:text-6xl">{settings.aboutTitle}</h2><p className="mt-7 max-w-3xl whitespace-pre-line text-lg leading-8 text-cream/65">{settings.aboutBody}</p></div>
      </section>

      <section id="fleet" className="border-y border-white/10 bg-white/[0.025] py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <p className="text-xs uppercase tracking-[0.32em] text-[var(--site-primary)]">Live inventory</p>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-5"><div><h2 className="font-serif text-4xl sm:text-6xl">{settings.fleetTitle}</h2><p className="mt-4 max-w-2xl text-cream/60">{settings.fleetBody}</p></div>{whatsapp ? <a href={whatsapp} target="_blank" rel="noreferrer" className="text-sm text-[var(--site-accent)]">Ask about availability →</a> : null}</div>
          {vehicles.length > 0 ? <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{vehicles.map((vehicle) => <article key={vehicle.id} className="overflow-hidden rounded-2xl border border-white/10 bg-black/20"><div className="relative aspect-[4/3] bg-white/5">{vehicle.photoUrls[0] ? <Image unoptimized fill sizes="(max-width: 768px) 100vw, 33vw" src={vehicle.photoUrls[0]} alt={`${vehicle.make} ${vehicle.model}`} className="object-cover" /> : <div className="grid h-full place-items-center text-sm text-cream/30">Photography coming soon</div>}</div><div className="p-6"><p className="text-xs uppercase tracking-widest text-[var(--site-primary)]">{vehicle.category} · {vehicle.year}</p><h3 className="mt-2 font-serif text-3xl">{vehicle.make} {vehicle.model}</h3><div className="mt-5 flex items-center justify-between text-sm"><span className="text-cream/55">From</span><span>{formatMoney(Number(vehicle.dailyRate), settings.currency)} / day</span></div></div></article>)}</div> : <p className="mt-12 rounded-2xl border border-white/10 p-10 text-center text-cream/50">Our active fleet will appear here as soon as vehicles are published by the team.</p>}
        </div>
      </section>

      {faqs.length > 0 ? <section id="faq" className="mx-auto max-w-5xl px-6 py-24 lg:px-10"><h2 className="font-serif text-4xl sm:text-6xl">{settings.faqTitle}</h2><div className="mt-10 divide-y divide-white/10 border-y border-white/10">{faqs.map((faq) => <details key={faq.id} className="group py-6"><summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-lg"><span>{faq.question}</span><span className="text-[var(--site-primary)] group-open:rotate-45">+</span></summary><p className="mt-4 max-w-3xl whitespace-pre-line leading-7 text-cream/60">{faq.answer}</p></details>)}</div></section> : null}

      <section id="contact" className="mx-auto max-w-7xl px-6 py-24 lg:px-10"><div className="rounded-3xl border border-[var(--site-primary)]/30 bg-white/[0.035] p-8 sm:p-14"><p className="text-xs uppercase tracking-[0.32em] text-[var(--site-primary)]">{settings.businessName}</p><h2 className="mt-5 max-w-3xl font-serif text-4xl sm:text-6xl">{settings.contactTitle}</h2><p className="mt-6 max-w-2xl whitespace-pre-line text-lg leading-8 text-cream/65">{settings.contactBody}</p><div className="mt-9 flex flex-wrap gap-3">{whatsapp ? <a href={whatsapp} target="_blank" rel="noreferrer" className="rounded-full bg-[var(--site-primary)] px-7 py-3.5 font-semibold text-black">Start on WhatsApp</a> : null}{settings.email ? <a href={`mailto:${settings.email}`} className="rounded-full border border-white/20 px-7 py-3.5">{settings.email}</a> : null}{settings.phone ? <a href={`tel:${settings.phone}`} className="rounded-full border border-white/20 px-7 py-3.5">{settings.phone}</a> : null}</div></div></section>

      <footer className="border-t border-white/10"><div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-8 text-sm text-cream/45 sm:flex-row sm:items-center sm:justify-between lg:px-10"><p>© {new Date().getFullYear()} {settings.legalName || settings.businessName}. {settings.footerText}</p><div className="flex gap-5"><span>{settings.city}, {settings.country}</span>{session ? <Link href="/admin" className="text-[var(--site-primary)]">Admin</Link> : null}</div></div></footer>
    </main>
  );
}

function whatsappUrl(value: string | null, businessName: string) {
  const digits = value?.replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}?text=${encodeURIComponent(`Hello ${businessName}, I would like help choosing a vehicle.`)}` : null;
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("en-AE", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}
