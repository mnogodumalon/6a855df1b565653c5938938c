/**
 * Pfoten-Porträt erstellen — 5-Schritt-Wizard.
 * Steps: 1) Hund wählen → 2) Titel, Widmung, Charakter → 3) Lieblingsaktivität & besondere Momente → 4) Foto → 5) Prüfen & speichern.
 * Reads: hundekartei, besitzer. Writes: pfoten_portraet (Erstellungsdatum setzt der Flow selbst).
 * Composes: IntentWizardShell, EntitySelectStep, Bound, StepNav, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Bound } from '@/components/blocks/Bound';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { fieldText, fieldRef } from '@/lib/journey';
import { usePortraetErstellenFlow } from '@/lib/journey/flows/PortraetErstellen';
import { tx } from '@/i18n';

export default function PortraetErstellenPage() {
  const [step, setStep] = useState(1);
  const flow = usePortraetErstellenFlow({
    steps: {
      hund: 1, besitzer: 1,
      titel: 2, widmung: 2, charakterbeschreibung: 2,
      lieblingsaktivitaet: 3, besondere_momente: 3,
      portraet_foto: 4,
    },
    items: {
      hund: (h, ctx) => ({ id: h.id, title: fieldText(h, 'name'), subtitle: ctx.ref('besitzer') }),
      besitzer: b => ({ id: b.id, title: `${fieldText(b, 'vorname')} ${fieldText(b, 'nachname')}`.trim() }),
    },
  });
  const form = flow.forms.pfoten_portraet;
  const hundPick = flow.pick('hund');

  const selectHund = (id: string) => {
    hundPick.onSelect(id);
    const rec = flow.picks.hund.recordOf(id);
    const besitzerId = rec ? fieldRef(rec, 'besitzer') : null;
    if (rec && besitzerId) {
      form.set('besitzer', besitzerId, flow.picks.hund.refLabel(rec, 'besitzer') ?? flow.picks.besitzer.labelOf(besitzerId) ?? tx('Besitzer'));
    }
    setStep(2);
  };

  return (
    <IntentWizardShell
      title={tx('Pfoten-Porträt erstellen')}
      currentStep={step}
      onStepChange={setStep}
      forms={flow.formList}
      draftKey={flow.draftKey}
      intro={{
        description: tx('Für einen Gast ein Porträt mit Foto, Widmung und kleinen Geschichten anlegen.'),
        needs: [tx('Den Hund, für den das Porträt gedacht ist'), tx('Ein Foto (optional)')],
      }}
    >
      <WizardStep label={tx('Hund')} description={tx('Für welchen Hund entsteht das Porträt?')}>
        <EntitySelectStep
          {...flow.picks.hund.select}
          {...hundPick}
          onSelect={selectHund}
          avatar="initials"
          searchPlaceholder={tx('Name des Hundes …')}
        />
      </WizardStep>

      <WizardStep label={tx('Titel & Widmung')} description={tx('Gib dem Porträt einen Titel und beschreibe den Charakter.')} needs={['hund']}>
        <div className="space-y-4">
          <Bound form={form} name="titel" />
          <Bound form={form} name="widmung" rows={3} />
          <Bound form={form} name="charakterbeschreibung" rows={4} />
          <StepNav onBack={() => setStep(1)} onNext={() => flow.validateStep(2)} nextStepLabel={tx('Momente')} />
        </div>
      </WizardStep>

      <WizardStep label={tx('Momente')} description={tx('Was liebt der Hund, und was war beim Aufenthalt besonders?')} needs={['hund']}>
        <div className="space-y-4">
          <Bound form={form} name="lieblingsaktivitaet" />
          <Bound form={form} name="besondere_momente" rows={4} />
          <StepNav onBack={() => setStep(2)} onNext={() => flow.validateStep(3)} nextStepLabel={tx('Foto')} />
        </div>
      </WizardStep>

      <WizardStep label={tx('Foto')} description={tx('Füge ein schönes Foto für das Porträt hinzu.')} needs={['hund']}>
        <div className="space-y-4">
          <Bound form={form} name="portraet_foto" />
          <StepNav onBack={() => setStep(3)} onNext={() => flow.validateStep(4)} nextStepLabel={tx('Prüfen')} />
        </div>
      </WizardStep>

      <WizardStep label={tx('Prüfen')} needs={['hund']}>
        {!flow.submit.done && (
          <SummaryStep
            forms={flow.formList}
            submit={flow.submit}
            whatHappensNext={tx('Das Porträt wird gespeichert und ist dem Hund und seinem Besitzer zugeordnet.')}
          />
        )}
      </WizardStep>

      {flow.submit.result && (
        <SuccessStep
          result={flow.submit.result}
          forms={flow.formList}
          submit={flow.submit}
          next={[
            { label: tx('Aufenthalt buchen'), href: '#/intents/aufenthalt-buchen' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
        />
      )}
    </IntentWizardShell>
  );
}
