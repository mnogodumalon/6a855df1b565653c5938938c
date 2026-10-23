/**
 * Anfrage bestätigen — 4-Schritt-Wizard.
 * Steps: 1) Neue Anfrage wählen → 2) Besitzer und Hund anlegen → 3) Freien Platz wählen → 4) Prüfen & bestätigen.
 * Reads: buchungsanfragen (Pick), belegung_buchungen (Belegung). Writes: besitzer, hundekartei, belegung_buchungen (create), buchungsanfragen (update).
 * Composes: IntentWizardShell, EntitySelectStep, Bound, Field, ChoiceGroup, AvailabilityRangePicker, StepNav, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Bound } from '@/components/blocks/Bound';
import { Field } from '@/components/blocks/Field';
import { ChoiceGroup } from '@/components/blocks/ChoiceGroup';
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
      vorname: 2, nachname: 2, email: 2, telefon: 2, name: 2, rasse: 2,
      platznummer: 3, anreisedatum: 3, abreisedatum: 3,
    },
    items: {
      buchungsanfragen: r => ({
        id: r.id,
        title: `${fieldText(r, 'interessent_vorname')} ${fieldText(r, 'interessent_nachname')}`.trim(),
        subtitle: tx`${fieldText(r, 'hund_name')} · ${shortDate(fieldDate(r, 'wunsch_anreise'))} – ${shortDate(fieldDate(r, 'wunsch_abreise'))}`,
        status: fieldLookup(r, 'anfrage_status') ?? undefined,
      }),
    },
  });

  const { besitzer, hundekartei, belegung_buchungen: buchung } = flow.forms;
  const anfrageSearch = flow.picks.buchungsanfragen;
  const anfragePick = flow.pick('buchungsanfragen');
  const anfrage = anfragePick.selectedId ? anfrageSearch.recordOf(anfragePick.selectedId) : undefined;

  const platz = (buchung.get('platznummer') as string | null) ?? null;
  const belegung = useOccupancy(flow.port, 'belegung_buchungen', { resource: platz });

  // The request's data seeds the three forms the person then checks and corrects.
  const prefill = (id: string) => {
    const r = anfrageSearch.recordOf(id);
    if (!r) return;
    besitzer.set('vorname', fieldText(r, 'interessent_vorname'));
    besitzer.set('nachname', fieldText(r, 'interessent_nachname'));
    besitzer.set('email', fieldText(r, 'interessent_email'));
    besitzer.set('telefon', fieldText(r, 'interessent_telefon'));
    hundekartei.set('name', fieldText(r, 'hund_name'));
    hundekartei.set('rasse', fieldText(r, 'hund_rasse'));
    buchung.set('anreisedatum', fieldDate(r, 'wunsch_anreise'));
    buchung.set('abreisedatum', fieldDate(r, 'wunsch_abreise'));
  };

  const checkPlatz = () => {
    if (!flow.validateStep(3)) return false;
    const from = buchung.get('anreisedatum') as string | null;
    const to = buchung.get('abreisedatum') as string | null;
    if (!belegung.isFree(from, to, platz)) {
      return tx('Dieser Platz ist im gewählten Zeitraum bereits belegt.');
    }
    return true;
  };

  const from = buchung.get('anreisedatum') as string | null;
  const to = buchung.get('abreisedatum') as string | null;
  const platzBelegt = Boolean(platz && from && to && !belegung.isFree(from, to, platz));

  return (
    <IntentWizardShell
      title={tx('Anfrage bestätigen')}
      currentStep={step}
      onStepChange={setStep}
      forms={flow.formList}
      draftKey={flow.draftKey}
      intro={{
        description: tx('Neue Anfrage prüfen, Besitzer und Hund anlegen und einen freien Platz buchen.'),
        needs: [tx('Eine neue Buchungsanfrage'), tx('Kenntnis der freien Plätze')],
      }}
    >
      <WizardStep label={tx('Anfrage')} description={tx('Welche neue Anfrage möchtest du bestätigen?')}>
        <EntitySelectStep
          {...anfrageSearch.select}
          selectedId={anfragePick.selectedId}
          onSelect={id => { anfragePick.onSelect(id); prefill(id); }}
          avatar="initials"
          searchPlaceholder={tx('Nachname oder Hundename …')}
          emptyText={tx('Es gibt keine neue Anfrage, die auf eine Bestätigung wartet.')}
        />
      </WizardStep>

      <WizardStep
        label={tx('Besitzer & Hund')}
        heading={tx('Besitzer und Hund anlegen')}
        description={tx('Die Angaben stammen aus der Anfrage — prüfe und ergänze sie.')}
        needs={['buchungsanfragen']}
      >
        <div className="space-y-6">
          {anfrage && fieldText(anfrage, 'nachricht') && (
            <div className="rounded-2xl bg-secondary p-4 text-sm">
              <p className="mb-1 font-medium">{tx('Nachricht aus der Anfrage')}</p>
              <p className="text-muted-foreground whitespace-pre-line">{fieldText(anfrage, 'nachricht')}</p>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Bound form={besitzer} name="vorname" />
            <Bound form={besitzer} name="nachname" />
            <Bound form={besitzer} name="email" />
            <Bound form={besitzer} name="telefon" />
            <Bound form={hundekartei} name="name" />
            <Bound form={hundekartei} name="rasse" />
          </div>
          <StepNav
            onBack={() => setStep(1)}
            onNext={() => flow.validateStep(2)}
            nextStepLabel={tx('Platz wählen')}
          />
        </div>
      </WizardStep>

      <WizardStep
        label={tx('Platz')}
        heading={tx('Freien Platz wählen')}
        description={tx('Platz und Zeitraum festlegen — belegte Nächte sind ausgegraut.')}
        needs={['buchungsanfragen']}
      >
        <div className="space-y-6">
          <Field form={buchung} name="platznummer">
            <ChoiceGroup {...buchung.choice('platznummer')} />
          </Field>
          {platz ? (
            <AvailabilityRangePicker
              {...buchung.range('anreisedatum', 'abreisedatum', { blocked: belegung.blocked })}
            />
          ) : (
            <p className="text-sm text-muted-foreground">{tx('Wähle zuerst einen Platz, dann siehst du seine freien Nächte.')}</p>
          )}
          {platzBelegt && (
            <p className="text-sm text-destructive">{tx('Dieser Platz ist im gewählten Zeitraum bereits belegt.')}</p>
          )}
          <StepNav
            onBack={() => setStep(2)}
            onNext={checkPlatz}
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
          title={tx('Anfrage bestätigt')}
          next={[
            { label: tx('Pfoten-Porträt erstellen'), href: '#/intents/portraet-erstellen' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
          whatHappensNext={tx('Der Platz ist für den Zeitraum reserviert. Zum Aufenthalt kannst du ein Pfoten-Porträt anlegen.')}
        />
      )}
    </IntentWizardShell>
  );
}
