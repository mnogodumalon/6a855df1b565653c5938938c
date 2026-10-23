/**
 * Anfrage bestätigen — 5-Schritt-Wizard.
 * Steps: 1) Offene Anfrage wählen → 2) Besitzer prüfen (wird angelegt) → 3) Hund prüfen (wird angelegt)
 *        → 4) Platz und Preis wählen → 5) Prüfen & Buchung speichern, Anfrage bestätigen.
 * Reads: buchungsanfragen (nur Status "neu"), belegung_buchungen (Platzprüfung).
 * Writes: besitzer, hundekartei, belegung_buchungen (anlegen), buchungsanfragen (Status → bestätigt) — alles über useAnfrageBestaetigenFlow.
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
import { fieldText, fieldDate, fieldLookup } from '@/lib/journey';
import { useAnfrageBestaetigenFlow } from '@/lib/journey/flows/AnfrageBestaetigen';
import { tx } from '@/i18n';

function day(iso: string | null | undefined): string {
  return iso ? format(parseISO(iso), 'dd.MM.yyyy') : '—';
}

function FactList({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className="grid grid-cols-1 gap-2 rounded-2xl bg-secondary p-4 text-sm sm:grid-cols-[10rem_1fr]">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="min-w-0 break-words font-medium text-foreground">{value || '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function AnfrageBestaetigenPage() {
  const [step, setStep] = useState(1);
  const flow = useAnfrageBestaetigenFlow({
    steps: { buchungsanfragen: 1, platznummer: 4, preis_euro: 4 },
    items: {
      buchungsanfragen: r => ({
        id: r.id,
        title: `${fieldText(r, 'interessent_vorname')} ${fieldText(r, 'interessent_nachname')}`.trim(),
        subtitle: `${fieldText(r, 'hund_name')} · ${day(fieldDate(r, 'wunsch_anreise'))} – ${day(fieldDate(r, 'wunsch_abreise'))}`,
      }),
    },
  });

  const anfrage = flow.targets.buchungsanfragen.record;
  const buchung = flow.forms.belegung_buchungen;
  const von = anfrage ? fieldDate(anfrage, 'wunsch_anreise') : null;
  const bis = anfrage ? fieldDate(anfrage, 'wunsch_abreise') : null;

  // Platz frei im Zeitraum? Gelesen über die Tür des Flows; stornierte Buchungen belegen nichts.
  const checkPlatz = async (): Promise<boolean | string> => {
    if (!flow.validateStep(4)) return false;
    const platz = buchung.get('platznummer');
    if (!von || !bis || typeof platz !== 'string') return true;
    const alle = await flow.port.list('belegung_buchungen', { limit: 1000 });
    const belegt = alle.some(b => {
      if (fieldLookup(b, 'platznummer')?.key !== platz) return false;
      if (fieldLookup(b, 'status')?.key === 'storniert') return false;
      const a = fieldDate(b, 'anreisedatum');
      const z = fieldDate(b, 'abreisedatum');
      return !!a && !!z && a < bis && von < z;
    });
    return belegt ? tx('Dieser Platz ist im gewählten Zeitraum bereits belegt.') : true;
  };

  const missing = (
    <StepNav onBack={() => setStep(1)} nextDisabled hideBack={false}>
      {tx('Dieser Schritt braucht die Auswahl aus Schritt 1.')}
    </StepNav>
  );

  return (
    <IntentWizardShell
      title={tx('Anfrage bestätigen')}
      currentStep={step}
      onStepChange={setStep}
      forms={flow.formList}
      draftKey={flow.draftKey}
      intro={{
        description: tx('Eine neue Buchungsanfrage prüfen und daraus Besitzer, Hund und Buchung anlegen.'),
        needs: [tx('Eine offene Anfrage'), tx('Platznummer'), tx('Preis')],
      }}
    >
      <WizardStep label={tx('Anfrage')} description={tx('Welche offene Anfrage möchtest du bestätigen?')}>
        <EntitySelectStep
          {...flow.picks.buchungsanfragen.select}
          {...flow.pick('buchungsanfragen')}
          avatar="initials"
          searchPlaceholder={tx('Name oder Hund suchen …')}
          emptyText={tx('Keine offene Anfrage vorhanden.')}
        />
      </WizardStep>

      <WizardStep label={tx('Besitzer')} description={tx('Diese Kontaktdaten werden als neuer Besitzer angelegt.')}>
        {anfrage ? (
          <div className="space-y-4">
            <FactList rows={[
              [tx('Vorname'), fieldText(anfrage, 'interessent_vorname')],
              [tx('Nachname'), fieldText(anfrage, 'interessent_nachname')],
              [tx('E-Mail'), fieldText(anfrage, 'interessent_email')],
              [tx('Telefon'), fieldText(anfrage, 'interessent_telefon')],
            ]} />
            <StepNav onBack={() => setStep(1)} onNext={() => setStep(3)} nextStepLabel={tx('Hund')} />
          </div>
        ) : missing}
      </WizardStep>

      <WizardStep label={tx('Hund')} description={tx('Dieser Hund wird in der Hundekartei angelegt.')}>
        {anfrage ? (
          <div className="space-y-4">
            <FactList rows={[
              [tx('Name'), fieldText(anfrage, 'hund_name')],
              [tx('Rasse'), fieldText(anfrage, 'hund_rasse')],
              [tx('Größe'), fieldLookup(anfrage, 'hund_groesse')?.label ?? ''],
            ]} />
            <StepNav onBack={() => setStep(2)} onNext={() => setStep(4)} nextStepLabel={tx('Platz und Preis')} />
          </div>
        ) : missing}
      </WizardStep>

      <WizardStep label={tx('Platz und Preis')} description={tx('Freien Platz für den Aufenthalt wählen und den Preis festlegen.')}>
        {anfrage ? (
          <div className="space-y-4">
            <FactList rows={[[tx('Zeitraum'), `${day(von)} – ${day(bis)}`]]} />
            <Bound form={buchung} name="platznummer" />
            <Bound form={buchung} name="preis_euro" hint={tx('In Euro, z. B. 240')} />
            <StepNav onBack={() => setStep(3)} onNext={checkPlatz} nextStepLabel={tx('Prüfen')} />
          </div>
        ) : missing}
      </WizardStep>

      <WizardStep label={tx('Prüfen')}>
        {!flow.submit.done && (
          <SummaryStep
            forms={flow.formList}
            submit={flow.submit}
            items={anfrage ? [
              { key: 'zeitraum', label: tx('Zeitraum'), value: `${day(von)} – ${day(bis)}` },
              { key: 'besitzer', label: tx('Neuer Besitzer'), value: `${fieldText(anfrage, 'interessent_vorname')} ${fieldText(anfrage, 'interessent_nachname')}`.trim() },
              { key: 'hund', label: tx('Neuer Hund'), value: fieldText(anfrage, 'hund_name') },
            ] : undefined}
            whatHappensNext={tx('Besitzer, Hund und Buchung werden angelegt und die Anfrage wird als bestätigt markiert.')}
          />
        )}
      </WizardStep>

      {flow.submit.result && (
        <SuccessStep
          result={flow.submit.result}
          forms={flow.formList}
          submit={flow.submit}
          whatHappensNext={tx('Für den Hund kannst du jetzt ein Pfoten-Porträt erstellen.')}
          next={[
            { label: tx('Pfoten-Porträt erstellen'), href: '#/intents/portraet-erstellen' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
        />
      )}
    </IntentWizardShell>
  );
}
