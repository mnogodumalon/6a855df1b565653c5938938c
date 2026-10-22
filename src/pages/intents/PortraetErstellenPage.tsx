/**
 * Pfoten-Porträt erstellen — 5-Schritt-Wizard.
 * Steps: 1) Hund wählen → 2) Titel, Widmung, Charakter → 3) Lieblingsaktivität & besondere Momente
 *        → 4) Foto hochladen → 5) Prüfen & speichern.
 * Reads: hundekartei (Name, Rasse, Besitzer, Foto). Writes: pfoten_portraet (Besitzer + Erstellungsdatum setzt der Flow selbst).
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
    steps: {
      hund: 1,
      titel: 2, widmung: 2, charakterbeschreibung: 2,
      lieblingsaktivitaet: 3, besondere_momente: 3,
      portraet_foto: 4,
    },
    items: {
      hund: (r, ctx) => ({
        id: r.id,
        title: fieldText(r, 'name'),
        subtitle: [fieldText(r, 'rasse'), ctx.ref('besitzer')].filter(Boolean).join(' · '),
      }),
    },
  });

  const form = flow.forms.pfoten_portraet;
  const hundId = form.get('hund') as string | null;
  const hundRecord = hundId ? flow.picks.hund.recordOf(hundId) : undefined;
  const besitzerName = hundRecord ? flow.picks.hund.refLabel(hundRecord, 'besitzer') : undefined;

  const reviewItems = [
    ...(besitzerName ? [{ key: 'besitzer', label: tx('Besitzer'), value: besitzerName }] : []),
    { key: 'erstellungsdatum', label: tx('Erstellungsdatum'), value: format(new Date(), 'dd.MM.yyyy') },
  ];

  return (
    <IntentWizardShell
      title={tx('Pfoten-Porträt erstellen')}
      currentStep={step}
      onStepChange={setStep}
      forms={flow.formList}
      draftKey={flow.draftKey}
      intro={{
        description: tx('Ein Aufenthaltsporträt mit Foto und kleinen Geschichten für die Besitzer anlegen.'),
        needs: [tx('Name des Hundes'), tx('Ein schönes Foto')],
      }}
    >
      <WizardStep label={tx('Hund')} heading={tx('Hund auswählen')} description={tx('Für welchen Gast entsteht das Porträt?')}>
        <EntitySelectStep
          {...flow.picks.hund.select}
          {...flow.pick('hund')}
          searchPlaceholder={tx('Name des Hundes …')}
          avatar="initials"
        />
      </WizardStep>

      <WizardStep label={tx('Porträt')} description={tx('Gib dem Porträt einen Titel und beschreibe den Charakter.')} needs={['hund']}>
        <div className="space-y-4">
          <Bound form={form} name="titel" />
          <Bound form={form} name="widmung" rows={3} />
          <Bound form={form} name="charakterbeschreibung" rows={4} />
          <StepNav onBack={() => setStep(1)} onNext={() => flow.validateStep(2)} nextStepLabel={tx('Geschichten')} />
        </div>
      </WizardStep>

      <WizardStep label={tx('Geschichten')} description={tx('Was macht der Hund am liebsten, und was war besonders?')} needs={['hund']}>
        <div className="space-y-4">
          <Bound form={form} name="lieblingsaktivitaet" />
          <Bound form={form} name="besondere_momente" rows={4} />
          <StepNav onBack={() => setStep(2)} onNext={() => flow.validateStep(3)} nextStepLabel={tx('Foto')} />
        </div>
      </WizardStep>

      <WizardStep label={tx('Foto')} description={tx('Lade ein Foto für das Porträt hoch.')} needs={['hund']}>
        <div className="space-y-4">
          <Bound form={form} name="portraet_foto" />
          <StepNav onBack={() => setStep(3)} onNext={() => flow.validateStep(4)} nextStepLabel={tx('Prüfen')} />
        </div>
      </WizardStep>

      <WizardStep label={tx('Prüfen')} needs={['hund', 'titel']}>
        {!flow.submit.done && (
          <SummaryStep
            forms={flow.formList}
            submit={flow.submit}
            items={reviewItems}
            whatHappensNext={tx('Das Porträt wird gespeichert und ist sofort für die Besitzer bereit.')}
          />
        )}
      </WizardStep>

      {flow.submit.result && (
        <SuccessStep
          result={flow.submit.result}
          forms={flow.formList}
          submit={flow.submit}
          title={tx('Porträt erstellt')}
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
