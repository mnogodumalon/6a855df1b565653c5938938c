/**
 * Pfoten-Portraet erstellen — 2-Schritt-Wizard.
 * Steps: 1) Hund auswaehlen → 2) Portraet-Details erfassen & speichern.
 * Reads: hundekartei, besitzer. Writes: pfoten_portraet (createPfotenPortraetEntry).
 * Composes: IntentWizardShell, EntitySelectStep.
 */
import { useState } from 'react';
import { format } from 'date-fns';
import { IconPaw, IconAlertCircle } from '@tabler/icons-react';
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

export default function PfotenPortraetErstellenPage() {
  const data = useDashboardData();
  const { hundekartei, besitzerMap, loading, error, fetchAll } = data;

  const [step, setStep] = useState(1);
  const [selectedHund, setSelectedHund] = useState<EnrichedHundekartei | null>(null);
  const [besitzerId, setBesitzerId] = useState<string | null>(null);

  // Schritt 2 Felder
  const [titel, setTitel] = useState('');
  const [widmung, setWidmung] = useState('');
  const [charakterbeschreibung, setCharakterbeschreibung] = useState('');
  const [lieblingsaktivitaet, setLieblingsaktivitaet] = useState('');
  const [besondereMomente, setBesondereMomente] = useState('');
  const [erstellungsdatum, setErstellungsdatum] = useState(
    format(new Date(), 'yyyy-MM-dd')
  );

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const enrichedHunde = enrichHundekartei(hundekartei, { besitzerMap });

  const handleSelectHund = (id: string) => {
    const hund = enrichedHunde.find(h => h.record_id === id);
    if (!hund) return;
    setSelectedHund(hund);
    const bid = extractRecordId(hund.fields.besitzer);
    setBesitzerId(bid ?? null);
    setStep(2);
  };

  const handleSubmit = async () => {
    if (!selectedHund || !titel) return;
    setSaving(true);
    setSaveError(null);
    try {
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
      setDone(true);
    } catch {
      setSaveError(tx('Speichern fehlgeschlagen. Bitte nochmal versuchen.'));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setSelectedHund(null);
    setBesitzerId(null);
    setTitel('');
    setWidmung('');
    setCharakterbeschreibung('');
    setLieblingsaktivitaet('');
    setBesondereMomente('');
    setErstellungsdatum(format(new Date(), 'yyyy-MM-dd'));
    setSaveError(null);
    setDone(false);
  };

  if (done) {
    return (
      <IntentWizardShell
        title={tx('Pfoten-Portraet erstellen')}
        subtitle={tx('Individuelles Portraet fuer einen Hund anlegen')}
        steps={[{ label: tx('Hund auswaehlen') }, { label: tx('Portraet erstellen') }]}
        currentStep={2}
        onStepChange={setStep}
        loading={loading}
        error={error}
        onRetry={fetchAll}
      >
        <div className="flex flex-col items-center justify-center gap-6 py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <IconPaw size={36} className="text-primary" stroke={1.5} />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">{tx('Portraet gespeichert!')}</h2>
            <p className="text-sm text-muted-foreground">
              {tx('Das Portraet fuer')} <span className="font-medium">{selectedHund?.fields.name}</span> {tx('wurde erfolgreich angelegt.')}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button variant="outline" onClick={handleReset}>
              {tx('Neues Portraet anlegen')}
            </Button>
            <Button asChild>
              <a href="#/">{tx('Zurueck zum Dashboard')}</a>
            </Button>
          </div>
        </div>
      </IntentWizardShell>
    );
  }

  return (
    <IntentWizardShell
      title={tx('Pfoten-Portraet erstellen')}
      subtitle={tx('Individuelles Portraet fuer einen Hund anlegen')}
      steps={[{ label: tx('Hund auswaehlen') }, { label: tx('Portraet erstellen') }]}
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
            title: h.fields.name ?? tx('Unbenannter Hund'),
            subtitle: [h.fields.rasse, h.besitzerName].filter(Boolean).join(' · '),
            icon: <IconPaw size={20} className="text-primary" stroke={1.5} />,
          }))}
          onSelect={handleSelectHund}
          searchPlaceholder={tx('Hund suchen …')}
          emptyText={tx('Kein Hund gefunden')}
          emptyIcon={<IconPaw size={32} className="text-muted-foreground" stroke={1.5} />}
        />
      )}

      {step === 2 && (
        selectedHund ? (
          <div className="space-y-6">
            {/* Kontext: ausgewaehlter Hund */}
            <div className="flex items-center gap-3 rounded-2xl border bg-secondary/40 px-4 py-3">
              <IconPaw size={20} className="shrink-0 text-primary" stroke={1.5} />
              <div className="min-w-0">
                <p className="truncate font-medium">{selectedHund.fields.name}</p>
                <p className="truncate text-xs text-muted-foreground">
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

            {/* Formular */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="pp-titel">
                  {tx('Titel')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="pp-titel"
                  value={titel}
                  onChange={e => setTitel(e.target.value)}
                  placeholder={tx('z. B. Max — der Sonnenschein')}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pp-widmung">{tx('Widmung')}</Label>
                <Textarea
                  id="pp-widmung"
                  value={widmung}
                  onChange={e => setWidmung(e.target.value)}
                  placeholder={tx('Eine persoenliche Widmung ...')}
                  rows={3}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pp-charakter">{tx('Charakterbeschreibung')}</Label>
                <Textarea
                  id="pp-charakter"
                  value={charakterbeschreibung}
                  onChange={e => setCharakterbeschreibung(e.target.value)}
                  placeholder={tx('Was macht diesen Hund besonders? ...')}
                  rows={3}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pp-aktivitaet">{tx('Lieblingsaktivitaet')}</Label>
                <Input
                  id="pp-aktivitaet"
                  value={lieblingsaktivitaet}
                  onChange={e => setLieblingsaktivitaet(e.target.value)}
                  placeholder={tx('z. B. Stöcke apportieren, Schwimmen, ...')}
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
                <Label htmlFor="pp-datum">{tx('Erstellungsdatum')}</Label>
                <Input
                  id="pp-datum"
                  type="date"
                  value={erstellungsdatum}
                  onChange={e => setErstellungsdatum(e.target.value)}
                />
              </div>
            </div>

            {saveError && (
              <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                <IconAlertCircle size={16} className="shrink-0" stroke={1.5} />
                {saveError}
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                {tx('Zurueck')}
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={saving || !titel}
              >
                {saving ? tx('Wird gespeichert …') : tx('Portraet speichern')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
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
