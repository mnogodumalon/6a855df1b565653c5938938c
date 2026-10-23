/**
 * Anfrage ablehnen — 2-Schritt-Wizard.
 * Steps: 1) Neue Anfrage wählen → 2) Ablehnen und speichern (Prüfen).
 * Reads: buchungsanfragen. Writes: buchungsanfragen (anfrage_status = abgelehnt, via useAnfrageAblehnenFlow).
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
        title: `${fieldText(r, 'interessent_nachname')} — ${fieldText(r, 'hund_name')}`,
        subtitle: `${shortDate(fieldDate(r, 'wunsch_anreise'))} – ${shortDate(fieldDate(r, 'wunsch_abreise'))}`,
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
        description: tx('Eine Buchungsanfrage ablehnen, z. B. weil kein Platz frei ist.'),
        needs: [tx('Die Anfrage, die du ablehnen möchtest')],
      }}
    >
      <WizardStep label={tx('Anfrage wählen')} description={tx('Welche Anfrage kannst du leider nicht annehmen?')}>
        <EntitySelectStep
          {...flow.picks.buchungsanfragen.select}
          {...flow.pick('buchungsanfragen')}
          searchPlaceholder={tx('Nachname oder Hund suchen …')}
          emptyText={tx('Keine offene Anfrage vorhanden.')}
        />
      </WizardStep>
      <WizardStep label={tx('Ablehnen und speichern')} description={tx('Prüfe die Anfrage und lehne sie ab.')}>
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
          next={[
            { label: tx('Weitere Anfrage ablehnen'), onClick: () => { flow.reset(); setStep(1); } },
            { label: tx('Anfrage bestätigen'), href: '#/intents/anfrage-bestaetigen' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
        />
      )}
    </IntentWizardShell>
  );
}
