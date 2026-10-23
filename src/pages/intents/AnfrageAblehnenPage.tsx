/**
 * Anfrage ablehnen — 2-Schritt-Wizard.
 * Steps: 1) Neue Anfrage wählen → 2) Daten prüfen & als abgelehnt markieren.
 * Reads: buchungsanfragen. Writes: buchungsanfragen (anfrage_status = abgelehnt, Update).
 * Composes: IntentWizardShell, EntitySelectStep, StepNav, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { fieldText, fieldDate } from '@/lib/journey';
import { useAnfrageAblehnenFlow } from '@/lib/journey/flows/AnfrageAblehnen';
import { tx } from '@/i18n';

export default function AnfrageAblehnenPage() {
  const [step, setStep] = useState(1);
  const flow = useAnfrageAblehnenFlow({
    steps: { buchungsanfragen: 1 },
    items: {
      buchungsanfragen: r => ({
        id: r.id,
        title: `${fieldText(r, 'interessent_vorname')} ${fieldText(r, 'interessent_nachname')}`.trim(),
        subtitle: tx`${fieldText(r, 'hund_name')} · ${fieldDate(r, 'wunsch_anreise') ?? '?'} – ${fieldDate(r, 'wunsch_abreise') ?? '?'}`,
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
        description: tx('Eine neue Buchungsanfrage ansehen und als abgelehnt markieren.'),
        needs: [tx('Eine Anfrage mit Status „neu“')],
      }}
    >
      <WizardStep label={tx('Anfrage')} description={tx('Welche neue Anfrage möchtest du ablehnen?')}>
        <EntitySelectStep
          {...flow.picks.buchungsanfragen.select}
          {...flow.pick('buchungsanfragen')}
          searchPlaceholder={tx('Nachname oder Hundename …')}
          emptyText={tx('Es gibt keine neue Anfrage, die abgelehnt werden könnte.')}
        />
      </WizardStep>
      <WizardStep label={tx('Prüfen')} description={tx('Daten ansehen und die Ablehnung bestätigen.')} needs={['buchungsanfragen']}>
        {!flow.submit.done && (
          <SummaryStep
            forms={flow.formList}
            submit={flow.submit}
            items={[{ key: 'anfrage_status', label: tx('Neuer Status'), value: tx('Abgelehnt') }]}
            whatHappensNext={tx('Die Anfrage wird als abgelehnt markiert und erscheint nicht mehr unter den neuen Anfragen.')}
          />
        )}
        {!flow.submit.done && <StepNav onBack={() => setStep(1)} hideBack={false} />}
      </WizardStep>
      {flow.submit.result && (
        <SuccessStep
          result={flow.submit.result}
          forms={flow.formList}
          submit={flow.submit}
          actions={{ copy: false, print: false }}
          whatHappensNext={tx('Die Anfrage ist abgelehnt. Weitere offene Anfragen kannst du direkt anschließend bearbeiten.')}
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
