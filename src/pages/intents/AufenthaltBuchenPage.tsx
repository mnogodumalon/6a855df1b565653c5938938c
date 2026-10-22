/**
 * Aufenthalt buchen — Wizard für die Einbuchung eines Hundes auf einen freien Platz.
 * Steps: 1) Besitzer wählen → 2) Hund wählen → 3) Zeitraum → 4) Freien Platz wählen → 5) Preis & Notizen → 6) Prüfen & buchen.
 * Reads: besitzer, hundekartei, belegung_buchungen (Belegung). Writes: belegung_buchungen (über useAufenthaltBuchenFlow).
 * Composes: IntentWizardShell, EntitySelectStep, AvailabilityRangePicker, ChoiceGroup, Bound, StepNav, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { AvailabilityRangePicker } from '@/components/blocks/AvailabilityRangePicker';
import { ChoiceGroup } from '@/components/blocks/ChoiceGroup';
import { Bound } from '@/components/blocks/Bound';
import { Field } from '@/components/blocks/Field';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { fieldText, useOccupancy } from '@/lib/journey';
import { useAufenthaltBuchenFlow } from '@/lib/journey/flows/AufenthaltBuchen';
import { tx } from '@/i18n';

export default function AufenthaltBuchenPage() {
  const [step, setStep] = useState(1);
  const flow = useAufenthaltBuchenFlow({
    steps: { besitzer: 1, hund: 2, anreisedatum: 3, abreisedatum: 3, platznummer: 4, preis_euro: 5, notizen: 5 },
    items: {
      besitzer: r => ({
        id: r.id,
        title: `${fieldText(r, 'vorname')} ${fieldText(r, 'nachname')}`.trim(),
        subtitle: fieldText(r, 'telefon'),
      }),
      hund: (r, ctx) => ({
        id: r.id,
        title: fieldText(r, 'name'),
        subtitle: [fieldText(r, 'rasse'), ctx.ref('besitzer')].filter(Boolean).join(' · '),
      }),
    },
  });
  const f = flow.forms.belegung_buchungen;
  const belegung = useOccupancy(flow.port, 'belegung_buchungen');

  const von = (f.get('anreisedatum') as string | null) ?? null;
  const bis = (f.get('abreisedatum') as string | null) ?? null;
  const platzProps = f.choice('platznummer');
  const freiePlaetze = platzProps.options.filter(o => belegung.isFree(von, bis, o.key));

  const checkPlatz = () => {
    if (!f.validate(['platznummer'])) return false;
    const platz = f.get('platznummer') as string | null;
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
        needs: [tx('Besitzer und Hund'), tx('An- und Abreisedatum'), tx('Preis des Aufenthalts')],
      }}
    >
      <WizardStep label={tx('Besitzer')} description={tx('Wer bringt den Hund?')}>
        <EntitySelectStep
          {...flow.picks.besitzer.select}
          {...flow.pick('besitzer')}
          avatar="initials"
          searchPlaceholder={tx('Name suchen …')}
        />
      </WizardStep>

      <WizardStep label={tx('Hund')} description={tx('Welcher Hund wird eingebucht?')} needs={['besitzer']}>
        <EntitySelectStep
          {...flow.picks.hund.select}
          {...flow.pick('hund')}
          searchPlaceholder={tx('Name des Hundes …')}
        />
      </WizardStep>

      <WizardStep label={tx('Zeitraum')} description={tx('An- und Abreise wählen.')} needs={['hund']}>
        <div className="space-y-4">
          <AvailabilityRangePicker {...f.range('anreisedatum', 'abreisedatum', { blocked: [] })} />
          <StepNav
            onBack={() => setStep(2)}
            onNext={() => flow.validateStep(3)}
            nextStepLabel={tx('Platz wählen')}
          />
        </div>
      </WizardStep>

      <WizardStep
        label={tx('Platz')}
        description={tx('Nur Plätze, die im gewählten Zeitraum frei sind.')}
        needs={['anreisedatum', 'abreisedatum']}
      >
        <div className="space-y-4">
          <Field form={f} name="platznummer">
            {freiePlaetze.length > 0 ? (
              <ChoiceGroup {...platzProps} options={freiePlaetze} />
            ) : (
              <p className="text-sm text-destructive">
                {belegung.loading ? tx('Belegung wird geladen …') : tx('Im gewählten Zeitraum ist kein Platz frei.')}
              </p>
            )}
          </Field>
          <StepNav onBack={() => setStep(3)} onNext={checkPlatz} nextStepLabel={tx('Preis')} />
        </div>
      </WizardStep>

      <WizardStep label={tx('Preis')} description={tx('Preis eintragen und Notizen ergänzen.')} needs={['platznummer']}>
        <div className="space-y-4">
          <Bound form={f} name="preis_euro" />
          <Bound form={f} name="notizen" rows={3} />
          <StepNav onBack={() => setStep(4)} onNext={() => flow.validateStep(5)} nextStepLabel={tx('Prüfen')} />
        </div>
      </WizardStep>

      <WizardStep label={tx('Prüfen')}>
        {!flow.submit.done && (
          <SummaryStep
            forms={flow.formList}
            submit={flow.submit}
            items={[{ key: 'status', label: tx('Status'), value: tx('Aktiv') }]}
            whatHappensNext={tx('Der Platz ist im gewählten Zeitraum für diesen Hund reserviert.')}
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
          whatHappensNext={tx('Nach dem Aufenthalt kannst du ihn über „Aufenthalt abschließen“ beenden.')}
        />
      )}
    </IntentWizardShell>
  );
}
