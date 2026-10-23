/**
 * Aufenthalt abschließen — 3-Schritt-Wizard.
 * Steps: 1) Aktiven Aufenthalt wählen → 2) Abschließen oder stornieren → 3) Prüfen & speichern.
 * Reads: belegung_buchungen (Hund, Platz, Zeitraum, Status). Writes: belegung_buchungen.status (Update).
 * Composes: IntentWizardShell, EntitySelectStep, Bound, StepNav, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Bound } from '@/components/blocks/Bound';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { fieldDate, fieldLookup } from '@/lib/journey';
import { useAufenthaltAbschliessenFlow } from '@/lib/journey/flows/AufenthaltAbschliessen';
import { tx } from '@/i18n';

function shortDate(iso: string | null): string {
  return iso ? format(parseISO(iso), 'dd.MM.yyyy') : '?';
}

export default function AufenthaltAbschliessenPage() {
  const [step, setStep] = useState(1);
  const flow = useAufenthaltAbschliessenFlow({
    steps: { belegung_buchungen: 1, status: 2 },
    items: {
      belegung_buchungen: (r, ctx) => ({
        id: r.id,
        title: tx`${ctx.ref('hund') ?? tx('Ohne Hund')} — ${fieldLookup(r, 'platznummer')?.label ?? '?'} · ${shortDate(fieldDate(r, 'anreisedatum'))} – ${shortDate(fieldDate(r, 'abreisedatum'))}`,
      }),
    },
  });

  return (
    <IntentWizardShell
      title={tx('Aufenthalt abschließen')}
      currentStep={step}
      onStepChange={setStep}
      forms={flow.formList}
      draftKey={flow.draftKey}
      intro={{ description: tx('Einen Aufenthalt nach der Abreise abschließen oder stornieren.'), needs: [tx('Name des Hundes oder Platznummer')] }}
    >
      <WizardStep label={tx('Aufenthalt')} description={tx('Welchen aktiven Aufenthalt möchtest du beenden?')}>
        <EntitySelectStep
          {...flow.picks.belegung_buchungen.select}
          {...flow.pick('belegung_buchungen')}
          searchPlaceholder={tx('Aufenthalt suchen …')}
          emptyText={tx('Es gibt keinen aktiven Aufenthalt.')}
        />
      </WizardStep>
      <WizardStep
        label={tx('Status')}
        description={tx('Abschließen nach der Abreise oder stornieren — der Platz wird danach wieder frei.')}
        needs={['belegung_buchungen']}
      >
        <div className="space-y-4">
          <Bound form={flow.forms.belegung_buchungen} name="status" />
          <StepNav
            onBack={() => setStep(1)}
            onNext={() => flow.validateStep(2)}
            nextStepLabel={tx('Prüfen')}
          />
        </div>
      </WizardStep>
      <WizardStep label={tx('Prüfen')}>
        {!flow.submit.done && (
          <SummaryStep
            forms={flow.formList}
            submit={flow.submit}
            whatHappensNext={tx('Der Platz ist danach wieder buchbar.')}
          />
        )}
      </WizardStep>
      {flow.submit.result && (
        <SuccessStep
          result={flow.submit.result}
          forms={flow.formList}
          submit={flow.submit}
          actions={{ copy: false, print: false }}
          next={[
            { label: tx('Pfoten-Porträt erstellen'), href: '#/intents/portraet-erstellen' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
        />
      )}
    </IntentWizardShell>
  );
}
