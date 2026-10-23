/**
 * Anfrage bestätigen — 5-Schritt-Wizard.
 * Steps: 1) Neue Anfrage wählen → 2) Besitzer prüfen → 3) Hund (Impfstatus) → 4) Freien Platz wählen → 5) Prüfen & bestätigen.
 * Reads: buchungsanfragen (neu), belegung_buchungen (Belegung je Platz). Writes: besitzer, hundekartei, belegung_buchungen (anlegen), buchungsanfragen (auf bestätigt setzen).
 * Composes: IntentWizardShell, EntitySelectStep, Bound, Field, ChoiceGroup, StepNav, SummaryStep, SuccessStep.
 */
import { useEffect, useState } from 'react';
import { IconAlertTriangle } from '@tabler/icons-react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Bound } from '@/components/blocks/Bound';
import { Field } from '@/components/blocks/Field';
import { ChoiceGroup } from '@/components/blocks/ChoiceGroup';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { fieldText, fieldDate, fieldLookup, formatRange, optionsOf, type JourneyRecord } from '@/lib/journey';
import { useAnfrageBestaetigenFlow } from '@/lib/journey/flows/AnfrageBestaetigen';
import { tx } from '@/i18n';

const FREE_STATUS = ['storniert', 'abgeschlossen'];

