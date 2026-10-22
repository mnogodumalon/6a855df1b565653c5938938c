/**
 * Neue Buchung — 5-Schritt-Wizard.
 * Steps: 1) Besitzer wählen oder neu anlegen → 2) Hund wählen oder neu anlegen → 3) Zeitraum → 4) Platz (Überschneidung wird geprüft) → 5) Prüfen & speichern.
 * Reads: besitzer, hundekartei, belegung_buchungen. Writes: besitzer, hundekartei (nur bei Neuanlage), belegung_buchungen (Status startet als aktiv).
 * Composes: IntentWizardShell, EntitySelectStep, AvailabilityRangePicker, ChoiceGroup, Field, StepNav, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { AvailabilityRangePicker } from '@/components/blocks/AvailabilityRangePicker';
import { ChoiceGroup } from '@/components/blocks/ChoiceGroup';
import { Field } from '@/components/blocks/Field';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { fieldText, optionsOf, useOccupancy } from '@/lib/journey';
import { useNeueBuchungFlow } from '@/lib/journey/flows/NeueBuchung';
import { tx } from '@/i18n';

export default function NeueBuchungPage() {
  const [step, setStep] = useState(1);
  const flow = useNeueBuchungFlow({
    steps: { besitzer: 1, hund: 2, anreisedatum: 3, abreisedatum: 3, platznummer: 4 },
    items: {
      besitzer: r => ({
        id: r.id,
        title: `${fieldText(r, 'vorname')} ${fieldText(r, 'nachname')}`.trim(),
        subtitle: fieldText(r, 'ort'),
      }),
      hund: (r, ctx) => ({
        id: r.id,
        title: fieldText(r, 'name'),
        subtitle: [fieldText(r, 'rasse'), ctx.ref('besitzer')].filter(Boolean).join(' · '),
      }),
    },
  });

  const buchung = flow.forms.belegung_buchungen;
  const belegung = useOccupancy(flow.port, 'belegung_buchungen');
  const von = (buchung.get('anreisedatum') as string | null) ?? null;
  const bis = (buchung.get('abreisedatum') as string | null) ?? null;
  const platz = buchung.choice('platznummer');
  const freiePlaetze = (platz.options ?? optionsOf('belegung_buchungen', 'platznummer')).filter(o => belegung.isFree(von, bis, o.key));
  const belegteAnzahl = optionsOf('belegung_buchungen', 'platznummer').length - freiePlaetze.length;

  const pruefePlatz = (): boolean | string => {
    if (!flow.validateStep(4)) return false;
    const key = buchung.get('platznummer') as string | null;
    if (key && !belegung.isFree(von, bis, key)) return tx('Dieser Platz ist im gewählten Zeitraum bereits belegt.');
    return true;
  };

  return (
    <IntentWizardShell
      title={tx('Neue Buchung')}
      currentStep={step}
      onStepChange={setStep}
      forms={flow.formList}
      draftKey={flow.draftKey}
      intro={{
        description: tx('Besitzer und Hund wählen, Zeitraum und Platz festlegen.'),
        needs: [tx('Name des Besitzers'), tx('Name des Hundes'), tx('An- und Abreisedatum')],
      }}
    >
      <WizardStep label={tx('Besitzer')} description={tx('Wähle den Besitzer aus oder lege einen neuen an.')}>
        <EntitySelectStep
          {...flow.picks.besitzer.select}
          {...flow.pick('besitzer')}
          avatar="initials"
          searchPlaceholder={tx('Name suchen …')}
        />
      </WizardStep>
      <WizardStep label={tx('Hund')} description={tx('Welcher Hund kommt zu Besuch? Wähle ihn aus oder lege ihn neu an.')}>
        <EntitySelectStep
          {...flow.picks.hund.select}
          {...flow.pick('hund')}
          searchPlaceholder={tx('Hundename suchen …')}
        />
      </WizardStep>
      <WizardStep label={tx('Zeitraum')} description={tx('An- und Abreise wählen.')} needs={['hund']}>
        <div className="space-y-4">
          <AvailabilityRangePicker {...buchung.range('anreisedatum', 'abreisedatum', { blocked: [] })} blocked={[]} />
          <StepNav
            onBack={() => setStep(2)}
            onNext={() => flow.validateStep(3)}
            nextStepLabel={tx('Platz wählen')}
          />
        </div>
      </WizardStep>
      <WizardStep label={tx('Platz')} description={tx('Nur Plätze, die im gewählten Zeitraum frei sind.')} needs={['anreisedatum', 'abreisedatum']}>
        <div className="space-y-4">
          <Field form={buchung} name="platznummer">
            <ChoiceGroup {...platz} options={freiePlaetze} />
          </Field>
          {belegteAnzahl > 0 && (
            <p className="text-sm text-muted-foreground">
              {freiePlaetze.length === 0
                ? tx('Im gewählten Zeitraum ist kein Platz frei — ändere den Zeitraum.')
                : tx`${belegteAnzahl} Plätze sind in diesem Zeitraum bereits belegt.`}
            </p>
          )}
          <StepNav onBack={() => setStep(3)} onNext={pruefePlatz} nextStepLabel={tx('Prüfen')} />
        </div>
      </WizardStep>
      <WizardStep label={tx('Prüfen')}>
        {!flow.submit.done && (
          <SummaryStep
            forms={flow.formList}
            submit={flow.submit}
            items={[{ key: 'status', label: tx('Status'), value: tx('Aktiv') }]}
            whatHappensNext={tx('Die Buchung wird mit Status „Aktiv“ gespeichert und der Platz ist im Zeitraum belegt.')}
          />
        )}
      </WizardStep>
      {flow.submit.result && (
        <SuccessStep
          result={flow.submit.result}
          forms={flow.formList}
          submit={flow.submit}
          next={[
            { label: tx('Check-in und Check-out'), href: '#/intents/check-in-check-out' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
        />
      )}
    </IntentWizardShell>
  );
}
