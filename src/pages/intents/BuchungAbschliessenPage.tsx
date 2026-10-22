/**
 * Aufenthalt abschließen — 3-Schritt-Wizard.
 * Steps: 1) Aktive Buchung auswählen → 2) Abschließen oder stornieren → 3) Prüfen & speichern.
 * Reads: belegung_buchungen (hund, platznummer, anreisedatum, abreisedatum, status).
 * Writes: belegung_buchungen (status, über useBuchungAbschliessenFlow).
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
import { useBuchungAbschliessenFlow } from '@/lib/journey/flows/BuchungAbschliessen';
import { tx } from '@/i18n';

const showDate = (iso: string | null) => (iso ? format(parseISO(iso), 'dd.MM.yyyy') : '?');

export default function BuchungAbschliessenPage() {
  const [step, setStep] = useState(1);
  const flow = useBuchungAbschliessenFlow({
    steps: { belegung_buchungen: 1, status: 2 },
    items: {
      belegung_buchungen: (r, ctx) => ({
        id: r.id,
        title: ctx.ref('hund') ?? tx('Ohne Hund'),
        subtitle: tx`${fieldLookup(r, 'platznummer')?.label ?? '?'} · ${showDate(fieldDate(r, 'anreisedatum'))} – ${showDate(fieldDate(r, 'abreisedatum'))}`,
        status: fieldLookup(r, 'status') ?? undefined,
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
      intro={{
        description: tx('Einen Aufenthalt nach der Abreise abschließen oder die Buchung stornieren.'),
        needs: [tx('Name des Hundes oder Platznummer')],
      }}
    >
      <WizardStep label={tx('Buchung')} heading={tx('Buchung auswählen')} description={tx('Welcher Aufenthalt soll abgeschlossen oder storniert werden?')}>
        <EntitySelectStep
          {...flow.picks.belegung_buchungen.select}
          {...flow.pick('belegung_buchungen')}
          avatar="none"
          searchPlaceholder={tx('Buchung suchen …')}
        />
      </WizardStep>
      <WizardStep label={tx('Status')} heading={tx('Abschließen oder stornieren')} description={tx('Setze den neuen Status der Buchung.')}>
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
            whatHappensNext={tx('Der Status der Buchung wird geändert. Ein stornierter Platz ist danach wieder frei.')}
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
