import { useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { PublicShell } from '@/components/PublicShell';
import {
  loadPublicPagesConfig,
  type PublicPagesConfig,
  type PublicPageConfig,
} from '@/lib/publicClient';
import {
  useStepForm,
  useJourneySubmit,
  useOccupancy,
  fieldDate,
  fieldLookup,
  type JourneyRecord,
  type JourneyPort,
} from '@/lib/journey';
import { createPublicPort } from '@/lib/journey/publicPort';
import { IntentWizardShell, type WizardStep } from '@/components/blocks/IntentWizardShell';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { Bound } from '@/components/blocks/Bound';
import { AvailabilityRangePicker } from '@/components/blocks/AvailabilityRangePicker';
import { tx } from '@/i18n';

const STEP_OF: Record<string, number> = {
  wunsch_anreise: 1,
  wunsch_abreise: 1,
  hund_name: 2,
  hund_rasse: 2,
  hund_groesse: 2,
  interessent_vorname: 3,
  interessent_nachname: 3,
  interessent_email: 3,
  interessent_telefon: 3,
  nachricht: 3,
};

function fmt(iso: string | null): string {
  if (!iso) return '';
  try {
    return format(parseISO(iso), 'dd.MM.yyyy');
  } catch {
    return iso;
  }
}

function Wizard({ port }: { port: JourneyPort }) {
  const [step, setStep] = useState(1);
  const [booked, setBooked] = useState<JourneyRecord[]>([]);
  const occupancy = useOccupancy(port, 'belegung_buchungen');

  const anfrage = useStepForm('buchungsanfragen', {
    fields: [
      'wunsch_anreise',
      'wunsch_abreise',
      'hund_name',
      'hund_rasse',
      'hund_groesse',
      'interessent_vorname',
      'interessent_nachname',
      'interessent_email',
      'interessent_telefon',
      'nachricht',
    ],
    steps: STEP_OF,
    autoComplete: true,
  });
  const submit = useJourneySubmit(
    port,
    [{ key: 'anfrage', entity: 'buchungsanfragen', form: anfrage, primary: true }],
    { draftKey: 'buchungsanfrage' },
  );

  useEffect(() => {
    let alive = true;
    port
      .list('belegung_buchungen')
      .then(rs => {
        if (alive) setBooked(rs);
      })
      .catch(() => {
        if (alive) setBooked([]);
      });
    return () => {
      alive = false;
    };
  }, [port]);

  const rows = useMemo(
    () =>
      booked
        .map(r => ({
          id: r.id,
          platz: fieldLookup(r, 'platznummer')?.label ?? '',
          von: fieldDate(r, 'anreisedatum'),
          bis: fieldDate(r, 'abreisedatum'),
        }))
        .sort((a, b) => (a.von ?? '').localeCompare(b.von ?? '')),
    [booked],
  );

  const steps: WizardStep[] = [
    { label: tx('Zeitraum'), heading: tx('Wann soll dein Hund kommen?'), description: tx('Belegte Nächte sind durchgestrichen und nicht wählbar.') },
    { label: tx('Hund'), heading: tx('Erzähl uns von deinem Hund') },
    { label: tx('Kontakt'), heading: tx('Wie erreichen wir dich?') },
    { label: tx('Prüfen'), heading: tx('Alles richtig?') },
  ];

  return (
    <IntentWizardShell
      steps={steps}
      currentStep={step}
      onStepChange={setStep}
      back={false}
      forms={[anfrage]}
      draftKey="buchungsanfrage"
    >
      {step === 1 && (
        <div className="space-y-5">
          <AvailabilityRangePicker
            {...anfrage.range('wunsch_anreise', 'wunsch_abreise', { blocked: occupancy.blocked })}
          />
          <div className="rounded-xl border bg-muted/30 p-4 overflow-hidden">
            <h3 className="text-sm font-semibold mb-2">{tx('Aktuell belegte Plätze')}</h3>
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">{tx('Aktuell sind keine Zeiträume belegt.')}</p>
            ) : (
              <ul className="space-y-1 max-h-48 overflow-y-auto">
                {rows.map(r => (
                  <li key={r.id} className="flex flex-wrap justify-between gap-x-3 text-sm">
                    <span className="font-medium">{r.platz}</span>
                    <span className="text-muted-foreground">
                      {fmt(r.von)} – {fmt(r.bis)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <StepNav
            hideBack
            onNext={() => anfrage.validate(['wunsch_anreise', 'wunsch_abreise'])}
            nextStepLabel={tx('Hund')}
          />
        </div>
      )}
      {step === 2 && (
        <div className="space-y-4">
          <Bound form={anfrage} name="hund_name" />
          <Bound form={anfrage} name="hund_rasse" />
          <Bound form={anfrage} name="hund_groesse" />
          <StepNav
            onBack={() => setStep(1)}
            onNext={() => anfrage.validate(['hund_name', 'hund_rasse', 'hund_groesse'])}
            nextStepLabel={tx('Kontakt')}
          />
        </div>
      )}
      {step === 3 && (
        <div className="space-y-4">
          <Bound form={anfrage} name="interessent_vorname" />
          <Bound form={anfrage} name="interessent_nachname" />
          <Bound form={anfrage} name="interessent_email" />
          <Bound form={anfrage} name="interessent_telefon" />
          <Bound form={anfrage} name="nachricht" />
          <StepNav
            onBack={() => setStep(2)}
            onNext={() =>
              anfrage.validate([
                'interessent_vorname',
                'interessent_nachname',
                'interessent_email',
                'interessent_telefon',
                'nachricht',
              ])
            }
            nextStepLabel={tx('Prüfen')}
          />
        </div>
      )}
      {step === 4 && !submit.done && (
        <SummaryStep
          forms={[anfrage]}
          submit={submit}
          whatHappensNext={tx('Wir prüfen deine Anfrage und melden uns per E-Mail oder Telefon bei dir.')}
        />
      )}
      {submit.result && (
        <SuccessStep
          result={submit.result}
          forms={[anfrage]}
          submit={submit}
          whatHappensNext={tx('Deine Anfrage ist bei uns eingegangen. Wir melden uns bald bei dir.')}
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
    loadPublicPagesConfig('buchungsanfrage').then(c => {
      setCfg(c);
      setPage(c?.pages['buchungsanfrage'] ?? null);
      setLoading(false);
    });
  }, []);

  const port = useMemo(() => (cfg && page ? createPublicPort(cfg, page) : null), [cfg, page]);

  if (loading || !cfg || !page || !port) {
    return <PublicShell loading={loading} unavailable={!loading} />;
  }

  return (
    <PublicShell
      title={page.title}
      description={tx('Prüfe, welche Zeiträume frei sind, und stelle deine Reservierungsanfrage für deinen Hund.')}
    >
      <Wizard port={port} />
    </PublicShell>
  );
}
