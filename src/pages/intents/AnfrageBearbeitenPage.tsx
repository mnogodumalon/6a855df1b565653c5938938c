/**
 * Buchungsanfrage bestätigen — 4-Schritt-Wizard.
 * Steps: 1) Neue Anfrage wählen → 2) Freien Platz für den Wunschzeitraum wählen → 3) Besitzer und Hund anlegen (Vorschau) → 4) Buchung erzeugen und Anfrage bestätigen.
 * Reads: buchungsanfragen, belegung_buchungen (Belegung). Writes: besitzer, hundekartei, belegung_buchungen (via useAnfrageBearbeitenFlow).
 * Composes: IntentWizardShell, EntitySelectStep, Bound, StepNav, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { IconCheck, IconAlertTriangle } from '@tabler/icons-react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Bound } from '@/components/blocks/Bound';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { fieldText, fieldDate, fieldLookup, useOccupancy } from '@/lib/journey';
import { useAnfrageBearbeitenFlow } from '@/lib/journey/flows/AnfrageBearbeiten';
import { tx } from '@/i18n';

function niceDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return format(parseISO(iso), 'dd.MM.yyyy');
  } catch {
    return iso;
  }
}

export default function AnfrageBearbeitenPage() {
  const [step, setStep] = useState(1);
  const flow = useAnfrageBearbeitenFlow({
    steps: { buchungsanfragen: 1, platznummer: 2, preis_euro: 2 },
    items: {
      buchungsanfragen: r => ({
        id: r.id,
        title: `${fieldText(r, 'interessent_vorname')} ${fieldText(r, 'interessent_nachname')}`.trim(),
        subtitle: `${fieldText(r, 'hund_name')} · ${niceDate(fieldDate(r, 'wunsch_anreise'))} – ${niceDate(fieldDate(r, 'wunsch_abreise'))}`,
        status: fieldLookup(r, 'hund_groesse') ?? undefined,
      }),
    },
  });

  const pickedId = flow.pick('buchungsanfragen').selectedId;
  const anfrage = pickedId ? flow.picks.buchungsanfragen.recordOf(pickedId) : undefined;
  const von = anfrage ? fieldDate(anfrage, 'wunsch_anreise') : null;
  const bis = anfrage ? fieldDate(anfrage, 'wunsch_abreise') : null;
  const platz = (flow.forms.belegung_buchungen.get('platznummer') as string | null | undefined) ?? null;
  const belegung = useOccupancy(flow.port, 'belegung_buchungen', { resource: platz });
  const platzFrei = platz && von && bis ? belegung.isFree(von, bis, platz) : null;
  const belegtText = tx('Dieser Platz ist im gewählten Zeitraum bereits belegt.');

  const name = anfrage
    ? `${fieldText(anfrage, 'interessent_vorname')} ${fieldText(anfrage, 'interessent_nachname')}`.trim()
    : '';

  return (
    <IntentWizardShell
      title={tx('Buchungsanfrage bestätigen')}
      currentStep={step}
      onStepChange={setStep}
      forms={flow.formList}
      draftKey={flow.draftKey}
      intro={{
        description: tx('Anfrage prüfen, Platz vergeben und Besitzer, Hund und Buchung in einem Rutsch anlegen.'),
        needs: [tx('Die eingegangene Anfrage'), tx('Platznummer und Preis')],
      }}
    >
      <WizardStep label={tx('Anfrage')} description={tx('Welche neue Anfrage möchtest du bestätigen?')}>
        <EntitySelectStep
          {...flow.picks.buchungsanfragen.select}
          {...flow.pick('buchungsanfragen')}
          avatar="initials"
          searchPlaceholder={tx('Name oder Hund suchen …')}
        />
      </WizardStep>

      <WizardStep
        label={tx('Platz')}
        description={tx('Wähle einen Platz, der im Wunschzeitraum frei ist.')}
        needs={['buchungsanfragen']}
      >
        <div className="space-y-4">
          <div className="rounded-xl border bg-secondary/50 p-4 text-sm">
            <p className="font-medium">{tx`Wunschzeitraum von ${name}`}</p>
            <p className="text-muted-foreground">{`${niceDate(von)} – ${niceDate(bis)}`}</p>
          </div>
          <Bound form={flow.forms.belegung_buchungen} name="platznummer" />
          {platzFrei === true && (
            <p className="flex items-center gap-2 text-sm text-emerald-600">
              <IconCheck size={16} className="shrink-0" />
              {tx('Der Platz ist im Wunschzeitraum frei.')}
            </p>
          )}
          {platzFrei === false && (
            <p className="flex items-center gap-2 text-sm text-destructive">
              <IconAlertTriangle size={16} className="shrink-0" />
              {belegtText}
            </p>
          )}
          <Bound form={flow.forms.belegung_buchungen} name="preis_euro" hint={tx('Gesamtpreis in Euro, z. B. 240')} />
          <StepNav
            onBack={() => setStep(1)}
            onNext={() => {
              if (platz && von && bis && !belegung.isFree(von, bis, platz)) return belegtText;
              return flow.validateStep(2);
            }}
            nextStepLabel={tx('Besitzer und Hund')}
          />
        </div>
      </WizardStep>

      <WizardStep
        label={tx('Besitzer und Hund')}
        description={tx('Diese Daten aus der Anfrage werden als neue Karteikarten angelegt.')}
        needs={['buchungsanfragen']}
      >
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="overflow-hidden rounded-xl border bg-card p-4">
              <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">{tx('Besitzer')}</p>
              <p className="truncate font-medium">{name || '—'}</p>
              <p className="truncate text-sm text-muted-foreground">{anfrage ? fieldText(anfrage, 'interessent_email') : ''}</p>
              <p className="truncate text-sm text-muted-foreground">{anfrage ? fieldText(anfrage, 'interessent_telefon') : ''}</p>
            </div>
            <div className="overflow-hidden rounded-xl border bg-card p-4">
              <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">{tx('Hund')}</p>
              <p className="truncate font-medium">{anfrage ? fieldText(anfrage, 'hund_name') : '—'}</p>
              <p className="truncate text-sm text-muted-foreground">{anfrage ? fieldText(anfrage, 'hund_rasse') : ''}</p>
              <p className="truncate text-sm text-muted-foreground">{anfrage ? (fieldLookup(anfrage, 'hund_groesse')?.label ?? '') : ''}</p>
            </div>
          </div>
          <StepNav onBack={() => setStep(2)} onNext={() => true} nextStepLabel={tx('Prüfen')} />
        </div>
      </WizardStep>

      <WizardStep label={tx('Prüfen')} needs={['buchungsanfragen']}>
        {!flow.submit.done && (
          <SummaryStep
            forms={flow.formList}
            submit={flow.submit}
            items={[
              { key: 'neu-besitzer', label: tx('Neuer Besitzer'), value: name || '—' },
              { key: 'neu-hund', label: tx('Neuer Hund'), value: anfrage ? fieldText(anfrage, 'hund_name') : '—' },
              { key: 'neu-zeitraum', label: tx('Zeitraum'), value: `${niceDate(von)} – ${niceDate(bis)}` },
              { key: 'neu-status', label: tx('Status der Buchung'), value: tx('Aktiv') },
            ]}
            whatHappensNext={tx('Besitzer, Hund und Buchung werden angelegt.')}
          />
        )}
      </WizardStep>

      {flow.submit.result && (
        <SuccessStep
          result={flow.submit.result}
          forms={flow.formList}
          submit={flow.submit}
          whatHappensNext={tx('Der Hund ist jetzt im Belegungsplan eingetragen.')}
          next={[
            { label: tx('Pfoten-Porträt erstellen'), href: '#/intents/portraet-erstellen' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
        />
      )}
    </IntentWizardShell>
  );
}
