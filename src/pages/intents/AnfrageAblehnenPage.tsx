/**
 * Anfrage ablehnen — 2-Schritt-Wizard.
 * Steps: 1) Offene Anfrage wählen → 2) Ablehnen und speichern.
 * Reads: buchungsanfragen. Writes: buchungsanfragen (anfrage_status = abgelehnt, update).
 * Composes: IntentWizardShell, EntitySelectStep, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { fieldText, fieldDate } from '@/lib/journey';
import { useAnfrageAblehnenFlow } from '@/lib/journey/flows/AnfrageAblehnen';
import { tx } from '@/i18n';

function day(iso: string | null): string {
  return iso ? format(parseISO(iso), 'dd.MM.yyyy') : '?';
}

export default function AnfrageAblehnenPage() {
  const [step, setStep] = useState(1);
  const flow = useAnfrageAblehnenFlow({
    steps: { buchungsanfragen: 1 },
    items: {
      buchungsanfragen: r => ({
        id: r.id,
        title: tx`${fieldText(r, 'interessent_nachname')} — ${fieldText(r, 'hund_name')}`,
        subtitle: tx`${day(fieldDate(r, 'wunsch_anreise'))} bis ${day(fieldDate(r, 'wunsch_abreise'))}`,
      }),
    },
  });

  return (
    <IntentWizardShell
      title={tx('Anfrage ablehnen')}
      currentStep={step}
      onStepChange={setStep}
      forms={flow.formList}
      draftKey={flow.draftKey}
      intro={{
        description: tx('Eine offene Buchungsanfrage ablehnen.'),
        needs: [tx('Name oder Hundename der Anfrage')],
      }}
    >
      <WizardStep label={tx('Anfrage')} description={tx('Welche offene Anfrage möchtest du ablehnen?')}>
        <EntitySelectStep
          {...flow.picks.buchungsanfragen.select}
          {...flow.pick('buchungsanfragen')}
          searchPlaceholder={tx('Name oder Hundename …')}
          emptyText={tx('Es gibt keine offene Anfrage.')}
        />
      </WizardStep>
      <WizardStep label={tx('Prüfen')} description={tx('Kontrolliere die Anfrage und lehne sie ab.')}>
        {!flow.submit.done && (
          <SummaryStep
            forms={flow.formList}
            submit={flow.submit}
            items={[{ key: 'anfrage_status', label: tx('Neuer Status'), value: tx('Abgelehnt') }]}
            confirmLabel={tx('Anfrage ablehnen')}
            whatHappensNext={tx('Die Anfrage wird als abgelehnt markiert und erscheint nicht mehr unter den offenen Anfragen.')}
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
            { label: tx('Weitere Anfrage ablehnen') , onClick: () => flow.reset() },
            { label: tx('Anfrage bestätigen'), href: '#/intents/anfrage-bestaetigen' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
        />
      )}
    </IntentWizardShell>
  );
}
