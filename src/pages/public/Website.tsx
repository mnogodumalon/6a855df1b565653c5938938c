import { useEffect, useRef, useState } from 'react';
import { PublicShell } from '@/components/PublicShell';
import {
  loadPublicPagesConfig,
  listPublicRecords,
  type PublicPagesConfig,
  type PublicPageConfig,
} from '@/lib/publicClient';
import { tx } from '@/i18n';
import { APP_IDS } from '@/types/app';

interface WebsiteContent {
  id: string;
  unternehmensname: string | null;
  slogan: string | null;
  beschreibung: string | null;
  anzahl_plaetze: number | null;
  leistungen: string | null;
  oeffnungszeiten: string | null;
  telefon: string | null;
  email: string | null;
  strasse: string | null;
  hausnummer: string | null;
  plz: string | null;
  ort: string | null;
  galerie: string | null;
}

export default function Website() {
  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [content, setContent] = useState<WebsiteContent | null>(null);
  const [loading, setLoading] = useState(true);

  const leistungenRef = useRef<HTMLElement>(null);
  const kontaktRef = useRef<HTMLElement>(null);
  const galerieRef = useRef<HTMLElement>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    loadPublicPagesConfig('hundepension').then(async (c) => {
      setCfg(c);
      const p = c?.pages['hundepension'] ?? null;
      setPage(p);
      if (c && p) {
        const ep = p.endpoints?.find((e) => e.op === 'list');
        if (ep) {
          const result = await listPublicRecords(c, p, {
            appId: ep.app_id,
            limit: 1,
          });
          const records = Object.values(result);
          if (records.length > 0) {
            const r = records[0];
            const f = r.fields as Record<string, unknown>;
            setContent({
              id: r.id,
              unternehmensname: (f.unternehmensname as string) ?? null,
              slogan: (f.slogan as string) ?? null,
              beschreibung: (f.beschreibung as string) ?? null,
              anzahl_plaetze: (f.anzahl_plaetze as number) ?? null,
              leistungen: (f.leistungen as string) ?? null,
              oeffnungszeiten: (f.oeffnungszeiten as string) ?? null,
              telefon: (f.telefon as string) ?? null,
              email: (f.email as string) ?? null,
              strasse: (f.strasse as string) ?? null,
              hausnummer: (f.hausnummer as string) ?? null,
              plz: (f.plz as string) ?? null,
              ort: (f.ort as string) ?? null,
              galerie: (f.galerie as string) ?? null,
            });
          }
        }
      }
      setLoading(false);
    });
  }, []);

  if (loading || !cfg || !page) {
    return <PublicShell loading={loading} unavailable={!loading} />;
  }

  const name = content?.unternehmensname ?? tx('Hundepension');
  const leistungenLines = content?.leistungen
    ? content.leistungen.split('\n').map((l) => l.trim()).filter(Boolean)
    : [];
  const oeffnungsLines = content?.oeffnungszeiten
    ? content.oeffnungszeiten.split('\n').map((l) => l.trim()).filter(Boolean)
    : [];
  const adresse = [
    content?.strasse && content?.hausnummer
      ? `${content.strasse} ${content.hausnummer}`
      : content?.strasse ?? null,
    content?.plz && content?.ort
      ? `${content.plz} ${content.ort}`
      : content?.ort ?? null,
  ].filter(Boolean).join(', ');

  return (
    <PublicShell fullBleed>
      {/* Hero */}
      <section className="relative bg-amber-950 text-white overflow-hidden">
        <div
          className="absolute inset-0 opacity-20 bg-cover bg-center"
          style={
            content?.galerie
              ? { backgroundImage: `url(${content.galerie})` }
              : {}
          }
          aria-hidden="true"
        />
        <div className="relative max-w-5xl mx-auto px-4 py-20 sm:py-32 text-center">
          <div className="inline-flex items-center gap-2 bg-amber-700/60 rounded-full px-4 py-1.5 text-amber-200 text-sm font-medium mb-6">
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 10c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2z"/><path d="M7 7c0-1.7 1.3-3 3-3"/><path d="M14 7c0-1.7-1.3-3-3-3"/><ellipse cx="12" cy="17" rx="5" ry="3"/><path d="M7 14c-1.1.5-2 1.4-2 2.5C5 18.4 8.1 20 12 20s7-1.6 7-3.5c0-1.1-.9-2-2-2.5"/></svg>
            {tx('Ihre Hundepension')}
          </div>
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight mb-4">
            {name}
          </h1>
          {content?.slogan && (
            <p className="text-xl sm:text-2xl text-amber-200 mb-8 max-w-2xl mx-auto">
              {content.slogan}
            </p>
          )}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="/#/public/buchungsanfrage"
              className="inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-white font-semibold px-6 py-3 rounded-xl transition-colors text-base"
            >
              {tx('Jetzt anfragen')}
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            </a>
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-medium px-6 py-3 rounded-xl transition-colors text-base"
              onClick={() => kontaktRef.current?.scrollIntoView({ behavior: 'smooth' })}
            >
              {tx('Kontakt')}
            </button>
          </div>
          {content?.anzahl_plaetze != null && (
            <p className="mt-8 text-amber-300 text-sm">
              {tx('Plätze verfügbar:')} <span className="font-semibold text-white">{content.anzahl_plaetze}</span>
            </p>
          )}
        </div>
      </section>

      {/* Nav strip */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-stone-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 flex gap-6 overflow-x-auto py-3 text-sm font-medium">
          {content?.beschreibung && (
            <button
              type="button"
              className="text-stone-600 hover:text-amber-800 whitespace-nowrap transition-colors"
              onClick={() => leistungenRef.current?.scrollIntoView({ behavior: 'smooth' })}
            >
              {tx('Über uns')}
            </button>
          )}
          {leistungenLines.length > 0 && (
            <button
              type="button"
              className="text-stone-600 hover:text-amber-800 whitespace-nowrap transition-colors"
              onClick={() => leistungenRef.current?.scrollIntoView({ behavior: 'smooth' })}
            >
              {tx('Leistungen')}
            </button>
          )}
          {content?.galerie && (
            <button
              type="button"
              className="text-stone-600 hover:text-amber-800 whitespace-nowrap transition-colors"
              onClick={() => galerieRef.current?.scrollIntoView({ behavior: 'smooth' })}
            >
              {tx('Galerie')}
            </button>
          )}
          <button
            type="button"
            className="text-stone-600 hover:text-amber-800 whitespace-nowrap transition-colors"
            onClick={() => kontaktRef.current?.scrollIntoView({ behavior: 'smooth' })}
          >
            {tx('Kontakt')}
          </button>
          <a
            href="/#/public/buchungsanfrage"
            className="ml-auto whitespace-nowrap bg-amber-500 hover:bg-amber-400 text-white font-semibold px-4 py-1.5 rounded-lg transition-colors text-sm"
          >
            {tx('Anfragen')}
          </a>
        </div>
      </div>

      {/* Beschreibung */}
      {content?.beschreibung && (
        <section className="bg-stone-50 py-16">
          <div className="max-w-5xl mx-auto px-4">
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-2xl sm:text-3xl font-bold text-stone-800 mb-4">
                {tx('Über uns')}
              </h2>
              <p className="text-stone-600 text-lg leading-relaxed whitespace-pre-line">
                {content.beschreibung}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Leistungen */}
      {leistungenLines.length > 0 && (
        <section ref={leistungenRef} className="py-16">
          <div className="max-w-5xl mx-auto px-4">
            <h2 className="text-2xl sm:text-3xl font-bold text-stone-800 mb-10 text-center">
              {tx('Unsere Leistungen')}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {leistungenLines.map((line, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 bg-amber-50 rounded-xl p-4 border border-amber-100"
                >
                  <span className="mt-0.5 shrink-0 text-amber-600">
                    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                  </span>
                  <span className="text-stone-700 text-sm leading-snug">{line}</span>
                </div>
              ))}
            </div>
            {content?.anzahl_plaetze != null && (
              <div className="mt-8 flex justify-center">
                <div className="inline-flex items-center gap-3 bg-amber-100 border border-amber-200 rounded-2xl px-6 py-4 text-amber-900">
                  <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
                  <div>
                    <p className="text-2xl font-bold leading-none">{content.anzahl_plaetze}</p>
                    <p className="text-sm text-amber-700 mt-0.5">{tx('verfügbare Plätze')}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Galerie */}
      {content?.galerie && (
        <section ref={galerieRef} className="py-16 bg-stone-50">
          <div className="max-w-5xl mx-auto px-4">
            <h2 className="text-2xl sm:text-3xl font-bold text-stone-800 mb-8 text-center">
              {tx('Galerie')}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <button
                type="button"
                className="col-span-2 sm:col-span-2 aspect-video rounded-2xl overflow-hidden focus:outline-none focus:ring-2 focus:ring-amber-500"
                onClick={() => setLightbox(content.galerie!)}
              >
                <img
                  src={content.galerie}
                  alt={name}
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                />
              </button>
              <div className="flex flex-col gap-3">
                <div className="flex-1 rounded-2xl overflow-hidden bg-amber-100 flex items-center justify-center text-amber-400">
                  <svg aria-hidden="true" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
                </div>
                <div className="flex-1 rounded-2xl overflow-hidden bg-amber-50 flex items-center justify-center text-amber-300">
                  <svg aria-hidden="true" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Kontakt + Öffnungszeiten */}
      <section ref={kontaktRef} className="py-16">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-2xl sm:text-3xl font-bold text-stone-800 mb-10 text-center">
            {tx('Kontakt & Öffnungszeiten')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Kontaktdaten */}
            <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm space-y-4">
              <h3 className="font-semibold text-stone-800 text-lg mb-2">
                {tx('So erreichst du uns')}
              </h3>
              {content?.telefon && (
                <a
                  href={`tel:${content.telefon}`}
                  className="flex items-center gap-3 text-stone-700 hover:text-amber-700 transition-colors group"
                >
                  <span className="shrink-0 w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 group-hover:bg-amber-200 transition-colors">
                    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6 6l.93-.93a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                  </span>
                  <span className="font-medium">{content.telefon}</span>
                </a>
              )}
              {content?.email && (
                <a
                  href={`mailto:${content.email}`}
                  className="flex items-center gap-3 text-stone-700 hover:text-amber-700 transition-colors group"
                >
                  <span className="shrink-0 w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 group-hover:bg-amber-200 transition-colors">
                    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                  </span>
                  <span className="font-medium min-w-0 truncate">{content.email}</span>
                </a>
              )}
              {adresse && (
                <div className="flex items-start gap-3 text-stone-700">
                  <span className="shrink-0 mt-0.5 w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center text-amber-700">
                    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                  </span>
                  <span className="leading-snug">{adresse}</span>
                </div>
              )}
              <div className="pt-4">
                <a
                  href="/#/public/buchungsanfrage"
                  className="w-full inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-white font-semibold px-5 py-3 rounded-xl transition-colors text-sm"
                >
                  {tx('Buchungsanfrage stellen')}
                  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                </a>
              </div>
            </div>

            {/* Öffnungszeiten */}
            {oeffnungsLines.length > 0 ? (
              <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm">
                <h3 className="font-semibold text-stone-800 text-lg mb-4">
                  {tx('Öffnungszeiten')}
                </h3>
                <ul className="space-y-2">
                  {oeffnungsLines.map((line, i) => {
                    const parts = line.split(/[:\t](.+)/);
                    return (
                      <li key={i} className="flex justify-between gap-2 text-sm border-b border-stone-100 pb-2 last:border-0 last:pb-0">
                        <span className="text-stone-600 font-medium">{parts[0]}</span>
                        <span className="text-stone-800 text-right">{parts[1] ?? ''}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : (
              <div className="bg-amber-50 rounded-2xl border border-amber-100 p-6 flex flex-col items-center justify-center text-center gap-3 text-amber-700">
                <svg aria-hidden="true" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <p className="text-sm">{tx('Für aktuelle Öffnungszeiten bitte direkt anfragen.')}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="bg-amber-900 text-white py-14">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">
            {tx('Ihr Hund in besten Händen')}
          </h2>
          <p className="text-amber-200 mb-6 max-w-xl mx-auto">
            {tx('Stellen Sie jetzt Ihre Buchungsanfrage — wir melden uns schnellstmöglich bei Ihnen.')}
          </p>
          <a
            href="/#/public/buchungsanfrage"
            className="inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-white font-bold px-8 py-4 rounded-2xl transition-colors text-base"
          >
            {tx('Buchungsanfrage stellen')}
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
          </a>
        </div>
      </section>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[var(--z-overlay)] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <img
            src={lightbox}
            alt={name}
            className="max-w-full max-h-full rounded-2xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
            onClick={() => setLightbox(null)}
            aria-label={tx('Schließen')}
          >
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
      )}
    </PublicShell>
  );
}