export default function AnfrageBestaetigenPage() {
  const [step, setStep] = useState(1);
  const [bookings, setBookings] = useState<JourneyRecord[]>([]);
  const flow = useAnfrageBestaetigenFlow({
    steps: { buchungsanfragen: 1, impfstatus: 3, platznummer: 4, preis_euro: 4 },
    items: {
      buchungsanfragen: r => ({
        id: r.id,
        title: `${fieldText(r, 'interessent_vorname')} ${fieldText(r, 'interessent_nachname')}`.trim(),
        subtitle: `${fieldText(r, 'hund_name')} · ${formatRange(fieldDate(r, 'wunsch_anreise'), fieldDate(r, 'wunsch_abreise'))}`,
      }),
    },
  });

  // Belegung through the flow's door — one read, the free-places rule is applied below
  const port = flow.port;
  useEffect(() => {
    let on = true;
    void port.list('belegung_buchungen', { limit: 500 }).then(r => { if (on) setBookings(r); }).catch(() => undefined);
    return () => { on = false; };
  }, [port]);

  const req = flow.targets.buchungsanfragen.record;
  const from = req ? fieldDate(req, 'wunsch_anreise') : null;
  const to = req ? fieldDate(req, 'wunsch_abreise') : null;
  const buchung = flow.forms.belegung_buchungen;
  const hund = flow.forms.hundekartei;

  const takenKeys = new Set<string>();
  if (from && to) {
    for (const b of bookings) {
      const bs = fieldDate(b, 'anreisedatum');
      const be = fieldDate(b, 'abreisedatum');
      const st = fieldLookup(b, 'status')?.key ?? '';
      const pk = fieldLookup(b, 'platznummer')?.key;
      if (!bs || !be || !pk || FREE_STATUS.includes(st)) continue;
      if (bs < to && from < be) takenKeys.add(pk);
    }
  }
  const freePlaces = optionsOf('belegung_buchungen', 'platznummer').filter(o => !takenKeys.has(o.key));
  const pickedPlace = buchung.get('platznummer') as string | null | undefined;
  const placeTaken = Boolean(pickedPlace && takenKeys.has(pickedPlace));

  const checkPlace = (): boolean | string => {
    if (!flow.validateStep(4)) return false;
    if (placeTaken) return tx('Dieser Platz ist im gewählten Zeitraum schon belegt.');
    return true;
  };

  const ownerName = req ? `${fieldText(req, 'interessent_vorname')} ${fieldText(req, 'interessent_nachname')}`.trim() : '';
  const missingRequest = (
    <StepNav onBack={() => setStep(1)} nextDisabled>{tx('Dieser Schritt braucht die Auswahl aus Schritt 1.')}</StepNav>
  );

  return (
    <IntentWizardShell
      title={tx('Anfrage bestätigen')}
      currentStep={step}
      onStepChange={setStep}
      forms={flow.formList}
      draftKey={flow.draftKey}
      intro={{
        description: tx('Eine neue Anfrage prüfen und daraus Besitzer, Hund und Buchung machen.'),
        needs: [tx('Eine neue Buchungsanfrage'), tx('Impfstatus des Hundes'), tx('Platz und Preis')],
      }}
    >
      <WizardStep label={tx('Anfrage')} description={tx('Welche neue Anfrage möchtest du bestätigen?')}>
        <EntitySelectStep
          {...flow.picks.buchungsanfragen.select}
          {...flow.pick('buchungsanfragen')}
          searchPlaceholder={tx('Nachname oder Hundename …')}
          emptyText={tx('Es gibt keine neuen Anfragen.')}
        />
      </WizardStep>

      <WizardStep label={tx('Besitzer')} description={tx('Diese Angaben aus der Anfrage werden als Besitzer angelegt.')}>
        {!req ? missingRequest : (
          <div className="space-y-4">
            <dl className="grid gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-2">
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">{tx('Name')}</dt>
                <dd className="truncate text-sm font-medium">{ownerName}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">{tx('E-Mail')}</dt>
                <dd className="truncate text-sm font-medium">{fieldText(req, 'interessent_email') || '—'}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">{tx('Telefon')}</dt>
                <dd className="truncate text-sm font-medium">{fieldText(req, 'interessent_telefon') || '—'}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">{tx('Wunschzeitraum')}</dt>
                <dd className="truncate text-sm font-medium">{formatRange(from, to)}</dd>
              </div>
            </dl>
            <StepNav onBack={() => setStep(1)} nextStepLabel={tx('Hund')} />
          </div>
        )}
      </WizardStep>

      <WizardStep label={tx('Hund')} description={tx('Name und Rasse kommen aus der Anfrage — trage den Impfstatus ein.')}>
        {!req ? missingRequest : (
          <div className="space-y-4">
            <div className="rounded-2xl border bg-card p-4">
              <p className="truncate text-sm font-medium">{fieldText(req, 'hund_name')}</p>
              <p className="truncate text-xs text-muted-foreground">{fieldText(req, 'hund_rasse') || '—'}</p>
            </div>
            <Bound form={hund} name="impfstatus" />
            <StepNav onBack={() => setStep(2)} onNext={() => flow.validateStep(3)} nextStepLabel={tx('Platz wählen')} />
          </div>
        )}
      </WizardStep>

      <WizardStep label={tx('Platz')} description={tx('Wähle einen Platz, der im Wunschzeitraum frei ist, und trage den Preis ein.')}>
        {!req ? missingRequest : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{tx`Wunschzeitraum: ${formatRange(from, to)}`}</p>
            <Field form={buchung} name="platznummer">
              <ChoiceGroup {...buchung.choice('platznummer')} options={freePlaces} />
            </Field>
            {freePlaces.length === 0 && (
              <p className="flex items-center gap-2 text-sm text-destructive">
                <IconAlertTriangle size={16} className="shrink-0" />
                {tx('Dieser Platz ist im gewählten Zeitraum schon belegt.')}
              </p>
            )}
            <Bound form={buchung} name="preis_euro" />
            <StepNav onBack={() => setStep(3)} onNext={checkPlace} nextStepLabel={tx('Prüfen')} />
          </div>
        )}
      </WizardStep>

      <WizardStep label={tx('Prüfen')}>
        {!flow.submit.done && (
          <SummaryStep
            forms={flow.formList}
            submit={flow.submit}
            items={req ? [
              { key: 'anfrage-besitzer', label: tx('Besitzer'), value: ownerName },
              { key: 'anfrage-hund', label: tx('Hund'), value: fieldText(req, 'hund_name') },
              { key: 'anfrage-zeitraum', label: tx('Zeitraum'), value: formatRange(from, to) },
            ] : []}
            whatHappensNext={tx('Besitzer, Hund und Buchung werden angelegt und die Anfrage gilt als bestätigt.')}
          />
        )}
      </WizardStep>

      {flow.submit.result && (
        <SuccessStep
          result={flow.submit.result}
          forms={flow.formList}
          submit={flow.submit}
          next={[
            { label: tx('Pfoten-Porträt erstellen'), href: '#/intents/portraet-erstellen' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
          whatHappensNext={tx('Für den Hund kannst du jetzt ein Pfoten-Porträt anlegen.')}
        />
      )}
    </IntentWizardShell>
  );
}
