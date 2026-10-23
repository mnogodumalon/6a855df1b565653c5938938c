/**
 * Buchung abschließen oder stornieren — 3-Schritt-Wizard.
 * Steps: 1) Aktive Buchung wählen → 2) Abschließen oder stornieren → 3) Prüfen & speichern.
 * Reads: belegung_buchungen (nur aktive), hundekartei (Name über ctx.ref). Writes: belegung_buchungen (status, Update).
 * Composes: IntentWizardShell, EntitySelectStep, Field, ChoiceGroup, StepNav, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Field } from '@/components/blocks/Field';
import { ChoiceGroup } from '@/components/blocks/ChoiceGroup';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { fieldDate, fieldLookup } from '@/lib/journey';
import { useBuchungAbschliessenFlow } from '@/lib/journey/flows/BuchungAbschliessen';
import { tx } from '@/i18n';

const OFFERED = ['abgeschlossen', 'storniert'];

function shortDate(iso: string | null): string {
  return iso ? format(parseISO(iso), 'dd.MM.yyyy') : '?';
}

export default function BuchungAbschliessenPage() {
  const [step, setStep] = useState(1);
  const flow = useBuchungAbschliessenFlow({
    steps: { belegung_buchungen: 1, status: 2 },
    items: {
      belegung_buchungen: (r, ctx) => ({
        id: r.id,
        title: ctx.ref('hund') ?? tx('Ohne Hund'),
        subtitle: tx`${fieldLookup(r, 'platznummer')?.label ?? '?'} · ${shortDate(fieldDate(r, 'anreisedatum'))} – ${shortDate(fieldDate(r, 'abreisedatum'))}`,
      }),
    },
  });
  const f = flow.forms.belegung_buchungen;
  const options = f.choice('status').options.filter(o => OFFERED.includes(o.key));

  return (
    <IntentWizardShell
      title={tx('Buchung abschließen oder stornieren')}
      currentStep={step}
      onStepChange={setStep}
      forms={flow.formList}
      draftKey={flow.draftKey}
      intro={{
        description: tx('Eine aktive Buchung bei Abreise abschließen oder stornieren.'),
        needs: [tx('Name des Hundes oder Platznummer')],
      }}
    >
      <WizardStep label={tx('Buchung')} description={tx('Welche aktive Buchung soll beendet werden?')}>
        <EntitySelectStep
          {...flow.picks.belegung_buchungen.select}
          {...flow.pick('belegung_buchungen')}
          emptyText={tx('Es gibt keine aktive Buchung mehr.')}
        />
      </WizardStep>
      <WizardStep label={tx('Status')} description={tx('Wurde der Aufenthalt beendet oder abgesagt?')} needs={['belegung_buchungen']}>
        <div className="space-y-4">
          <Field form={f} name="status">
            <ChoiceGroup {...f.choice('status')} options={options} />
          </Field>
          <StepNav
            onBack={() => setStep(1)}
            onNext={() => {
              const v = f.get('status');
              if (typeof v !== 'string' || !OFFERED.includes(v)) return tx('Bitte „Abgeschlossen“ oder „Storniert“ wählen.');
              return flow.validateStep(2);
            }}
            nextStepLabel={tx('Prüfen')}
          />
        </div>
      </WizardStep>
      <WizardStep label={tx('Prüfen')}>
        {!flow.submit.done && (
          <SummaryStep
            forms={flow.formList}
            submit={flow.submit}
            whatHappensNext={tx('Der Platz wird danach wieder als frei angezeigt.')}
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
            { label: tx('Aufenthalt buchen'), href: '#/intents/aufenthalt-buchen' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
        />
      )}
    </IntentWizardShell>
  );
}
