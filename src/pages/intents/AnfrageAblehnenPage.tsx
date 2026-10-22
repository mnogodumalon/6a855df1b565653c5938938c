/**
 * Anfrage ablehnen — 2-Schritt-Wizard.
 * Steps: 1) Neue Anfrage wählen → 2) Ablehnen und speichern.
 * Reads: buchungsanfragen (nur Status „neu"). Writes: buchungsanfragen (anfrage_status = abgelehnt, über den Flow-Hook).
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

function shortDate(iso: string | null): string {
  return iso ? format(parseISO(iso), 'dd.MM.yyyy') : '?';
}

export default function AnfrageAblehnenPage() {
  const [step, setStep] = useState(1);
  const flow = useAnfrageAblehnenFlow({
    steps: { buchungsanfragen: 1 },
    items: {
      buchungsanfragen: r => ({
        id: r.id,
        title: fieldText(r, 'interessent_nachname'),
        subtitle: tx`${fieldText(r, 'hund_name')} · ${shortDate(fieldDate(r, 'wunsch_anreise'))} – ${shortDate(fieldDate(r, 'wunsch_abreise'))}`,
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
        description: tx('Eine neue Buchungsanfrage ablehnen.'),
        needs: [tx('Name oder Hund der Anfrage')],
      }}
    >
      <WizardStep label={tx('Anfrage')} description={tx('Wähle die neue Anfrage, die du ablehnen möchtest.')}>
        <EntitySelectStep
          {...flow.picks.buchungsanfragen.select}
          {...flow.pick('buchungsanfragen')}
          searchPlaceholder={tx('Nachname, Vorname oder Hund …')}
          emptyText={tx('Es gibt keine neuen Anfragen mehr.')}
        />
      </WizardStep>
      <WizardStep label={tx('Prüfen')} description={tx('Prüfe die Anfrage und lehne sie ab.')}>
        {!flow.submit.done && (
          <SummaryStep
            forms={flow.formList}
            submit={flow.submit}
            confirmLabel={tx('Ablehnen und speichern')}
            items={[{ key: 'anfrage_status', label: tx('Neuer Status'), value: tx('Abgelehnt') }]}
            whatHappensNext={tx('Die Anfrage wird als abgelehnt markiert und erscheint nicht mehr unter den neuen Anfragen.')}
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
            { label: tx('Weitere Anfrage ablehnen') },
            { label: tx('Anfrage bestätigen'), href: '#/intents/anfrage-bestaetigen' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
        />
      )}
    </IntentWizardShell>
  );
}
