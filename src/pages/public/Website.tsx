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
  IconPaw,
  IconStar,
  IconShield,
  IconHeart,
  IconArrowRight,
  IconPhoto,
} from '@tabler/icons-react';

interface WebsiteData {
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
  standort: { lat: number; long: number; info?: string } | null;
  galerie: string | null;
  instagram: string | null;
  facebook: string | null;
}

export default function Website() {
  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [data, setData] = useState<WebsiteData | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const leistungenRef = useRef<HTMLElement>(null);
  const kontaktRef = useRef<HTMLElement>(null);
  const galerieRef = useRef<HTMLElement>(null);

  useEffect(() => {
    loadPublicPagesConfig('hundepension')
      .then(async (c) => {
        setCfg(c);
        const p = c?.pages['hundepension'] ?? null;
        setPage(p);
        if (!p) {
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
        try {
          const result = await listPublicRecords(c!, p, { appId: ep.app_id, limit: 1 });
          const records = Object.values(result);
          if (records.length > 0) {
            const r = records[0];
            const f = r.fields;
            setData({
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
              standort: (f.standort as { lat: number; long: number; info?: string }) ?? null,
              galerie: (f.galerie as string) ?? null,
              instagram: (f.instagram as string) ?? null,
              facebook: (f.facebook as string) ?? null,
            });
          }
        } catch (err) {
          if (err instanceof PageUnavailableError) {
            setUnavailable(true);
          }
        }
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

  const name = data?.unternehmensname ?? tx('Unsere Hundepension');
  const leistungszeilen = (data?.leistungen ?? '').split('\n').filter(Boolean);
  const oeffnungszeilen = (data?.oeffnungszeiten ?? '').split('\n').filter(Boolean);
  const mapsQuery = data?.standort
    ? `${data.standort.lat},${data.standort.long}`
    : data?.strasse
    ? encodeURIComponent(`${data.strasse} ${data.hausnummer ?? ''}, ${data.plz ?? ''} ${data.ort ?? ''}`)
    : null;

  return (
    <PublicShell fullBleed>
      {/* Lightbox */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-[var(--z-overlay)] bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setLightboxSrc(null)}
        >
          <img
            src={lightboxSrc}
            alt={tx('Galeriefoto')}
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
          />
        </div>
      )}

      {/* HERO */}
      <section className="relative bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-8 left-8 text-amber-900">
            <IconPaw size={120} stroke={1} />
          </div>
          <div className="absolute bottom-8 right-8 text-amber-900">
            <IconPaw size={80} stroke={1} />
          </div>
        </div>
        <div className="relative max-w-5xl mx-auto px-6 py-20 md:py-28 text-center">
          <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-800 text-sm font-medium px-4 py-1.5 rounded-full mb-6">
            <IconPaw size={14} />
            {tx('Herzlich willkommen')}
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-4 leading-tight">
            {name}
          </h1>
          {data?.slogan && (
            <p className="text-xl md:text-2xl text-amber-700 font-medium mb-6 italic">
              {data.slogan}
            </p>
          )}
          {data?.beschreibung && (
            <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-10 leading-relaxed">
              {data.beschreibung}
            </p>
          )}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <a
              href="/#/public/buchungsanfrage"
              className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold px-8 py-4 rounded-xl shadow-lg hover:shadow-xl transition-all text-lg"
            >
              {tx('Jetzt Anfrage stellen')}
              <IconArrowRight size={20} />
            </a>
            <button
              onClick={() => kontaktRef.current?.scrollIntoView({ behavior: 'smooth' })}
              className="inline-flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-700 font-semibold px-8 py-4 rounded-xl border border-gray-200 shadow transition-all text-lg"
            >
              {tx('Kontakt aufnehmen')}
            </button>
          </div>
        </div>
      </section>

      {/* FEATURE STRIP — Plätze + Leistungen */}
      {(data?.anzahl_plaetze !== null || leistungszeilen.length > 0) && (
        <section ref={leistungenRef} className="bg-white py-16 md:py-20">
          <div className="max-w-5xl mx-auto px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
                {tx('Was wir bieten')}
              </h2>
              <p className="text-gray-500 text-lg">
                {tx('Ihr Hund ist bei uns in den besten Pfoten')}
              </p>
            </div>

            {data?.anzahl_plaetze != null && (
              <div className="flex justify-center mb-10">
                <div className="bg-amber-50 border border-amber-200 rounded-2xl px-10 py-6 text-center">
                  <div className="text-5xl font-bold text-amber-600 mb-1">
                    {data?.anzahl_plaetze}
                  </div>
                  <div className="text-gray-600 font-medium">
                    {tx('verfügbare Plätze')}
                  </div>
                </div>
              </div>
            )}

            {leistungszeilen.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {leistungszeilen.map((zeile, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 bg-gray-50 rounded-xl p-4 border border-gray-100"
                  >
                    <div className="mt-0.5 shrink-0 text-amber-500">
                      {i % 3 === 0 ? <IconStar size={18} /> : i % 3 === 1 ? <IconShield size={18} /> : <IconHeart size={18} />}
                    </div>
                    <span className="text-gray-700 text-sm leading-relaxed">{zeile}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ÖFFNUNGSZEITEN */}
      {oeffnungszeilen.length > 0 && (
        <section className="bg-amber-50 py-16 md:py-20">
          <div className="max-w-5xl mx-auto px-6">
            <div className="max-w-xl mx-auto">
              <div className="flex items-center gap-3 mb-8 justify-center">
                <div className="bg-amber-100 p-3 rounded-xl text-amber-600">
                  <IconClock size={24} />
                </div>
                <h2 className="text-3xl font-bold text-gray-900">
                  {tx('Öffnungszeiten')}
                </h2>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-amber-100 divide-y divide-gray-100">
                {oeffnungszeilen.map((zeile, i) => {
                  const parts = zeile.split(':');
                  const tag = parts[0]?.trim();
                  const zeit = parts.slice(1).join(':').trim();
                  return (
                    <div key={i} className="flex justify-between items-center px-6 py-4">
                      <span className="font-medium text-gray-800">{tag}</span>
                      {zeit ? (
                        <span className="text-gray-600 text-sm">{zeit}</span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* GALERIE */}
      {data?.galerie && (
        <section ref={galerieRef} className="bg-white py-16 md:py-20">
          <div className="max-w-5xl mx-auto px-6">
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 text-amber-600 bg-amber-50 px-4 py-2 rounded-full mb-4">
                <IconPhoto size={16} />
                <span className="text-sm font-medium">{tx('Galerie')}</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
                {tx('Einblicke in unsere Pension')}
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div
                className="group relative aspect-square overflow-hidden rounded-2xl cursor-zoom-in shadow-sm hover:shadow-lg transition-all"
                onClick={() => setLightboxSrc(data.galerie!)}
              >
                <img
                  src={data.galerie}
                  alt={tx('Galerieaufnahme unserer Hundepension')}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-2xl" />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* CTA BANNER */}
      <section className="bg-amber-600 py-16">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            {tx('Ihr Hund verdient das Beste')}
          </h2>
          <p className="text-amber-100 text-lg mb-8 max-w-xl mx-auto">
            {tx('Stellen Sie jetzt eine unverbindliche Anfrage — wir melden uns innerhalb von 24 Stunden.')}
          </p>
          <a
            href="/#/public/buchungsanfrage"
            className="inline-flex items-center gap-2 bg-white hover:bg-amber-50 text-amber-700 font-bold px-10 py-4 rounded-xl shadow-lg transition-all text-lg"
          >
            {tx('Buchungsanfrage stellen')}
            <IconArrowRight size={20} />
          </a>
        </div>
      </section>

      {/* KONTAKT */}
      <section ref={kontaktRef} className="bg-gray-50 py-16 md:py-20">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
              {tx('So erreichen Sie uns')}
            </h2>
            <p className="text-gray-500 text-lg">
              {tx('Wir freuen uns auf Ihre Nachricht')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Kontaktdaten */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                {tx('Kontaktdaten')}
              </h3>

              {data?.telefon && (
                <a
                  href={`tel:${data.telefon}`}
                  className="flex items-center gap-4 group"
                >
                  <div className="bg-amber-100 p-3 rounded-xl text-amber-600 shrink-0 group-hover:bg-amber-200 transition-colors">
                    <IconPhone size={20} />
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">
                      {tx('Telefon')}
                    </div>
                    <span className="text-gray-800 font-medium group-hover:text-amber-600 transition-colors">
                      {data.telefon}
                    </span>
                  </div>
                </a>
              )}

              {data?.email && (
                <a
                  href={`mailto:${data.email}`}
                  className="flex items-center gap-4 group"
                >
                  <div className="bg-amber-100 p-3 rounded-xl text-amber-600 shrink-0 group-hover:bg-amber-200 transition-colors">
                    <IconMail size={20} />
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">
                      {tx('E-Mail')}
                    </div>
                    <span className="text-gray-800 font-medium group-hover:text-amber-600 transition-colors">
                      {data.email}
                    </span>
                  </div>
                </a>
              )}

              {(data?.strasse || data?.ort) && (
                <div className="flex items-start gap-4">
                  <div className="bg-amber-100 p-3 rounded-xl text-amber-600 shrink-0">
                    <IconMapPin size={20} />
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">
                      {tx('Adresse')}
                    </div>
                    <div className="text-gray-800 font-medium">
                      {data.strasse && data.hausnummer
                        ? `${data.strasse} ${data.hausnummer}`
                        : data.strasse ?? null}
                    </div>
                    {(data?.plz || data?.ort) && (
                      <div className="text-gray-600 text-sm">
                        {[data.plz, data.ort].filter(Boolean).join(' ')}
                      </div>
                    )}
                    {mapsQuery && (
                      <a
                        href={`https://maps.google.com/?q=${mapsQuery}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-amber-600 hover:text-amber-700 text-sm mt-2 font-medium"
                      >
                        {tx('In Google Maps öffnen')}
                        <IconArrowRight size={14} />
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Social Media */}
              {(data?.instagram || data?.facebook) && (
                <div className="pt-4 border-t border-gray-100 flex gap-3">
                  {data.instagram && (
                    <a
                      href={data.instagram}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 bg-gradient-to-br from-pink-500 to-purple-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
                    >
                      <IconBrandInstagram size={16} />
                      {tx('Instagram')}
                    </a>
                  )}
                  {data.facebook && (
                    <a
                      href={data.facebook}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
                    >
                      <IconBrandFacebook size={16} />
                      {tx('Facebook')}
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Karte / Buchungs-CTA */}
            <div className="space-y-6">
              {data?.standort && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <a
                    href={`https://maps.google.com/?q=${data.standort.lat},${data.standort.long}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <div className="bg-amber-50 h-40 flex flex-col items-center justify-center gap-3 hover:bg-amber-100 transition-colors">
                      <div className="bg-amber-600 text-white p-4 rounded-full">
                        <IconMapPin size={28} />
                      </div>
                      <span className="text-amber-700 font-medium text-sm">
                        {tx('Auf Karte anzeigen')}
                      </span>
                      {data.standort.info && (
                        <span className="text-gray-500 text-xs text-center px-4">
                          {data.standort.info}
                        </span>
                      )}
                    </div>
                  </a>
                </div>
              )}

              <div className="bg-amber-600 rounded-2xl p-8 text-center text-white">
                <div className="mb-4">
                  <IconPaw size={40} className="mx-auto opacity-80" />
                </div>
                <h3 className="text-xl font-bold mb-2">
                  {tx('Bereit für den ersten Schritt?')}
                </h3>
                <p className="text-amber-100 text-sm mb-6">
                  {tx('Stellen Sie jetzt Ihre unverbindliche Buchungsanfrage.')}
                </p>
                <a
                  href="/#/public/buchungsanfrage"
                  className="inline-flex items-center gap-2 bg-white text-amber-700 font-bold px-6 py-3 rounded-xl hover:bg-amber-50 transition-colors"
                >
                  {tx('Anfrage stellen')}
                  <IconArrowRight size={16} />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-gray-900 text-gray-400 py-8">
        <div className="max-w-5xl mx-auto px-6 text-center text-sm">
          <div className="flex items-center justify-center gap-2 mb-2">
            <IconPaw size={16} className="text-amber-500" />
            <span className="text-white font-medium">{name}</span>
          </div>
          {(data?.plz || data?.ort) && (
            <p>{[data?.plz, data?.ort].filter(Boolean).join(' ')}</p>
          )}
          {data?.telefon && (
            <p>
              <a href={`tel:${data.telefon}`} className="hover:text-white transition-colors">
                {data.telefon}
              </a>
            </p>
          )}
        </div>
      </footer>
    </PublicShell>
  );
}
