/**
 * Aufenthalt buchen — 5-Schritt-Wizard.
 * Steps: 1) Hund wählen → 2) An- und Abreise → 3) Freien Platz wählen → 4) Preis & Notizen → 5) Prüfen & speichern.
 * Reads: hundekartei, belegung_buchungen (Belegung per Platz). Writes: belegung_buchungen (via useAufenthaltBuchenFlow).
 * Composes: IntentWizardShell, EntitySelectStep, Bound, Field, ChoiceGroup, StepNav, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Bound } from '@/components/blocks/Bound';
import { Field } from '@/components/blocks/Field';
import { ChoiceGroup } from '@/components/blocks/ChoiceGroup';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { fieldText, fieldLookup, useOccupancy } from '@/lib/journey';
import { useAufenthaltBuchenFlow } from '@/lib/journey/flows/AufenthaltBuchen';
import { tx } from '@/i18n';

export default function AufenthaltBuchenPage() {
  const [step, setStep] = useState(1);
  const flow = useAufenthaltBuchenFlow({
    steps: { hund: 1, anreisedatum: 2, abreisedatum: 2, platznummer: 3, preis_euro: 4, notizen: 4 },
    items: {
      hund: r => ({
        id: r.id,
        title: fieldText(r, 'name'),
        subtitle: [fieldText(r, 'rasse'), fieldLookup(r, 'impfstatus')?.label].filter(Boolean).join(' · '),
      }),
    },
  });
  const f = flow.forms.belegung_buchungen;
  const belegung = useOccupancy(flow.port, 'belegung_buchungen');

  const von = f.get('anreisedatum') as string | null;
  const bis = f.get('abreisedatum') as string | null;
  const platz = f.get('platznummer') as string | null;
  const platzProps = f.choice('platznummer');
  const freePlaetze = platzProps.options.filter(o => belegung.isFree(von, bis, o.key));

  const checkDates = () => {
    if (!f.validate(['anreisedatum', 'abreisedatum'])) return false;
    if (von && bis && bis < von) return tx('Die Abreise muss nach der Anreise liegen.');
    return true;
  };
  const checkPlatz = () => {
    if (!f.validate(['platznummer'])) return false;
    if (!belegung.isFree(von, bis, platz)) return tx('Dieser Platz ist im gewählten Zeitraum bereits belegt.');
    return true;
  };

  return (
    <IntentWizardShell
      title={tx('Aufenthalt buchen')}
      currentStep={step}
      onStepChange={setStep}
      forms={flow.formList}
      draftKey={flow.draftKey}
      intro={{
        description: tx('Einen Hund für einen Zeitraum auf einem freien Platz einbuchen.'),
        needs: [tx('Hund aus der Kartei'), tx('An- und Abreisedatum'), tx('Preis')],
      }}
    >
      <WizardStep label={tx('Hund')} description={tx('Welcher Hund kommt zu Besuch?')}>
        <EntitySelectStep
          {...flow.picks.hund.select}
          {...flow.pick('hund')}
          searchPlaceholder={tx('Name des Hundes …')}
        />
      </WizardStep>

      <WizardStep label={tx('Zeitraum')} description={tx('Wann reist der Hund an und wieder ab?')} needs={['hund']}>
        <div className="space-y-4">
          <Bound form={f} name="anreisedatum" />
          <Bound form={f} name="abreisedatum" />
          <StepNav onBack={() => setStep(1)} onNext={checkDates} nextStepLabel={tx('Platz wählen')} />
        </div>
      </WizardStep>

      <WizardStep
        label={tx('Platz')}
        description={tx('Nur Plätze, die im gewählten Zeitraum frei sind, stehen zur Auswahl.')}
        needs={['anreisedatum', 'abreisedatum']}
      >
        <div className="space-y-4">
          <Field form={f} name="platznummer">
            {freePlaetze.length > 0 ? (
              <ChoiceGroup {...platzProps} options={freePlaetze} />
            ) : (
              <p className="text-sm text-destructive">{tx('In diesem Zeitraum ist kein Platz frei.')}</p>
            )}
          </Field>
          <StepNav onBack={() => setStep(2)} onNext={checkPlatz} nextStepLabel={tx('Preis eingeben')} />
        </div>
      </WizardStep>

      <WizardStep label={tx('Preis')} description={tx('Preis der Buchung und optionale Notizen.')} needs={['platznummer']}>
        <div className="space-y-4">
          <Bound form={f} name="preis_euro" hint={tx('In Euro, z. B. 120')} />
          <Bound form={f} name="notizen" rows={3} />
          <StepNav onBack={() => setStep(3)} onNext={() => flow.validateStep(4)} nextStepLabel={tx('Prüfen')} />
        </div>
      </WizardStep>

      <WizardStep label={tx('Prüfen')}>
        {!flow.submit.done && (
          <SummaryStep
            forms={flow.formList}
            submit={flow.submit}
            items={[{ key: 'status', label: tx('Status'), value: tx('Aktiv') }]}
            whatHappensNext={tx('Der Platz ist im gewählten Zeitraum für andere Buchungen gesperrt.')}
          />
        )}
      </WizardStep>

      {flow.submit.result && (
        <SuccessStep
          result={flow.submit.result}
          forms={flow.formList}
          submit={flow.submit}
          next={[
            { label: tx('Pfoten-Porträt erstellen'), href: '#/intents/portraet-erstellen' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
          whatHappensNext={tx('Zum Aufenthalt kannst du ein Pfoten-Porträt für den Hund anlegen.')}
        />
      )}
    </IntentWizardShell>
  );
}
