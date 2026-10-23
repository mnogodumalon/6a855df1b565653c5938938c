/**
 * Aufenthalt abschließen — 3-Schritt-Wizard.
 * Steps: 1) Aktive Buchung wählen → 2) Abschließen oder stornieren → 3) Prüfen & speichern.
 * Reads: belegung_buchungen (hund über ctx.ref). Writes: belegung_buchungen (status, Update).
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

const dayText = (iso: string | null) => (iso ? format(parseISO(iso), 'dd.MM.yyyy') : '?');

export default function BuchungAbschliessenPage() {
  const [step, setStep] = useState(1);
  const flow = useBuchungAbschliessenFlow({
    steps: { belegung_buchungen: 1, status: 2 },
    items: {
      belegung_buchungen: (r, ctx) => ({
        id: r.id,
        title: ctx.ref('hund') ?? tx('Ohne Hund'),
        subtitle: tx`${fieldLookup(r, 'platznummer')?.label ?? '—'} · ${dayText(fieldDate(r, 'anreisedatum'))} – ${dayText(fieldDate(r, 'abreisedatum'))}`,
      }),
    },
  });

  const form = flow.forms.belegung_buchungen;
  const statusProps = form.choice('status');
  const closingOptions = statusProps.options.filter(o => o.key === 'abgeschlossen' || o.key === 'storniert');

  return (
    <IntentWizardShell
      title={tx('Aufenthalt abschließen')}
      currentStep={step}
      onStepChange={setStep}
      forms={flow.formList}
      draftKey={flow.draftKey}
      intro={{
        description: tx('Einen beendeten Aufenthalt abschließen oder stornieren.'),
        needs: [tx('Aktive Buchung'), tx('Entscheidung: abgeschlossen oder storniert')],
      }}
    >
      <WizardStep label={tx('Buchung')} description={tx('Welcher aktive Aufenthalt soll beendet werden?')}>
        <EntitySelectStep
          {...flow.picks.belegung_buchungen.select}
          {...flow.pick('belegung_buchungen')}
          searchPlaceholder={tx('Hund oder Notiz suchen …')}
          emptyText={tx('Es gibt keine aktive Buchung, die abgeschlossen werden könnte.')}
        />
      </WizardStep>
      <WizardStep
        label={tx('Ergebnis')}
        description={tx('Wurde der Aufenthalt regulär beendet oder storniert?')}
        needs={['belegung_buchungen']}
      >
        <div className="space-y-4">
          <Field form={form} name="status">
            <ChoiceGroup {...statusProps} options={closingOptions} />
          </Field>
          <StepNav
            onBack={() => setStep(1)}
            onNext={() => flow.validateStep(2)}
            nextStepLabel={tx('Prüfen')}
          />
        </div>
      </WizardStep>
      <WizardStep label={tx('Prüfen')}>
        {!flow.submit.done && (
          <SummaryStep
            forms={flow.formList}
            submit={flow.submit}
            whatHappensNext={tx('Der Platz ist danach wieder frei und der Aufenthalt erscheint mit dem neuen Status.')}
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
            { label: tx('Pfoten-Porträt erstellen'), href: '#/intents/portraet-erstellen' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
          whatHappensNext={tx('Zum Abschied kannst du für den Hund ein Pfoten-Porträt anlegen.')}
        />
      )}
    </IntentWizardShell>
  );
}
