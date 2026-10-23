/**
 * Pfoten-Porträt erstellen — 5-Schritt-Wizard.
 * Steps: 1) Hund wählen → 2) Titel und Widmung → 3) Charakter & Momente → 4) Foto hochladen → 5) Prüfen & speichern.
 * Reads: hundekartei (Name, Rasse, Besitzer). Writes: pfoten_portraet (Besitzer und Erstellungsdatum setzt der Flow selbst).
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
      titel: 2, widmung: 2,
      charakterbeschreibung: 3, lieblingsaktivitaet: 3, besondere_momente: 3,
      portraet_foto: 4,
    },
    items: {
      hund: (h, ctx) => ({
        id: h.id,
        title: fieldText(h, 'name'),
        subtitle: [fieldText(h, 'rasse'), ctx.ref('besitzer')].filter(Boolean).join(' · '),
      }),
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
        description: tx('Ein persönliches Porträt für einen Gast und seine Besitzer anlegen.'),
        needs: [tx('Name des Hundes'), tx('Ein paar Worte zum Charakter'), tx('Ein schönes Foto')],
      }}
    >
      <WizardStep label={tx('Hund')} description={tx('Für welchen Hund soll das Porträt entstehen? Der Besitzer wird übernommen.')}>
        <EntitySelectStep
          {...flow.picks.hund.select}
          {...flow.pick('hund')}
          searchPlaceholder={tx('Name oder Rasse …')}
        />
      </WizardStep>

      <WizardStep label={tx('Titel')} description={tx('Gib dem Porträt einen Titel und schreibe eine persönliche Widmung.')} needs={['hund']}>
        <div className="space-y-4">
          <Bound form={f} name="titel" placeholder={tx('z. B. Bello, der Sonnenschein')} />
          <Bound form={f} name="widmung" rows={4} />
          <StepNav onBack={() => setStep(1)} onNext={() => flow.validateStep(2)} nextStepLabel={tx('Charakter')} />
        </div>
      </WizardStep>

      <WizardStep label={tx('Charakter')} description={tx('Beschreibe den Charakter und halte besondere Momente fest.')} needs={['hund']}>
        <div className="space-y-4">
          <Bound form={f} name="charakterbeschreibung" rows={4} />
          <Bound form={f} name="lieblingsaktivitaet" />
          <Bound form={f} name="besondere_momente" rows={4} />
          <StepNav onBack={() => setStep(2)} onNext={() => flow.validateStep(3)} nextStepLabel={tx('Foto')} />
        </div>
      </WizardStep>

      <WizardStep label={tx('Foto')} description={tx('Lade das Foto hoch, das auf dem Porträt erscheinen soll.')} needs={['hund']}>
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
            whatHappensNext={tx('Das Porträt wird gespeichert und ist sofort beim Hund hinterlegt.')}
          />
        )}
      </WizardStep>

      {flow.submit.result && (
        <SuccessStep
          result={flow.submit.result}
          forms={flow.formList}
          submit={flow.submit}
          restartLabel={tx('Weiteres Porträt')}
          next={[
            { label: tx('Aufenthalt buchen'), href: '#/intents/aufenthalt-buchen' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
        />
      )}
    </IntentWizardShell>
  );
}
