/**
 * Pfoten-Porträt erstellen — 5-Schritt-Wizard.
 * Steps: 1) Hund wählen → 2) Besitzer wird übernommen → 3) Titel, Widmung, Charakter → 4) Lieblingsaktivität & Momente → 5) Foto → Prüfen & anlegen.
 * Reads: hundekartei (Pick), besitzer (Anzeige des übernommenen Besitzers). Writes: pfoten_portraet (via usePortraetErstellenFlow).
 * Composes: IntentWizardShell, EntitySelectStep, Bound, StepNav, SummaryStep, SuccessStep.
 */
import { useEffect, useState } from 'react';
import { IconUser } from '@tabler/icons-react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Bound } from '@/components/blocks/Bound';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { fieldText, fieldRef, displayNameOf } from '@/lib/journey';
import { usePortraetErstellenFlow } from '@/lib/journey/flows/PortraetErstellen';
import { tx } from '@/i18n';

export default function PortraetErstellenPage() {
  const [step, setStep] = useState(1);
  const flow = usePortraetErstellenFlow({
    steps: { hund: 1, titel: 3, widmung: 3, charakterbeschreibung: 3, lieblingsaktivitaet: 4, besondere_momente: 4, portraet_foto: 5 },
    items: {
      hund: r => ({ id: r.id, title: fieldText(r, 'name'), subtitle: fieldText(r, 'rasse') || undefined }),
    },
  });

  const form = flow.forms.pfoten_portraet;
  const hundId = (form.get('hund') as string | undefined) ?? '';
  const hundRecord = hundId ? flow.picks.hund.recordOf(hundId) : undefined;
  const besitzerId = hundRecord ? fieldRef(hundRecord, 'besitzer') : null;
  const [besitzerName, setBesitzerName] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setBesitzerName(null);
    if (!besitzerId) return;
    flow.port.get('besitzer', besitzerId).then(r => {
      if (alive && r) setBesitzerName(displayNameOf('besitzer', r.fields));
    }).catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [besitzerId]);

  const hundName = hundId ? flow.picks.hund.labelOf(hundId) : undefined;

  return (
    <IntentWizardShell
      title={tx('Pfoten-Porträt erstellen')}
      currentStep={step}
      onStepChange={setStep}
      forms={flow.formList}
      draftKey={flow.draftKey}
      intro={{ description: tx('Ein Aufenthaltsporträt mit Foto und Geschichten für den Besitzer anlegen.'), needs: [tx('Den Hund aus der Kartei'), tx('Ein Foto für das Porträt')] }}
    >
      <WizardStep label={tx('Hund')} description={tx('Für welchen Gast soll das Porträt entstehen?')}>
        <EntitySelectStep {...flow.picks.hund.select} {...flow.pick('hund')} searchPlaceholder={tx('Name des Hundes …')} />
      </WizardStep>

      <WizardStep label={tx('Besitzer')} description={tx('Der Besitzer kommt automatisch aus der Hundekartei.')} needs={['hund']}>
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-2xl border bg-card p-4 overflow-hidden">
            <IconUser size={28} className="shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="truncate font-medium">{besitzerName ?? tx('Besitzer wird geladen …')}</p>
              <p className="truncate text-sm text-muted-foreground">{tx`Besitzer von ${hundName ?? ''}`}</p>
            </div>
          </div>
          <StepNav onBack={() => setStep(1)} nextStepLabel={tx('Titel & Widmung')} />
        </div>
      </WizardStep>

      <WizardStep label={tx('Titel & Charakter')} description={tx('Wie heißt das Porträt und was macht den Hund aus?')} needs={['hund']}>
        <div className="space-y-4">
          <Bound form={form} name="titel" />
          <Bound form={form} name="widmung" rows={3} />
          <Bound form={form} name="charakterbeschreibung" rows={4} />
          <StepNav onBack={() => setStep(2)} onNext={() => flow.validateStep(3)} nextStepLabel={tx('Geschichten')} />
        </div>
      </WizardStep>

      <WizardStep label={tx('Geschichten')} description={tx('Was liebt der Hund und was war besonders?')} needs={['hund']}>
        <div className="space-y-4">
          <Bound form={form} name="lieblingsaktivitaet" />
          <Bound form={form} name="besondere_momente" rows={4} />
          <StepNav onBack={() => setStep(3)} onNext={() => flow.validateStep(4)} nextStepLabel={tx('Foto')} />
        </div>
      </WizardStep>

      <WizardStep label={tx('Foto')} description={tx('Ein schönes Foto für das Porträt hochladen.')} needs={['hund']}>
        <div className="space-y-4">
          <Bound form={form} name="portraet_foto" />
          <StepNav onBack={() => setStep(4)} onNext={() => flow.validateStep(5)} nextStepLabel={tx('Prüfen')} />
        </div>
      </WizardStep>

      <WizardStep label={tx('Prüfen')}>
        {!flow.submit.done && (
          <SummaryStep
            forms={flow.formList}
            submit={flow.submit}
            items={[
              { key: 'besitzer-info', label: tx('Besitzer'), value: besitzerName ?? tx('Aus der Hundekartei') },
            ]}
            whatHappensNext={tx('Das Porträt wird mit dem heutigen Datum gespeichert und dem Besitzer des Hundes zugeordnet.')}
          />
        )}
      </WizardStep>

      {flow.submit.result && (
        <SuccessStep
          result={flow.submit.result}
          forms={flow.formList}
          submit={flow.submit}
          next={[
            { label: tx('Aufenthalt buchen'), href: '#/intents/aufenthalt-buchen' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
          whatHappensNext={tx('Das Porträt ist gespeichert und kann dem Besitzer gezeigt werden.')}
        />
      )}
    </IntentWizardShell>
  );
}
