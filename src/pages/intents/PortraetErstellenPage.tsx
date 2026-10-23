/**
 * Pfoten-Porträt erstellen — 5-Schritt-Wizard.
 * Steps: 1) Hund wählen (Besitzer wird übernommen) → 2) Titel, Widmung, Charakter → 3) Lieblingsaktivität & besondere Momente
 *        → 4) Foto hochladen → 5) Prüfen & anlegen.
 * Reads: hundekartei (name, rasse, besitzer, foto). Writes: pfoten_portraet (via usePortraetErstellenFlow).
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

  return (
    <IntentWizardShell
      title={tx('Pfoten-Porträt erstellen')}
      currentStep={step}
      onStepChange={setStep}
      forms={flow.formList}
      draftKey={flow.draftKey}
      intro={{
        description: tx('Ein Aufenthaltsporträt mit Foto und kleinen Geschichten für den Besitzer anlegen.'),
        needs: [tx('Den Hund aus der Kartei'), tx('Ein Foto für das Porträt')],
      }}
    >
      <WizardStep label={tx('Hund')} description={tx('Für welchen Hund entsteht das Porträt? Der Besitzer wird automatisch übernommen.')}>
        <EntitySelectStep
          {...flow.picks.hund.select}
          {...flow.pick('hund')}
          searchPlaceholder={tx('Name des Hundes …')}
        />
      </WizardStep>

      <WizardStep label={tx('Charakter')} description={tx('Gib dem Porträt einen Titel und beschreibe den Charakter des Hundes.')} needs={['hund']}>
        <div className="space-y-4">
          <Bound form={form} name="titel" placeholder={tx('z. B. Bellos Ferienwoche')} />
          <Bound form={form} name="widmung" rows={3} hint={tx('Ein paar persönliche Worte an den Besitzer')} />
          <Bound form={form} name="charakterbeschreibung" rows={4} />
          <StepNav
            onBack={() => setStep(1)}
            onNext={() => flow.validateStep(2)}
            nextStepLabel={tx('Lieblingsaktivität')}
          />
        </div>
      </WizardStep>

      <WizardStep label={tx('Geschichten')} description={tx('Was hat der Hund am liebsten gemacht, und was war besonders?')} needs={['titel']}>
        <div className="space-y-4">
          <Bound form={form} name="lieblingsaktivitaet" placeholder={tx('z. B. Stöckchen jagen')} />
          <Bound form={form} name="besondere_momente" rows={4} />
          <StepNav
            onBack={() => setStep(2)}
            onNext={() => flow.validateStep(3)}
            nextStepLabel={tx('Foto')}
          />
        </div>
      </WizardStep>

      <WizardStep label={tx('Foto')} description={tx('Lade das schönste Foto des Aufenthalts hoch.')} needs={['titel']}>
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
            whatHappensNext={tx('Das Porträt wird mit dem heutigen Datum gespeichert und dem Besitzer des Hundes zugeordnet.')}
          />
        )}
      </WizardStep>

      {flow.submit.result && (
        <SuccessStep
          result={flow.submit.result}
          forms={flow.formList}
          submit={flow.submit}
          next={[
            { label: tx('Aufenthalt abschließen'), href: '#/intents/aufenthalt-abschliessen' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
          whatHappensNext={tx('Das Porträt ist jetzt beim Hund hinterlegt und kann dem Besitzer gezeigt werden.')}
        />
      )}
    </IntentWizardShell>
  );
}
