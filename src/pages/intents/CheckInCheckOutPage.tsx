/**
 * Check-in und Check-out — 3-Schritt-Wizard.
 * Steps: 1) Buchung wählen → 2) Neuen Status wählen → 3) Prüfen & speichern.
 * Reads: belegung_buchungen (Hund über ctx.ref). Writes: belegung_buchungen (nur status, update).
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
import { useCheckInCheckOutFlow } from '@/lib/journey/flows/CheckInCheckOut';
import { tx } from '@/i18n';

function shortDate(iso: string | null): string {
  return iso ? format(parseISO(iso), 'dd.MM.yyyy') : '?';
}

export default function CheckInCheckOutPage() {
  const [step, setStep] = useState(1);
  const flow = useCheckInCheckOutFlow({
    steps: { belegung_buchungen: 1, status: 2 },
    items: {
      belegung_buchungen: (b, ctx) => {
        const von = shortDate(fieldDate(b, 'anreisedatum'));
        const bis = shortDate(fieldDate(b, 'abreisedatum'));
        const platz = fieldLookup(b, 'platznummer')?.label;
        return {
          id: b.id,
          title: ctx.ref('hund') ?? tx('Hund ohne Namen'),
          subtitle: platz ? `${von} – ${bis} · ${platz}` : `${von} – ${bis}`,
          status: fieldLookup(b, 'status') ?? undefined,
        };
      },
    },
  });

  return (
    <IntentWizardShell
      title={tx('Check-in und Check-out')}
      currentStep={step}
      onStepChange={setStep}
      forms={flow.formList}
      draftKey={flow.draftKey}
      intro={{ description: tx('Eine Buchung wählen und ihren Status setzen.'), needs: [tx('Name des Hundes oder Zeitraum der Buchung')] }}
    >
      <WizardStep label={tx('Buchung')} description={tx('Welche Buchung soll sich ändern?')}>
        <EntitySelectStep
          {...flow.picks.belegung_buchungen.select}
          {...flow.pick('belegung_buchungen')}
          avatar="none"
          searchPlaceholder={tx('Hund oder Notiz suchen …')}
        />
      </WizardStep>
      <WizardStep label={tx('Status')} description={tx('Aktiv, abgeschlossen oder storniert — was gilt jetzt?')} needs={['belegung_buchungen']}>
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
            whatHappensNext={tx('Der neue Status erscheint sofort in der Belegung.')}
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
            { label: tx('Neue Buchung'), href: '#/intents/neue-buchung' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
        />
      )}
    </IntentWizardShell>
  );
}
