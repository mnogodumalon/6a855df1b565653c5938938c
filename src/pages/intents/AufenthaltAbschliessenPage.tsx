/**
 * Aufenthalt abschließen — 2-Schritt-Wizard.
 * Steps: 1) Aktive Buchung wählen → 2) Prüfen & abschließen.
 * Reads: belegung_buchungen (nur aktive), hundekartei (Name über ctx.ref). Writes: belegung_buchungen (status → abgeschlossen).
 * Composes: IntentWizardShell, EntitySelectStep, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { fieldDate, fieldLookup } from '@/lib/journey';
import { useAufenthaltAbschliessenFlow } from '@/lib/journey/flows/AufenthaltAbschliessen';
import { tx } from '@/i18n';

function day(iso: string | null): string {
  return iso ? format(parseISO(iso), 'dd.MM.yyyy') : '?';
}

export default function AufenthaltAbschliessenPage() {
  const [step, setStep] = useState(1);
  const flow = useAufenthaltAbschliessenFlow({
    steps: { belegung_buchungen: 1 },
    items: {
      belegung_buchungen: (r, ctx) => {
        const platz = fieldLookup(r, 'platznummer')?.label;
        const status = fieldLookup(r, 'status');
        return {
          id: r.id,
          title: ctx.ref('hund') ?? tx('Hund ohne Namen'),
          subtitle: tx`${day(fieldDate(r, 'anreisedatum'))} – ${day(fieldDate(r, 'abreisedatum'))}${platz ? ` · ${platz}` : ''}`,
          status: status ?? undefined,
        };
      },
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
        description: tx('Eine aktive Buchung nach der Abreise als abgeschlossen markieren.'),
        needs: [tx('Die aktive Buchung des Hundes')],
      }}
    >
      <WizardStep label={tx('Buchung')} description={tx('Welche aktive Buchung ist beendet?')}>
        <EntitySelectStep
          {...flow.picks.belegung_buchungen.select}
          {...flow.pick('belegung_buchungen')}
          searchPlaceholder={tx('Hund suchen …')}
          emptyText={tx('Es gibt keine aktive Buchung, die abgeschlossen werden könnte.')}
        />
      </WizardStep>
      <WizardStep label={tx('Prüfen')} description={tx('Stimmt alles? Der Status wird auf „abgeschlossen“ gesetzt.')}>
        {!flow.submit.done && (
          <SummaryStep
            forms={flow.formList}
            submit={flow.submit}
            whatHappensNext={tx('Die Buchung wird als abgeschlossen markiert und der Platz ist wieder frei.')}
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
          whatHappensNext={tx('Zur Erinnerung kannst du dem Hund jetzt ein Pfoten-Porträt widmen.')}
        />
      )}
    </IntentWizardShell>
  );
}
