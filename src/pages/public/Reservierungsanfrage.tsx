import { useEffect, useMemo, useState } from 'react';
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
  type JourneyPort,
  type JourneyRecord,
} from '@/lib/journey';
import { createPublicPort } from '@/lib/journey/publicPort';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { AvailabilityRangePicker } from '@/components/blocks/AvailabilityRangePicker';
import { Bound } from '@/components/blocks/Bound';
import { FieldErrorSummary } from '@/components/blocks/FieldErrorSummary';
import { formatDate } from '@/lib/formatters';
import { tx } from '@/i18n';

function Belegung({ port }: { port: JourneyPort }) {
  const [records, setRecords] = useState<JourneyRecord[] | null>(null);

  useEffect(() => {
    let alive = true;
    port
      .list('belegung_buchungen')
      .then(r => alive && setRecords(r))
      .catch(() => alive && setRecords([]));
    return () => {
      alive = false;
    };
  }, [port]);

  const rows = useMemo(() => {
    const byPlatz = new Map<string, { label: string; n: number; ranges: string[] }>();
    for (const r of records ?? []) {
      const p = fieldLookup(r, 'platznummer');
      const a = fieldDate(r, 'anreisedatum');
      const b = fieldDate(r, 'abreisedatum');
      if (!p || !a || !b) continue;
      const cur = byPlatz.get(p.key) ?? {
        label: p.label,
        n: parseInt(p.key.replace(/\D/g, ''), 10) || 0,
        ranges: [],
      };
      cur.ranges.push(`${a}|${b}`);
      byPlatz.set(p.key, cur);
    }
    return [...byPlatz.values()]
      .sort((x, y) => x.n - y.n)
      .map(v => ({ ...v, ranges: v.ranges.sort() }));
  }, [records]);

  if (records === null) {
    return <p className="text-sm text-muted-foreground">{tx('Belegung wird geladen …')}</p>;
  }
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {tx('Aktuell sind keine Zeiträume belegt – alle Plätze sind frei.')}
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">{tx('Bereits belegte Zeiträume je Platz')}</h3>
      <ul className="grid gap-2 sm:grid-cols-2">
        {rows.map(r => (
          <li key={r.label} className="rounded-lg border bg-muted/30 p-3 text-sm">
            <div className="font-medium">{r.label}</div>
            <ul className="mt-1 space-y-0.5 text-muted-foreground">
              {r.ranges.map(rg => {
                const [a, b] = rg.split('|');
                return (
                  <li key={rg}>
                    {formatDate(a)} – {formatDate(b)}
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Wizard({ cfg, page }: { cfg: PublicPagesConfig; page: PublicPageConfig }) {
  const port = useMemo(() => createPublicPort(cfg, page), [cfg, page]);
  const [step, setStep] = useState(1);
  const occupancy = useOccupancy(port, 'belegung_buchungen');

  const f = useStepForm('buchungsanfragen', {
    fields: [
      'interessent_vorname',
      'interessent_nachname',
      'interessent_email',
      'interessent_telefon',
      'hund_name',
      'hund_rasse',
      'hund_groesse',
      'wunsch_anreise',
      'wunsch_abreise',
      'nachricht',
    ],
    autoComplete: true,
    steps: {
      wunsch_anreise: 1,
      wunsch_abreise: 1,
      hund_name: 2,
      hund_rasse: 2,
      hund_groesse: 2,
      nachricht: 2,
      interessent_vorname: 3,
      interessent_nachname: 3,
      interessent_email: 3,
      interessent_telefon: 3,
    },
  });

  const submit = useJourneySubmit(
    port,
    [{ key: 'anfrage', entity: 'buchungsanfragen', form: f, primary: true }],
    { draftKey: 'buchungsanfrage' },
  );

  const steps = [
    { label: tx('Zeitraum'), description: tx('Wähle An- und Abreise – belegte Nächte sind gesperrt.') },
    { label: tx('Dein Hund') },
    { label: tx('Kontakt') },
    { label: tx('Prüfen') },
  ];

  return (
    <IntentWizardShell
      steps={steps}
      currentStep={step}
      onStepChange={setStep}
      back={false}
      forms={[f]}
      draftKey="buchungsanfrage"
    >
      {step === 1 && (
        <div className="space-y-5">
          <AvailabilityRangePicker
            {...f.range('wunsch_anreise', 'wunsch_abreise', { blocked: occupancy.blocked })}
          />
          <Belegung port={port} />
          <StepNav
            hideBack
            onNext={() => f.validate(['wunsch_anreise', 'wunsch_abreise'])}
            nextStepLabel={tx('Dein Hund')}
          />
        </div>
      )}
      {step === 2 && (
        <div className="space-y-4">
          <Bound form={f} name="hund_name" />
          <Bound form={f} name="hund_rasse" />
          <Bound form={f} name="hund_groesse" allowClear />
          <Bound form={f} name="nachricht" />
          <StepNav
            onBack={() => setStep(1)}
            onNext={() => f.validate(['hund_name'])}
            nextStepLabel={tx('Kontakt')}
          />
        </div>
      )}
      {step === 3 && (
        <div className="space-y-4">
          <FieldErrorSummary forms={[f]} step={3} />
          <Bound form={f} name="interessent_vorname" />
          <Bound form={f} name="interessent_nachname" />
          <Bound form={f} name="interessent_email" />
          <Bound form={f} name="interessent_telefon" />
          <StepNav
            onBack={() => setStep(2)}
            onNext={() =>
              f.validate(['interessent_vorname', 'interessent_nachname', 'interessent_email'])
            }
            nextStepLabel={tx('Prüfen')}
          />
        </div>
      )}
      {step === 4 && !submit.done && (
        <SummaryStep
          forms={[f]}
          submit={submit}
          whatHappensNext={tx(
            'Deine Anfrage geht bei uns ein. Wir prüfen sie und melden uns per E-Mail oder Telefon bei dir.',
          )}
        />
      )}
      {submit.result && (
        <SuccessStep
          result={submit.result}
          forms={[f]}
          submit={submit}
          title={tx('Anfrage gesendet')}
          whatHappensNext={tx('Wir melden uns bei dir, sobald wir deine Anfrage geprüft haben.')}
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
    loadPublicPagesConfig('buchungsanfrage')
      .then(c => {
        setCfg(c);
        setPage(c?.pages['buchungsanfrage'] ?? null);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  if (loading || !cfg || !page) {
    return <PublicShell loading={loading} unavailable={!loading} />;
  }

  return (
    <PublicShell
      title={page.title}
      description={tx('Sieh, wann Plätze belegt sind, und frag den Aufenthalt für deinen Hund an.')}
      wide
    >
      <Wizard cfg={cfg} page={page} />
    </PublicShell>
  );
}
