/**
 * Aufenthalt buchen — 5-Schritt-Wizard.
 * Steps: 1) Hund wählen → 2) Zeitraum → 3) freien Platz wählen → 4) Preis & Notiz → 5) Prüfen & speichern.
 * Reads: hundekartei (Auswahl), belegung_buchungen (belegte Plätze). Writes: belegung_buchungen (über den Flow-Hook).
 * Composes: IntentWizardShell, EntitySelectStep, AvailabilityRangePicker, ChoiceGroup, Bound, Field, StepNav, SummaryStep, SuccessStep.
 */
import { useEffect, useMemo, useState } from 'react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { AvailabilityRangePicker } from '@/components/blocks/AvailabilityRangePicker';
import { ChoiceGroup } from '@/components/blocks/ChoiceGroup';
import { Bound } from '@/components/blocks/Bound';
import { Field } from '@/components/blocks/Field';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { fieldText, fieldLookup, fieldDate, type JourneyRecord } from '@/lib/journey';
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

  // bestehende Buchungen — über die Tür des Flows gelesen
  const [bookings, setBookings] = useState<JourneyRecord[]>([]);
  useEffect(() => {
    let alive = true;
    flow.port.list('belegung_buchungen', { limit: 500 }).then(rs => { if (alive) setBookings(rs); }).catch(() => { if (alive) setBookings([]); });
    return () => { alive = false; };
  }, [flow.port]);

  const from = (f.get('anreisedatum') as string | null) || null;
  const to = (f.get('abreisedatum') as string | null) || null;

  const takenPlaces = useMemo(() => {
    const taken = new Set<string>();
    if (!from || !to) return taken;
    for (const b of bookings) {
      const status = fieldLookup(b, 'status')?.key;
      if (status === 'storniert' || status === 'abgeschlossen') continue;
      const bFrom = fieldDate(b, 'anreisedatum');
      const bTo = fieldDate(b, 'abreisedatum');
      const place = fieldLookup(b, 'platznummer')?.key;
      if (!bFrom || !bTo || !place) continue;
      if (bFrom < to && bTo > from) taken.add(place);
    }
    return taken;
  }, [bookings, from, to]);

  const placeProps = f.choice('platznummer');
  const freeOptions = placeProps.options.filter(o => !takenPlaces.has(o.key));
  const chosenPlace = f.get('platznummer') as string | null;
  const overlapMessage = tx('Dieser Platz ist im gewählten Zeitraum schon belegt.');
  const checkOverlap = (): string | true => (chosenPlace && takenPlaces.has(chosenPlace) ? overlapMessage : true);

  return (
    <IntentWizardShell
      title={tx('Aufenthalt buchen')}
      currentStep={step}
      onStepChange={setStep}
      forms={flow.formList}
      draftKey={flow.draftKey}
      intro={{
        description: tx('Einen Hund auf einem freien Platz einbuchen.'),
        needs: [tx('Hund aus der Kartei'), tx('An- und Abreisedatum'), tx('Preis')],
      }}
    >
      <WizardStep label={tx('Hund')} description={tx('Für welchen Hund ist der Aufenthalt?')}>
        <EntitySelectStep
          {...flow.picks.hund.select}
          {...flow.pick('hund')}
          searchPlaceholder={tx('Name oder Rasse …')}
        />
      </WizardStep>

      <WizardStep label={tx('Zeitraum')} description={tx('An- und Abreise wählen.')} needs={['hund']}>
        <div className="space-y-4">
          <AvailabilityRangePicker {...f.range('anreisedatum', 'abreisedatum', { blocked: [] })} />
          <StepNav
            onBack={() => setStep(1)}
            onNext={() => flow.validateStep(2)}
            nextStepLabel={tx('Platz wählen')}
          />
        </div>
      </WizardStep>

      <WizardStep label={tx('Platz')} description={tx('Nur Plätze, die im Zeitraum frei sind.')} needs={['anreisedatum', 'abreisedatum']}>
        <div className="space-y-4">
          <Field form={f} name="platznummer">
            {freeOptions.length > 0 ? (
              <ChoiceGroup {...placeProps} options={freeOptions} />
            ) : (
              <p className="text-sm text-destructive">{tx('Im gewählten Zeitraum ist kein Platz frei.')}</p>
            )}
          </Field>
          {takenPlaces.size > 0 && (
            <p className="text-xs text-muted-foreground">{tx`${takenPlaces.size} Plätze sind im Zeitraum belegt.`}</p>
          )}
          <StepNav
            onBack={() => setStep(2)}
            onNext={() => (f.validate(['platznummer']) ? checkOverlap() : false)}
            nextStepLabel={tx('Preis')}
          />
        </div>
      </WizardStep>

      <WizardStep label={tx('Preis')} description={tx('Preis eintragen und bei Bedarf eine Notiz hinzufügen.')} needs={['platznummer']}>
        <div className="space-y-4">
          <Bound form={f} name="preis_euro" hint={tx('In Euro, z. B. 120')} />
          <Bound form={f} name="notizen" rows={3} />
          <StepNav
            onBack={() => setStep(3)}
            onNext={() => (flow.validateStep(4) ? checkOverlap() : false)}
            nextStepLabel={tx('Prüfen')}
          />
        </div>
      </WizardStep>

      <WizardStep label={tx('Prüfen')}>
        {!flow.submit.done && (
          <SummaryStep
            forms={flow.formList}
            submit={flow.submit}
            whatHappensNext={tx('Die Buchung erscheint sofort in der Belegung.')}
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
        />
      )}
    </IntentWizardShell>
  );
}
