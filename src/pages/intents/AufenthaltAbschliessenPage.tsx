/**
 * Aufenthalt abschließen — 3-Schritt-Wizard.
 * Steps: 1) Aktive Buchung wählen → 2) Abschließen oder stornieren → 3) Prüfen & speichern.
 * Reads: belegung_buchungen (nur Status aktiv; Hund über ctx.ref). Writes: belegung_buchungen (status, update).
 * Follow-up on success: Pfoten-Porträt anlegen (portraet-erstellen).
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
  if (!iso) return '?';
  try {
    return format(parseISO(iso), 'dd.MM.yyyy');
  } catch {
    return iso;
  }
}

export default function AufenthaltAbschliessenPage() {
  const [step, setStep] = useState(1);
  const flow = useAufenthaltAbschliessenFlow({
    steps: { belegung_buchungen: 1, status: 2 },
    items: {
      belegung_buchungen: (b, ctx) => {
        const platz = fieldLookup(b, 'platznummer')?.label ?? '';
        const von = shortDate(fieldDate(b, 'anreisedatum'));
        const bis = shortDate(fieldDate(b, 'abreisedatum'));
        return {
          id: b.id,
          title: ctx.ref('hund') ?? tx('Ohne Hund'),
          subtitle: tx`${platz} · ${von} – ${bis}`,
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
      intro={{ description: tx('Eine aktive Buchung bei Abreise abschließen oder stornieren.'), needs: [tx('Die aktive Buchung des Hundes')] }}
    >
      <WizardStep label={tx('Buchung')} description={tx('Welche aktive Buchung soll beendet werden?')}>
        <EntitySelectStep
          {...flow.picks.belegung_buchungen.select}
          {...flow.pick('belegung_buchungen')}
          searchPlaceholder={tx('Hund suchen …')}
          emptyText={tx('Keine aktive Buchung vorhanden.')}
        />
      </WizardStep>
      <WizardStep label={tx('Ergebnis')} description={tx('Aufenthalt abschließen oder stornieren — der Platz wird danach wieder frei.')}>
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
            whatHappensNext={tx('Der Status der Buchung wird geändert und der Platz ist wieder frei.')}
          />
        )}
      </WizardStep>
      {flow.submit.result && (
        <SuccessStep
          result={flow.submit.result}
          forms={flow.formList}
          submit={flow.submit}
          actions={{ copy: false, print: false }}
          whatHappensNext={tx('Du kannst jetzt ein Pfoten-Porträt als Erinnerung anlegen.')}
          next={[
            { label: tx('Pfoten-Porträt erstellen'), href: '#/intents/portraet-erstellen' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
        />
      )}
    </IntentWizardShell>
  );
}
