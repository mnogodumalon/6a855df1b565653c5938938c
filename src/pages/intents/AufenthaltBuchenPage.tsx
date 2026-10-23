/**
 * Aufenthalt buchen — 5-Schritt-Wizard.
 * Steps: 1) Hund wählen → 2) Zeitraum → 3) freien Platz wählen → 4) Preis & Notizen → 5) Prüfen & speichern.
 * Reads: hundekartei (Pick), belegung_buchungen (Belegung). Writes: belegung_buchungen (status = aktiv, Besitzer aus dem Hund).
 * Composes: IntentWizardShell, EntitySelectStep, AvailabilityRangePicker, ChoiceGroup, Bound, Field, StepNav, SummaryStep, SuccessStep.
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
import { fieldText, fieldLookup, useOccupancy } from '@/lib/journey';
import { useAufenthaltBuchenFlow } from '@/lib/journey/flows/AufenthaltBuchen';
import { tx } from '@/i18n';

export default function AufenthaltBuchenPage() {
  const [step, setStep] = useState(1);
  const flow = useAufenthaltBuchenFlow({
    steps: { hund: 1, anreisedatum: 2, abreisedatum: 2, platznummer: 3, preis_euro: 4, notizen: 4 },
    items: {
      hund: (r, ctx) => ({
        id: r.id,
        title: fieldText(r, 'name'),
        subtitle: [fieldText(r, 'rasse'), ctx.ref('besitzer')].filter(Boolean).join(' · ') || undefined,
        status: fieldLookup(r, 'impfstatus') ?? undefined,
      }),
    },
  });
  const f = flow.forms.belegung_buchungen;
  const belegung = useOccupancy(flow.port, 'belegung_buchungen');

  const von = f.get('anreisedatum') as string | null;
  const bis = f.get('abreisedatum') as string | null;
  const platzProps = f.choice('platznummer');
  const freiePlaetze = platzProps.options.filter(o => belegung.isFree(von, bis, o.key));

  const checkPlatz = () => {
    if (!flow.validateStep(3)) return false;
    const platz = f.get('platznummer') as string | null;
    if (!belegung.isFree(von, bis, platz)) return tx('Dieser Platz ist im gewählten Zeitraum schon belegt.');
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
        description: tx('Hund wählen, freien Platz im Zeitraum prüfen und die Buchung anlegen.'),
        needs: [tx('Name des Hundes'), tx('Anreise- und Abreisedatum')],
      }}
    >
      <WizardStep label={tx('Hund')} heading={tx('Hund wählen')} description={tx('Wähle den Hund aus der Hundekartei — der Besitzer wird übernommen.')}>
        <EntitySelectStep
          {...flow.picks.hund.select}
          {...flow.pick('hund')}
          searchPlaceholder={tx('Name oder Rasse …')}
          avatar="initials"
        />
      </WizardStep>

      <WizardStep label={tx('Zeitraum')} needs={['hund']} description={tx('An- und Abreise wählen.')}>
        <div className="space-y-4">
          <AvailabilityRangePicker {...f.range('anreisedatum', 'abreisedatum', { blocked: [] })} legend={false} />
          <StepNav onBack={() => setStep(1)} onNext={() => flow.validateStep(2)} nextStepLabel={tx('Platz wählen')} />
        </div>
      </WizardStep>

      <WizardStep label={tx('Platz')} needs={['anreisedatum', 'abreisedatum']} description={tx('Nur Plätze, die im Zeitraum frei sind, kannst du wählen.')}>
        <div className="space-y-4">
          <Field form={f} name="platznummer">
            <ChoiceGroup {...platzProps} options={freiePlaetze} />
          </Field>
          {!belegung.loading && freiePlaetze.length === 0 && (
            <p className="text-sm text-destructive">{tx('Dieser Platz ist im gewählten Zeitraum schon belegt.')}</p>
          )}
          <StepNav onBack={() => setStep(2)} onNext={checkPlatz} nextStepLabel={tx('Preis und Notizen')} />
        </div>
      </WizardStep>

      <WizardStep label={tx('Preis & Notizen')} needs={['platznummer']} description={tx('Preis und Hinweise zur Buchung eintragen.')}>
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
            whatHappensNext={tx('Die Buchung wird als aktiv angelegt, der Platz ist im Zeitraum belegt.')}
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
          whatHappensNext={tx('Zum Aufenthalt kannst du ein Pfoten-Porträt für den Besitzer anlegen.')}
        />
      )}
    </IntentWizardShell>
  );
}
