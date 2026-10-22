/**
 * Buchungsanfrage bearbeiten — 3-Schritt-Wizard.
 * Steps: 1) Offene Anfrage wählen → 2) Annehmen oder ablehnen → 3) Status speichern (Prüfen).
 * Reads: buchungsanfragen. Writes: buchungsanfragen (update von anfrage_status, über den Flow-Hook).
 * Composes: IntentWizardShell, EntitySelectStep, Field, ChoiceGroup, StepNav, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { ChoiceGroup } from '@/components/blocks/ChoiceGroup';
import { Field } from '@/components/blocks/Field';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { fieldText, fieldDate, formatRange } from '@/lib/journey';
import { useBuchungsanfrageBearbeitenFlow } from '@/lib/journey/flows/BuchungsanfrageBearbeiten';
import { tx } from '@/i18n';

export default function BuchungsanfrageBearbeitenPage() {
  const [step, setStep] = useState(1);
  const flow = useBuchungsanfrageBearbeitenFlow({
    steps: { buchungsanfragen: 1, anfrage_status: 2 },
    items: {
      buchungsanfragen: r => ({
        id: r.id,
        title: `${fieldText(r, 'interessent_vorname')} ${fieldText(r, 'interessent_nachname')}`.trim(),
        subtitle: `${fieldText(r, 'hund_name')} · ${formatRange(fieldDate(r, 'wunsch_anreise'), fieldDate(r, 'wunsch_abreise'), 'none')}`,
      }),
    },
  });
  const f = flow.forms.buchungsanfragen;

  const decisionOptions = f
    .choice('anfrage_status')
    .options.filter(o => o.key === 'bestaetigt' || o.key === 'abgelehnt');

  const decide = () => {
    const current = f.get('anfrage_status');
    if (current !== 'bestaetigt' && current !== 'abgelehnt') {
      return tx('Bitte wähle, ob du die Anfrage annimmst oder ablehnst.');
    }
    return flow.validateStep(2);
  };

  return (
    <IntentWizardShell
      title={tx('Buchungsanfrage bearbeiten')}
      currentStep={step}
      onStepChange={setStep}
      forms={flow.formList}
      draftKey={flow.draftKey}
      intro={{
        description: tx('Eine offene Anfrage annehmen oder ablehnen.'),
        needs: [tx('Eine offene Buchungsanfrage')],
      }}
    >
      <WizardStep label={tx('Anfrage')} description={tx('Welche offene Anfrage möchtest du bearbeiten?')}>
        <EntitySelectStep
          {...flow.picks.buchungsanfragen.select}
          {...flow.pick('buchungsanfragen')}
          avatar="initials"
          searchPlaceholder={tx('Name oder Hund suchen …')}
          emptyText={tx('Aktuell gibt es keine offenen Anfragen.')}
        />
      </WizardStep>
      <WizardStep
        label={tx('Entscheidung')}
        description={tx('Annehmen oder ablehnen?')}
        needs={['buchungsanfragen']}
      >
        <div className="space-y-4">
          <Field form={f} name="anfrage_status">
            <ChoiceGroup {...f.choice('anfrage_status')} options={decisionOptions} />
          </Field>
          <StepNav
            onBack={() => setStep(1)}
            onNext={decide}
            nextStepLabel={tx('Prüfen')}
          />
        </div>
      </WizardStep>
      <WizardStep label={tx('Prüfen')} description={tx('Status speichern')}>
        {!flow.submit.done && (
          <SummaryStep
            forms={flow.formList}
            submit={flow.submit}
            whatHappensNext={tx('Der Status der Anfrage wird sofort aktualisiert.')}
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
            { label: tx('Neue Buchung anlegen'), href: '#/intents/neue-buchung' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
        />
      )}
    </IntentWizardShell>
  );
}
