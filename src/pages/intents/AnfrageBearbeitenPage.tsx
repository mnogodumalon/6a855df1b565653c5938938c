/**
 * Buchungsanfrage bearbeiten — 5-Schritt-Wizard.
 * Steps: 1) Neue Anfrage wählen → 2) Freie Plätze im Wunschzeitraum prüfen → 3) Bestätigen oder ablehnen
 *        → 4) Besitzer, Hund und Buchung anlegen (nur bei Bestätigung) → 5) Prüfen & speichern.
 * Reads: buchungsanfragen, belegung_buchungen (Belegung per Platz). Writes: besitzer, hundekartei,
 * belegung_buchungen (nur bei Bestätigung), buchungsanfragen (Status) — alles über useAnfrageBearbeitenFlow.
 * Composes: IntentWizardShell, EntitySelectStep, Bound, AvailabilityRangePicker, StepNav, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Bound } from '@/components/blocks/Bound';
import { ChoiceGroup } from '@/components/blocks/ChoiceGroup';
import { Field } from '@/components/blocks/Field';
import { AvailabilityRangePicker } from '@/components/blocks/AvailabilityRangePicker';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { fieldText, fieldDate, fieldLookup, formatRange, optionsOf, useOccupancy } from '@/lib/journey';
import { useAnfrageBearbeitenFlow, type AnfrageBearbeitenFlow } from '@/lib/journey/flows/AnfrageBearbeiten';
import { tx } from '@/i18n';

const BELEGUNG = 'belegung_buchungen' as const;

function PlatzTile({ port, platz, label, from, to }: {
  port: AnfrageBearbeitenFlow['port']; platz: string; label: string; from: string | null; to: string | null;
}) {
  const occ = useOccupancy(port, BELEGUNG, { resource: platz });
  const known = !occ.loading && !occ.error;
  const free = known && occ.isFree(from, to, platz);
  const tone = !known
    ? 'border-border bg-secondary text-muted-foreground'
    : free
      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700'
      : 'border-destructive/30 bg-destructive/10 text-destructive';
  return (
    <div className={`rounded-xl border px-3 py-2 min-w-0 ${tone}`}>
      <div className="text-sm font-medium truncate">{label}</div>
      <div className="text-xs">{!known ? tx('lädt …') : free ? tx('frei') : tx('belegt')}</div>
    </div>
  );
}

export default function AnfrageBearbeitenPage() {
  const [step, setStep] = useState(1);
  const flow = useAnfrageBearbeitenFlow({
    steps: {
      buchungsanfragen: 1, anfrage_status: 3,
      besitzer: 4, hund: 4,
      vorname: 4, nachname: 4, email: 4, telefon: 4, name: 4, rasse: 4,
      anreisedatum: 4, abreisedatum: 4, platznummer: 4,
    },
    items: {
      buchungsanfragen: r => ({
        id: r.id,
        title: `${fieldText(r, 'interessent_vorname')} ${fieldText(r, 'interessent_nachname')}`.trim(),
        subtitle: tx`${fieldText(r, 'hund_name')} · ${formatRange(fieldDate(r, 'wunsch_anreise'), fieldDate(r, 'wunsch_abreise'))}`,
      }),
    },
  });

  const { besitzer, hundekartei, belegung_buchungen: buchung, buchungsanfragen: anfrage } = flow.forms;
  const request = flow.targets.buchungsanfragen.record;
  const wishFrom = request ? fieldDate(request, 'wunsch_anreise') : null;
  const wishTo = request ? fieldDate(request, 'wunsch_abreise') : null;
  const platzOptions = optionsOf(BELEGUNG, 'platznummer');
  const decision = anfrage.get('anfrage_status');
  const confirmed = decision === 'bestaetigt';

  const belegung = useOccupancy(flow.port, BELEGUNG, { resource: (buchung.get('platznummer') as string) || null });

  const clearBooking = () => { besitzer.reset(); hundekartei.reset(); buchung.reset(); };
  const prefillBooking = () => {
    if (!request) return;
    besitzer.reset({
      vorname: fieldText(request, 'interessent_vorname'),
      nachname: fieldText(request, 'interessent_nachname'),
      email: fieldText(request, 'interessent_email'),
      telefon: fieldText(request, 'interessent_telefon'),
    });
    hundekartei.reset({ name: fieldText(request, 'hund_name'), rasse: fieldText(request, 'hund_rasse') });
    buchung.reset({ anreisedatum: wishFrom ?? undefined, abreisedatum: wishTo ?? undefined });
  };

  const statusProps = anfrage.choice('anfrage_status');
  const decide = (key: string | null) => {
    statusProps.onChange(key);
    if (key === 'bestaetigt') prefillBooking();
    else clearBooking();
  };

  const pickRequest = flow.pick('buchungsanfragen');
  const missingRequest = (back: number) => (
    <StepNav onBack={() => setStep(back)} nextDisabled>{tx('Dieser Schritt braucht die Anfrage aus Schritt 1.')}</StepNav>
  );

  const validateBooking = () => {
    const ok = besitzer.validate(['vorname', 'nachname', 'email', 'telefon'])
      && hundekartei.validate(['name', 'rasse'])
      && buchung.validate(['anreisedatum', 'abreisedatum', 'platznummer']);
    if (!ok) return false;
    const from = buchung.get('anreisedatum') as string;
    const to = buchung.get('abreisedatum') as string;
    const platz = buchung.get('platznummer') as string;
    if (!belegung.isFree(from, to, platz)) return tx('Dieser Platz ist im gewählten Zeitraum schon belegt.');
    return true;
  };

  return (
    <IntentWizardShell
      title={tx('Buchungsanfrage bearbeiten')}
      currentStep={step} onStepChange={setStep}
      forms={flow.formList} draftKey={flow.draftKey}
      intro={{
        description: tx('Eine neue Anfrage prüfen, bestätigen oder ablehnen.'),
        needs: [tx('Die Anfrage aus dem Formular'), tx('Überblick über freie Plätze')],
      }}
    >
      <WizardStep label={tx('Anfrage')} description={tx('Welche neue Anfrage möchtest du bearbeiten?')}>
        <EntitySelectStep {...flow.picks.buchungsanfragen.select}
          selectedId={pickRequest.selectedId}
          onSelect={id => { clearBooking(); pickRequest.onSelect(id); }}
          avatar="initials"
          searchPlaceholder={tx('Name oder Hund suchen …')}
          emptyText={tx('Keine neue Anfrage offen.')} />
        <StepNav hideBack onNext={() => flow.validateStep(1)} nextStepLabel={tx('Plätze prüfen')} />
      </WizardStep>

      <WizardStep label={tx('Plätze')} description={tx('Schau nach, welche Plätze im Wunschzeitraum frei sind.')}>
        {!request ? missingRequest(1) : (
          <div className="space-y-4">
            <div className="rounded-xl border bg-secondary/40 p-4 space-y-1 overflow-hidden">
              <div className="font-medium truncate">
                {`${fieldText(request, 'interessent_vorname')} ${fieldText(request, 'interessent_nachname')}`.trim()}
              </div>
              <div className="text-sm text-muted-foreground">
                {tx`${fieldText(request, 'hund_name')} ${fieldText(request, 'hund_rasse')} ${fieldLookup(request, 'hund_groesse')?.label ?? ''}`}
              </div>
              <div className="text-sm">{tx`Wunschzeitraum: ${formatRange(wishFrom, wishTo)}`}</div>
              {fieldText(request, 'nachricht') && (
                <p className="text-sm text-muted-foreground whitespace-pre-line">{fieldText(request, 'nachricht')}</p>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {platzOptions.map(o => (
                <PlatzTile key={o.key} port={flow.port} platz={o.key} label={o.label} from={wishFrom} to={wishTo} />
              ))}
            </div>
            <StepNav onBack={() => setStep(1)} nextStepLabel={tx('Entscheiden')} />
          </div>
        )}
      </WizardStep>

      <WizardStep label={tx('Entscheidung')} description={tx('Anfrage bestätigen oder ablehnen.')}>
        {!request ? missingRequest(1) : (
          <div className="space-y-4">
            <Field form={anfrage} name="anfrage_status">
              <ChoiceGroup {...statusProps}
                options={statusProps.options.filter(o => o.key !== 'neu')}
                onChange={decide} />
            </Field>
            <StepNav onBack={() => setStep(2)}
              onNext={() => {
                if (!decision || decision === 'neu') return tx('Bitte bestätigen oder ablehnen.');
                return anfrage.validate(['anfrage_status']);
              }}
              nextStepLabel={confirmed ? tx('Buchung anlegen') : tx('Prüfen')} />
          </div>
        )}
      </WizardStep>

      <WizardStep label={tx('Buchung')} enabledIf={confirmed}
        description={tx('Besitzer, Hund und Aufenthalt prüfen und einen Platz zuweisen.')}>
        <div className="space-y-6">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">{tx('Besitzer')}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Bound form={besitzer} name="vorname" />
              <Bound form={besitzer} name="nachname" />
              <Bound form={besitzer} name="email" />
              <Bound form={besitzer} name="telefon" />
            </div>
          </section>
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">{tx('Hund')}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Bound form={hundekartei} name="name" />
              <Bound form={hundekartei} name="rasse" />
            </div>
          </section>
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">{tx('Aufenthalt')}</h3>
            <Bound form={buchung} name="platznummer" as="choice" />
            <AvailabilityRangePicker {...buchung.range('anreisedatum', 'abreisedatum', { blocked: belegung.blocked })} />
          </section>
          <StepNav onBack={() => setStep(3)} onNext={validateBooking} nextStepLabel={tx('Prüfen')} />
        </div>
      </WizardStep>

      <WizardStep label={tx('Prüfen')}>
        {!flow.submit.done && (
          <SummaryStep forms={flow.formList} submit={flow.submit}
            whatHappensNext={confirmed
              ? tx('Besitzer, Hund und Buchung werden angelegt und die Anfrage gilt als bestätigt.')
              : tx('Die Anfrage wird als abgelehnt markiert. Es wird nichts weiter angelegt.')} />
        )}
      </WizardStep>

      {flow.submit.result && (
        <SuccessStep result={flow.submit.result} forms={flow.formList} submit={flow.submit}
          title={tx('Anfrage bearbeitet')}
          next={[
            { label: tx('Pfoten-Porträt erstellen'), href: '#/intents/portraet-erstellen' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]} />
      )}
    </IntentWizardShell>
  );
}
