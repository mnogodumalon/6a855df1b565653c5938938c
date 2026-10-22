/**
 * Buchungsanfrage ablehnen — 2-Schritt-Wizard.
 * Steps: 1) Neue Anfrage wählen → 2) Ablehnen bestätigen (Prüfen).
 * Reads: buchungsanfragen. Writes: buchungsanfragen (update, via useAnfrageAblehnenFlow).
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
        title: `${fieldText(r, 'interessent_nachname')} · ${fieldText(r, 'hund_name')}`,
        subtitle: `${shortDate(fieldDate(r, 'wunsch_anreise'))} – ${shortDate(fieldDate(r, 'wunsch_abreise'))}`,
      }),
    },
  });

  return (
    <IntentWizardShell
      title={tx('Buchungsanfrage ablehnen')}
      currentStep={step}
      onStepChange={setStep}
      forms={flow.formList}
      draftKey={flow.draftKey}
      intro={{
        description: tx('Eine neue Anfrage ablehnen, wenn kein Platz frei ist.'),
        needs: [tx('Die Anfrage, die du ablehnen möchtest')],
      }}
    >
      <WizardStep label={tx('Anfrage')} description={tx('Wähle die Anfrage, für die kein Platz frei ist.')}>
        <EntitySelectStep
          {...flow.picks.buchungsanfragen.select}
          {...flow.pick('buchungsanfragen')}
          avatar="initials"
          searchPlaceholder={tx('Nachname oder Hund suchen …')}
        />
      </WizardStep>
      <WizardStep label={tx('Prüfen')} description={tx('Stimmt die Anfrage? Dann lehne sie jetzt ab.')}>
        {!flow.submit.done && (
          <SummaryStep
            forms={flow.formList}
            submit={flow.submit}
            items={[{ key: 'anfrage_status', label: tx('Neuer Status'), value: tx('Abgelehnt') }]}
            confirmLabel={tx('Anfrage ablehnen')}
            whatHappensNext={tx('Die Anfrage wird als abgelehnt markiert. Es wird keine Buchung angelegt.')}
          />
        )}
      </WizardStep>
      {flow.submit.result && (
        <SuccessStep
          result={flow.submit.result}
          forms={flow.formList}
          submit={flow.submit}
          title={tx('Anfrage abgelehnt')}
          restartLabel={tx('Weitere Anfrage ablehnen')}
          next={[
            { label: tx('Weitere Anfrage ablehnen'), onClick: () => { flow.reset(); setStep(1); } },
            { label: tx('Buchungsanfrage bestätigen'), href: '#/intents/anfrage-bearbeiten' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
        />
      )}
    </IntentWizardShell>
  );
}
