import { useEffect, useRef, useState } from 'react';
import { PublicShell } from '@/components/PublicShell';
import {
  loadPublicPagesConfig, listPublicRecords, PageUnavailableError,
  type PublicPagesConfig, type PublicPageConfig,
} from '@/lib/publicClient';
import { tx } from '@/i18n';
import {
  IconPhone, IconMail, IconMapPin, IconClock, IconBrandInstagram,
  IconBrandFacebook, IconPaw, IconStar, IconArrowRight, IconHome,
} from '@tabler/icons-react';

interface WebsiteFields {
  unternehmensname?: string;
  slogan?: string;
  beschreibung?: string;
  anzahl_plaetze?: number;
  leistungen?: string;
  oeffnungszeiten?: string;
  telefon?: string;
  email?: string;
  website_url?: string;
  strasse?: string;
  hausnummer?: string;
  plz?: string;
  ort?: string;
  galerie?: string;
  instagram?: string;
  facebook?: string;
}

export default function Website() {
  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [content, setContent] = useState<WebsiteFields | null>(null);

  const leistungenRef = useRef<HTMLElement>(null);
  const kontaktRef = useRef<HTMLElement>(null);

  useEffect(() => {
    loadPublicPagesConfig('hundepension')
      .then(async (c) => {
        setCfg(c);
        const p = c?.pages['hundepension'] ?? null;
        setPage(p);
        if (!p) { setUnavailable(true); setLoading(false); return; }

        const ep = p.endpoints?.find(e => e.op === 'list');
        if (!ep) { setUnavailable(true); setLoading(false); return; }

        const result = await listPublicRecords(c!, p, { appId: ep.app_id, limit: 1 });
        const records = Object.values(result);
        if (records.length > 0) {
          setContent(records[0].fields as WebsiteFields);
        }
        setLoading(false);
      })
      .catch((err) => {
        if (err instanceof PageUnavailableError) setUnavailable(true);
        setLoading(false);
      });
  }, []);

  if (loading || unavailable || !cfg || !page) {
    return <PublicShell loading={loading} unavailable={unavailable && !loading} />;
  }

  const info = content ?? {};
  const name = info.unternehmensname ?? tx('Hundepension');
  const address = [info.strasse, info.hausnummer].filter(Boolean).join(' ');
  const cityLine = [info.plz, info.ort].filter(Boolean).join(' ');

  const leistungsList = info.leistungen
    ? info.leistungen.split('\n').map(l => l.trim()).filter(Boolean)
    : [];

  const oeffnungsLines = info.oeffnungszeiten
    ? info.oeffnungszeiten.split('\n').map(l => l.trim()).filter(Boolean)
    : [];

  return (
    <PublicShell fullBleed>
      {/* Hero */}
      <section
        className="relative min-h-[70vh] flex items-center justify-center overflow-hidden"
        style={
          info.galerie
            ? { background: `linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.55)), url(${JSON.stringify(info.galerie)}) center/cover no-repeat` }
            : { background: 'linear-gradient(135deg, #1a3a2a 0%, #2d5a3d 60%, #4a7c5a 100%)' }
        }
      >
        <div className="relative z-10 max-w-3xl mx-auto px-6 py-20 text-center text-white">
          <div className="flex items-center justify-center gap-2 mb-4 opacity-80">
            <IconPaw size={24} stroke={1.5} />
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4 drop-shadow-lg">
            {name}
          </h1>
          {info.slogan && (
            <p className="text-xl sm:text-2xl font-light mb-6 text-white/90 drop-shadow">
              {info.slogan}
            </p>
          )}
          {info.beschreibung && (
            <p className="text-base sm:text-lg text-white/80 max-w-xl mx-auto leading-relaxed mb-8">
              {info.beschreibung}
            </p>
          )}
          {info.anzahl_plaetze != null && (
            <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm border border-white/25 rounded-full px-5 py-2 text-white font-medium mb-8">
              <IconStar size={16} stroke={1.5} />
              {tx`${info.anzahl_plaetze} Plätze verfügbar`}
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => leistungenRef.current?.scrollIntoView({ behavior: 'smooth' })}
              className="inline-flex items-center gap-2 bg-white text-green-900 font-semibold px-6 py-3 rounded-full hover:bg-green-50 transition-colors"
            >
              {tx('Unsere Leistungen')}
            </button>
            <button
              onClick={() => kontaktRef.current?.scrollIntoView({ behavior: 'smooth' })}
              className="inline-flex items-center gap-2 border border-white/60 text-white font-medium px-6 py-3 rounded-full hover:bg-white/10 transition-colors"
            >
              {tx('Kontakt')}
            </button>
          </div>
        </div>
      </section>

      {/* Leistungen */}
      {leistungsList.length > 0 && (
        <section ref={leistungenRef} className="py-16 bg-white">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 mb-2">
              {tx('Unsere Leistungen')}
            </h2>
            <p className="text-center text-gray-500 mb-10">
              {tx('Was wir für euren Hund tun')}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {leistungsList.map((item, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 bg-green-50 border border-green-100 rounded-2xl p-5"
                >
                  <IconPaw size={20} className="text-green-700 shrink-0 mt-0.5" stroke={1.5} />
                  <span className="text-gray-800 leading-snug">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Plätze highlight — nur wenn kein Leistungstext vorhanden */}
      {leistungsList.length === 0 && info.anzahl_plaetze != null && (
        <section className="py-16 bg-white">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
            <div className="inline-flex items-center gap-3 bg-green-50 border border-green-200 rounded-2xl px-8 py-6">
              <IconHome size={32} className="text-green-700" stroke={1.5} />
              <div className="text-left">
                <p className="text-3xl font-bold text-green-800">{info.anzahl_plaetze}</p>
                <p className="text-green-700 font-medium">{tx('liebevoll betreute Plätze')}</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Kontakt */}
      <section ref={kontaktRef} className="py-16 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 mb-10">
            {tx('Kontakt & Anfahrt')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Kontaktdaten */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
              <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide mb-4">
                {tx('Erreichbarkeit')}
              </h3>
              {info.telefon && (
                <a
                  href={`tel:${info.telefon}`}
                  className="flex items-center gap-3 text-gray-800 hover:text-green-700 transition-colors group"
                >
                  <span className="bg-green-50 rounded-full p-2 shrink-0 group-hover:bg-green-100 transition-colors">
                    <IconPhone size={18} className="text-green-700" stroke={1.5} />
                  </span>
                  <span className="font-medium">{info.telefon}</span>
                </a>
              )}
              {info.email && (
                <a
                  href={`mailto:${info.email}`}
                  className="flex items-center gap-3 text-gray-800 hover:text-green-700 transition-colors group"
                >
                  <span className="bg-green-50 rounded-full p-2 shrink-0 group-hover:bg-green-100 transition-colors">
                    <IconMail size={18} className="text-green-700" stroke={1.5} />
                  </span>
                  <span className="break-all">{info.email}</span>
                </a>
              )}
              {(address || cityLine) && (
                <div className="flex items-start gap-3 text-gray-800">
                  <span className="bg-green-50 rounded-full p-2 shrink-0 mt-0.5">
                    <IconMapPin size={18} className="text-green-700" stroke={1.5} />
                  </span>
                  <div>
                    {address && <p>{address}</p>}
                    {cityLine && <p>{cityLine}</p>}
                  </div>
                </div>
              )}
              {info.website_url && (
                <a
                  href={info.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 text-gray-800 hover:text-green-700 transition-colors group"
                >
                  <span className="bg-green-50 rounded-full p-2 shrink-0 group-hover:bg-green-100 transition-colors">
                    <IconHome size={18} className="text-green-700" stroke={1.5} />
                  </span>
                  <span className="break-all">{info.website_url.replace(/^https?:\/\//, '')}</span>
                </a>
              )}
            </div>

            {/* Öffnungszeiten */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide mb-4">
                {tx('Öffnungszeiten')}
              </h3>
              {oeffnungsLines.length > 0 ? (
                <div className="space-y-2">
                  {oeffnungsLines.map((line, i) => (
                    <div key={i} className="flex items-start gap-2 text-gray-700">
                      <IconClock size={16} className="text-green-600 shrink-0 mt-0.5" stroke={1.5} />
                      <span>{line}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 text-sm">{tx('Bitte telefonisch anfragen')}</p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Anfrage */}
      <section className="py-16 bg-green-800">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <IconPaw size={40} className="text-green-300 mx-auto mb-4" stroke={1.5} />
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
            {tx('Euer Hund ist bei uns in guten Pfoten!')}
          </h2>
          <p className="text-green-200 mb-8 text-lg">
            {tx('Sendet uns eine Anfrage — wir melden uns schnell zurück.')}
          </p>
          <a
            href="/#/public/buchungsanfrage"
            className="inline-flex items-center gap-2 bg-white text-green-900 font-semibold px-8 py-4 rounded-full hover:bg-green-50 transition-colors text-lg"
          >
            {tx('Jetzt anfragen')}
            <IconArrowRight size={20} stroke={1.5} />
          </a>
        </div>
      </section>

      {/* Social / Footer */}
      {(info.instagram || info.facebook) && (
        <section className="py-10 bg-gray-900">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-center gap-6">
            {info.instagram && (
              <a
                href={info.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-gray-300 hover:text-pink-400 transition-colors font-medium"
              >
                <IconBrandInstagram size={22} stroke={1.5} />
                Instagram
              </a>
            )}
            {info.facebook && (
              <a
                href={info.facebook}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-gray-300 hover:text-blue-400 transition-colors font-medium"
              >
                <IconBrandFacebook size={22} stroke={1.5} />
                Facebook
              </a>
            )}
          </div>
        </section>
      )}
    </PublicShell>
  );
}
