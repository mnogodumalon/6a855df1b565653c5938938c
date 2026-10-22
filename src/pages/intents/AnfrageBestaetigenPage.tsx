/**
 * Anfrage bestätigen — 4-Schritt-Wizard.
 * Steps: 1) Neue Anfrage wählen → 2) Besitzer & Hund aus der Anfrage prüfen, Impfstatus ergänzen
 *        → 3) Freien Platz für den Wunschzeitraum wählen → 4) Prüfen & bestätigen.
 * Reads: buchungsanfragen, belegung_buchungen (Belegung). Writes: besitzer, hundekartei,
 *        belegung_buchungen (neu), buchungsanfragen (Status → bestätigt) — alles über den Flow-Hook.
 * Composes: IntentWizardShell, EntitySelectStep, Bound, StepNav, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Bound } from '@/components/blocks/Bound';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { fieldText, fieldDate, fieldLookup, useOccupancy, formatRange } from '@/lib/journey';
import { useAnfrageBestaetigenFlow } from '@/lib/journey/flows/AnfrageBestaetigen';
import { tx } from '@/i18n';

export default function AnfrageBestaetigenPage() {
  const [step, setStep] = useState(1);
  const flow = useAnfrageBestaetigenFlow({
    steps: { buchungsanfragen: 1, impfstatus: 2, platznummer: 3, preis_euro: 3 },
    items: {
      buchungsanfragen: r => ({
        id: r.id,
        title: `${fieldText(r, 'interessent_vorname')} ${fieldText(r, 'interessent_nachname')}`.trim(),
        subtitle: tx`${fieldText(r, 'hund_name')} · ${formatRange(fieldDate(r, 'wunsch_anreise'), fieldDate(r, 'wunsch_abreise'))}`,
        status: fieldLookup(r, 'anfrage_status') ?? undefined,
      }),
    },
  });

  const anfrage = flow.targets.buchungsanfragen.record;
  const von = anfrage ? fieldDate(anfrage, 'wunsch_anreise') : null;
  const bis = anfrage ? fieldDate(anfrage, 'wunsch_abreise') : null;
  const bookingForm = flow.forms.belegung_buchungen;
  const platz = (bookingForm.get('platznummer') as string | null) ?? null;
  const belegung = useOccupancy(flow.port, 'belegung_buchungen', { resource: platz });

  const checkPlatz = () => {
    if (!bookingForm.validate(['platznummer', 'preis_euro'])) return false;
    if (!belegung.isFree(von, bis, platz)) return tx('Dieser Platz ist im gewählten Zeitraum schon belegt.');
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
        description: tx('Eine Buchungsanfrage prüfen und daraus Besitzer, Hund und Buchung anlegen.'),
        needs: [tx('Die eingegangene Anfrage'), tx('Impfstatus des Hundes'), tx('Platznummer und Preis')],
      }}
    >
      <WizardStep label={tx('Anfrage')} description={tx('Welche Anfrage möchtest du bestätigen?')}>
        <EntitySelectStep
          {...flow.picks.buchungsanfragen.select}
          {...flow.pick('buchungsanfragen')}
          avatar="initials"
          searchPlaceholder={tx('Name oder Hund suchen …')}
        />
      </WizardStep>

      <WizardStep
        label={tx('Besitzer & Hund')}
        description={tx('Die Angaben kommen aus der Anfrage — ergänze nur den Impfstatus.')}
        needs={['buchungsanfragen']}
      >
        <div className="space-y-4">
          {anfrage && (
            <div className="grid gap-3 rounded-2xl bg-secondary p-4 text-sm sm:grid-cols-2">
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">{tx('Besitzer')}</p>
                <p className="truncate font-medium">
                  {`${fieldText(anfrage, 'interessent_vorname')} ${fieldText(anfrage, 'interessent_nachname')}`.trim()}
                </p>
                <p className="truncate text-muted-foreground">{fieldText(anfrage, 'interessent_email')}</p>
                <p className="truncate text-muted-foreground">{fieldText(anfrage, 'interessent_telefon')}</p>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">{tx('Hund')}</p>
                <p className="truncate font-medium">{fieldText(anfrage, 'hund_name')}</p>
                <p className="truncate text-muted-foreground">{fieldText(anfrage, 'hund_rasse')}</p>
              </div>
            </div>
          )}
          <Bound form={flow.forms.hundekartei} name="impfstatus" />
          <StepNav
            onBack={() => setStep(1)}
            onNext={() => flow.validateStep(2)}
            nextStepLabel={tx('Platz wählen')}
          />
        </div>
      </WizardStep>

      <WizardStep
        label={tx('Platz')}
        description={tx('Wähle einen freien Platz für den Wunschzeitraum.')}
        needs={['buchungsanfragen']}
      >
        <div className="space-y-4">
          {von && bis && (
            <p className="rounded-2xl bg-secondary p-3 text-sm">
              {tx`Wunschzeitraum: ${formatRange(von, bis)}`}
            </p>
          )}
          <Bound form={bookingForm} name="platznummer" />
          {platz && von && bis && !belegung.loading && !belegung.isFree(von, bis, platz) && (
            <p className="text-sm text-destructive">{tx('Dieser Platz ist im gewählten Zeitraum schon belegt.')}</p>
          )}
          <Bound form={bookingForm} name="preis_euro" hint={tx('Gesamtpreis in Euro')} />
          <StepNav onBack={() => setStep(2)} onNext={checkPlatz} nextStepLabel={tx('Prüfen')} />
        </div>
      </WizardStep>

      <WizardStep label={tx('Prüfen')}>
        {!flow.submit.done && (
          <SummaryStep
            forms={flow.formList}
            submit={flow.submit}
            items={[{ key: 'status', label: tx('Status der Buchung'), value: tx('Aktiv') }]}
            whatHappensNext={tx('Besitzer, Hund und Buchung werden angelegt, die Anfrage gilt danach als bestätigt.')}
          />
        )}
      </WizardStep>

      {flow.submit.result && (
        <SuccessStep
          result={flow.submit.result}
          forms={flow.formList}
          submit={flow.submit}
          whatHappensNext={tx('Die Anfrage ist bestätigt und der Platz ist für den Zeitraum reserviert.')}
          next={[
            { label: tx('Pfoten-Porträt erstellen'), href: '#/intents/portraet-erstellen' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
        />
      )}
    </IntentWizardShell>
  );
}
