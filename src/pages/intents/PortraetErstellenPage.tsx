/**
 * Pfoten-Porträt erstellen — 4-Schritt-Wizard.
 * Steps: 1) Hund wählen → 2) Titel, Widmung, Charakter → 3) Lieblingsaktivität, Momente, Foto → 4) Prüfen & anlegen.
 * Reads: hundekartei (Pick, mit Besitzer als Untertitel). Writes: pfoten_portraet (Erstellungsdatum setzt der Flow selbst).
 * Composes: IntentWizardShell, EntitySelectStep, Bound, StepNav, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
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
    steps: {
      hund: 1,
      titel: 2, widmung: 2, charakterbeschreibung: 2,
      lieblingsaktivitaet: 3, besondere_momente: 3, portraet_foto: 3,
    },
    items: {
      hund: (h, ctx) => ({ id: h.id, title: fieldText(h, 'name'), subtitle: ctx.ref('besitzer') }),
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
        description: tx('Ein Porträt mit Foto, Widmung und kleinen Geschichten für einen Gast anlegen.'),
        needs: [tx('Name des Hundes'), tx('Ein Foto für das Porträt')],
      }}
    >
      <WizardStep label={tx('Hund')} description={tx('Für welchen Hund entsteht das Porträt? Der Besitzer wird übernommen.')}>
        <EntitySelectStep
          {...flow.picks.hund.select}
          {...flow.pick('hund')}
          searchPlaceholder={tx('Name oder Rasse …')}
        />
      </WizardStep>
      <WizardStep label={tx('Porträt')} description={tx('Gib dem Porträt einen Titel und beschreibe den Charakter.')} needs={['hund']}>
        <div className="space-y-4">
          <Bound form={f} name="titel" />
          <Bound form={f} name="widmung" />
          <Bound form={f} name="charakterbeschreibung" />
          <StepNav
            onBack={() => setStep(1)}
            onNext={() => flow.validateStep(2)}
            nextStepLabel={tx('Geschichten & Foto')}
          />
        </div>
      </WizardStep>
      <WizardStep label={tx('Geschichten')} description={tx('Erzähl von Lieblingsaktivität und besonderen Momenten und lade ein Foto hoch.')} needs={['hund']}>
        <div className="space-y-4">
          <Bound form={f} name="lieblingsaktivitaet" />
          <Bound form={f} name="besondere_momente" />
          <Bound form={f} name="portraet_foto" />
          <StepNav
            onBack={() => setStep(2)}
            onNext={() => flow.validateStep(3)}
            nextStepLabel={tx('Prüfen')}
          />
        </div>
      </WizardStep>
      <WizardStep label={tx('Prüfen')}>
        {!flow.submit.done && (
          <SummaryStep
            forms={flow.formList}
            submit={flow.submit}
            items={[{ key: 'erstellungsdatum', label: tx('Erstellungsdatum'), value: tx('Heute') }]}
            whatHappensNext={tx('Das Porträt wird gespeichert und ist sofort beim Hund hinterlegt.')}
          />
        )}
      </WizardStep>
      {flow.submit.result && (
        <SuccessStep
          result={flow.submit.result}
          forms={flow.formList}
          submit={flow.submit}
          next={[
            { label: tx('Aufenthalt buchen'), href: '#/intents/buchung-anlegen' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
        />
      )}
    </IntentWizardShell>
  );
}
