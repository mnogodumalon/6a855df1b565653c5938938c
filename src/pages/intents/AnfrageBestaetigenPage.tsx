/**
 * Anfrage bestätigen — 4-Schritt-Wizard.
 * Steps: 1) Neue Anfrage wählen → 2) Besitzer-/Hundedaten prüfen & ergänzen → 3) Platz wählen & Überschneidung prüfen → 4) Prüfen & anlegen.
 * Reads: buchungsanfragen, belegung_buchungen (Belegung). Writes: besitzer, hundekartei, belegung_buchungen (create), buchungsanfragen (update → bestätigt).
 * Composes: IntentWizardShell, EntitySelectStep, Bound, StepNav, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Bound } from '@/components/blocks/Bound';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { fieldText, fieldDate, fieldLookup, useOccupancy } from '@/lib/journey';
import { useAnfrageBestaetigenFlow } from '@/lib/journey/flows/AnfrageBestaetigen';
import { tx } from '@/i18n';

export default function AnfrageBestaetigenPage() {
  const [step, setStep] = useState(1);
  const flow = useAnfrageBestaetigenFlow({
    steps: { buchungsanfragen: 1, impfstatus: 2, gewicht_kg: 2, platznummer: 3, preis_euro: 3 },
    items: {
      buchungsanfragen: r => {
        const von = fieldDate(r, 'wunsch_anreise');
        const bis = fieldDate(r, 'wunsch_abreise');
        return {
          id: r.id,
          title: `${fieldText(r, 'interessent_vorname')} ${fieldText(r, 'interessent_nachname')}`.trim(),
          subtitle: `${fieldText(r, 'hund_name')} · ${von ? format(parseISO(von), 'dd.MM.yyyy') : '?'} – ${bis ? format(parseISO(bis), 'dd.MM.yyyy') : '?'}`,
          status: fieldLookup(r, 'anfrage_status') ?? undefined,
        };
      },
    },
  });

  const anfrageId = flow.pick('buchungsanfragen').selectedId as string | null | undefined;
  const anfrage = anfrageId ? flow.picks.buchungsanfragen.recordOf(anfrageId) : undefined;
  const von = anfrage ? fieldDate(anfrage, 'wunsch_anreise') : null;
  const bis = anfrage ? fieldDate(anfrage, 'wunsch_abreise') : null;
  const platz = flow.forms.belegung_buchungen.get('platznummer') as string | null | undefined;
  const belegung = useOccupancy(flow.port, 'belegung_buchungen', { resource: platz ?? null });

  const fmt = (iso: string | null) => (iso ? format(parseISO(iso), 'dd.MM.yyyy') : '—');
  const overlapMessage = tx('Dieser Platz ist im gewählten Zeitraum bereits belegt.');

  const checkStep3 = () => {
    if (!flow.validateStep(3)) return false;
    if (!belegung.isFree(von, bis, platz)) return overlapMessage;
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
        description: tx('Eine Buchungsanfrage zusagen und Besitzer, Hund und Aufenthalt anlegen.'),
        needs: [tx('Die neue Anfrage'), tx('Impfstatus und Gewicht des Hundes'), tx('Platznummer und Preis')],
      }}
    >
      <WizardStep label={tx('Anfrage')} description={tx('Welche Anfrage möchtest du zusagen?')}>
        <EntitySelectStep
          {...flow.picks.buchungsanfragen.select}
          {...flow.pick('buchungsanfragen')}
          avatar="initials"
          searchPlaceholder={tx('Name oder Hund suchen …')}
        />
      </WizardStep>

      <WizardStep
        label={tx('Daten')}
        description={tx('Die Angaben aus der Anfrage werden übernommen — ergänze Impfstatus und Gewicht.')}
        needs={['buchungsanfragen']}
      >
        <div className="space-y-4">
          {anfrage && (
            <div className="rounded-xl border bg-secondary/40 p-4 text-sm space-y-1 overflow-hidden">
              <p className="font-medium truncate">
                {fieldText(anfrage, 'interessent_vorname')} {fieldText(anfrage, 'interessent_nachname')}
              </p>
              <p className="text-muted-foreground truncate">
                {[fieldText(anfrage, 'interessent_email'), fieldText(anfrage, 'interessent_telefon')].filter(Boolean).join(' · ')}
              </p>
              <p className="truncate">
                {fieldText(anfrage, 'hund_name')}
                {fieldText(anfrage, 'hund_rasse') ? ` (${fieldText(anfrage, 'hund_rasse')})` : ''}
                {fieldLookup(anfrage, 'hund_groesse') ? ` · ${fieldLookup(anfrage, 'hund_groesse')?.label}` : ''}
              </p>
              <p className="text-muted-foreground">{tx`Wunschzeitraum: ${fmt(von)} – ${fmt(bis)}`}</p>
              {fieldText(anfrage, 'nachricht') && (
                <p className="text-muted-foreground line-clamp-3">{fieldText(anfrage, 'nachricht')}</p>
              )}
            </div>
          )}
          <Bound form={flow.forms.hundekartei} name="impfstatus" />
          <Bound form={flow.forms.hundekartei} name="gewicht_kg" />
          <StepNav
            onBack={() => setStep(1)}
            onNext={() => flow.validateStep(2)}
            nextStepLabel={tx('Platz wählen')}
          />
        </div>
      </WizardStep>

      <WizardStep
        label={tx('Platz')}
        description={tx('Platz und Preis festlegen — belegte Plätze im Wunschzeitraum werden geprüft.')}
        needs={['buchungsanfragen']}
      >
        <div className="space-y-4">
          {von && bis && (
            <p className="text-sm text-muted-foreground">{tx`Aufenthalt: ${fmt(von)} – ${fmt(bis)}`}</p>
          )}
          <Bound form={flow.forms.belegung_buchungen} name="platznummer" />
          <Bound form={flow.forms.belegung_buchungen} name="preis_euro" />
          <StepNav
            onBack={() => setStep(2)}
            onNext={checkStep3}
            nextStepLabel={tx('Prüfen')}
          />
        </div>
      </WizardStep>

      <WizardStep label={tx('Prüfen')} description={tx('Alles richtig? Dann werden die Datensätze angelegt.')}>
        {!flow.submit.done && (
          <SummaryStep
            forms={flow.formList}
            submit={flow.submit}
            items={[
              {
                key: 'besitzer-name',
                label: tx('Besitzer'),
                value: anfrage
                  ? `${fieldText(anfrage, 'interessent_vorname')} ${fieldText(anfrage, 'interessent_nachname')}`.trim()
                  : '—',
              },
              { key: 'hund-name', label: tx('Hund'), value: anfrage ? fieldText(anfrage, 'hund_name') || '—' : '—' },
              { key: 'zeitraum', label: tx('Zeitraum'), value: `${fmt(von)} – ${fmt(bis)}` },
              { key: 'anfrage-status', label: tx('Status der Anfrage'), value: tx('Bestätigt') },
            ]}
            whatHappensNext={tx('Besitzer, Hund und Aufenthalt werden angelegt, die Anfrage steht danach auf bestätigt.')}
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
          whatHappensNext={tx('Besitzer, Hund und Aufenthalt sind angelegt.')}
        />
      )}
    </IntentWizardShell>
  );
}
