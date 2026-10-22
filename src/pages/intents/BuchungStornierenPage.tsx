/**
 * Buchung stornieren — 2-Schritt-Wizard.
 * Steps: 1) Aktive Buchung wählen → 2) Stornierung bestätigen (Prüfen & stornieren).
 * Reads: belegung_buchungen (nur aktive), hundekartei (Name des Hundes). Writes: belegung_buchungen.status = storniert.
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

function shortDate(iso: string | null): string {
  return iso ? format(parseISO(iso), 'dd.MM.yyyy') : '?';
}

export default function BuchungStornierenPage() {
  const [step, setStep] = useState(1);
  const flow = useBuchungStornierenFlow({
    steps: { belegung_buchungen: 1 },
    items: {
      belegung_buchungen: (b, ctx) => {
        const platz = fieldLookup(b, 'platznummer')?.label;
        const zeitraum = `${shortDate(fieldDate(b, 'anreisedatum'))} – ${shortDate(fieldDate(b, 'abreisedatum'))}`;
        return {
          id: b.id,
          title: ctx.ref('hund') ?? tx('Hund ohne Namen'),
          subtitle: platz ? `${platz} · ${zeitraum}` : zeitraum,
        };
      },
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
        description: tx('Eine aktive Buchung stornieren, damit der Platz wieder frei wird.'),
        needs: [tx('Name des Hundes oder Zeitraum der Buchung')],
      }}
    >
      <WizardStep label={tx('Buchung')} heading={tx('Aktive Buchung wählen')} description={tx('Welche Buchung soll storniert werden? Nur aktive Buchungen werden angezeigt.')}>
        <EntitySelectStep
          {...flow.picks.belegung_buchungen.select}
          {...flow.pick('belegung_buchungen')}
          searchPlaceholder={tx('Buchung suchen …')}
          emptyText={tx('Es gibt keine aktive Buchung, die storniert werden könnte.')}
        />
      </WizardStep>
      <WizardStep label={tx('Prüfen')} heading={tx('Stornierung bestätigen')} description={tx('Prüfe die Buchung, bevor du sie stornierst.')}>
        {!flow.submit.done && (
          <SummaryStep
            forms={flow.formList}
            submit={flow.submit}
            confirmLabel={tx('Buchung stornieren')}
            items={[{ key: 'neuer_status', label: tx('Neuer Status'), value: tx('Storniert') }]}
            whatHappensNext={tx('Die Buchung wird als storniert markiert und der Platz wird wieder frei.')}
          />
        )}
      </WizardStep>
      {flow.submit.result && (
        <SuccessStep
          result={flow.submit.result}
          forms={flow.formList}
          submit={flow.submit}
          actions={{ copy: false, print: false }}
          whatHappensNext={tx('Der Platz steht ab sofort wieder für neue Buchungen zur Verfügung.')}
          next={[
            { label: tx('Aufenthalt buchen'), href: '#/intents/aufenthalt-buchen' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
        />
      )}
    </IntentWizardShell>
  );
}
