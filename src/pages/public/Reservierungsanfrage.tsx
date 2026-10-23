import { useEffect, useMemo, useState } from 'react';
import { PublicShell } from '@/components/PublicShell';
import {
  loadPublicPagesConfig, prepareChallenge, PageUnavailableError,
  type PublicPagesConfig, type PublicPageConfig,
} from '@/lib/publicClient';
import {
  useStepForm, useJourneySubmit, useOccupancy, fieldLookup, fieldDate,
  optionsOf, formatRange,
  type JourneyRecord,
} from '@/lib/journey';
import { createPublicPort } from '@/lib/journey/publicPort';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { AvailabilityRangePicker } from '@/components/blocks/AvailabilityRangePicker';
import { Bound } from '@/components/blocks/Bound';
import { tx } from '@/i18n';

const SLUG = 'buchungsanfrage';
const FIELDS = [
  'interessent_vorname', 'interessent_nachname', 'interessent_email', 'interessent_telefon',
  'hund_name', 'hund_rasse', 'hund_groesse', 'wunsch_anreise', 'wunsch_abreise', 'nachricht',
];

export default function Reservierungsanfrage() {
  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPublicPagesConfig(SLUG)
      .then(c => {
        setCfg(c);
        setPage(c?.pages[SLUG] ?? null);
        setLoading(false);
      })
      .catch(e => {
        if (!(e instanceof PageUnavailableError)) console.error(e);
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
  const [belegt, setBelegt] = useState<JourneyRecord[]>([]);
  const occupancy = useOccupancy(port, 'belegung_buchungen');

  const f = useStepForm('buchungsanfragen', {
    fields: [
      'interessent_vorname', 'interessent_nachname', 'interessent_email', 'interessent_telefon',
      'hund_name', 'hund_rasse', 'hund_groesse', 'wunsch_anreise', 'wunsch_abreise', 'nachricht',
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
    [{ key: 'anfrage', entity: 'buchungsanfragen', form: f, primary: true }],
    { draftKey: SLUG },
  );

  useEffect(() => {
    let alive = true;
    port.list('belegung_buchungen', { limit: 500 })
      .then(r => { if (alive) setBelegt(r); })
      .catch(() => { if (alive) setBelegt([]); });
    return () => { alive = false; };
  }, [port]);

  useEffect(() => { prepareChallenge(cfg, page, 'POST', `/apps/${page.endpoints?.find(e => e.op === 'create')?.app_id ?? ''}/records`); }, [cfg, page]);

  const plaetze = optionsOf('belegung_buchungen', 'platznummer');
  const proPlatz = plaetze.map(p => ({
    key: p.key,
    label: p.label,
    ranges: belegt
      .filter(r => fieldLookup(r, 'platznummer')?.key === p.key)
      .map(r => ({ von: fieldDate(r, 'anreisedatum'), bis: fieldDate(r, 'abreisedatum') }))
      .sort((a, b) => (a.von ?? '').localeCompare(b.von ?? '')),
  }));

  const steps = [
    { label: tx('Zeitraum') },
    { label: tx('Deine Angaben') },
    { label: tx('Prüfen') },
  ];

  return (
    <PublicShell title={page.title} description={page.description} wide>
      <IntentWizardShell
        steps={steps}
        currentStep={step}
        onStepChange={setStep}
        back={false}
        forms={[f]}
        draftKey={SLUG}
      >
        {step === 1 && (
          <div className="space-y-5">
            <AvailabilityRangePicker
              {...f.range('wunsch_anreise', 'wunsch_abreise', { blocked: occupancy.blocked })}
            />
            <details className="rounded-lg border p-3 text-sm">
              <summary className="cursor-pointer font-medium">{tx('Belegte Zeiträume pro Platz')}</summary>
              <div className="mt-3 space-y-2">
                {proPlatz.map(p => (
                  <div key={p.key} className="flex flex-wrap gap-x-3 gap-y-1">
                    <span className="w-24 font-medium">{p.label}</span>
                    {p.ranges.length === 0 ? (
                      <span className="text-muted-foreground">{tx('frei')}</span>
                    ) : (
                      <span className="min-w-0 flex-1">
                        {p.ranges.map(r => formatRange(r.von, r.bis, 'days')).join(' · ')}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </details>
            <StepNav
              hideBack
              onNext={() => f.validate(['wunsch_anreise', 'wunsch_abreise'])}
              nextStepLabel={tx('Deine Angaben')}
            />
          </div>
        )}
        {step === 2 && (
          <div className="space-y-4">
            <Bound form={f} name="interessent_vorname" />
            <Bound form={f} name="interessent_nachname" />
            <Bound form={f} name="interessent_email" />
            <Bound form={f} name="interessent_telefon" />
            <Bound form={f} name="hund_name" />
            <Bound form={f} name="hund_rasse" />
            <Bound form={f} name="hund_groesse" allowClear />
            <Bound form={f} name="nachricht" />
            <StepNav
              onBack={() => setStep(1)}
              onNext={() => f.validate(FIELDS)}
              nextStepLabel={tx('Prüfen')}
            />
          </div>
        )}
        {step === 3 && !submit.done && (
          <SummaryStep
            forms={[f]}
            submit={submit}
            whatHappensNext={tx('Wir prüfen deine Anfrage und melden uns per E-Mail bei dir.')}
          />
        )}
        {submit.result && (
          <SuccessStep
            result={submit.result}
            forms={[f]}
            submit={submit}
            whatHappensNext={tx('Deine Anfrage ist eingegangen. Wir prüfen sie und melden uns bei dir.')}
          />
        )}
      </IntentWizardShell>
    </PublicShell>
  );
}
