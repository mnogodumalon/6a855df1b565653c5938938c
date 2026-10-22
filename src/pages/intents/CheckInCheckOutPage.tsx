/**
 * Check-in und Check-out — 3-Schritt-Wizard.
 * Steps: 1) Buchung wählen → 2) Check-in oder Check-out wählen → 3) Prüfen & Status speichern.
 * Reads: belegung_buchungen (Hund, Platz, Zeitraum, Status). Writes: belegung_buchungen.status (Update, via useCheckInCheckOutFlow).
 * Composes: IntentWizardShell, EntitySelectStep, Field, ChoiceGroup, StepNav, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { ChoiceGroup } from '@/components/blocks/ChoiceGroup';
import { Field } from '@/components/blocks/Field';
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
        const platz = fieldLookup(b, 'platznummer')?.label;
        const von = shortDate(fieldDate(b, 'anreisedatum'));
        const bis = shortDate(fieldDate(b, 'abreisedatum'));
        return {
          id: b.id,
          title: ctx.ref('hund') ?? tx('Ohne Hund'),
          subtitle: platz ? `${platz} · ${von} – ${bis}` : `${von} – ${bis}`,
          status: fieldLookup(b, 'status') ?? undefined,
        };
      },
    },
  });
  const f = flow.forms.belegung_buchungen;

  return (
    <IntentWizardShell
      title={tx('Check-in und Check-out')}
      currentStep={step}
      onStepChange={setStep}
      forms={flow.formList}
      draftKey={flow.draftKey}
      intro={{
        description: tx('Eine Buchung wählen und den Aufenthalt starten oder beenden.'),
        needs: [tx('Die Buchung des Hundes')],
      }}
    >
      <WizardStep label={tx('Buchung')} description={tx('Welche Buchung soll eingecheckt oder ausgecheckt werden?')}>
        <EntitySelectStep
          {...flow.picks.belegung_buchungen.select}
          {...flow.pick('belegung_buchungen')}
          searchPlaceholder={tx('Buchung suchen …')}
          avatar="none"
        />
      </WizardStep>
      <WizardStep
        label={tx('Check-in / Check-out')}
        description={tx('Aktiv setzt den Check-in, Abgeschlossen den Check-out.')}
        needs={['belegung_buchungen']}
      >
        <div className="space-y-4">
          <Field form={f} name="status">
            <ChoiceGroup
              {...f.choice('status')}
              options={f.choice('status').options.filter(o => o.key !== 'storniert')}
            />
          </Field>
          <StepNav
            onBack={() => setStep(1)}
            onNext={() => f.validate(['status'])}
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
            { label: tx('Aufenthaltsporträt erstellen'), href: '#/intents/aufenthaltsportraet-erstellen' },
            { label: tx('Neue Buchung'), href: '#/intents/neue-buchung' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
        />
      )}
    </IntentWizardShell>
  );
}
