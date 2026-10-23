import { useEffect, useMemo, useState } from 'react';
import { addDays, format, parseISO } from 'date-fns';
import { PublicShell } from '@/components/PublicShell';
import {
  loadPublicPagesConfig,
  type PublicPagesConfig,
  type PublicPageConfig,
} from '@/lib/publicClient';
import {
  useStepForm,
  useJourneySubmit,
  useRecordSearch,
  occupancyFor,
  optionsOf,
  fieldLookup,
  fieldDate,
  type OccupancyRange,
} from '@/lib/journey';
import { createPublicPort } from '@/lib/journey/publicPort';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import {
  AvailabilityRangePicker,
  isNightBlocked,
} from '@/components/blocks/AvailabilityRangePicker';
import { Bound } from '@/components/blocks/Bound';
import { tx } from '@/i18n';

const STEP_OF: Record<string, number> = {
  wunsch_anreise: 1,
  wunsch_abreise: 1,
  interessent_vorname: 2,
  interessent_nachname: 2,
  interessent_email: 2,
  interessent_telefon: 2,
  hund_name: 3,
  hund_rasse: 3,
  hund_groesse: 3,
  nachricht: 3,
};

function fmt(iso: string | null): string {
  if (!iso) return '';
  return format(parseISO(iso), 'dd.MM.yyyy');
}

export default function Reservierungsanfrage() {
  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPublicPagesConfig('buchungsanfrage').then(c => {
      setCfg(c);
      setPage(c?.pages['buchungsanfrage'] ?? null);
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

  const f = useStepForm('buchungsanfragen', {
    fields: ['wunsch_anreise', 'wunsch_abreise', 'interessent_vorname', 'interessent_nachname', 'interessent_email', 'interessent_telefon', 'hund_name', 'hund_rasse', 'hund_groesse', 'nachricht'],
    steps: STEP_OF,
    autoComplete: true,
  });
  const submit = useJourneySubmit(
    port,
    [{ key: 'anfrage', entity: 'buchungsanfragen', form: f, primary: true }],
    { draftKey: 'buchungsanfrage' },
  );

  const belegung = useRecordSearch(port, 'belegung_buchungen', {
    searchFields: ['notizen'],
    loadAllUpTo: 500,
    includeTaken: true,
    toItem: r => ({ id: r.id, title: r.id }),
  });
  const records = belegung.records;

  const plaetze = optionsOf('belegung_buchungen', 'platznummer');

  // Pro Platz: belegte Zeiträume (nur Platz + Zeitraum)
  const perPlatz = useMemo(
    () =>
      plaetze.map(p => {
        const own = records.filter(r => fieldLookup(r, 'platznummer')?.key === p.key);
        const ranges = own
          .map(r => ({ from: fieldDate(r, 'anreisedatum'), to: fieldDate(r, 'abreisedatum') }))
          .filter(x => x.from && x.to)
          .sort((a, b) => (a.from! < b.from! ? -1 : 1));
        return { key: p.key, label: p.label, ranges };
      }),
    [plaetze, records],
  );

  // Nächte, in denen ALLE Plätze belegt sind -> im Kalender gesperrt
  const blocked = useMemo<OccupancyRange[]>(() => {
    if (plaetze.length === 0) return [];
    const perResource = plaetze.map(p =>
      occupancyFor('belegung_buchungen', records, { resource: p.key }),
    );
    if (perResource.some(r => r.length === 0)) return [];
    const starts = perResource.flat().map(r => r.start).sort();
    const ends = perResource.flat().map(r => r.end ?? r.start).sort();
    const out: OccupancyRange[] = [];
    let d = parseISO(starts[0]);
    const last = parseISO(ends[ends.length - 1]);
    let guard = 0;
    while (d <= last && guard < 1500) {
      const iso = format(d, 'yyyy-MM-dd');
      if (perResource.every(rs => isNightBlocked(iso, rs))) {
        out.push({ start: iso, end: format(addDays(d, 1), 'yyyy-MM-dd') });
      }
      d = addDays(d, 1);
      guard += 1;
    }
    return out;
  }, [plaetze, records]);

  return (
    <PublicShell
      title={page.title || tx('Reservierungsanfrage')}
      description={tx('Sieh dir die belegten Zeiträume an und stelle deine Anfrage – wir melden uns bei dir.')}
      wide
    >
      <IntentWizardShell
        steps={[
    {
      label: tx('Zeitraum'),
      heading: tx('Wunschzeitraum wählen'),
      description: tx('Hier siehst du, wann alle Plätze belegt sind. Wähle An- und Abreise.'),
    },
    { label: tx('Kontakt'), heading: tx('Deine Kontaktdaten') },
    { label: tx('Hund'), heading: tx('Dein Hund') },
    { label: tx('Prüfen'), heading: tx('Prüfen und absenden') },
  ]}
        currentStep={step}
        onStepChange={setStep}
        back={false}
        forms={[f]}
        draftKey="buchungsanfrage"
      >
        {step === 1 && (
          <div className="space-y-5">
            <AvailabilityRangePicker
              {...f.range('wunsch_anreise', 'wunsch_abreise', { blocked, minNights: 1 })}
            />
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">{tx('Belegte Zeiträume je Platz')}</h3>
              {belegung.select.loading ? (
                <p className="text-sm text-muted-foreground">{tx('Belegung wird geladen …')}</p>
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {perPlatz.map(p => (
                    <li key={p.key} className="rounded-lg border p-3 text-sm min-w-0">
                      <div className="font-medium">{p.label}</div>
                      {p.ranges.length === 0 ? (
                        <div className="text-muted-foreground">{tx('Aktuell frei')}</div>
                      ) : (
                        <ul className="text-muted-foreground">
                          {p.ranges.map((r, i) => (
                            <li key={i}>
                              {fmt(r.from)} – {fmt(r.to)}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <StepNav
              hideBack
              onNext={() => f.validate(['wunsch_anreise', 'wunsch_abreise'])}
              nextStepLabel={tx('Kontakt')}
            />
          </div>
        )}
        {step === 2 && (
          <div className="space-y-4">
            <Bound form={f} name="interessent_vorname" />
            <Bound form={f} name="interessent_nachname" />
            <Bound form={f} name="interessent_email" />
            <Bound form={f} name="interessent_telefon" />
            <StepNav
              onBack={() => setStep(1)}
              onNext={() =>
                f.validate(['interessent_vorname', 'interessent_nachname', 'interessent_email'])
              }
              nextStepLabel={tx('Hund')}
            />
          </div>
        )}
        {step === 3 && (
          <div className="space-y-4">
            <Bound form={f} name="hund_name" />
            <Bound form={f} name="hund_rasse" />
            <Bound form={f} name="hund_groesse" />
            <Bound form={f} name="nachricht" />
            <StepNav
              onBack={() => setStep(2)}
              onNext={() => f.validate(['hund_name'])}
              nextStepLabel={tx('Prüfen')}
            />
          </div>
        )}
        {step === 4 && !submit.done && (
          <SummaryStep
            forms={[f]}
            submit={submit}
            whatHappensNext={tx('Die Pension prüft deine Anfrage und meldet sich per E-Mail bei dir.')}
          />
        )}
        {submit.result && (
          <SuccessStep
            result={submit.result}
            forms={[f]}
            submit={submit}
            whatHappensNext={tx('Die Pension prüft deine Anfrage und meldet sich per E-Mail bei dir.')}
          />
        )}
      </IntentWizardShell>
    </PublicShell>
  );
}
