/**
 * Pfoten-Portraet anlegen — 2-Schritt-Wizard.
 * Steps: 1) Hund auswaehlen → 2) Portraet-Inhalte eingeben & speichern.
 * Reads: hundekartei (enriched). Writes: pfoten_portraet (createPfotenPortraetEntry).
 * Composes: IntentWizardShell, EntitySelectStep.
 */

import { useState } from 'react';
import { format } from 'date-fns';
import { IconPaw, IconCheck, IconFileText } from '@tabler/icons-react';
import { tx } from '@/i18n';
import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichHundekartei } from '@/lib/enrich';
import type { EnrichedHundekartei } from '@/types/enriched';
import { APP_IDS } from '@/types/app';
import { LivingAppsService, createRecordUrl, extractRecordId } from '@/services/livingAppsService';
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

  // Completion state
  const [savedPortraetId, setSavedPortraetId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const enrichedHunde = enrichHundekartei(hundekartei, { besitzerMap });

  const handleHundSelect = (id: string) => {
    const hund = enrichedHunde.find(h => h.record_id === id) ?? null;
    setSelectedHund(hund);
    setStep(2);
  };

  const handleSave = async () => {
    if (!selectedHund || !titel) return;

    // Guard against duplicate create on retry
    if (savedPortraetId) return;

    const besitzerId = extractRecordId(selectedHund.fields.besitzer);

    setSaving(true);
    setSaveError(null);
    try {
      const result = await LivingAppsService.createPfotenPortraetEntry({
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
      setSavedPortraetId(result.record_id);
      await fetchAll();
      setStep(3);
    } catch {
      setSaveError(tx('Speichern fehlgeschlagen. Bitte erneut versuchen.'));
    } finally {
      setSaving(false);
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
    setSavedPortraetId(null);
    setSaveError(null);
  };

  return (
    <IntentWizardShell
      title={tx('Pfoten-Portraet anlegen')}
      subtitle={tx('Erstelle ein persönliches Portraet für einen Hund')}
      steps={[
        { label: tx('Hund wählen') },
        { label: tx('Inhalte eingeben') },
        { label: tx('Fertig') },
      ]}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* Step 1: Hund auswählen */}
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

      {/* Step 2: Portraet-Inhalte eingeben */}
      {step === 2 && (
        selectedHund ? (
          <div className="space-y-6">
            {/* Hund-Info-Karte */}
            <div className="rounded-2xl border bg-secondary/40 p-4 flex items-center gap-3">
              <IconPaw size={24} className="text-primary shrink-0" />
              <div className="min-w-0">
                <p className="font-semibold truncate">
                  {selectedHund.fields.name ?? tx('Hund')}
                </p>
                <p className="text-sm text-muted-foreground truncate">
                  {[selectedHund.fields.rasse, selectedHund.besitzerName]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 ml-auto"
                onClick={() => setStep(1)}
              >
                {tx('Ändern')}
              </Button>
            </div>

            {/* Formular */}
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="titel">
                  {tx('Titel')}
                  <span className="text-destructive ml-1">*</span>
                </Label>
                <Input
                  id="titel"
                  value={titel}
                  onChange={e => setTitel(e.target.value)}
                  placeholder={tx('z. B. Das Leben mit Bello')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="widmung">{tx('Widmung')}</Label>
                <Textarea
                  id="widmung"
                  value={widmung}
                  onChange={e => setWidmung(e.target.value)}
                  placeholder={tx('Eine persönliche Widmung …')}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="charakterbeschreibung">{tx('Charakterbeschreibung')}</Label>
                <Textarea
                  id="charakterbeschreibung"
                  value={charakterbeschreibung}
                  onChange={e => setCharakterbeschreibung(e.target.value)}
                  placeholder={tx('Wie ist der Hund so? Was macht ihn besonders?')}
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lieblingsaktivitaet">{tx('Lieblingsaktivität')}</Label>
                <Input
                  id="lieblingsaktivitaet"
                  value={lieblingsaktivitaet}
                  onChange={e => setLieblingsaktivitaet(e.target.value)}
                  placeholder={tx('z. B. Apportieren im Park')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="besondere-momente">{tx('Besondere Momente')}</Label>
                <Textarea
                  id="besondere-momente"
                  value={besondereMomente}
                  onChange={e => setBesondereMomente(e.target.value)}
                  placeholder={tx('Unvergessliche Erlebnisse und Erinnerungen …')}
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="erstellungsdatum">{tx('Erstellungsdatum')}</Label>
                <Input
                  id="erstellungsdatum"
                  type="date"
                  value={erstellungsdatum}
                  onChange={e => setErstellungsdatum(e.target.value)}
                />
              </div>
            </div>

            {saveError && (
              <p className="text-sm text-destructive">{saveError}</p>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                className="shrink-0"
              >
                {tx('Zurück')}
              </Button>
              <Button
                onClick={handleSave}
                disabled={!titel || saving}
                className="flex-1"
              >
                {saving ? tx('Speichern …') : tx('Portraet speichern')}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              {tx('Das Portraet-Foto kann nach dem Speichern über die Verwaltungsseite hochgeladen werden.')}
            </p>
          </div>
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

      {/* Step 3: Fertig */}
      {step === 3 && (
        savedPortraetId ? (
          <div className="flex flex-col items-center text-center py-12 space-y-6">
            <div className="rounded-full bg-primary/10 p-5">
              <IconCheck size={40} className="text-primary" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">
                {tx('Portraet gespeichert!')}
              </h2>
              <p className="text-muted-foreground max-w-sm">
                {tx('Das Pfoten-Portraet für')}
                {' '}
                <strong>{selectedHund?.fields.name ?? tx('den Hund')}</strong>
                {' '}
                {tx('wurde erfolgreich angelegt.')}
              </p>
              {selectedHund?.fields.name && (
                <p className="text-sm text-muted-foreground">
                  <IconFileText size={14} className="inline mr-1 shrink-0" />
                  {titel}
                </p>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
              <Button onClick={handleReset} variant="outline" className="flex-1">
                {tx('Neues Portraet anlegen')}
              </Button>
              <Button asChild className="flex-1">
                <a href="#/">{tx('Zum Dashboard')}</a>
              </Button>
            </div>
          </div>
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
