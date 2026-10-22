/**
 * Anfrage ablehnen — 2-Schritt-Wizard.
 * Steps: 1) Neue Anfrage auswählen → 2) Ablehnen (Prüfen & bestätigen).
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
  if (!iso) return '?';
  try {
    return format(parseISO(iso), 'dd.MM.yyyy');
  } catch {
    return iso;
  }
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
        description: tx('Eine neue Buchungsanfrage ablehnen, zum Beispiel weil nichts frei ist.'),
        needs: [tx('Die Anfrage, die du ablehnen möchtest')],
      }}
    >
      <WizardStep label={tx('Anfrage wählen')} description={tx('Welche neue Anfrage möchtest du ablehnen?')}>
        <EntitySelectStep
          {...flow.picks.buchungsanfragen.select}
          {...flow.pick('buchungsanfragen')}
          searchPlaceholder={tx('Nachname oder Hundename …')}
          emptyText={tx('Keine neue Anfrage gefunden.')}
        />
      </WizardStep>
      <WizardStep label={tx('Ablehnen')} description={tx('Prüfe die Anfrage und lehne sie ab.')}>
        {!flow.submit.done && (
          <SummaryStep
            forms={flow.formList}
            submit={flow.submit}
            confirmLabel={tx('Anfrage ablehnen')}
            items={[{ key: 'anfrage_status', label: tx('Neuer Status'), value: tx('Abgelehnt') }]}
            whatHappensNext={tx('Die Anfrage wird als abgelehnt markiert und verschwindet aus den neuen Anfragen.')}
          />
        )}
      </WizardStep>
      {flow.submit.result && (
        <SuccessStep
          result={flow.submit.result}
          forms={flow.formList}
          submit={flow.submit}
          title={tx('Anfrage abgelehnt')}
          actions={{ copy: false, print: false }}
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
