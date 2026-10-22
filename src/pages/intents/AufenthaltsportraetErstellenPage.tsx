/**
 * Aufenthaltsporträt erstellen — 5-Schritt-Wizard.
 * Steps: 1) Hund wählen → 2) Besitzer wählen → 3) Titel & Texte → 4) Porträtfoto → 5) Prüfen & speichern.
 * Reads: hundekartei, besitzer. Writes: pfoten_portraet (Erstellungsdatum = heute, vom Hook gesetzt).
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
import { useAufenthaltsportraetErstellenFlow } from '@/lib/journey/flows/AufenthaltsportraetErstellen';
import { tx } from '@/i18n';

export default function AufenthaltsportraetErstellenPage() {
  const [step, setStep] = useState(1);
  const flow = useAufenthaltsportraetErstellenFlow({
    steps: {
      hund: 1,
      besitzer: 2,
      titel: 3,
      charakterbeschreibung: 3,
      lieblingsaktivitaet: 3,
      besondere_momente: 3,
      portraet_foto: 4,
    },
    items: {
      hund: r => ({ id: r.id, title: fieldText(r, 'name'), subtitle: fieldText(r, 'rasse') }),
      besitzer: r => ({
        id: r.id,
        title: `${fieldText(r, 'vorname')} ${fieldText(r, 'nachname')}`.trim(),
      }),
    },
  });
  const f = flow.forms.pfoten_portraet;

  return (
    <IntentWizardShell
      title={tx('Aufenthaltsporträt erstellen')}
      currentStep={step}
      onStepChange={setStep}
      forms={flow.formList}
      draftKey={flow.draftKey}
      intro={{
        description: tx('Ein Pfoten-Porträt mit Foto für einen Hund und seinen Besitzer anlegen.'),
        needs: [tx('Hund aus der Kartei'), tx('Porträtfoto')],
      }}
    >
      <WizardStep label={tx('Hund')} description={tx('Für welchen Hund entsteht das Porträt?')}>
        <EntitySelectStep
          {...flow.picks.hund.select}
          {...flow.pick('hund')}
          searchPlaceholder={tx('Name oder Rasse …')}
        />
      </WizardStep>
      <WizardStep label={tx('Besitzer')} description={tx('Wem gehört der Hund?')} needs={['hund']}>
        <EntitySelectStep
          {...flow.picks.besitzer.select}
          {...flow.pick('besitzer')}
          avatar="initials"
          searchPlaceholder={tx('Vor- oder Nachname …')}
        />
        <StepNav onBack={() => setStep(1)} onNext={() => flow.validateStep(2)} nextStepLabel={tx('Texte')} />
      </WizardStep>
      <WizardStep label={tx('Texte')} description={tx('Gib dem Porträt einen Titel und erzähl vom Aufenthalt.')} needs={['hund']}>
        <div className="space-y-4">
          <Bound form={f} name="titel" />
          <Bound form={f} name="charakterbeschreibung" />
          <Bound form={f} name="lieblingsaktivitaet" />
          <Bound form={f} name="besondere_momente" />
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
            whatHappensNext={tx('Das Porträt wird mit dem heutigen Datum als Erstellungsdatum gespeichert.')}
          />
        )}
      </WizardStep>
      {flow.submit.result && (
        <SuccessStep
          result={flow.submit.result}
          forms={flow.formList}
          submit={flow.submit}
          next={[
            { label: tx('Neue Buchung'), href: '#/intents/neue-buchung' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
        />
      )}
    </IntentWizardShell>
  );
}
