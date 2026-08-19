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
  IconBrandInstagram,
  IconBrandFacebook,
  IconPaw,
  IconClock,
  IconStar,
  IconArrowRight,
} from '@tabler/icons-react';

interface WebsiteInhalteFields {
  unternehmensname?: string;
  slogan?: string;
  beschreibung?: string;
  anzahl_plaetze?: number;
  leistungen?: string;
  oeffnungszeiten?: string;
  telefon?: string;
  email?: string;
  strasse?: string;
  hausnummer?: string;
  plz?: string;
  ort?: string;
  standort?: { lat: number; long: number; info?: string } | null;
  galerie?: string | null;
  instagram?: string | null;
  facebook?: string | null;
}

interface WebsiteRecord {
  id: string;
  fields: WebsiteInhalteFields;
}

export default function HundepensionWebsite() {
  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [info, setInfo] = useState<WebsiteRecord | null>(null);

  const leistungenRef = useRef<HTMLDivElement>(null);
  const kontaktRef = useRef<HTMLDivElement>(null);
  const galerieRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadPublicPagesConfig('hundepension')
      .then(async (c) => {
        if (!c) { setUnavailable(true); setLoading(false); return; }
        setCfg(c);
        const pg = c.pages['hundepension'] ?? null;
        setPage(pg);
        if (!pg) { setUnavailable(true); setLoading(false); return; }

        const ep = pg.endpoints?.find((e) => e.op === 'list');
        if (!ep) { setUnavailable(true); setLoading(false); return; }

        const result = await listPublicRecords(c, pg, {
          appId: ep.app_id,
          limit: 1,
        });
        const records = Object.values(result) as WebsiteRecord[];
        setInfo(records[0] ?? null);
        setLoading(false);
      })
      .catch((err) => {
        if (err instanceof PageUnavailableError) setUnavailable(true);
        setLoading(false);
      });
  }, []);

  if (loading || unavailable || !cfg || !page) {
    return <PublicShell loading={loading} unavailable={!loading && unavailable} />;
  }

  const f = info?.fields ?? {};
  const name = f.unternehmensname ?? tx('Hundepension');
  const adresse = [f.strasse, f.hausnummer].filter(Boolean).join(' ');
  const ort = [f.plz, f.ort].filter(Boolean).join(' ');

  // Leistungen zeilenweise aufsplitten
  const leistungItems = f.leistungen
    ? f.leistungen.split('\n').map((l) => l.trim()).filter(Boolean)
    : [];

  const oeffnungsItems = f.oeffnungszeiten
    ? f.oeffnungszeiten.split('\n').map((l) => l.trim()).filter(Boolean)
    : [];

  const handleCta = () => {
    window.location.hash = '/public/buchungsanfrage';
  };

  return (
    <PublicShell fullBleed>
      {/* ── Hero ── */}
      <section className="relative bg-gradient-to-br from-amber-800 via-amber-700 to-amber-600 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none select-none">
          <IconPaw size={320} className="absolute -bottom-16 -right-16 rotate-12" />
          <IconPaw size={200} className="absolute top-8 -left-8 -rotate-12" />
        </div>
        <div className="relative max-w-5xl mx-auto px-4 py-20 sm:py-32 text-center">
          <div className="inline-flex items-center gap-2 bg-white/20 rounded-full px-4 py-1.5 text-sm font-medium mb-6">
            <IconPaw size={16} />
            <span>{tx('Herzlich Willkommen')}</span>
          </div>
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight mb-4 drop-shadow">
            {name}
          </h1>
          {f.slogan && (
            <p className="text-xl sm:text-2xl font-light italic mb-6 text-amber-100">
              {f.slogan}
            </p>
          )}
          {f.beschreibung && (
            <p className="max-w-2xl mx-auto text-base sm:text-lg text-amber-50 leading-relaxed mb-10 whitespace-pre-line">
              {f.beschreibung}
            </p>
          )}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={handleCta}
              className="inline-flex items-center justify-center gap-2 bg-white text-amber-800 font-bold px-8 py-3.5 rounded-full text-lg shadow-lg hover:bg-amber-50 transition-colors"
            >
              {tx('Buchungsanfrage stellen')}
              <IconArrowRight size={20} />
            </button>
            {f.telefon && (
              <a
                href={`tel:${f.telefon}`}
                className="inline-flex items-center justify-center gap-2 border-2 border-white/60 text-white font-semibold px-8 py-3.5 rounded-full text-lg hover:bg-white/10 transition-colors"
              >
                <IconPhone size={20} />
                {f.telefon}
              </a>
            )}
          </div>
          {typeof f.anzahl_plaetze === 'number' && (
            <p className="mt-8 text-amber-200 text-sm">
              {tx('Platz für')} <strong className="text-white">{f.anzahl_plaetze}</strong>{' '}
              {tx('glückliche Hunde')}
            </p>
          )}
        </div>
      </section>

      {/* ── Leistungen ── */}
      {leistungItems.length > 0 && (
        <section ref={leistungenRef} className="bg-white py-16 sm:py-20">
          <div className="max-w-5xl mx-auto px-4">
            <div className="text-center mb-10">
              <span className="inline-flex items-center gap-2 text-amber-700 font-semibold text-sm uppercase tracking-widest mb-2">
                <IconStar size={16} />
                {tx('Was wir bieten')}
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
                {tx('Unsere Leistungen')}
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {leistungItems.map((item, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 bg-amber-50 rounded-xl p-4 border border-amber-100"
                >
                  <span className="mt-0.5 flex-shrink-0 w-6 h-6 rounded-full bg-amber-600 flex items-center justify-center">
                    <IconPaw size={14} className="text-white" />
                  </span>
                  <span className="text-gray-800 leading-snug">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Galerie ── */}
      {f.galerie && (
        <section ref={galerieRef} className="bg-amber-50 py-16 sm:py-20">
          <div className="max-w-5xl mx-auto px-4">
            <div className="text-center mb-10">
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
                {tx('Galerie')}
              </h2>
              <p className="text-gray-500 mt-2">{tx('Eindrücke aus unserer Pension')}</p>
            </div>
            <div className="flex justify-center">
              <div className="rounded-2xl overflow-hidden shadow-xl max-w-3xl w-full">
                <img
                  src={f.galerie}
                  alt={name}
                  className="w-full object-cover max-h-[480px]"
                />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Öffnungszeiten ── */}
      {oeffnungsItems.length > 0 && (
        <section className="bg-white py-16 sm:py-20">
          <div className="max-w-5xl mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-start">
              <div>
                <span className="inline-flex items-center gap-2 text-amber-700 font-semibold text-sm uppercase tracking-widest mb-3">
                  <IconClock size={16} />
                  {tx('Wann wir da sind')}
                </span>
                <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-6">
                  {tx('Öffnungszeiten')}
                </h2>
                <div className="space-y-2">
                  {oeffnungsItems.map((line, i) => {
                    const parts = line.split(/[:：](.+)/);
                    if (parts.length >= 2) {
                      return (
                        <div key={i} className="flex justify-between gap-4 py-2 border-b border-gray-100">
                          <span className="text-gray-600 font-medium">{parts[0].trim()}</span>
                          <span className="text-gray-900 font-semibold text-right">{parts[1].trim()}</span>
                        </div>
                      );
                    }
                    return (
                      <div key={i} className="py-2 border-b border-gray-100 text-gray-800">
                        {line}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* CTA-Karte neben den Öffnungszeiten */}
              <div className="bg-gradient-to-br from-amber-600 to-amber-700 rounded-2xl p-8 text-white text-center shadow-lg">
                <IconPaw size={48} className="mx-auto mb-4 opacity-80" />
                <h3 className="text-2xl font-bold mb-3">{tx('Platz reservieren')}</h3>
                <p className="text-amber-100 mb-6 leading-relaxed">
                  {tx('Sende uns eine Anfrage und wir melden uns schnellstmöglich bei dir.')}
                </p>
                <button
                  onClick={handleCta}
                  className="inline-flex items-center gap-2 bg-white text-amber-800 font-bold px-6 py-3 rounded-full hover:bg-amber-50 transition-colors"
                >
                  {tx('Jetzt anfragen')}
                  <IconArrowRight size={18} />
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Kontakt ── */}
      <section ref={kontaktRef} className="bg-gray-900 text-white py-16 sm:py-20">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-bold">{tx('Kontakt & Anfahrt')}</h2>
            <p className="text-gray-400 mt-2">{tx('Wir freuen uns auf dich und deinen Hund!')}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Kontaktdaten */}
            <div className="space-y-5">
              {f.telefon && (
                <a
                  href={`tel:${f.telefon}`}
                  className="flex items-center gap-4 bg-white/5 hover:bg-white/10 rounded-xl px-5 py-4 transition-colors group"
                >
                  <span className="w-10 h-10 flex-shrink-0 rounded-full bg-amber-600 flex items-center justify-center">
                    <IconPhone size={20} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400 uppercase tracking-wider">{tx('Telefon')}</p>
                    <p className="font-semibold text-white group-hover:text-amber-300 transition-colors truncate">
                      {f.telefon}
                    </p>
                  </div>
                </a>
              )}
              {f.email && (
                <a
                  href={`mailto:${f.email}`}
                  className="flex items-center gap-4 bg-white/5 hover:bg-white/10 rounded-xl px-5 py-4 transition-colors group"
                >
                  <span className="w-10 h-10 flex-shrink-0 rounded-full bg-amber-600 flex items-center justify-center">
                    <IconMail size={20} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400 uppercase tracking-wider">{tx('E-Mail')}</p>
                    <p className="font-semibold text-white group-hover:text-amber-300 transition-colors truncate">
                      {f.email}
                    </p>
                  </div>
                </a>
              )}
              {(adresse || ort) && (
                <div className="flex items-start gap-4 bg-white/5 rounded-xl px-5 py-4">
                  <span className="w-10 h-10 flex-shrink-0 rounded-full bg-amber-600 flex items-center justify-center mt-0.5">
                    <IconMapPin size={20} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{tx('Adresse')}</p>
                    {adresse && <p className="font-semibold text-white">{adresse}</p>}
                    {ort && <p className="text-gray-300">{ort}</p>}
                    {f.standort && (
                      <a
                        href={`https://maps.google.com/?q=${f.standort.lat},${f.standort.long}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-amber-400 hover:text-amber-300 text-sm mt-2 transition-colors"
                      >
                        {tx('In Google Maps öffnen')}
                        <IconArrowRight size={14} />
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Social Media */}
              {(f.instagram || f.facebook) && (
                <div className="flex gap-3 pt-2">
                  {f.instagram && (
                    <a
                      href={f.instagram}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 bg-white/5 hover:bg-white/10 rounded-xl px-4 py-3 transition-colors text-sm font-medium"
                    >
                      <IconBrandInstagram size={18} className="text-pink-400" />
                      Instagram
                    </a>
                  )}
                  {f.facebook && (
                    <a
                      href={f.facebook}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 bg-white/5 hover:bg-white/10 rounded-xl px-4 py-3 transition-colors text-sm font-medium"
                    >
                      <IconBrandFacebook size={18} className="text-blue-400" />
                      Facebook
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Karte via OpenStreetMap embed oder Placeholder */}
            <div className="rounded-2xl overflow-hidden bg-white/5 min-h-[240px] flex items-center justify-center">
              {f.standort ? (
                <iframe
                  title={tx('Standort auf der Karte')}
                  className="w-full h-full min-h-[280px] border-0"
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${f.standort.long - 0.01},${f.standort.lat - 0.007},${f.standort.long + 0.01},${f.standort.lat + 0.007}&layer=mapnik&marker=${f.standort.lat},${f.standort.long}`}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="text-center text-gray-500 p-8">
                  <IconMapPin size={48} className="mx-auto mb-3 opacity-40" />
                  <p className="text-sm">{tx('Kein Standort hinterlegt')}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer CTA ── */}
      <section className="bg-amber-700 py-12 text-center text-white">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">
            {tx('Bereit für den nächsten Urlaub?')}
          </h2>
          <p className="text-amber-100 mb-6">{tx('Dein Hund ist bei uns in den besten Pfoten.')}</p>
          <button
            onClick={handleCta}
            className="inline-flex items-center gap-2 bg-white text-amber-800 font-bold px-8 py-3.5 rounded-full text-lg shadow hover:bg-amber-50 transition-colors"
          >
            {tx('Buchungsanfrage stellen')}
            <IconArrowRight size={20} />
          </button>
        </div>
      </section>
    </PublicShell>
  );
}
