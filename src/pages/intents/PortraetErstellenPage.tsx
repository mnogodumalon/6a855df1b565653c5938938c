/**
 * Pfoten-Porträt erstellen — 5-Schritt-Wizard.
 * Steps: 1) Hund wählen → 2) Titel, Widmung, Charakter → 3) Lieblingsaktivität & besondere Momente → 4) Foto → 5) Prüfen & speichern.
 * Reads: hundekartei. Writes: pfoten_portraet (besitzer und Erstellungsdatum setzt der Flow selbst).
 * Composes: IntentWizardShell, EntitySelectStep, Bound, StepNav, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Bound } from '@/components/blocks/Bound';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { fieldText, todayIso } from '@/lib/journey';
import { usePortraetErstellenFlow } from '@/lib/journey/flows/PortraetErstellen';
import { tx } from '@/i18n';

export default function PortraetErstellenPage() {
  const [step, setStep] = useState(1);
  const flow = usePortraetErstellenFlow({
    steps: {
      hund: 1,
      titel: 2, widmung: 2, charakterbeschreibung: 2,
      lieblingsaktivitaet: 3, besondere_momente: 3,
      portraet_foto: 4,
    },
    items: {
      hund: r => ({ id: r.id, title: fieldText(r, 'name'), subtitle: fieldText(r, 'rasse') }),
    },
  });
  const f = flow.forms.pfoten_portraet;

  return (
    <IntentWizardShell
      title={tx('Pfoten-Porträt erstellen')}
      currentStep={step}
      onStepChange={setStep}
      forms={flow.formList}
      draftKey={flow.draftKey}
      intro={{
        description: tx('Ein Aufenthaltsporträt mit Foto und kleinen Geschichten für einen Gast anlegen.'),
        needs: [tx('Name des Hundes'), tx('Ein Titel für das Porträt'), tx('Ein Foto (optional)')],
      }}
    >
      <WizardStep label={tx('Hund')} description={tx('Für welchen Gast soll das Porträt entstehen?')}>
        <EntitySelectStep
          {...flow.picks.hund.select}
          {...flow.pick('hund')}
          searchPlaceholder={tx('Name oder Rasse …')}
        />
      </WizardStep>

      <WizardStep label={tx('Charakter')} description={tx('Gib dem Porträt einen Titel, eine Widmung und beschreibe den Charakter.')} needs={['hund']}>
        <div className="space-y-4">
          <Bound form={f} name="titel" placeholder={tx('z. B. Der Strandläufer')} />
          <Bound form={f} name="widmung" rows={3} />
          <Bound form={f} name="charakterbeschreibung" rows={4} />
          <StepNav onBack={() => setStep(1)} onNext={() => flow.validateStep(2)} nextStepLabel={tx('Geschichten')} />
        </div>
      </WizardStep>

      <WizardStep label={tx('Geschichten')} description={tx('Was liebt der Hund am meisten, und was ist beim Aufenthalt passiert?')} needs={['hund']}>
        <div className="space-y-4">
          <Bound form={f} name="lieblingsaktivitaet" />
          <Bound form={f} name="besondere_momente" rows={5} />
          <StepNav onBack={() => setStep(2)} onNext={() => flow.validateStep(3)} nextStepLabel={tx('Foto')} />
        </div>
      </WizardStep>

      <WizardStep label={tx('Foto')} description={tx('Lade ein schönes Foto für das Porträt hoch.')} needs={['hund']}>
        <div className="space-y-4">
          <Bound form={f} name="portraet_foto" />
          <StepNav onBack={() => setStep(3)} onNext={() => flow.validateStep(4)} nextStepLabel={tx('Prüfen')} />
        </div>
      </WizardStep>

      <WizardStep label={tx('Prüfen')}>
        {!flow.submit.done && (
          <SummaryStep
            forms={flow.formList}
            submit={flow.submit}
            items={[{ key: 'erstellungsdatum', label: tx('Erstellt am'), value: todayIso() }]}
            whatHappensNext={tx('Das Porträt wird gespeichert und dem Besitzer des Hundes zugeordnet.')}
          />
        )}
      </WizardStep>

      {flow.submit.result && (
        <SuccessStep
          result={flow.submit.result}
          forms={flow.formList}
          submit={flow.submit}
          whatHappensNext={tx('Das Porträt ist jetzt in der Porträt-Sammlung zu finden.')}
          next={[
            { label: tx('Aufenthalt buchen'), href: '#/intents/aufenthalt-buchen' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
        />
      )}
    </IntentWizardShell>
  );
}
