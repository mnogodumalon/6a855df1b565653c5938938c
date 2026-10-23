/**
 * Pfoten-Porträt erstellen — 5-Schritt-Wizard.
 * Steps: 1) Hund wählen → 2) Titel, Widmung, Charakter → 3) Lieblingsaktivität & besondere Momente → 4) Foto → 5) Prüfen & anlegen.
 * Reads: hundekartei. Writes: pfoten_portraet (Besitzer und Erstellungsdatum setzt der Plan selbst).
 * Composes: IntentWizardShell, EntitySelectStep, Bound, StepNav, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { format } from 'date-fns';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Bound } from '@/components/blocks/Bound';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { fieldText } from '@/lib/journey';
import { usePortraetErstellenFlow } from '@/lib/journey/flows/PortraetErstellen';
import { tx } from '@/i18n';

export default function PortraetErstellenPage() {
  const [step, setStep] = useState(1);
  const flow = usePortraetErstellenFlow({
    steps: { hund: 1, titel: 2, widmung: 2, charakterbeschreibung: 2, lieblingsaktivitaet: 3, besondere_momente: 3, portraet_foto: 4 },
    items: {
      hund: r => ({ id: r.id, title: fieldText(r, 'name'), subtitle: fieldText(r, 'rasse') }),
    },
  });
  const form = flow.forms.pfoten_portraet;

  return (
    <IntentWizardShell
      title={tx('Pfoten-Porträt erstellen')}
      currentStep={step}
      onStepChange={setStep}
      forms={flow.formList}
      draftKey={flow.draftKey}
      intro={{
        description: tx('Halte den Aufenthalt eines Gastes als persönliches Porträt fest.'),
        needs: [tx('Name des Hundes'), tx('Ein paar Worte zum Charakter'), tx('Ein Foto (optional)')],
      }}
    >
      <WizardStep label={tx('Hund')} heading={tx('Hund auswählen')} description={tx('Für welchen Gast entsteht das Porträt?')}>
        <EntitySelectStep
          {...flow.picks.hund.select}
          {...flow.pick('hund')}
          searchPlaceholder={tx('Name oder Rasse …')}
        />
      </WizardStep>

      <WizardStep label={tx('Charakter')} needs={['hund']} description={tx('Gib dem Porträt einen Titel und ein paar persönliche Worte.')}>
        <div className="space-y-4">
          <Bound form={form} name="titel" />
          <Bound form={form} name="widmung" rows={3} />
          <Bound form={form} name="charakterbeschreibung" rows={4} />
          <StepNav
            onBack={() => setStep(1)}
            onNext={() => flow.validateStep(2)}
            nextStepLabel={tx('Momente')}
          />
        </div>
      </WizardStep>

      <WizardStep label={tx('Momente')} needs={['hund']} description={tx('Was liebt der Hund am meisten, und was war besonders?')}>
        <div className="space-y-4">
          <Bound form={form} name="lieblingsaktivitaet" />
          <Bound form={form} name="besondere_momente" rows={4} />
          <StepNav
            onBack={() => setStep(2)}
            onNext={() => flow.validateStep(3)}
            nextStepLabel={tx('Foto')}
          />
        </div>
      </WizardStep>

      <WizardStep label={tx('Foto')} needs={['hund']} description={tx('Lade ein schönes Foto für das Porträt hoch.')}>
        <div className="space-y-4">
          <Bound form={form} name="portraet_foto" />
          <StepNav
            onBack={() => setStep(3)}
            onNext={() => flow.validateStep(4)}
            nextStepLabel={tx('Prüfen')}
          />
        </div>
      </WizardStep>

      <WizardStep label={tx('Prüfen')}>
        {!flow.submit.done && (
          <SummaryStep
            forms={flow.formList}
            submit={flow.submit}
            items={[{ key: 'erstellungsdatum', label: tx('Erstellt am'), value: format(new Date(), 'dd.MM.yyyy') }]}
            whatHappensNext={tx('Das Porträt wird gespeichert und dem Besitzer des Hundes zugeordnet.')}
          />
        )}
      </WizardStep>

      {flow.submit.result && (
        <SuccessStep
          result={flow.submit.result}
          forms={flow.formList}
          submit={flow.submit}
          next={[
            { label: tx('Weiteres Porträt'), onClick: () => flow.reset() },
            { label: tx('Aufenthalt buchen'), href: '#/intents/aufenthalt-buchen' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
        />
      )}
    </IntentWizardShell>
  );
}
