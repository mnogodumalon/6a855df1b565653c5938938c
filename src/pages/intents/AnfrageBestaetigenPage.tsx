/**
 * Anfrage bestätigen — 4-Schritt-Wizard.
 * Steps: 1) Neue Anfrage wählen → 2) Besitzer und Hund prüfen/anlegen → 3) Freien Platz wählen → 4) Prüfen & bestätigen.
 * Reads: buchungsanfragen (nur Status „neu"), belegung_buchungen (Belegung). Writes: besitzer, hundekartei,
 * belegung_buchungen (Status aktiv), buchungsanfragen (Status bestätigt) — all through useAnfrageBestaetigenFlow.
 * Composes: IntentWizardShell, EntitySelectStep, Bound, Field, AvailabilityRangePicker, StepNav, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Bound } from '@/components/blocks/Bound';
import { Field } from '@/components/blocks/Field';
import { AvailabilityRangePicker } from '@/components/blocks/AvailabilityRangePicker';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { fieldText, fieldDate, fieldLookup, useOccupancy } from '@/lib/journey';
import { useAnfrageBestaetigenFlow } from '@/lib/journey/flows/AnfrageBestaetigen';
import { tx } from '@/i18n';

function shortDate(iso: string | null): string {
  return iso ? format(parseISO(iso), 'dd.MM.yyyy') : '?';
}

export default function AnfrageBestaetigenPage() {
  const [step, setStep] = useState(1);
  const flow = useAnfrageBestaetigenFlow({
    steps: {
      buchungsanfragen: 1,
      vorname: 2, nachname: 2, telefon: 2, email: 2, name: 2, rasse: 2,
      platznummer: 3, anreisedatum: 3, abreisedatum: 3, preis_euro: 3,
    },
    items: {
      buchungsanfragen: r => ({
        id: r.id,
        title: `${fieldText(r, 'interessent_vorname')} ${fieldText(r, 'interessent_nachname')}`.trim(),
        subtitle: `${fieldText(r, 'hund_name')} · ${shortDate(fieldDate(r, 'wunsch_anreise'))} – ${shortDate(fieldDate(r, 'wunsch_abreise'))}`,
        status: fieldLookup(r, 'anfrage_status') ?? undefined,
      }),
    },
  });

  const owner = flow.forms.besitzer;
  const dog = flow.forms.hundekartei;
  const stay = flow.forms.belegung_buchungen;
  const request = flow.picks.buchungsanfragen;
  const pick = flow.pick('buchungsanfragen');

  const platz = (stay.get('platznummer') as string | null) ?? null;
  const belegung = useOccupancy(flow.port, 'belegung_buchungen', { resource: platz });

  // Prefill the three forms from the picked request — the team only corrects what differs.
  const adoptRequest = (id: string) => {
    pick.onSelect(id);
    const r = request.recordOf(id);
    if (!r) return;
    owner.set('vorname', fieldText(r, 'interessent_vorname'));
    owner.set('nachname', fieldText(r, 'interessent_nachname'));
    owner.set('telefon', fieldText(r, 'interessent_telefon'));
    owner.set('email', fieldText(r, 'interessent_email'));
    dog.set('name', fieldText(r, 'hund_name'));
    dog.set('rasse', fieldText(r, 'hund_rasse'));
    stay.set('anreisedatum', fieldDate(r, 'wunsch_anreise'));
    stay.set('abreisedatum', fieldDate(r, 'wunsch_abreise'));
  };

  const checkStay = () => {
    if (!flow.validateStep(3)) return false;
    const from = stay.get('anreisedatum') as string | null;
    const to = stay.get('abreisedatum') as string | null;
    if (!belegung.isFree(from, to, platz)) return tx('Dieser Platz ist im gewählten Zeitraum schon belegt.');
    return true;
  };

  return (
    <IntentWizardShell
      title={tx('Anfrage bestätigen')}
      currentStep={step}
      onStepChange={setStep}
      forms={flow.formList}
      draftKey={flow.draftKey}
      intro={{
        description: tx('Aus einer neuen Anfrage werden Besitzer, Hund und Buchung.'),
        needs: [tx('Eine neue Buchungsanfrage'), tx('Preis für den Aufenthalt')],
      }}
    >
      <WizardStep label={tx('Anfrage')} description={tx('Welche neue Anfrage möchtest du bestätigen?')}>
        <EntitySelectStep
          {...request.select}
          {...pick}
          onSelect={adoptRequest}
          avatar="initials"
          searchPlaceholder={tx('Name oder Hund suchen …')}
          emptyText={tx('Keine neue Anfrage offen.')}
        />
      </WizardStep>

      <WizardStep
        label={tx('Besitzer & Hund')}
        description={tx('Die Daten kommen aus der Anfrage — prüfe und ergänze sie.')}
        needs={['buchungsanfragen']}
      >
        <div className="space-y-4">
          <Bound form={owner} name="vorname" />
          <Bound form={owner} name="nachname" />
          <Bound form={owner} name="telefon" />
          <Bound form={owner} name="email" />
          <Bound form={dog} name="name" />
          <Bound form={dog} name="rasse" />
          <StepNav
            onBack={() => setStep(1)}
            onNext={() => flow.validateStep(2)}
            nextStepLabel={tx('Platz wählen')}
          />
        </div>
      </WizardStep>

      <WizardStep
        label={tx('Platz')}
        description={tx('Platz wählen, dann den Zeitraum — belegte Nächte sind ausgegraut.')}
        needs={['buchungsanfragen']}
      >
        <div className="space-y-4">
          <Bound form={stay} name="platznummer" />
          <AvailabilityRangePicker
            {...stay.range('anreisedatum', 'abreisedatum', { blocked: belegung.blocked })}
          />
          <Bound form={stay} name="preis_euro" hint={tx('Gesamtpreis in Euro')} />
          <StepNav
            onBack={() => setStep(2)}
            onNext={checkStay}
            nextStepLabel={tx('Prüfen')}
          />
        </div>
      </WizardStep>

      <WizardStep label={tx('Prüfen')}>
        {!flow.submit.done && (
          <SummaryStep
            forms={flow.formList}
            submit={flow.submit}
            items={[
              { key: 'buchung_status', label: tx('Status der Buchung'), value: tx('Aktiv') },
              { key: 'anfrage_status', label: tx('Status der Anfrage'), value: tx('Bestätigt') },
            ]}
            whatHappensNext={tx('Besitzer, Hund und Buchung werden angelegt, die Anfrage gilt danach als bestätigt.')}
          />
        )}
      </WizardStep>

      {flow.submit.result && (
        <SuccessStep
          result={flow.submit.result}
          forms={flow.formList}
          submit={flow.submit}
          whatHappensNext={tx('Der Platz ist jetzt reserviert. Für den Hund kannst du gleich ein Pfoten-Porträt anlegen.')}
          next={[
            { label: tx('Pfoten-Porträt erstellen'), href: '#/intents/portraet-erstellen' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
        />
      )}
    </IntentWizardShell>
  );
}
