import { useEffect, useMemo, useState } from 'react';
import { PublicShell } from '@/components/PublicShell';
import {
  loadPublicPagesConfig, prepareChallenge,
  type PublicPagesConfig, type PublicPageConfig,
} from '@/lib/publicClient';
import { useStepForm, useJourneySubmit, useOccupancy } from '@/lib/journey';
import { createPublicPort } from '@/lib/journey/publicPort';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { AvailabilityRangePicker } from '@/components/blocks/AvailabilityRangePicker';
import { Bound } from '@/components/blocks/Bound';
import { tx } from '@/i18n';

const SLUG = 'buchungsanfrage';

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
      <RequestWizard cfg={cfg} page={page} />
    </PublicShell>
  );
}

function RequestWizard({ cfg, page }: { cfg: PublicPagesConfig; page: PublicPageConfig }) {
  const [step, setStep] = useState(1);
  const port = useMemo(() => createPublicPort(cfg, page), [cfg, page]);
  const occupancy = useOccupancy(port, 'belegung_buchungen');

  const anfrage = useStepForm('buchungsanfragen', {
    fields: [
      'wunsch_anreise', 'wunsch_abreise',
      'hund_name', 'hund_rasse', 'hund_groesse',
      'interessent_vorname', 'interessent_nachname', 'interessent_email', 'interessent_telefon',
      'nachricht',
    ],
    steps: {
      wunsch_anreise: 1, wunsch_abreise: 1,
      hund_name: 2, hund_rasse: 2, hund_groesse: 2,
      interessent_vorname: 3, interessent_nachname: 3, interessent_email: 3, interessent_telefon: 3,
      nachricht: 3,
    },
    autoComplete: true,
  });

  const submit = useJourneySubmit(
    port,
    [{ key: 'anfrage', entity: 'buchungsanfragen', form: anfrage, primary: true }],
    { draftKey: SLUG },
  );

  const touch = () => {
    const ep = page.endpoints?.find(e => e.op === 'create');
    if (ep?.app_id) prepareChallenge(cfg, page, 'POST', `/apps/${ep.app_id}/records`);
  };

  const steps = [
    { label: tx('Zeitraum'), heading: tx('Wunschzeitraum'), description: tx('Wähle An- und Abreise — belegte Nächte sind durchgestrichen.') },
    { label: tx('Hund'), heading: tx('Dein Hund') },
    { label: tx('Kontakt'), heading: tx('Deine Kontaktdaten') },
    { label: tx('Prüfen'), heading: tx('Anfrage prüfen') },
  ];

  return (
    <div onFocusCapture={touch}>
      <IntentWizardShell
        steps={steps}
        currentStep={step}
        onStepChange={setStep}
        back={false}
        forms={[anfrage]}
        draftKey={SLUG}
      >
        {step === 1 && (
          <>
            <AvailabilityRangePicker
              {...anfrage.range('wunsch_anreise', 'wunsch_abreise', { blocked: occupancy.blocked })}
            />
            <StepNav
              hideBack
              onNext={() => anfrage.validate(['wunsch_anreise', 'wunsch_abreise'])}
              nextStepLabel={tx('Dein Hund')}
            />
          </>
        )}
        {step === 2 && (
          <>
            <div className="space-y-4">
              <Bound form={anfrage} name="hund_name" />
              <Bound form={anfrage} name="hund_rasse" />
              <Bound form={anfrage} name="hund_groesse" allowClear />
            </div>
            <StepNav
              onBack={() => setStep(1)}
              onNext={() => anfrage.validate(['hund_name'])}
              nextStepLabel={tx('Kontakt')}
            />
          </>
        )}
        {step === 3 && (
          <>
            <div className="space-y-4">
              <Bound form={anfrage} name="interessent_vorname" />
              <Bound form={anfrage} name="interessent_nachname" />
              <Bound form={anfrage} name="interessent_email" />
              <Bound form={anfrage} name="interessent_telefon" />
              <Bound form={anfrage} name="nachricht" />
            </div>
            <StepNav
              onBack={() => setStep(2)}
              onNext={() => anfrage.validate(['interessent_vorname', 'interessent_nachname', 'interessent_email'])}
              nextStepLabel={tx('Prüfen')}
            />
          </>
        )}
        {step === 4 && !submit.done && (
          <SummaryStep
            forms={[anfrage]}
            submit={submit}
            whatHappensNext={tx('Die Pension prüft deine Anfrage und meldet sich per E-Mail bei dir.')}
          />
        )}
        {submit.result && (
          <SuccessStep
            result={submit.result}
            forms={[anfrage]}
            submit={submit}
            title={tx('Anfrage gesendet')}
            whatHappensNext={tx('Die Pension prüft deine Anfrage und meldet sich per E-Mail bei dir.')}
          />
        )}
      </IntentWizardShell>
    </div>
  );
}
