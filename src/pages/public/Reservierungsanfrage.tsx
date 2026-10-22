import { useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { PublicShell } from '@/components/PublicShell';
import {
  loadPublicPagesConfig, prepareChallenge,
  type PublicPagesConfig, type PublicPageConfig,
} from '@/lib/publicClient';
import {
  useStepForm, useJourneySubmit, useOccupancy, fieldLookup, fieldText, optionsOf,
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

function day(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    return format(parseISO(iso), 'dd.MM.yyyy');
  } catch {
    return iso;
  }
}

function Flow({ cfg, page }: { cfg: PublicPagesConfig; page: PublicPageConfig }) {
  const port = useMemo(() => createPublicPort(cfg, page), [cfg, page]);
  const [step, setStep] = useState(1);
  const [belegung, setBelegung] = useState<JourneyRecord[]>([]);
  const [belegungError, setBelegungError] = useState(false);
  const occupancy = useOccupancy(port, 'buchungsanfragen');

  useEffect(() => {
    let alive = true;
    port.list('belegung_buchungen', { limit: 500 })
      .then(rows => { if (alive) setBelegung(rows); })
      .catch(() => { if (alive) setBelegungError(true); });
    return () => { alive = false; };
  }, [port]);

  const anfrage = useStepForm('buchungsanfragen', {
    fields: [
      'wunsch_anreise', 'wunsch_abreise',
      'interessent_vorname', 'interessent_nachname', 'interessent_email', 'interessent_telefon',
      'hund_name', 'hund_rasse', 'hund_groesse', 'nachricht',
    ],
    steps: {
      wunsch_anreise: 1, wunsch_abreise: 1,
      interessent_vorname: 2, interessent_nachname: 2, interessent_email: 2, interessent_telefon: 2,
      hund_name: 2, hund_rasse: 2, hund_groesse: 2, nachricht: 2,
    },
    autoComplete: true,
  });
  const submit = useJourneySubmit(
    port,
    [{ key: 'anfrage', entity: 'buchungsanfragen', form: anfrage, primary: true }],
    { draftKey: SLUG },
  );

  const blocked = useMemo(
    () => occupancy.ruled
      ? occupancy.blocked
      : belegung.flatMap(r => {
          const start = (r.fields.anreisedatum as string | undefined) ?? '';
          const end = (r.fields.abreisedatum as string | undefined) ?? '';
          return start && end ? [{ start, end }] : [];
        }),
    [occupancy.ruled, occupancy.blocked, belegung],
  );

  const plaetze = optionsOf('belegung_buchungen', 'platznummer');
  const perPlatz = plaetze.map(p => ({
    key: p.key,
    label: p.label,
    ranges: belegung
      .filter(r => fieldLookup(r, 'platznummer')?.key === p.key)
      .map(r => ({
        id: r.id,
        von: (r.fields.anreisedatum as string) ?? '',
        bis: (r.fields.abreisedatum as string) ?? '',
      }))
      .sort((a, b) => a.von.localeCompare(b.von)),
  }));

  const steps = [
    { label: tx('Zeitraum'), heading: tx('Wunschzeitraum wählen'), description: tx('Belegte Nächte sind durchgestrichen und nicht wählbar.') },
    { label: tx('Angaben'), heading: tx('Über dich und deinen Hund') },
    { label: tx('Prüfen'), heading: tx('Anfrage prüfen') },
  ];

  return (
    <IntentWizardShell
      steps={steps}
      currentStep={step}
      onStepChange={setStep}
      back={false}
      forms={[anfrage]}
      draftKey={SLUG}
    >
      {step === 1 && (
        <div className="space-y-5">
          <AvailabilityRangePicker {...anfrage.range('wunsch_anreise', 'wunsch_abreise', { blocked })} />
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">{tx('Belegte Zeiträume pro Platz')}</h3>
            {belegungError && (
              <p className="text-sm text-muted-foreground">{tx('Die Belegung konnte nicht geladen werden.')}</p>
            )}
            <ul className="divide-y rounded-lg border text-sm">
              {perPlatz.map(p => (
                <li key={p.key} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2">
                  <span className="min-w-20 font-medium">{p.label}</span>
                  {p.ranges.length === 0 ? (
                    <span className="text-muted-foreground">{tx('Frei')}</span>
                  ) : (
                    <span className="flex flex-wrap gap-x-3 gap-y-1">
                      {p.ranges.map(r => (
                        <span key={r.id} className="text-muted-foreground">
                          {day(r.von)} – {day(r.bis)}
                        </span>
                      ))}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
          <StepNav
            hideBack
            onNext={() => anfrage.validate(['wunsch_abreise'])}
            nextStepLabel={tx('Angaben')}
          />
        </div>
      )}
      {step === 2 && (
        <div className="space-y-4" onFocusCapture={() => prepareChallenge(cfg, page, 'POST', `/apps/${page.endpoints?.find(e => e.op === 'create')?.app_id ?? ''}/records`)}>
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
          whatHappensNext={tx('Wir prüfen deine Anfrage und melden uns per E-Mail bei dir.')}
        />
      )}
    </IntentWizardShell>
  );
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
  return (
    <PublicShell title={page.title} description={page.description}>
      <Flow cfg={cfg} page={page} />
    </PublicShell>
  );
}
