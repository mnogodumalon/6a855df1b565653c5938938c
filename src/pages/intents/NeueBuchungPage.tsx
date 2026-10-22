/**
 * Neue Buchung — 4-Schritt-Wizard.
 * Steps: 1) Besitzer wählen oder neu anlegen → 2) Hund wählen oder neu anlegen → 3) Platz und Zeitraum
 * (Doppelbelegung wird geprüft) → 4) Prüfen & Buchung speichern (Status startet als „Aktiv“).
 * Reads: besitzer, hundekartei, belegung_buchungen (Belegung). Writes: besitzer (nur bei neuem Besitzer),
 * hundekartei (nur bei neuem Hund), belegung_buchungen (useNeueBuchungFlow).
 * Composes: IntentWizardShell, EntitySelectStep, ChoiceGroup, Bound, AvailabilityRangePicker, StepNav, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { IconAlertTriangle } from '@tabler/icons-react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { ChoiceGroup } from '@/components/blocks/ChoiceGroup';
import { Bound } from '@/components/blocks/Bound';
import { Field } from '@/components/blocks/Field';
import { AvailabilityRangePicker } from '@/components/blocks/AvailabilityRangePicker';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { fieldText, useOccupancy } from '@/lib/journey';
import { useNeueBuchungFlow } from '@/lib/journey/flows/NeueBuchung';
import { tx } from '@/i18n';

type Mode = 'existing' | 'new';

export default function NeueBuchungPage() {
  const [step, setStep] = useState(1);
  const [ownerChoice, setOwnerChoice] = useState<Mode | null>(null);
  const [dogChoice, setDogChoice] = useState<Mode | null>(null);

  const flow = useNeueBuchungFlow({
    steps: {
      besitzer: 1, vorname: 1, nachname: 1, telefon: 1, email: 1,
      hund: 2, name: 2, rasse: 2,
      anreisedatum: 3, abreisedatum: 3, platznummer: 3,
    },
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

  const { besitzer: besitzerForm, hundekartei: hundForm, belegung_buchungen: buchung } = flow.forms;
  const platz = (buchung.get('platznummer') as string | undefined) ?? null;
  const belegung = useOccupancy(flow.port, 'belegung_buchungen', { resource: platz });

  const ownerFilled = besitzerForm.keys.some(k => Boolean(besitzerForm.get(k)));
  const dogFilled = hundForm.keys.some(k => k !== 'besitzer' && Boolean(hundForm.get(k)));
  const ownerMode: Mode = ownerChoice ?? (ownerFilled ? 'new' : 'existing');
  const dogMode: Mode = dogChoice ?? (dogFilled ? 'new' : 'existing');

  const ownerId = (buchung.get('besitzer') as string | undefined) ?? null;
  const from = buchung.get('anreisedatum') as string | undefined;
  const to = buchung.get('abreisedatum') as string | undefined;
  const conflict = Boolean(platz && from && to && !belegung.loading && !belegung.isFree(from, to, platz));
  const conflictText = tx('Dieser Platz ist im gewählten Zeitraum bereits belegt.');

  const modeOptions = [
    { key: 'existing', label: tx('Aus der Kartei wählen') },
    { key: 'new', label: tx('Neu anlegen') },
  ];

  const pickOwner = (id: string) => {
    const label = flow.picks.besitzer.labelOf(id);
    (buchung.set as (k: string, v: unknown, l?: string) => void)('besitzer', id, label);
    (hundForm.set as (k: string, v: unknown, l?: string) => void)('besitzer', id, label);
  };

  const changeOwnerMode = (m: Mode) => {
    setOwnerChoice(m);
    if (m === 'existing') besitzerForm.reset();
  };

  const changeDogMode = (m: Mode) => {
    setDogChoice(m);
    if (m === 'existing') {
      hundForm.reset();
    } else if (ownerId) {
      (hundForm.set as (k: string, v: unknown, l?: string) => void)('besitzer', ownerId, flow.picks.besitzer.labelOf(ownerId));
    }
  };

  const nextFromOwner = () => {
    if (ownerMode === 'new') return besitzerForm.validate(['vorname', 'nachname']);
    return ownerId ? true : tx('Bitte einen Besitzer auswählen oder neu anlegen.');
  };

  const nextFromDog = () => {
    if (dogMode === 'new') return hundForm.validate(['name']);
    return buchung.get('hund') ? true : tx('Bitte einen Hund auswählen oder neu anlegen.');
  };

  const nextFromStay = () => {
    if (!buchung.validate(['platznummer', 'anreisedatum', 'abreisedatum'])) return false;
    if (belegung.loading) return tx('Die Belegung wird noch geladen — einen Moment bitte.');
    if (!belegung.isFree(from, to, platz)) return conflictText;
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
        description: tx('Besitzer, Hund, Platz und Zeitraum — ohne Doppelbelegung.'),
        needs: [tx('Name des Besitzers'), tx('Name des Hundes'), tx('Anreise und Abreise')],
      }}
    >
      <WizardStep label={tx('Besitzer')} description={tx('Wer bringt den Hund? Wähle einen bekannten Besitzer oder lege einen neuen an.')}>
        <div className="space-y-4">
          <ChoiceGroup id="besitzer-mode" value={ownerMode} onChange={k => changeOwnerMode((k as Mode) ?? 'existing')} options={modeOptions} />
          {ownerMode === 'existing' ? (
            <EntitySelectStep
              {...flow.picks.besitzer.select}
              selectedId={ownerId}
              onSelect={pickOwner}
              avatar="initials"
              searchPlaceholder={tx('Name oder Telefon suchen …')}
            />
          ) : (
            <div className="space-y-4">
              <Bound form={besitzerForm} name="vorname" />
              <Bound form={besitzerForm} name="nachname" />
              <Bound form={besitzerForm} name="telefon" />
              <Bound form={besitzerForm} name="email" />
            </div>
          )}
          <StepNav hideBack onNext={nextFromOwner} nextStepLabel={tx('Hund')} />
        </div>
      </WizardStep>

      <WizardStep label={tx('Hund')} description={tx('Welcher Hund kommt? Wähle einen bekannten Hund oder lege ihn neu an.')}>
        <div className="space-y-4">
          <ChoiceGroup id="hund-mode" value={dogMode} onChange={k => changeDogMode((k as Mode) ?? 'existing')} options={modeOptions} />
          {dogMode === 'existing' ? (
            <EntitySelectStep
              {...flow.picks.hund.select}
              {...flow.pick('hund')}
              avatar="initials"
              searchPlaceholder={tx('Name oder Rasse suchen …')}
            />
          ) : (
            <div className="space-y-4">
              <Bound form={hundForm} name="name" />
              <Bound form={hundForm} name="rasse" />
            </div>
          )}
          <StepNav onBack={() => setStep(1)} onNext={nextFromDog} nextStepLabel={tx('Platz und Zeitraum')} />
        </div>
      </WizardStep>

      <WizardStep label={tx('Zeitraum & Platz')} description={tx('Erst den Platz, dann An- und Abreise — belegte Nächte sind ausgegraut.')}>
        <div className="space-y-4">
          <Bound form={buchung} name="platznummer" />
          {platz ? (
            <Field form={buchung} name="anreisedatum" hideLabel>
              <AvailabilityRangePicker
                {...buchung.range('anreisedatum', 'abreisedatum', { blocked: belegung.blocked })}
                blocked={belegung.blocked}
              />
            </Field>
          ) : (
            <p className="text-sm text-muted-foreground">{tx('Wähle zuerst einen Platz, dann erscheint der Kalender mit den freien Nächten.')}</p>
          )}
          {conflict && (
            <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
              <IconAlertTriangle size={16} className="shrink-0" />
              {conflictText}
            </p>
          )}
          <StepNav onBack={() => setStep(2)} onNext={nextFromStay} nextStepLabel={tx('Prüfen')} />
        </div>
      </WizardStep>

      <WizardStep label={tx('Prüfen')}>
        {!flow.submit.done && (
          conflict ? (
            <div className="space-y-4">
              <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
                <IconAlertTriangle size={16} className="shrink-0" />
                {conflictText}
              </p>
              <StepNav onBack={() => setStep(3)} nextDisabled />
            </div>
          ) : (
            <SummaryStep
              forms={flow.formList}
              submit={flow.submit}
              whatHappensNext={tx('Die Buchung startet als „Aktiv“. Neue Besitzer und Hunde werden dabei gleich mit angelegt.')}
            />
          )
        )}
      </WizardStep>

      {flow.submit.result && (
        <SuccessStep
          result={flow.submit.result}
          forms={flow.formList}
          submit={flow.submit}
          next={[
            { label: tx('Zum Check-in und Check-out'), href: '#/intents/check-in-check-out' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
        />
      )}
    </IntentWizardShell>
  );
}
