/**
 * Aufenthalt buchen — 4-Schritt-Wizard mit Prüfen-Schritt.
 * Steps: 1) Hund wählen → 2) Anreise & Abreise → 3) Freien Platz wählen → 4) Preis & Notizen → 5) Prüfen & anlegen.
 * Reads: hundekartei, besitzer (über den Hund), belegung_buchungen (Belegung je Platz).
 * Writes: belegung_buchungen (Status „aktiv“ setzt der Flow selbst).
 * Composes: IntentWizardShell, EntitySelectStep, Bound, Field, ChoiceGroup, StepNav, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Bound } from '@/components/blocks/Bound';
import { Field } from '@/components/blocks/Field';
import { ChoiceGroup } from '@/components/blocks/ChoiceGroup';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { fieldText, fieldRef, useOccupancy } from '@/lib/journey';
import { useBuchungAnlegenFlow } from '@/lib/journey/flows/BuchungAnlegen';
import { tx } from '@/i18n';

export default function BuchungAnlegenPage() {
  const [step, setStep] = useState(1);
  const flow = useBuchungAnlegenFlow({
    steps: { hund: 1, besitzer: 1, anreisedatum: 2, abreisedatum: 2, platznummer: 3, preis_euro: 4, notizen: 4 },
    items: {
      hund: (r, ctx) => ({ id: r.id, title: fieldText(r, 'name'), subtitle: [fieldText(r, 'rasse'), ctx.ref('besitzer')].filter(Boolean).join(' · ') }),
      besitzer: r => ({ id: r.id, title: `${fieldText(r, 'vorname')} ${fieldText(r, 'nachname')}`.trim() }),
    },
  });
  const f = flow.forms.belegung_buchungen;

  const von = (f.get('anreisedatum') as string | null) ?? null;
  const bis = (f.get('abreisedatum') as string | null) ?? null;
  const platz = (f.get('platznummer') as string | null) ?? null;
  const belegung = useOccupancy(flow.port, 'belegung_buchungen', { resource: platz });

  const platzOptions = f.choice('platznummer').options;
  const belegt = von && bis ? platzOptions.filter(o => !belegung.isFree(von, bis, o.key)) : [];
  const platzFrei = Boolean(platz) && belegung.isFree(von, bis, platz);

  const onPickHund = (id: string) => {
    flow.pick('hund').onSelect(id);
    const hund = flow.picks.hund.recordOf(id);
    const besitzerId = hund ? fieldRef(hund, 'besitzer') : null;
    if (besitzerId) {
      const name = flow.picks.besitzer.labelOf(besitzerId) ?? (hund ? flow.picks.hund.refLabel(hund, 'besitzer') : undefined) ?? tx('Besitzer');
      f.set('besitzer', besitzerId, name);
    }
  };

  return (
    <IntentWizardShell
      title={tx('Aufenthalt buchen')}
      currentStep={step}
      onStepChange={setStep}
      forms={flow.formList}
      draftKey={flow.draftKey}
      intro={{ description: tx('Hund, Zeitraum und Platz festlegen und die Buchung anlegen.'), needs: [tx('Hund aus der Kartei'), tx('An- und Abreisedatum')] }}
    >
      <WizardStep label={tx('Hund')} description={tx('Für welchen Hund ist der Aufenthalt?')}>
        <EntitySelectStep
          {...flow.picks.hund.select}
          {...flow.pick('hund')}
          onSelect={onPickHund}
          searchPlaceholder={tx('Name oder Rasse …')}
        />
      </WizardStep>

      <WizardStep label={tx('Zeitraum')} description={tx('Wann kommt der Hund und wann wird er abgeholt?')} needs={['hund']}>
        <div className="space-y-4">
          <Bound form={f} name="anreisedatum" />
          <Bound form={f} name="abreisedatum" />
          <StepNav
            onBack={() => setStep(1)}
            onNext={() => {
              const ok = flow.validateStep(2);
              if (!ok) return ok;
              if (von && bis && bis <= von) return tx('Die Abreise muss nach der Anreise liegen.');
              return true;
            }}
            nextStepLabel={tx('Platz wählen')}
          />
        </div>
      </WizardStep>

      <WizardStep label={tx('Platz')} description={tx('Welcher Platz ist im gewählten Zeitraum frei?')} needs={['anreisedatum', 'abreisedatum']}>
        <div className="space-y-4">
          <Field form={f} name="platznummer">
            <ChoiceGroup {...f.choice('platznummer')} />
          </Field>
          {belegt.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {tx`Belegt im Zeitraum: ${belegt.map(o => o.label).join(', ')}`}
            </p>
          )}
          {platz && !platzFrei && (
            <p className="text-sm text-destructive">{tx('Dieser Platz ist im gewählten Zeitraum bereits belegt.')}</p>
          )}
          <StepNav
            onBack={() => setStep(2)}
            onNext={() => {
              const ok = flow.validateStep(3);
              if (!ok) return ok;
              if (!belegung.isFree(von, bis, platz)) return tx('Dieser Platz ist im gewählten Zeitraum bereits belegt.');
              return true;
            }}
            nextStepLabel={tx('Preis eintragen')}
          />
        </div>
      </WizardStep>

      <WizardStep label={tx('Preis')} description={tx('Preis und Hinweise zur Buchung eintragen.')} needs={['platznummer']}>
        <div className="space-y-4">
          <Bound form={f} name="preis_euro" hint={tx('Gesamtpreis in Euro')} />
          <Bound form={f} name="notizen" rows={3} />
          <StepNav onBack={() => setStep(3)} onNext={() => flow.validateStep(4)} nextStepLabel={tx('Prüfen')} />
        </div>
      </WizardStep>

      <WizardStep label={tx('Prüfen')}>
        {!flow.submit.done && (
          <SummaryStep
            forms={flow.formList}
            submit={flow.submit}
            items={[{ key: 'status', label: tx('Status'), value: tx('Aktiv') }]}
            whatHappensNext={tx('Die Buchung belegt den Platz sofort im gewählten Zeitraum.')}
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
          whatHappensNext={tx('Nach dem Aufenthalt schließt du die Buchung über „Aufenthalt abschließen“ ab.')}
        />
      )}
    </IntentWizardShell>
  );
}
