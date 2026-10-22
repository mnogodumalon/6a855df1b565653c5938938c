/**
 * Aufenthalt buchen — 5-Schritt-Wizard.
 * Steps: 1) Hund wählen → 2) Zeitraum → 3) freien Platz wählen → 4) Preis & Notizen → 5) Prüfen & buchen.
 * Reads: hundekartei, belegung_buchungen (Belegung). Writes: belegung_buchungen (via useAufenthaltBuchenFlow).
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
import { fieldText, useOccupancy } from '@/lib/journey';
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
        subtitle: [fieldText(r, 'rasse'), ctx.ref('besitzer')].filter(Boolean).join(' · '),
      }),
    },
  });
  const f = flow.forms.belegung_buchungen;
  const belegung = useOccupancy(flow.port, 'belegung_buchungen');

  const from = (f.get('anreisedatum') as string | null) ?? null;
  const to = (f.get('abreisedatum') as string | null) ?? null;
  const platz = f.choice('platznummer');
  const freePlaetze = platz.options.filter(o => belegung.isFree(from, to, o.key));

  return (
    <IntentWizardShell
      title={tx('Aufenthalt buchen')}
      currentStep={step}
      onStepChange={setStep}
      forms={flow.formList}
      draftKey={flow.draftKey}
      intro={{
        description: tx('Hund, Zeitraum und freien Platz wählen und die Buchung anlegen.'),
        needs: [tx('Der Hund ist in der Hundekartei'), tx('An- und Abreisedatum'), tx('Preis des Aufenthalts')],
      }}
    >
      <WizardStep label={tx('Hund')} description={tx('Für welchen Hund ist der Aufenthalt?')}>
        <EntitySelectStep
          {...flow.picks.hund.select}
          {...flow.pick('hund')}
          avatar="initials"
          searchPlaceholder={tx('Name des Hundes …')}
        />
      </WizardStep>

      <WizardStep label={tx('Zeitraum')} description={tx('An- und Abreise wählen.')} needs={['hund']}>
        <div className="space-y-4">
          <AvailabilityRangePicker {...f.range('anreisedatum', 'abreisedatum', { blocked: [] })} legend={false} />
          <StepNav
            onBack={() => setStep(1)}
            onNext={() => f.validate(['anreisedatum', 'abreisedatum'])}
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
          {belegung.loading ? (
            <p className="text-sm text-muted-foreground">{tx('Belegung wird geladen …')}</p>
          ) : freePlaetze.length === 0 ? (
            <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
              {tx('Im gewählten Zeitraum ist kein Platz frei. Wähle einen anderen Zeitraum.')}
            </p>
          ) : (
            <Field form={f} name="platznummer" hint={tx`${freePlaetze.length} von ${platz.options.length} Plätzen frei`}>
              <ChoiceGroup {...platz} options={freePlaetze} />
            </Field>
          )}
          <StepNav
            onBack={() => setStep(2)}
            onNext={() => {
              if (!f.validate(['platznummer'])) return false;
              if (!belegung.isFree(from, to, f.get('platznummer') as string)) {
                return tx('Dieser Platz ist im gewählten Zeitraum schon belegt.');
              }
              return true;
            }}
            nextStepLabel={tx('Preis')}
          />
        </div>
      </WizardStep>

      <WizardStep label={tx('Preis')} description={tx('Preis eintragen und bei Bedarf eine Notiz ergänzen.')} needs={['platznummer']}>
        <div className="space-y-4">
          <Bound form={f} name="preis_euro" hint={tx('Gesamtpreis in Euro')} />
          <Bound form={f} name="notizen" rows={3} />
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
            items={[{ key: 'status', label: tx('Status'), value: tx('Aktiv') }]}
            whatHappensNext={tx('Der Platz ist für den Zeitraum belegt und erscheint sofort in der Belegung.')}
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
