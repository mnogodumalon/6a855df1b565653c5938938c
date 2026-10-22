/**
 * Buchungsanfrage bearbeiten — 4-Schritt-Wizard.
 * Steps: 1) Offene Anfrage wählen → 2) Anfrage ansehen → 3) Annehmen oder ablehnen → 4) Prüfen & speichern.
 * Reads: buchungsanfragen. Writes: buchungsanfragen (anfrage_status, über den Flow-Hook).
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
import { fieldText, fieldLookup, fieldDate } from '@/lib/journey';
import type { JourneyRecord } from '@/lib/journey';
import { useBuchungsanfrageBearbeitenFlow } from '@/lib/journey/flows/BuchungsanfrageBearbeiten';
import { tx } from '@/i18n';

function dateText(iso: string | null): string {
  if (!iso) return '—';
  try {
    return format(parseISO(iso), 'dd.MM.yyyy');
  } catch {
    return iso;
  }
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
      <dt className="text-sm text-muted-foreground sm:w-40 sm:shrink-0">{label}</dt>
      <dd className="min-w-0 break-words text-sm font-medium">{value || '—'}</dd>
    </div>
  );
}

export default function BuchungsanfrageBearbeitenPage() {
  const [step, setStep] = useState(1);
  const flow = useBuchungsanfrageBearbeitenFlow({
    steps: { buchungsanfragen: 1, anfrage_status: 3 },
    items: {
      buchungsanfragen: r => ({
        id: r.id,
        title: `${fieldText(r, 'interessent_vorname')} ${fieldText(r, 'interessent_nachname')}`.trim(),
        subtitle: `${fieldText(r, 'hund_name')} · ${dateText(fieldDate(r, 'wunsch_anreise'))} – ${dateText(fieldDate(r, 'wunsch_abreise'))}`,
      }),
    },
  });

  const form = flow.forms.buchungsanfragen;
  const record = flow.targets.buchungsanfragen?.record as JourneyRecord | undefined;

  return (
    <IntentWizardShell
      title={tx('Buchungsanfrage bearbeiten')}
      currentStep={step}
      onStepChange={setStep}
      forms={flow.formList}
      draftKey={flow.draftKey}
      intro={{
        description: tx('Eine offene Anfrage prüfen und annehmen oder ablehnen.'),
        needs: [tx('Eine offene Buchungsanfrage')],
      }}
    >
      <WizardStep label={tx('Anfrage')} description={tx('Welche offene Anfrage möchtest du bearbeiten?')}>
        <EntitySelectStep
          {...flow.picks.buchungsanfragen.select}
          {...flow.pick('buchungsanfragen')}
          avatar="initials"
          searchPlaceholder={tx('Name oder Hund suchen …')}
          emptyText={tx('Es gibt keine offenen Anfragen — alles ist bearbeitet.')}
        />
      </WizardStep>

      <WizardStep label={tx('Ansehen')} description={tx('Das möchte die Person — lies die Anfrage in Ruhe durch.')}>
        {record ? (
          <div className="space-y-4">
            <dl className="space-y-3 overflow-hidden rounded-2xl bg-card p-4 shadow-lg">
              <Row
                label={tx('Interessent')}
                value={`${fieldText(record, 'interessent_vorname')} ${fieldText(record, 'interessent_nachname')}`.trim()}
              />
              <Row label={tx('Hund')} value={fieldText(record, 'hund_name')} />
              <Row label={tx('Größe')} value={fieldLookup(record, 'hund_groesse')?.label ?? '—'} />
              <Row
                label={tx('Wunschzeitraum')}
                value={`${dateText(fieldDate(record, 'wunsch_anreise'))} – ${dateText(fieldDate(record, 'wunsch_abreise'))}`}
              />
              <Row label={tx('Nachricht')} value={fieldText(record, 'nachricht')} />
              <Row label={tx('Status')} value={fieldLookup(record, 'anfrage_status')?.label ?? '—'} />
            </dl>
            <StepNav onBack={() => setStep(1)} onNext={() => true} nextStepLabel={tx('Entscheiden')} />
          </div>
        ) : (
          <StepNav onBack={() => setStep(1)} nextDisabled>
            {tx('Dieser Schritt braucht die Auswahl aus Schritt 1.')}
          </StepNav>
        )}
      </WizardStep>

      <WizardStep label={tx('Entscheiden')} description={tx('Anfrage annehmen oder ablehnen.')}>
        {record ? (
          <div className="space-y-4">
            <Bound form={form} name="anfrage_status" />
            <StepNav
              onBack={() => setStep(2)}
              onNext={() => form.validate(['anfrage_status'])}
              nextStepLabel={tx('Prüfen')}
            />
          </div>
        ) : (
          <StepNav onBack={() => setStep(1)} nextDisabled>
            {tx('Dieser Schritt braucht die Auswahl aus Schritt 1.')}
          </StepNav>
        )}
      </WizardStep>

      <WizardStep label={tx('Prüfen')} description={tx('Stimmt die Entscheidung?')}>
        {!flow.submit.done && (
          <SummaryStep
            forms={flow.formList}
            submit={flow.submit}
            whatHappensNext={tx('Der Status der Anfrage wird gespeichert. Die Buchung selbst legst du im Ablauf „Neue Buchung“ an.')}
          />
        )}
      </WizardStep>

      {flow.submit.result && (
        <SuccessStep
          result={flow.submit.result}
          forms={flow.formList}
          submit={flow.submit}
          actions={{ copy: false, print: false }}
          next={[
            { label: tx('Weitere Anfrage bearbeiten') },
            { label: tx('Neue Buchung anlegen'), href: '#/intents/neue-buchung' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
        />
      )}
    </IntentWizardShell>
  );
}
