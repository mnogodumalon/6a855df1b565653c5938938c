/**
 * Buchung stornieren — 2-Schritt-Wizard.
 * Steps: 1) Aktive Buchung wählen → 2) Stornierung bestätigen (Prüfen & stornieren).
 * Reads: belegung_buchungen (hund, platznummer, anreisedatum, abreisedatum). Writes: belegung_buchungen.status = storniert
 * (via useBuchungStornierenFlow).
 * Composes: IntentWizardShell, EntitySelectStep, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { fieldDate, fieldLookup } from '@/lib/journey';
import { useBuchungStornierenFlow } from '@/lib/journey/flows/BuchungStornieren';
import { tx } from '@/i18n';

const day = (iso: string | null) => (iso ? format(parseISO(iso), 'dd.MM.yyyy') : '?');

export default function BuchungStornierenPage() {
  const [step, setStep] = useState(1);
  const flow = useBuchungStornierenFlow({
    steps: { belegung_buchungen: 1 },
    items: {
      belegung_buchungen: (r, ctx) => ({
        id: r.id,
        title: ctx.ref('hund') ?? tx('Ohne Hund'),
        subtitle: tx`${day(fieldDate(r, 'anreisedatum'))} – ${day(fieldDate(r, 'abreisedatum'))} · ${fieldLookup(r, 'platznummer')?.label ?? '—'}`,
      }),
    },
  });

  return (
    <IntentWizardShell
      title={tx('Buchung stornieren')}
      currentStep={step}
      onStepChange={setStep}
      forms={flow.formList}
      draftKey={flow.draftKey}
      intro={{
        description: tx('Eine aktive Buchung stornieren und den Platz wieder freigeben.'),
        needs: [tx('Name des Hundes oder Zeitraum der Buchung')],
      }}
    >
      <WizardStep label={tx('Buchung')} description={tx('Welche aktive Buchung soll storniert werden?')}>
        <EntitySelectStep
          {...flow.picks.belegung_buchungen.select}
          {...flow.pick('belegung_buchungen')}
          searchPlaceholder={tx('Buchung suchen …')}
          emptyText={tx('Es gibt keine aktive Buchung, die storniert werden könnte.')}
        />
      </WizardStep>
      <WizardStep label={tx('Prüfen')} description={tx('Stimmt die Buchung? Mit dem Bestätigen wird sie storniert.')}>
        {!flow.submit.done && (
          <SummaryStep
            forms={flow.formList}
            submit={flow.submit}
            items={[{ key: 'neuer-status', label: tx('Neuer Status'), value: tx('Storniert') }]}
            whatHappensNext={tx('Der Platz ist für diesen Zeitraum sofort wieder frei.')}
          />
        )}
      </WizardStep>
      {flow.submit.result && (
        <SuccessStep
          result={flow.submit.result}
          forms={flow.formList}
          submit={flow.submit}
          whatHappensNext={tx('Der Platz steht für neue Buchungen wieder zur Verfügung.')}
          next={[
            { label: tx('Aufenthalt buchen'), href: '#/intents/aufenthalt-buchen' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
        />
      )}
    </IntentWizardShell>
  );
}
