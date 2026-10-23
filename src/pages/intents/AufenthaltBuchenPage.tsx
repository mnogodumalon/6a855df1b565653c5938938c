/**
 * Aufenthalt buchen — 4-Schritt-Wizard.
 * Steps: 1) Besitzer wählen oder neu anlegen → 2) Hund wählen oder neu anlegen → 3) Platz und Zeitraum wählen → 4) Preis eintragen → Prüfen & speichern.
 * Reads: besitzer, hundekartei, belegung_buchungen (Belegung per Platz). Writes: besitzer, hundekartei (nur bei Neuanlage), belegung_buchungen.
 * Composes: IntentWizardShell, EntitySelectStep, ChoiceGroup, AvailabilityRangePicker, Bound, StepNav, SummaryStep, SuccessStep.
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
import { lookupOption } from '@/types/app';
import { tx } from '@/i18n';

export default function AufenthaltBuchenPage() {
  const [step, setStep] = useState(1);
  const flow = useAufenthaltBuchenFlow({
    steps: {
      besitzer: 1, hund: 2,
      platznummer: 3, anreisedatum: 3, abreisedatum: 3,
      preis_euro: 4, notizen: 4,
    },
    items: {
      besitzer: r => ({
        id: r.id,
        title: `${fieldText(r, 'vorname')} ${fieldText(r, 'nachname')}`.trim(),
        subtitle: fieldText(r, 'telefon') || fieldText(r, 'email'),
      }),
      hund: (r, ctx) => ({
        id: r.id,
        title: fieldText(r, 'name'),
        subtitle: [fieldText(r, 'rasse'), ctx.ref('besitzer')].filter(Boolean).join(' · '),
      }),
    },
  });

  const booking = flow.forms.belegung_buchungen;
  const platz = booking.get('platznummer') as string | null;
  const von = booking.get('anreisedatum') as string | null;
  const bis = booking.get('abreisedatum') as string | null;
  const besitzerId = flow.forms.hundekartei.get('besitzer') as string | null;

  const belegung = useOccupancy(flow.port, 'belegung_buchungen', { resource: platz });

  const checkStay = () => {
    if (!booking.validate(['platznummer', 'anreisedatum', 'abreisedatum'])) return false;
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
        description: tx('Besitzer, Hund, Platz und Zeitraum festlegen und die Buchung ohne Überschneidung speichern.'),
        needs: [tx('Name des Besitzers'), tx('Name des Hundes'), tx('Anreise- und Abreisedatum')],
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

      <WizardStep label={tx('Hund')} description={tx('Wähle den Hund aus oder lege einen neuen an.')}>
        <EntitySelectStep
          {...flow.picks.hund.select}
          {...flow.pick('hund')}
          avatar="none"
          searchPlaceholder={tx('Hundename suchen …')}
          create={{ fields: ['name', 'rasse', 'impfstatus'], initial: besitzerId ? { besitzer: besitzerId } : undefined }}
        />
      </WizardStep>

      <WizardStep label={tx('Platz & Zeitraum')} description={tx('Erst den Platz wählen, dann An- und Abreise — belegte Nächte sind ausgegraut.')} needs={['hund']}>
        <div className="space-y-5">
          <Field form={booking} name="platznummer">
            <ChoiceGroup {...booking.choice('platznummer')} />
          </Field>
          {platz ? (
            <AvailabilityRangePicker
              {...booking.range('anreisedatum', 'abreisedatum', { blocked: belegung.blocked })}
            />
          ) : (
            <p className="text-sm text-muted-foreground">{tx('Wähle zuerst einen Platz, dann siehst du, wann er frei ist.')}</p>
          )}
          <StepNav onBack={() => setStep(2)} onNext={checkStay} nextStepLabel={tx('Preis')} />
        </div>
      </WizardStep>

      <WizardStep label={tx('Preis')} description={tx('Preis eintragen und bei Bedarf eine Notiz zur Buchung hinzufügen.')} needs={['platznummer', 'anreisedatum', 'abreisedatum']}>
        <div className="space-y-4">
          <Bound form={booking} name="preis_euro" hint={tx('Gesamtpreis in Euro, z. B. 140')} />
          <Bound form={booking} name="notizen" rows={3} />
          <StepNav
            onBack={() => setStep(3)}
            onNext={() => booking.validate(['preis_euro', 'notizen'])}
            nextStepLabel={tx('Prüfen')}
          />
        </div>
      </WizardStep>

      <WizardStep label={tx('Prüfen')}>
        {!flow.submit.done && (
          <SummaryStep
            forms={flow.formList}
            submit={flow.submit}
            items={[{ key: 'status', label: tx('Status'), value: lookupOption('belegung_buchungen', 'status', 'aktiv')?.label ?? tx('Aktiv') }]}
            whatHappensNext={tx('Die Buchung belegt den Platz sofort im gewählten Zeitraum.')}
          />
        )}
      </WizardStep>

      {flow.submit.result && (
        <SuccessStep
          result={flow.submit.result}
          forms={flow.formList}
          submit={flow.submit}
          whatHappensNext={tx('Nach dem Aufenthalt kannst du ihn abschließen oder ein Pfoten-Porträt erstellen.')}
          next={[
            { label: tx('Pfoten-Porträt erstellen'), href: '#/intents/portraet-erstellen' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
        />
      )}
    </IntentWizardShell>
  );
}
