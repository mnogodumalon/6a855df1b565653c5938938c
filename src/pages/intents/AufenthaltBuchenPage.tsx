/**
 * Aufenthalt buchen — 5-Schritt-Wizard.
 * Steps: 1) Hund wählen → 2) Zeitraum → 3) Platz wählen (Überschneidungsprüfung) → 4) Preis & Notizen → 5) Prüfen & buchen.
 * Reads: hundekartei, belegung_buchungen (Belegung). Writes: belegung_buchungen (via useAufenthaltBuchenFlow).
 * Composes: IntentWizardShell, EntitySelectStep, AvailabilityRangePicker, Field, Bound, StepNav, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { IconCheck, IconBan } from '@tabler/icons-react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { AvailabilityRangePicker } from '@/components/blocks/AvailabilityRangePicker';
import { Bound } from '@/components/blocks/Bound';
import { Field } from '@/components/blocks/Field';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { fieldText, fieldLookup, optionsOf, useOccupancy } from '@/lib/journey';
import { useAufenthaltBuchenFlow } from '@/lib/journey/flows/AufenthaltBuchen';
import { tx } from '@/i18n';

export default function AufenthaltBuchenPage() {
  const [step, setStep] = useState(1);
  const flow = useAufenthaltBuchenFlow({
    steps: { hund: 1, anreisedatum: 2, abreisedatum: 2, platznummer: 3, preis_euro: 4, notizen: 4 },
    items: {
      hund: (h, ctx) => ({
        id: h.id,
        title: fieldText(h, 'name'),
        subtitle: [fieldText(h, 'rasse'), ctx.ref('besitzer')].filter(Boolean).join(' · '),
        status: fieldLookup(h, 'impfstatus') ?? undefined,
      }),
    },
  });
  const f = flow.forms.belegung_buchungen;
  const belegung = useOccupancy(flow.port, 'belegung_buchungen');

  const von = f.get('anreisedatum') as string | null;
  const bis = f.get('abreisedatum') as string | null;
  const platz = f.choice('platznummer');
  const plaetze = optionsOf('belegung_buchungen', 'platznummer');

  return (
    <IntentWizardShell
      title={tx('Aufenthalt buchen')}
      currentStep={step}
      onStepChange={setStep}
      forms={flow.formList}
      draftKey={flow.draftKey}
      intro={{
        description: tx('Einen Hund für einen Zeitraum auf einem freien Platz einbuchen.'),
        needs: [tx('Hund in der Hundekartei'), tx('An- und Abreisedatum'), tx('Preis, falls bekannt')],
      }}
    >
      <WizardStep label={tx('Hund')} heading={tx('Hund auswählen')} description={tx('Wer kommt zu Besuch? Der Besitzer wird aus der Hundekartei übernommen.')}>
        <EntitySelectStep
          {...flow.picks.hund.select}
          {...flow.pick('hund')}
          avatar="initials"
          searchPlaceholder={tx('Name des Hundes …')}
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

      <WizardStep
        label={tx('Platz')}
        heading={tx('Platz wählen')}
        description={tx('Belegte Plätze sind im gewählten Zeitraum nicht auswählbar.')}
        needs={['anreisedatum', 'abreisedatum']}
      >
        <div className="space-y-4">
          <Field form={f} name="platznummer">
            <div
              role="radiogroup"
              id={platz.id}
              aria-labelledby={platz['aria-labelledby']}
              aria-describedby={platz['aria-describedby']}
              className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4"
            >
              {plaetze.map(o => {
                const free = belegung.isFree(von, bis, o.key);
                const selected = platz.value === o.key;
                return (
                  <button
                    key={o.key}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={!free}
                    onClick={() => platz.onChange(o.key)}
                    className={[
                      'flex min-w-0 flex-col items-start gap-1 rounded-xl border p-3 text-left text-sm transition-colors',
                      selected ? 'border-primary bg-primary/10' : 'border-border bg-card hover:bg-secondary',
                      !free ? 'cursor-not-allowed opacity-50' : '',
                    ].join(' ')}
                  >
                    <span className="w-full truncate font-medium">{o.label}</span>
                    <span className={`flex items-center gap-1 text-xs ${free ? 'text-emerald-600' : 'text-destructive'}`}>
                      {free ? <IconCheck size={14} className="shrink-0" /> : <IconBan size={14} className="shrink-0" />}
                      {free ? tx('Frei') : tx('Belegt')}
                    </span>
                  </button>
                );
              })}
            </div>
          </Field>
          <StepNav
            onBack={() => setStep(2)}
            onNext={() => {
              if (!flow.validateStep(3)) return false;
              if (!belegung.isFree(von, bis, platz.value)) {
                return tx('Dieser Platz ist im gewählten Zeitraum bereits belegt.');
              }
              return true;
            }}
            nextStepLabel={tx('Preis & Notizen')}
          />
        </div>
      </WizardStep>

      <WizardStep label={tx('Preis & Notizen')} description={tx('Preis und Hinweise zur Buchung ergänzen.')} needs={['platznummer']}>
        <div className="space-y-4">
          <Bound form={f} name="preis_euro" hint={tx('Gesamtpreis in Euro, z. B. 120')} />
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
            whatHappensNext={tx('Der Platz ist für den Zeitraum belegt und der Besitzer wird aus der Hundekartei übernommen.')}
          />
        )}
      </WizardStep>

      {flow.submit.result && (
        <SuccessStep
          result={flow.submit.result}
          forms={flow.formList}
          submit={flow.submit}
          restartLabel={tx('Weiteren Aufenthalt buchen')}
          next={[
            { label: tx('Weiteren Aufenthalt buchen'), onClick: () => { flow.reset(); setStep(1); } },
            { label: tx('Pfoten-Porträt erstellen'), href: '#/intents/portraet-erstellen' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
          whatHappensNext={tx('Nach dem Aufenthalt kannst du ihn über „Aufenthalt abschließen“ beenden.')}
        />
      )}
    </IntentWizardShell>
  );
}
