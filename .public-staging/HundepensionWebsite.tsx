import { useEffect, useRef, useState } from 'react';
import { PublicShell } from '@/components/PublicShell';
import {
  loadPublicPagesConfig,
  listPublicRecords,
  PageUnavailableError,
  type PublicPagesConfig,
  type PublicPageConfig,
} from '@/lib/publicClient';
import { tx } from '@/i18n';
import {
  IconPhone,
  IconMail,
  IconMapPin,
  IconClock,
  IconBrandInstagram,
  IconBrandFacebook,
  IconStar,
  IconPaw,
  IconCalendar,
  IconChevronDown,
} from '@tabler/icons-react';

interface WebsiteInhalt {
  unternehmensname: string | null;
  slogan: string | null;
  beschreibung: string | null;
  anzahl_plaetze: number | null;
  leistungen: string | null;
  oeffnungszeiten: string | null;
  telefon: string | null;
  email: string | null;
  website_url: string | null;
  strasse: string | null;
  hausnummer: string | null;
  plz: string | null;
  ort: string | null;
  standort: { lat: number; long: number; info?: string } | null;
  galerie: string | null;
  instagram: string | null;
  facebook: string | null;
}

export default function HundepensionWebsite() {
  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [inhalt, setInhalt] = useState<WebsiteInhalt | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  const leistungenRef = useRef<HTMLElement>(null);
  const kontaktRef = useRef<HTMLElement>(null);

  useEffect(() => {
    loadPublicPagesConfig('hundepension')
      .then(async (c) => {
        setCfg(c);
        const p = c?.pages['hundepension'] ?? null;
        setPage(p);
        if (!c || !p) {
          setUnavailable(true);
          setLoading(false);
          return;
        }
        const ep = p.endpoints?.find((e) => e.op === 'list');
        if (!ep) {
          setUnavailable(true);
          setLoading(false);
          return;
        }
        const rows = await listPublicRecords(c, p, {
          appId: ep.app_id,
          limit: 1,
        });
        const first = Object.values(rows)[0] ?? null;
        if (first) {
          const f = first.fields;
          setInhalt({
            unternehmensname: (f.unternehmensname as string) ?? null,
            slogan: (f.slogan as string) ?? null,
            beschreibung: (f.beschreibung as string) ?? null,
            anzahl_plaetze: (f.anzahl_plaetze as number) ?? null,
            leistungen: (f.leistungen as string) ?? null,
            oeffnungszeiten: (f.oeffnungszeiten as string) ?? null,
            telefon: (f.telefon as string) ?? null,
            email: (f.email as string) ?? null,
            website_url: (f.website_url as string) ?? null,
            strasse: (f.strasse as string) ?? null,
            hausnummer: (f.hausnummer as string) ?? null,
            plz: (f.plz as string) ?? null,
            ort: (f.ort as string) ?? null,
            standort: (f.standort as WebsiteInhalt['standort']) ?? null,
            galerie: (f.galerie as string) ?? null,
            instagram: (f.instagram as string) ?? null,
            facebook: (f.facebook as string) ?? null,
          });
        }
        setLoading(false);
      })
      .catch((err) => {
        if (err instanceof PageUnavailableError) {
          setUnavailable(true);
        }
        setLoading(false);
      });
  }, []);

  if (loading || unavailable || !cfg || !page) {
    return <PublicShell loading={loading} unavailable={!loading && unavailable} />;
  }

  const name = inhalt?.unternehmensname ?? tx('Unsere Hundepension');
  const adresszeile = [
    inhalt?.strasse && inhalt?.hausnummer
      ? `${inhalt.strasse} ${inhalt.hausnummer}`
      : inhalt?.strasse,
    inhalt?.plz && inhalt?.ort
      ? `${inhalt.plz} ${inhalt.ort}`
      : inhalt?.ort,
  ]
    .filter(Boolean)
    .join(', ');

  const leistungenList = inhalt?.leistungen
    ? inhalt.leistungen.split('\n').filter((l) => l.trim().length > 0)
    : [];

  const oeffnungList = inhalt?.oeffnungszeiten
    ? inhalt.oeffnungszeiten.split('\n').filter((l) => l.trim().length > 0)
    : [];

  return (
    <PublicShell fullBleed>
      {/* HERO */}
      <section className="relative min-h-[70vh] flex flex-col items-center justify-center text-center overflow-hidden bg-amber-950">
        {inhalt?.galerie && (
          <img
            src={inhalt.galerie}
            alt={name}
            className="absolute inset-0 w-full h-full object-cover opacity-40"
          />
        )}
        <div className="relative z-10 max-w-3xl mx-auto px-6 py-20">
          <div className="inline-flex items-center gap-2 bg-amber-500/20 border border-amber-400/40 rounded-full px-4 py-1.5 mb-6">
            <IconPaw size={16} className="text-amber-300 shrink-0" />
            <span className="text-amber-200 text-sm font-medium">{tx('Professionelle Hundebetreuung')}</span>
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-4 leading-tight">
            {name}
          </h1>
          {inhalt?.slogan && (
            <p className="text-xl sm:text-2xl text-amber-200 mb-8 font-light">
              {inhalt.slogan}
            </p>
          )}
          {inhalt?.beschreibung && (
            <p className="text-white/80 text-base sm:text-lg max-w-2xl mx-auto mb-10 leading-relaxed">
              {inhalt.beschreibung}
            </p>
          )}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="/#/public/buchungsanfrage"
              className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold px-8 py-4 rounded-xl text-lg transition-colors shadow-lg"
            >
              <IconCalendar size={20} className="shrink-0" />
              {tx('Jetzt Platz anfragen')}
            </a>
            <button
              onClick={() => leistungenRef.current?.scrollIntoView({ behavior: 'smooth' })}
              className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/30 font-semibold px-8 py-4 rounded-xl text-lg transition-colors"
            >
              {tx('Mehr erfahren')}
              <IconChevronDown size={20} className="shrink-0" />
            </button>
          </div>
          {inhalt?.anzahl_plaetze && (
            <p className="mt-8 text-white/60 text-sm">
              {/* i18n-exempt: number + text */}
              {tx('Bis zu')} <strong className="text-amber-300">{inhalt.anzahl_plaetze}</strong> {tx('Plätze verfügbar')}
            </p>
          )}
        </div>
      </section>

      {/* LEISTUNGEN */}
      {leistungenList.length > 0 && (
        <section ref={leistungenRef} className="py-20 bg-white">
          <div className="max-w-5xl mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-stone-800 mb-3">{tx('Unsere Leistungen')}</h2>
              <p className="text-stone-500 max-w-xl mx-auto">
                {tx('Wir kümmern uns rundum um euren Liebling — mit viel Liebe und Erfahrung.')}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {leistungenList.map((leistung, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-5 rounded-xl border border-stone-100 bg-stone-50 hover:bg-amber-50 hover:border-amber-200 transition-colors"
                >
                  <IconStar size={18} className="text-amber-500 shrink-0 mt-0.5" />
                  <span className="text-stone-700 text-sm leading-relaxed">{leistung}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ÖFFNUNGSZEITEN */}
      {oeffnungList.length > 0 && (
        <section className="py-16 bg-stone-50">
          <div className="max-w-5xl mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
              <div>
                <h2 className="text-3xl font-bold text-stone-800 mb-3">{tx('Öffnungszeiten')}</h2>
                <p className="text-stone-500 mb-8">{tx('Wann ihr uns erreichen könnt.')}</p>
                <div className="space-y-3">
                  {oeffnungList.map((zeile, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <IconClock size={16} className="text-amber-500 shrink-0 mt-0.5" />
                      <span className="text-stone-700 text-sm">{zeile}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-amber-500 rounded-2xl p-8 text-amber-950 text-center">
                <IconPaw size={48} className="mx-auto mb-4 opacity-80" />
                <p className="text-xl font-bold mb-2">{tx('Bereit für euren Liebling?')}</p>
                <p className="text-amber-800 text-sm mb-6">
                  {tx('Sichert euch jetzt einen Platz in unserer Hundepension.')}
                </p>
                <a
                  href="/#/public/buchungsanfrage"
                  className="inline-flex items-center gap-2 bg-amber-950 hover:bg-amber-900 text-amber-100 font-bold px-6 py-3 rounded-xl text-sm transition-colors"
                >
                  <IconCalendar size={16} className="shrink-0" />
                  {tx('Buchungsanfrage stellen')}
                </a>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* KONTAKT */}
      <section ref={kontaktRef} className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-stone-800 mb-3">{tx('Kontakt & Anfahrt')}</h2>
            <p className="text-stone-500">{tx('Wir freuen uns auf eure Nachricht!')}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {inhalt?.telefon && (
              <a
                href={`tel:${inhalt.telefon}`}
                className="flex flex-col items-center gap-3 p-6 rounded-xl border border-stone-100 bg-stone-50 hover:bg-amber-50 hover:border-amber-200 transition-colors text-center"
              >
                <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                  <IconPhone size={22} className="text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-stone-400 uppercase tracking-wide mb-1">{tx('Telefon')}</p>
                  <p className="text-stone-800 font-semibold">{inhalt.telefon}</p>
                </div>
              </a>
            )}
            {inhalt?.email && (
              <a
                href={`mailto:${inhalt.email}`}
                className="flex flex-col items-center gap-3 p-6 rounded-xl border border-stone-100 bg-stone-50 hover:bg-amber-50 hover:border-amber-200 transition-colors text-center"
              >
                <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                  <IconMail size={22} className="text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-stone-400 uppercase tracking-wide mb-1">{tx('E-Mail')}</p>
                  <p className="text-stone-800 font-semibold break-all">{inhalt.email}</p>
                </div>
              </a>
            )}
            {adresszeile && (
              <div className="flex flex-col items-center gap-3 p-6 rounded-xl border border-stone-100 bg-stone-50 text-center">
                <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                  <IconMapPin size={22} className="text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-stone-400 uppercase tracking-wide mb-1">{tx('Adresse')}</p>
                  <p className="text-stone-800 font-semibold">{adresszeile}</p>
                  {inhalt?.standort?.info && (
                    <p className="text-stone-500 text-sm mt-1">{inhalt.standort.info}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Social Media */}
          {(inhalt?.instagram || inhalt?.facebook) && (
            <div className="mt-10 flex flex-wrap gap-4 justify-center">
              {inhalt.instagram && (
                <a
                  href={inhalt.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold text-sm hover:opacity-90 transition-opacity"
                >
                  <IconBrandInstagram size={18} className="shrink-0" />
                  {tx('Auf Instagram folgen')}
                </a>
              )}
              {inhalt.facebook && (
                <a
                  href={inhalt.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-500 transition-colors"
                >
                  <IconBrandFacebook size={18} className="shrink-0" />
                  {tx('Auf Facebook besuchen')}
                </a>
              )}
            </div>
          )}
        </div>
      </section>

      {/* CTA FOOTER BAND */}
      <section className="py-16 bg-amber-950 text-center">
        <div className="max-w-2xl mx-auto px-4">
          <IconPaw size={40} className="text-amber-400 mx-auto mb-4" />
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
            {tx('Jetzt Platz reservieren')}
          </h2>
          <p className="text-amber-200 mb-8 text-base">
            {tx('Stellt eine unverbindliche Buchungsanfrage — wir melden uns schnellstmöglich.')}
          </p>
          <a
            href="/#/public/buchungsanfrage"
            className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold px-10 py-4 rounded-xl text-lg transition-colors shadow-lg"
          >
            <IconCalendar size={22} className="shrink-0" />
            {tx('Buchungsanfrage stellen')}
          </a>
        </div>
      </section>
    </PublicShell>
  );
}
