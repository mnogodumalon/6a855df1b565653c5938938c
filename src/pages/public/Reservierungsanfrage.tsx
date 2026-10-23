import { useEffect, useMemo, useState } from 'react';
import { addDays, format, parseISO } from 'date-fns';
import { PublicShell } from '@/components/PublicShell';
import { Bound } from '@/components/blocks/Bound';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { AvailabilityRangePicker } from '@/components/blocks/AvailabilityRangePicker';
import {
  loadPublicPagesConfig, prepareChallenge,
  type PublicPagesConfig, type PublicPageConfig,
} from '@/lib/publicClient';
import {
  useStepForm, useJourneySubmit, fieldLookup, fieldDate, optionsOf,
  type JourneyRecord,
} from '@/lib/journey';
import { createPublicPort } from '@/lib/journey/publicPort';
import { tx } from '@/i18n';

const SLUG = 'buchungsanfrage';

function fmt(iso: string | null): string {
  return iso ? format(parseISO(iso), 'dd.MM.yyyy') : '';
}

export default function Reservierungsanfrage() {
  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPublicPagesConfig(SLUG).then(c => {
      setCfg(c);
      setPage(c?.pages[SLUG] ?? null);
      setLoading(false);
    });
  }, []);

  if (loading || !cfg || !page) {
    return <PublicShell loading={loading} unavailable={!loading} />;
  }
  return <Inner cfg={cfg} page={page} />;
}

function Inner({ cfg, page }: { cfg: PublicPagesConfig; page: PublicPageConfig }) {
  const port = useMemo(() => createPublicPort(cfg, page), [cfg, page]);
  const [step, setStep] = useState(1);
  const [bookings, setBookings] = useState<JourneyRecord[]>([]);

  useEffect(() => {
    let alive = true;
    port.list('belegung_buchungen').then(r => { if (alive) setBookings(r); }).catch(() => { /* Belegung bleibt leer */ });
    return () => { alive = false; };
  }, [port]);

  const anfrage = useStepForm('buchungsanfragen', {
    fields: [
      'wunsch_anreise', 'wunsch_abreise',
      'interessent_vorname', 'interessent_nachname', 'interessent_email', 'interessent_telefon',
      'hund_name', 'hund_rasse', 'hund_groesse', 'nachricht',
    ],
    autoComplete: true,
    steps: {
      wunsch_anreise: 1, wunsch_abreise: 1,
      interessent_vorname: 2, interessent_nachname: 2, interessent_email: 2, interessent_telefon: 2,
      hund_name: 2, hund_rasse: 2, hund_groesse: 2, nachricht: 2,
    },
  });
  const submit = useJourneySubmit(
    port,
    [{ key: 'anfrage', entity: 'buchungsanfragen', form: anfrage, primary: true }],
    { draftKey: SLUG },
  );

  const plaetze = optionsOf('belegung_buchungen', 'platznummer');

  const perPlatz = useMemo(() => {
    const map = new Map<string, { from: string; to: string }[]>();
    for (const r of bookings) {
      const key = fieldLookup(r, 'platznummer')?.key;
      const from = fieldDate(r, 'anreisedatum');
      const to = fieldDate(r, 'abreisedatum');
      if (!key || !from || !to) continue;
      map.set(key, [...(map.get(key) ?? []), { from, to }]);
    }
    for (const list of map.values()) list.sort((a, b) => a.from.localeCompare(b.from));
    return map;
  }, [bookings]);

  // Nächte, in denen ALLE Plätze belegt sind — nur dort ist keine Anfrage sinnvoll.
  const blocked = useMemo(() => {
    const count = new Map<string, number>();
    for (const list of perPlatz.values()) {
      const nights = new Set<string>();
      for (const b of list) {
        for (let d = parseISO(b.from); format(d, 'yyyy-MM-dd') < b.to; d = addDays(d, 1)) {
          nights.add(format(d, 'yyyy-MM-dd'));
        }
      }
      for (const n of nights) count.set(n, (count.get(n) ?? 0) + 1);
    }
    const total = plaetze.length;
    return total === 0
      ? []
      : [...count.entries()]
          .filter(([, c]) => c >= total)
          .map(([n]) => ({ start: n, end: format(addDays(parseISO(n), 1), 'yyyy-MM-dd') }));
  }, [perPlatz, plaetze.length]);

  const steps = [
    { label: tx('Zeitraum'), heading: tx('Wunschzeitraum'), description: tx('Wähle An- und Abreise. Unten siehst du, welche Plätze wann belegt sind.') },
    { label: tx('Deine Angaben'), heading: tx('Du und dein Hund') },
    { label: tx('Prüfen'), heading: tx('Anfrage prüfen') },
  ];

  return (
    <PublicShell title={page.title} description={page.description} wide>
      <IntentWizardShell
        steps={steps}
        currentStep={step}
        onStepChange={setStep}
        back={false}
        forms={[anfrage]}
        draftKey={SLUG}
      >
        {step === 1 && (
          <div className="space-y-5" onFocusCapture={() => prepareChallenge(cfg, page, 'POST', `/apps/${page.endpoints?.find(e => e.op === 'create')?.app_id}/records`)}>
            <AvailabilityRangePicker {...anfrage.range('wunsch_anreise', 'wunsch_abreise', { blocked })} />
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">{tx('Belegung je Platz')}</h3>
              <ul className="divide-y rounded-lg border text-sm">
                {plaetze.map(p => {
                  const list = perPlatz.get(p.key) ?? [];
                  return (
                    <li key={p.key} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2">
                      <span className="w-24 shrink-0 font-medium">{p.label}</span>
                      {list.length === 0 ? (
                        <span className="text-muted-foreground">{tx('Keine Buchung — frei')}</span>
                      ) : (
                        <span className="min-w-0 flex-1 text-muted-foreground">
                          {list.map(b => `${fmt(b.from)} – ${fmt(b.to)}`).join(' · ')}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
            <StepNav hideBack onNext={() => anfrage.validate(['wunsch_anreise', 'wunsch_abreise'])} nextStepLabel={tx('Deine Angaben')} />
          </div>
        )}
        {step === 2 && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Bound form={anfrage} name="interessent_vorname" />
              <Bound form={anfrage} name="interessent_nachname" />
            </div>
            <Bound form={anfrage} name="interessent_email" />
            <Bound form={anfrage} name="interessent_telefon" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Bound form={anfrage} name="hund_name" />
              <Bound form={anfrage} name="hund_rasse" />
            </div>
            <Bound form={anfrage} name="hund_groesse" allowClear />
            <Bound form={anfrage} name="nachricht" />
            <StepNav
              onBack={() => setStep(1)}
              onNext={() => anfrage.validate(['interessent_vorname', 'interessent_nachname', 'interessent_email', 'hund_name'])}
              nextStepLabel={tx('Prüfen')}
            />
          </div>
        )}
        {step === 3 && !submit.done && (
          <SummaryStep
            forms={[anfrage]}
            submit={submit}
            whatHappensNext={tx('Wir prüfen deine Anfrage und melden uns per E-Mail bei dir.')}
          />
        )}
        {submit.result && (
          <SuccessStep
            result={submit.result}
            forms={[anfrage]}
            submit={submit}
            title={tx('Anfrage gesendet')}
            whatHappensNext={tx('Wir melden uns bei dir, sobald wir deine Anfrage geprüft haben.')}
          />
        )}
      </IntentWizardShell>
    </PublicShell>
  );
}
