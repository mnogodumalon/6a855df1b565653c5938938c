/**
 * Pfoten-Portraet anlegen — 2-Schritt-Wizard.
 * Steps: 1) Hund auswählen → 2) Portraet verfassen & speichern.
 * Reads: hundekartei (enriched mit besitzerName). Writes: pfoten_portraet (createPfotenPortraetEntry).
 * Composes: IntentWizardShell, EntitySelectStep.
 */
import { useState } from 'react';
import { format } from 'date-fns';
import { IconPaw, IconHeart, IconCheck } from '@tabler/icons-react';
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
  const [selectedBesitzerId, setSelectedBesitzerId] = useState<string>('');

  // Step 2 form fields
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

  const handleHundSelect = (id: string) => {
    const hund = enrichedHunde.find(h => h.record_id === id);
    if (!hund) return;
    setSelectedHund(hund);
    const besitzerId = extractRecordId(hund.fields.besitzer);
    setSelectedBesitzerId(besitzerId ?? '');
    setStep(2);
  };

  const handleSave = async () => {
    if (!selectedHund || !titel) return;
    setSaving(true);
    setSaveError(null);
    try {
      await LivingAppsService.createPfotenPortraetEntry({
        hund: createRecordUrl(APP_IDS.HUNDEKARTEI, selectedHund.record_id),
        besitzer: selectedBesitzerId
          ? createRecordUrl(APP_IDS.BESITZER, selectedBesitzerId)
          : undefined,
        titel,
        widmung: widmung || undefined,
        charakterbeschreibung: charakterbeschreibung || undefined,
        lieblingsaktivitaet: lieblingsaktivitaet || undefined,
        besondere_momente: besondereMomente || undefined,
        erstellungsdatum,
      });
      setDone(true);
    } catch {
      setSaveError(tx('Speichern fehlgeschlagen. Bitte erneut versuchen.'));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setSelectedHund(null);
    setSelectedBesitzerId('');
    setTitel('');
    setWidmung('');
    setCharakterbeschreibung('');
    setLieblingsaktivitaet('');
    setBesondereMomente('');
    setErstellungsdatum(format(new Date(), 'yyyy-MM-dd'));
    setSaveError(null);
    setDone(false);
  };

  return (
    <IntentWizardShell
      title={tx('Pfoten-Portraet anlegen')}
      subtitle={tx('Ein liebevolles Portraet für deinen Vierbeiner erstellen')}
      steps={[
        { label: tx('Hund wählen') },
        { label: tx('Portraet verfassen') },
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
            subtitle: h.besitzerName
              ? tx`Besitzer: ${h.besitzerName}`
              : (h.fields.rasse ?? ''),
            icon: <IconPaw size={20} className="text-primary" />,
          }))}
          onSelect={handleHundSelect}
          searchPlaceholder={tx('Hund suchen …')}
          emptyText={tx('Kein Hund gefunden')}
          emptyIcon={<IconPaw size={32} className="text-muted-foreground" />}
        />
      )}

      {/* Step 2: Portraet verfassen */}
      {step === 2 && (
        selectedHund ? (
          <div className="space-y-6">
            {/* Hund-Info-Banner */}
            <div className="rounded-2xl border bg-card p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <IconPaw size={20} className="text-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-foreground truncate">
                  {selectedHund.fields.name ?? tx('Hund')}
                </p>
                {selectedHund.besitzerName && (
                  <p className="text-sm text-muted-foreground truncate">
                    {tx`Besitzer: ${selectedHund.besitzerName}`}
                  </p>
                )}
              </div>
            </div>

            {done ? (
              /* Erfolgszustand */
              <div className="rounded-2xl border bg-card p-8 flex flex-col items-center gap-4 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10">
                  <IconCheck size={28} className="text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-lg">
                    {tx('Portraet gespeichert!')}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {tx`Das Portraet für ${selectedHund.fields.name ?? tx('den Hund')} wurde angelegt.`}
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                  <Button onClick={handleReset} variant="outline">
                    {tx('Neues Portraet anlegen')}
                  </Button>
                  <Button asChild>
                    <a href="#/">{tx('Zurück zum Dashboard')}</a>
                  </Button>
                </div>
              </div>
            ) : (
              /* Formular */
              <div className="space-y-5">
                <div className="rounded-2xl border bg-card p-5 space-y-5">
                  <div className="flex items-center gap-2">
                    <IconHeart size={18} className="text-primary shrink-0" />
                    <h3 className="font-semibold text-foreground">
                      {tx('Portraet-Details')}
                    </h3>
                  </div>

                  {/* Titel (Pflichtfeld) */}
                  <div className="space-y-2">
                    <Label htmlFor="portraet-titel">
                      {tx('Titel')}
                      <span className="text-destructive ml-1">*</span>
                    </Label>
                    <Input
                      id="portraet-titel"
                      value={titel}
                      onChange={e => setTitel(e.target.value)}
                      placeholder={tx('z. B. „Bello — der sonnige Lausbub"')}
                    />
                  </div>

                  {/* Erstellungsdatum */}
                  <div className="space-y-2">
                    <Label htmlFor="portraet-datum">{tx('Erstellungsdatum')}</Label>
                    <Input
                      id="portraet-datum"
                      type="date"
                      value={erstellungsdatum}
                      onChange={e => setErstellungsdatum(e.target.value)}
                    />
                  </div>

                  {/* Widmung */}
                  <div className="space-y-2">
                    <Label htmlFor="portraet-widmung">{tx('Widmung')}</Label>
                    <Textarea
                      id="portraet-widmung"
                      value={widmung}
                      onChange={e => setWidmung(e.target.value)}
                      placeholder={tx('Eine persönliche Widmung an den Hund oder die Besitzer …')}
                      rows={3}
                    />
                  </div>

                  {/* Charakterbeschreibung */}
                  <div className="space-y-2">
                    <Label htmlFor="portraet-charakter">
                      {tx('Charakterbeschreibung')}
                    </Label>
                    <Textarea
                      id="portraet-charakter"
                      value={charakterbeschreibung}
                      onChange={e => setCharakterbeschreibung(e.target.value)}
                      placeholder={tx('Wie würdest du den Charakter dieses Hundes beschreiben?')}
                      rows={4}
                    />
                  </div>

                  {/* Lieblingsaktivität */}
                  <div className="space-y-2">
                    <Label htmlFor="portraet-aktivitaet">
                      {tx('Lieblingsaktivität')}
                    </Label>
                    <Input
                      id="portraet-aktivitaet"
                      value={lieblingsaktivitaet}
                      onChange={e => setLieblingsaktivitaet(e.target.value)}
                      placeholder={tx('z. B. Apportieren, Schwimmen, Schmusen …')}
                    />
                  </div>

                  {/* Besondere Momente */}
                  <div className="space-y-2">
                    <Label htmlFor="portraet-momente">
                      {tx('Besondere Momente')}
                    </Label>
                    <Textarea
                      id="portraet-momente"
                      value={besondereMomente}
                      onChange={e => setBesondereMomente(e.target.value)}
                      placeholder={tx('Unvergessliche Erlebnisse, lustige Geschichten oder Highlights …')}
                      rows={4}
                    />
                  </div>
                </div>

                {saveError && (
                  <p className="text-sm text-destructive px-1">{saveError}</p>
                )}

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setStep(1)}
                    className="sm:w-auto w-full"
                  >
                    {tx('Anderen Hund wählen')}
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={!titel || saving}
                    className="sm:w-auto w-full"
                  >
                    {saving ? tx('Wird gespeichert …') : tx('Portraet speichern')}
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Fallback: kein Hund ausgewählt (z. B. direkter ?step=2-Aufruf) */
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">
              {tx('Dieser Schritt braucht die Auswahl eines Hundes aus Schritt 1.')}
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
