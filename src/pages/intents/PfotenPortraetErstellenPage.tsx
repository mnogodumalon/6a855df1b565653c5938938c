/**
 * Pfoten-Portraet erstellen — 2-Schritt-Wizard.
 * Steps: 1) Hund auswaehlen → 2) Portraet gestalten & anlegen.
 * Reads: hundekartei, besitzer (via besitzerMap).
 * Writes: pfoten_portraet (createPfotenPortraetEntry).
 * Composes: IntentWizardShell, EntitySelectStep.
 */
import { useState } from 'react';
import { format } from 'date-fns';
import { IconPaw, IconHeart } from '@tabler/icons-react';
import { tx } from '@/i18n';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichHundekartei } from '@/lib/enrich';
import { LivingAppsService, createRecordUrl, extractRecordId } from '@/services/livingAppsService';
import { APP_IDS } from '@/types/app';
import type { EnrichedHundekartei } from '@/types/enriched';

export default function PfotenPortraetErstellenPage() {
  const data = useDashboardData();
  const { hundekartei, besitzerMap, loading, error, fetchAll } = data;

  const [step, setStep] = useState(1);
  const [selectedHund, setSelectedHund] = useState<EnrichedHundekartei | null>(null);

  // Step 2 form state
  const [titel, setTitel] = useState('');
  const [widmung, setWidmung] = useState('');
  const [charakterbeschreibung, setCharakterbeschreibung] = useState('');
  const [lieblingsaktivitaet, setLieblingsaktivitaet] = useState('');
  const [besondereMomente, setBesondereMomente] = useState('');
  const [erstellungsdatum, setErstellungsdatum] = useState(format(new Date(), 'yyyy-MM-dd'));

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const enrichedHunde = enrichHundekartei(hundekartei, { besitzerMap });

  const handleHundSelect = (id: string) => {
    const hund = enrichedHunde.find(h => h.record_id === id);
    if (hund) {
      setSelectedHund(hund);
      setStep(2);
    }
  };

  const handleSubmit = async () => {
    if (!selectedHund || !titel || !erstellungsdatum) return;

    const besitzerId = extractRecordId(selectedHund.fields.besitzer);
    if (!besitzerId) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      await LivingAppsService.createPfotenPortraetEntry({
        hund: createRecordUrl(APP_IDS.HUNDEKARTEI, selectedHund.record_id),
        besitzer: createRecordUrl(APP_IDS.BESITZER, besitzerId),
        titel,
        widmung: widmung || undefined,
        charakterbeschreibung: charakterbeschreibung || undefined,
        lieblingsaktivitaet: lieblingsaktivitaet || undefined,
        besondere_momente: besondereMomente || undefined,
        erstellungsdatum,
      });
      await fetchAll();
      setDone(true);
    } catch {
      setSubmitError(tx('Das Portraet konnte nicht gespeichert werden. Bitte versuche es erneut.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setSelectedHund(null);
    setTitel('');
    setWidmung('');
    setCharakterbeschreibung('');
    setLieblingsaktivitaet('');
    setBesondereMomente('');
    setErstellungsdatum(format(new Date(), 'yyyy-MM-dd'));
    setSubmitError(null);
    setDone(false);
    setStep(1);
  };

  const canSubmit = !!titel && !!erstellungsdatum && !submitting;

  return (
    <IntentWizardShell
      title={tx('Pfoten-Portraet erstellen')}
      subtitle={tx('Ein persoenliches Andenken fuer Hund und Besitzer')}
      steps={[{ label: tx('Hund waehlen') }, { label: tx('Portraet gestalten') }]}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* Step 1: Hund auswaehlen */}
      {step === 1 && (
        <EntitySelectStep
          items={enrichedHunde.map(h => ({
            id: h.record_id,
            title: h.fields.name ?? tx('Unbekannter Hund'),
            subtitle: [h.fields.rasse, h.besitzerName].filter(Boolean).join(' · '),
            icon: <IconPaw size={20} className="text-primary" />,
          }))}
          onSelect={handleHundSelect}
          searchPlaceholder={tx('Hund suchen ...')}
          emptyText={tx('Kein Hund gefunden')}
          emptyIcon={<IconPaw size={32} className="text-muted-foreground" />}
        />
      )}

      {/* Step 2: Portraet gestalten */}
      {step === 2 && (
        selectedHund ? (
          done ? (
            <div className="flex flex-col items-center gap-6 py-12 text-center">
              <div className="rounded-full bg-primary/10 p-5">
                <IconHeart size={48} className="text-primary" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-semibold">{tx('Portraet erstellt!')}</h2>
                <p className="text-muted-foreground">
                  {tx('Das Pfoten-Portraet fuer')} <strong>{selectedHund.fields.name}</strong> {tx('wurde erfolgreich angelegt.')}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button variant="outline" onClick={handleReset}>
                  {tx('Weiteres Portraet erstellen')}
                </Button>
                <Button asChild>
                  <a href="#/">{tx('Zurueck zum Dashboard')}</a>
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6 max-w-2xl mx-auto">
              {/* Gewaehlter Hund */}
              <div className="rounded-2xl border bg-secondary/40 p-4 flex items-center gap-3">
                <div className="rounded-full bg-primary/10 p-2">
                  <IconPaw size={20} className="text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium truncate">{selectedHund.fields.name}</p>
                  <p className="text-sm text-muted-foreground truncate">
                    {[selectedHund.fields.rasse, selectedHund.besitzerName].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto shrink-0"
                  onClick={() => setStep(1)}
                >
                  {tx('Aendern')}
                </Button>
              </div>

              {/* Mini-Form */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="pp-titel">{tx('Titel')} <span className="text-destructive">*</span></Label>
                  <Input
                    id="pp-titel"
                    value={titel}
                    onChange={e => setTitel(e.target.value)}
                    placeholder={tx('z. B. Bello – unser treuer Begleiter')}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="pp-widmung">{tx('Widmung')}</Label>
                  <Textarea
                    id="pp-widmung"
                    value={widmung}
                    onChange={e => setWidmung(e.target.value)}
                    placeholder={tx('Eine persoenliche Widmung an den Hund oder Besitzer ...')}
                    rows={3}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="pp-charakter">{tx('Charakterbeschreibung')}</Label>
                  <Textarea
                    id="pp-charakter"
                    value={charakterbeschreibung}
                    onChange={e => setCharakterbeschreibung(e.target.value)}
                    placeholder={tx('Was macht diesen Hund besonders?')}
                    rows={3}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="pp-aktivitaet">{tx('Lieblingsaktivitaet')}</Label>
                  <Input
                    id="pp-aktivitaet"
                    value={lieblingsaktivitaet}
                    onChange={e => setLieblingsaktivitaet(e.target.value)}
                    placeholder={tx('z. B. Ballspielen im Park')}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="pp-momente">{tx('Besondere Momente')}</Label>
                  <Textarea
                    id="pp-momente"
                    value={besondereMomente}
                    onChange={e => setBesondereMomente(e.target.value)}
                    placeholder={tx('Unvergessliche Erlebnisse und Erinnerungen ...')}
                    rows={3}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="pp-datum">{tx('Erstellungsdatum')} <span className="text-destructive">*</span></Label>
                  <Input
                    id="pp-datum"
                    type="date"
                    value={erstellungsdatum}
                    onChange={e => setErstellungsdatum(e.target.value)}
                  />
                </div>
              </div>

              {submitError && (
                <p className="text-sm text-destructive">{submitError}</p>
              )}

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button variant="outline" onClick={() => setStep(1)} className="sm:w-auto w-full">
                  {tx('Zurueck')}
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className="sm:w-auto w-full"
                >
                  {submitting ? tx('Wird gespeichert ...') : tx('Portraet anlegen')}
                </Button>
              </div>
            </div>
          )
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">
              {tx('Dieser Schritt braucht die Auswahl aus Schritt 1.')}
            </p>
            <Button variant="outline" onClick={() => setStep(1)}>
              {tx('Neu starten')}
            </Button>
          </div>
        )
      )}
    </IntentWizardShell>
  );
}
