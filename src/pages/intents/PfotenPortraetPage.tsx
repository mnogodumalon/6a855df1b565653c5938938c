/**
 * Pfoten-Portraet anlegen — 2-Schritt-Wizard.
 * Steps: 1) Hund wählen (aus Hundekartei) → 2) Portraet-Inhalte erfassen & speichern.
 * Reads: hundekartei, besitzerMap (via useDashboardData + enrichHundekartei).
 * Writes: pfoten_portraet (createPfotenPortraetEntry).
 * Composes: IntentWizardShell, EntitySelectStep.
 */
import { useState } from 'react';
import { format } from 'date-fns';
import { IconPaw, IconCheck } from '@tabler/icons-react';
import { tx } from '@/i18n';
import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichHundekartei } from '@/lib/enrich';
import type { EnrichedHundekartei } from '@/types/enriched';
import { LivingAppsService, createRecordUrl, extractRecordId } from '@/services/livingAppsService';
import { APP_IDS } from '@/types/app';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

export default function PfotenPortraetPage() {
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
  const [erstellungsdatum, setErstellungsdatum] = useState(
    format(new Date(), 'yyyy-MM-dd')
  );

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const enrichedHunde = enrichHundekartei(hundekartei, { besitzerMap });

  const handleHundSelect = (id: string) => {
    const hund = enrichedHunde.find(h => h.record_id === id) ?? null;
    setSelectedHund(hund);
    setStep(2);
  };

  const handleSubmit = async () => {
    if (!selectedHund || !titel) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const besitzerId = extractRecordId(selectedHund.fields.besitzer);
      await LivingAppsService.createPfotenPortraetEntry({
        hund: createRecordUrl(APP_IDS.HUNDEKARTEI, selectedHund.record_id),
        besitzer: besitzerId
          ? createRecordUrl(APP_IDS.BESITZER, besitzerId)
          : undefined,
        titel,
        widmung: widmung || undefined,
        charakterbeschreibung: charakterbeschreibung || undefined,
        lieblingsaktivitaet: lieblingsaktivitaet || undefined,
        besondere_momente: besondereMomente || undefined,
        erstellungsdatum,
      });
      await fetchAll();
      setSuccess(true);
    } catch (e) {
      setSubmitError(tx('Speichern fehlgeschlagen. Bitte erneut versuchen.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setSelectedHund(null);
    setTitel('');
    setWidmung('');
    setCharakterbeschreibung('');
    setLieblingsaktivitaet('');
    setBesondereMomente('');
    setErstellungsdatum(format(new Date(), 'yyyy-MM-dd'));
    setSubmitError(null);
    setSuccess(false);
  };

  return (
    <IntentWizardShell
      title={tx('Pfoten-Portraet anlegen')}
      subtitle={tx('Erstelle ein individuelles Portraet für einen Hund')}
      steps={[{ label: tx('Hund wählen') }, { label: tx('Portraet erstellen') }]}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {step === 1 && (
        <EntitySelectStep
          items={enrichedHunde.map(h => ({
            id: h.record_id,
            title: h.fields.name ?? tx('Unbekannter Hund'),
            subtitle: [h.fields.rasse, h.besitzerName]
              .filter(Boolean)
              .join(' · '),
            icon: <IconPaw size={20} className="text-primary" />,
          }))}
          onSelect={handleHundSelect}
          searchPlaceholder={tx('Hund suchen …')}
          emptyText={tx('Kein Hund gefunden')}
          emptyIcon={<IconPaw size={32} className="text-muted-foreground" />}
        />
      )}

      {step === 2 && (
        selectedHund ? (
          success ? (
            <div className="flex flex-col items-center gap-6 py-12 text-center">
              <div className="rounded-full bg-emerald-100 p-4">
                <IconCheck size={40} className="text-emerald-600" />
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-semibold">
                  {tx('Portraet erfolgreich angelegt!')}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {tx('Das Pfoten-Portraet für')} <strong>{selectedHund.fields.name}</strong>{' '}
                  {tx('wurde gespeichert.')}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button onClick={handleReset} variant="outline">
                  {tx('Neues Portraet anlegen')}
                </Button>
                <Button asChild>
                  <a href="#/">{tx('Zurück zum Dashboard')}</a>
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6 max-w-xl">
              {/* Selected dog context */}
              <div className="rounded-2xl border bg-card p-4 flex items-center gap-3">
                <div className="rounded-full bg-primary/10 p-2">
                  <IconPaw size={20} className="text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium truncate">{selectedHund.fields.name}</p>
                  <p className="text-sm text-muted-foreground truncate">
                    {[selectedHund.fields.rasse, selectedHund.besitzerName]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto shrink-0"
                  onClick={() => setStep(1)}
                >
                  {tx('Ändern')}
                </Button>
              </div>

              {/* Portrait form */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="titel">
                    {tx('Titel')} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="titel"
                    value={titel}
                    onChange={e => setTitel(e.target.value)}
                    placeholder={tx('z. B. „Bello – der treue Begleiter"')}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="widmung">{tx('Widmung')}</Label>
                  <Textarea
                    id="widmung"
                    value={widmung}
                    onChange={e => setWidmung(e.target.value)}
                    placeholder={tx('Eine persönliche Widmung …')}
                    rows={3}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="charakterbeschreibung">
                    {tx('Charakterbeschreibung')}
                  </Label>
                  <Textarea
                    id="charakterbeschreibung"
                    value={charakterbeschreibung}
                    onChange={e => setCharakterbeschreibung(e.target.value)}
                    placeholder={tx('Was macht diesen Hund besonders?')}
                    rows={3}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="lieblingsaktivitaet">
                    {tx('Lieblingsaktivität')}
                  </Label>
                  <Input
                    id="lieblingsaktivitaet"
                    value={lieblingsaktivitaet}
                    onChange={e => setLieblingsaktivitaet(e.target.value)}
                    placeholder={tx('z. B. Apportieren, Schwimmen …')}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="besondere_momente">
                    {tx('Besondere Momente')}
                  </Label>
                  <Textarea
                    id="besondere_momente"
                    value={besondereMomente}
                    onChange={e => setBesondereMomente(e.target.value)}
                    placeholder={tx('Unvergessliche Erlebnisse und Erinnerungen …')}
                    rows={3}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="erstellungsdatum">
                    {tx('Erstellungsdatum')}
                  </Label>
                  <Input
                    id="erstellungsdatum"
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
                <Button
                  variant="outline"
                  onClick={() => setStep(1)}
                  className="sm:order-first"
                >
                  {tx('Zurück')}
                </Button>
                <Button
                  disabled={!titel || submitting}
                  onClick={handleSubmit}
                  className="flex-1"
                >
                  {submitting ? tx('Wird gespeichert …') : tx('Portraet anlegen')}
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
