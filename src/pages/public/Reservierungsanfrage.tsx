import { useEffect, useMemo, useState } from 'react';
import { PublicShell } from '@/components/PublicShell';
import {
  loadPublicPagesConfig,
  type PublicPagesConfig,
  type PublicPageConfig,
} from '@/lib/publicClient';
import { tx } from '@/i18n';
import {
  useStepForm,
  useJourneySubmit,
  useOccupancy,
  fieldLookup,
  fieldDate,
  formatRange,
  type JourneyRecord,
} from '@/lib/journey';
import { createPublicPort } from '@/lib/journey/publicPort';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { AvailabilityRangePicker } from '@/components/blocks/AvailabilityRangePicker';
import { Bound } from '@/components/blocks/Bound';

const SLUG = 'buchungsanfrage';

const FIELD_STEPS: Record<string, number> = {
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
    <PublicShell title={page.title} description={tx('Prüfe die freien Zeiträume und sende uns deine Reservierungsanfrage.')}>
      <RequestWizard cfg={cfg} page={page} />
    </PublicShell>
  );
}

function RequestWizard({ cfg, page }: { cfg: PublicPagesConfig; page: PublicPageConfig }) {
  const [step, setStep] = useState(1);
  const port = useMemo(() => createPublicPort(cfg, page), [cfg, page]);

  const occupancy = useOccupancy(port, 'belegung_buchungen');
  const [records, setRecords] = useState<JourneyRecord[]>([]);
  useEffect(() => {
    port.list('belegung_buchungen').then(setRecords, () => setRecords([]));
  }, [port]);

  const form = useStepForm('buchungsanfragen', {
    fields: [
      'wunsch_anreise',
      'wunsch_abreise',
      'interessent_vorname',
      'interessent_nachname',
      'interessent_email',
      'interessent_telefon',
      'hund_name',
      'hund_rasse',
      'hund_groesse',
      'nachricht',
    ],
    steps: FIELD_STEPS,
    autoComplete: true,
  });
  const submit = useJourneySubmit(
    port,
    [{ key: 'anfrage', entity: 'buchungsanfragen', form, primary: true }],
    { draftKey: SLUG },
  );

  // per Platz: belegte Zeiträume (ohne Namen), aufsteigend nach Anreise
  const perPlatz = useMemo(() => {
    const map = new Map<string, { label: string; ranges: { from: string; to: string }[] }>();
    for (const r of records) {
      const p = fieldLookup(r, 'platznummer');
      const from = fieldDate(r, 'anreisedatum');
      const to = fieldDate(r, 'abreisedatum');
      if (!p || !from || !to) continue;
      const entry = map.get(p.key) ?? { label: p.label, ranges: [] };
      entry.ranges.push({ from, to });
      map.set(p.key, entry);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[1].label.localeCompare(b[1].label, undefined, { numeric: true }))
      .map(([key, v]) => ({
        key,
        label: v.label,
        ranges: v.ranges.sort((a, b) => a.from.localeCompare(b.from)),
      }));
  }, [records]);

  const steps = [
    { label: tx('Zeitraum'), heading: tx('Wann möchtest du kommen?'), description: tx('Belegte Nächte sind durchgestrichen und nicht wählbar.') },
    { label: tx('Kontakt'), heading: tx('Wie erreichen wir dich?') },
    { label: tx('Hund'), heading: tx('Erzähl uns von deinem Hund') },
    { label: tx('Prüfen') },
  ];

  const restart = () => {
    submit.reset();
    form.reset();
    setStep(1);
  };

  return (
    <IntentWizardShell
      steps={steps}
      currentStep={step}
      onStepChange={setStep}
      back={false}
      forms={[form]}
      draftKey={SLUG}
      loading={occupancy.loading}
    >
      {step === 1 && (
        <div className="space-y-4">
          <AvailabilityRangePicker
            {...form.range('wunsch_anreise', 'wunsch_abreise', { blocked: occupancy.blocked })}
          />
          {perPlatz.length > 0 && (
            <details className="rounded-lg border p-3 text-sm">
              <summary className="cursor-pointer font-medium">{tx('Belegung je Platz')}</summary>
              <ul className="mt-3 space-y-2">
                {perPlatz.map(p => (
                  <li key={p.key}>
                    <span className="font-medium">{p.label}</span>
                    <span className="block text-muted-foreground">
                      {p.ranges.map(r => formatRange(r.from, r.to, 'days')).join(' · ')}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
          <StepNav
            hideBack
            onNext={() => form.validate(['wunsch_anreise', 'wunsch_abreise'])}
            nextStepLabel={tx('Kontakt')}
          />
        </div>
      )}
      {step === 2 && (
        <div className="space-y-4">
          <Bound form={form} name="interessent_vorname" />
          <Bound form={form} name="interessent_nachname" />
          <Bound form={form} name="interessent_email" />
          <Bound form={form} name="interessent_telefon" />
          <StepNav
            onBack={() => setStep(1)}
            onNext={() => form.validate(['interessent_vorname', 'interessent_nachname', 'interessent_email', 'interessent_telefon'])}
            nextStepLabel={tx('Hund')}
          />
        </div>
      )}
      {step === 3 && (
        <div className="space-y-4">
          <Bound form={form} name="hund_name" />
          <Bound form={form} name="hund_rasse" />
          <Bound form={form} name="hund_groesse" allowClear />
          <Bound form={form} name="nachricht" />
          <StepNav
            onBack={() => setStep(2)}
            onNext={() => form.validate(['hund_name', 'hund_rasse', 'hund_groesse', 'nachricht'])}
            nextStepLabel={tx('Prüfen')}
          />
        </div>
      )}
      {step === 4 && !submit.done && (
        <SummaryStep
          forms={[form]}
          submit={submit}
          whatHappensNext={tx('Wir prüfen deine Anfrage und melden uns per E-Mail bei dir.')}
        />
      )}
      {submit.result && (
        <SuccessStep
          result={submit.result}
          forms={[form]}
          title={tx('Anfrage gesendet')}
          whatHappensNext={tx('Wir prüfen deine Anfrage und melden uns per E-Mail bei dir.')}
          next={[{ label: tx('Weitere Anfrage'), onClick: restart }]}
        />
      )}
    </IntentWizardShell>
  );
}
