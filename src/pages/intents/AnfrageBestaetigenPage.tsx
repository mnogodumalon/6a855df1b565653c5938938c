/**
 * Anfrage bestätigen — 3-Schritt-Wizard.
 * Steps: 1) Buchungsanfrage wählen (nur Status 'neu') → 2) Details prüfen und Entscheidung treffen
 *        (ablehnen oder bestätigen) → 3) Aufenthalt anlegen (Belegung erstellen).
 * Reads: buchungsanfragen. Writes: buchungsanfragen (updateBuchungsanfragenEntry),
 *        belegung_buchungen (createBelegungBuchungenEntry).
 * Composes: IntentWizardShell, EntitySelectStep.
 */
import { useState } from 'react';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { StatusBadge } from '@/components/blocks/StatusBadge';
import { useDashboardData } from '@/hooks/useDashboardData';
import { LivingAppsService } from '@/services/livingAppsService';
import type { Buchungsanfragen } from '@/types/app';
import { LOOKUP_OPTIONS } from '@/types/app';
import { tx } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { IconCheck, IconX, IconCalendar, IconUser, IconDog, IconPhone, IconMail, IconMessageCircle, IconRuler } from '@tabler/icons-react';

export default function AnfrageBestaetigenPage() {
  const { buchungsanfragen, loading, error, fetchAll } = useDashboardData();

  const [step, setStep] = useState(1);
  const [selectedAnfrage, setSelectedAnfrage] = useState<Buchungsanfragen | null>(null);

  // Step 3 form state
  const [anreisedatum, setAnreisedatum] = useState('');
  const [abreisedatum, setAbreisedatum] = useState('');
  const [platznummerKey, setPlatznummerKey] = useState('none');
  const [preisEuro, setPreisEuro] = useState('');
  const [notizen, setNotizen] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const PLATZNUMMER_OPTIONS = LOOKUP_OPTIONS['belegung_buchungen']?.['platznummer'] ?? [];

  const offeneAnfragen = buchungsanfragen.filter(
    (a) => a.fields.anfrage_status?.key === 'neu'
  );

  const handleSelectAnfrage = (id: string) => {
    const found = offeneAnfragen.find((a) => a.record_id === id) ?? null;
    setSelectedAnfrage(found);
    if (found) {
      setAnreisedatum(found.fields.wunsch_anreise ?? '');
      setAbreisedatum(found.fields.wunsch_abreise ?? '');
    }
    setStep(2);
  };

  const handleAblehnen = async () => {
    if (!selectedAnfrage) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await LivingAppsService.updateBuchungsanfragenEntry(selectedAnfrage.record_id, {
        anfrage_status: 'abgelehnt',
      });
      await fetchAll();
      window.location.hash = '/';
    } catch {
      setSubmitError(tx('Ablehnung fehlgeschlagen. Bitte erneut versuchen.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleBestaetigenUndWeiter = async () => {
    if (!selectedAnfrage) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await LivingAppsService.updateBuchungsanfragenEntry(selectedAnfrage.record_id, {
        anfrage_status: 'bestaetigt',
      });
      await fetchAll();
      setStep(3);
    } catch {
      setSubmitError(tx('Bestätigung fehlgeschlagen. Bitte erneut versuchen.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleAufenthaltAnlegen = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await LivingAppsService.createBelegungBuchungenEntry({
        anreisedatum: anreisedatum || undefined,
        abreisedatum: abreisedatum || undefined,
        platznummer: platznummerKey !== 'none' ? platznummerKey : undefined,
        status: 'aktiv',
        preis_euro: preisEuro ? Number(preisEuro) : undefined,
        notizen: notizen || undefined,
      });
      await fetchAll();
      window.location.hash = '/';
    } catch {
      setSubmitError(tx('Aufenthalt konnte nicht angelegt werden. Bitte erneut versuchen.'));
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmitAufenthalt = !!anreisedatum && !!abreisedatum;

  return (
    <IntentWizardShell
      title={tx('Anfrage bearbeiten')}
      subtitle={tx('Buchungsanfrage prüfen, bestätigen und Aufenthalt anlegen')}
      steps={[
        { label: tx('Buchungsanfrage') },
        { label: tx('Bearbeiten') },
        { label: tx('Aufenthalt') },
      ]}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* Step 1 — Anfrage wählen */}
      {step === 1 && (
        <EntitySelectStep
          items={offeneAnfragen.map((a) => ({
            id: a.record_id,
            title:
              `${a.fields.interessent_vorname ?? ''} ${a.fields.interessent_nachname ?? ''}`.trim() +
              (a.fields.hund_name ? ` — ${a.fields.hund_name}` : ''),
            subtitle:
              a.fields.wunsch_anreise && a.fields.wunsch_abreise
                ? `${a.fields.wunsch_anreise} bis ${a.fields.wunsch_abreise}`
                : a.fields.wunsch_anreise ?? '',
            status: a.fields.anfrage_status
              ? { key: a.fields.anfrage_status.key, label: a.fields.anfrage_status.label }
              : undefined,
            icon: <IconDog size={20} className="text-primary shrink-0" />,
          }))}
          onSelect={handleSelectAnfrage}
          searchPlaceholder={tx('Nach Name oder Hund suchen …')}
          emptyText={tx('Keine offenen Buchungsanfragen vorhanden.')}
          emptyIcon={<IconDog size={48} className="text-muted-foreground" />}
        />
      )}

      {/* Step 2 — Details und Entscheidung */}
      {step === 2 && (
        selectedAnfrage ? (
          <div className="space-y-6">
            {/* Summary card */}
            <div className="rounded-2xl border bg-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-base">{tx('Buchungsanfrage')}</h2>
                <StatusBadge
                  statusKey={selectedAnfrage.fields.anfrage_status?.key}
                  label={selectedAnfrage.fields.anfrage_status?.label}
                />
              </div>

              {/* Kontaktdaten */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {tx('Kontakt')}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 text-sm">
                    <IconUser size={16} className="shrink-0 text-muted-foreground" />
                    <span>
                      {[selectedAnfrage.fields.interessent_vorname, selectedAnfrage.fields.interessent_nachname]
                        .filter(Boolean)
                        .join(' ') || '—'}
                    </span>
                  </div>
                  {selectedAnfrage.fields.interessent_telefon && (
                    <div className="flex items-center gap-2 text-sm">
                      <IconPhone size={16} className="shrink-0 text-muted-foreground" />
                      <span>{selectedAnfrage.fields.interessent_telefon}</span>
                    </div>
                  )}
                  {selectedAnfrage.fields.interessent_email && (
                    <div className="flex items-center gap-2 text-sm">
                      <IconMail size={16} className="shrink-0 text-muted-foreground" />
                      <span className="truncate">{selectedAnfrage.fields.interessent_email}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Hunddaten */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {tx('Hund')}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {selectedAnfrage.fields.hund_name && (
                    <div className="flex items-center gap-2 text-sm">
                      <IconDog size={16} className="shrink-0 text-muted-foreground" />
                      <span>{selectedAnfrage.fields.hund_name}</span>
                    </div>
                  )}
                  {selectedAnfrage.fields.hund_rasse && (
                    <div className="flex items-center gap-2 text-sm">
                      <IconDog size={16} className="shrink-0 text-muted-foreground" />
                      <span>{selectedAnfrage.fields.hund_rasse}</span>
                    </div>
                  )}
                  {selectedAnfrage.fields.hund_groesse && (
                    <div className="flex items-center gap-2 text-sm">
                      <IconRuler size={16} className="shrink-0 text-muted-foreground" />
                      <span>{selectedAnfrage.fields.hund_groesse.label}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Zeitraum */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {tx('Gewünschter Zeitraum')}
                </p>
                <div className="flex items-center gap-2 text-sm">
                  <IconCalendar size={16} className="shrink-0 text-muted-foreground" />
                  <span>
                    {selectedAnfrage.fields.wunsch_anreise ?? '—'}
                    {selectedAnfrage.fields.wunsch_abreise
                      ? ` ${tx('bis')} ${selectedAnfrage.fields.wunsch_abreise}`
                      : ''}
                  </span>
                </div>
              </div>

              {/* Nachricht */}
              {selectedAnfrage.fields.nachricht && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {tx('Nachricht')}
                  </p>
                  <div className="flex items-start gap-2 text-sm">
                    <IconMessageCircle size={16} className="shrink-0 text-muted-foreground mt-0.5" />
                    <p className="whitespace-pre-wrap">{selectedAnfrage.fields.nachricht}</p>
                  </div>
                </div>
              )}
            </div>

            {submitError && (
              <p className="text-sm text-destructive">{submitError}</p>
            )}

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                className="flex-1 border-destructive text-destructive hover:bg-destructive/10"
                onClick={handleAblehnen}
                disabled={submitting}
              >
                <IconX size={16} className="shrink-0 mr-2" />
                {tx('Ablehnen')}
              </Button>
              <Button
                className="flex-1"
                onClick={handleBestaetigenUndWeiter}
                disabled={submitting}
              >
                <IconCheck size={16} className="shrink-0 mr-2" />
                {tx('Bestätigen und Aufenthalt anlegen')}
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

      {/* Step 3 — Aufenthalt anlegen */}
      {step === 3 && (
        selectedAnfrage ? (
          <div className="space-y-6">
            <div className="rounded-2xl border bg-card p-5 space-y-4">
              <h2 className="font-semibold text-base">{tx('Aufenthalt anlegen')}</h2>
              <p className="text-sm text-muted-foreground">
                {tx('Für')}
                {' '}
                <strong>
                  {[selectedAnfrage.fields.interessent_vorname, selectedAnfrage.fields.interessent_nachname]
                    .filter(Boolean)
                    .join(' ')}
                </strong>
                {selectedAnfrage.fields.hund_name ? ` ${tx('und')} ${selectedAnfrage.fields.hund_name}` : ''}
                {'. '}
                {tx('Besitzer und Hund können später auf der Detailseite verknüpft werden.')}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium" htmlFor="anreisedatum">
                    {tx('Anreisedatum')} <span className="text-destructive">*</span>
                  </label>
                  <Input
                    id="anreisedatum"
                    type="date"
                    value={anreisedatum}
                    onChange={(e) => setAnreisedatum(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium" htmlFor="abreisedatum">
                    {tx('Abreisedatum')} <span className="text-destructive">*</span>
                  </label>
                  <Input
                    id="abreisedatum"
                    type="date"
                    value={abreisedatum}
                    onChange={(e) => setAbreisedatum(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="platznummer">
                  {tx('Platznummer')}
                </label>
                <Select value={platznummerKey} onValueChange={setPlatznummerKey}>
                  <SelectTrigger id="platznummer">
                    <SelectValue placeholder={tx('Platz wählen …')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{tx('Kein Platz gewählt')}</SelectItem>
                    {PLATZNUMMER_OPTIONS.map((opt) => (
                      <SelectItem key={opt.key} value={opt.key}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="preis">
                  {tx('Preis (€)')}
                </label>
                <Input
                  id="preis"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={preisEuro}
                  onChange={(e) => setPreisEuro(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="notizen">
                  {tx('Notizen')}
                </label>
                <Textarea
                  id="notizen"
                  placeholder={tx('Besondere Hinweise, Absprachen …')}
                  value={notizen}
                  onChange={(e) => setNotizen(e.target.value)}
                  rows={3}
                />
              </div>
            </div>

            {submitError && (
              <p className="text-sm text-destructive">{submitError}</p>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                onClick={() => setStep(2)}
                disabled={submitting}
                className="sm:w-auto"
              >
                {tx('Zurück')}
              </Button>
              <Button
                className="flex-1"
                onClick={handleAufenthaltAnlegen}
                disabled={!canSubmitAufenthalt || submitting}
              >
                <IconCheck size={16} className="shrink-0 mr-2" />
                {tx('Aufenthalt anlegen')}
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
