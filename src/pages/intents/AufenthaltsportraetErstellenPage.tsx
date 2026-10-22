/**
 * Aufenthaltsporträt erstellen — 5-Schritt-Wizard.
 * Steps: 1) Hund wählen → 2) Besitzer wählen → 3) Texte zum Porträt → 4) Porträtfoto → 5) Prüfen & speichern.
 * Reads: hundekartei, besitzer. Writes: pfoten_portraet (Erstellungsdatum = heute, vom Plan gesetzt).
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
      hund: r => ({ id: r.id, title: fieldText(r, 'name'), subtitle: fieldText(r, 'rasse') || undefined }),
      besitzer: r => ({
        id: r.id,
        title: `${fieldText(r, 'vorname')} ${fieldText(r, 'nachname')}`.trim(),
      }),
    },
  });
  const portraet = flow.forms.pfoten_portraet;

  return (
    <IntentWizardShell
      title={tx('Aufenthaltsporträt erstellen')}
      currentStep={step}
      onStepChange={setStep}
      forms={flow.formList}
      draftKey={flow.draftKey}
      intro={{
        description: tx('Ein persönliches Porträt für den Aufenthalt eines Hundes anlegen.'),
        needs: [tx('Hund und Besitzer'), tx('Titel und ein paar Worte zum Charakter'), tx('Ein schönes Foto')],
      }}
    >
      <WizardStep label={tx('Hund')} description={tx('Für welchen Hund entsteht das Porträt?')}>
        <EntitySelectStep
          {...flow.picks.hund.select}
          {...flow.pick('hund')}
          searchPlaceholder={tx('Name oder Rasse …')}
          avatar="initials"
        />
      </WizardStep>
      <WizardStep label={tx('Besitzer')} description={tx('Wem gehört der Hund?')}>
        <EntitySelectStep
          {...flow.picks.besitzer.select}
          {...flow.pick('besitzer')}
          searchPlaceholder={tx('Vor- oder Nachname …')}
          avatar="initials"
        />
        <StepNav
          onBack={() => setStep(1)}
          onNext={() => flow.validateStep(2)}
          nextStepLabel={tx('Porträttexte')}
        />
      </WizardStep>
      <WizardStep label={tx('Porträt')} description={tx('Was macht diesen Hund besonders?')}>
        <div className="space-y-4">
          <Bound form={portraet} name="titel" />
          <Bound form={portraet} name="charakterbeschreibung" rows={4} />
          <Bound form={portraet} name="lieblingsaktivitaet" />
          <Bound form={portraet} name="besondere_momente" rows={4} />
          <StepNav
            onBack={() => setStep(2)}
            onNext={() => flow.validateStep(3)}
            nextStepLabel={tx('Foto')}
          />
        </div>
      </WizardStep>
      <WizardStep label={tx('Foto')} description={tx('Lade ein Porträtfoto hoch.')}>
        <div className="space-y-4">
          <Bound form={portraet} name="portraet_foto" />
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
            items={[{ key: 'erstellungsdatum', label: tx('Erstellungsdatum'), value: format(new Date(), 'dd.MM.yyyy') }]}
            whatHappensNext={tx('Das Porträt wird mit dem heutigen Datum gespeichert.')}
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
            { label: tx('Check-in und Check-out'), href: '#/intents/check-in-check-out' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
        />
      )}
    </IntentWizardShell>
  );
}
