/**
 * Anfrage bestätigen — 2-Schritt-Wizard.
 * Steps: 1) Offene Buchungsanfrage auswählen → 2) Bestätigen (Belegung anlegen) oder Ablehnen.
 * Reads: buchungsanfragen. Writes: besitzer (createBesitzerEntry), hundekartei (createHundekarteiEntry),
 *   belegung_buchungen (createBelegungBuchungenEntry), buchungsanfragen (updateBuchungsanfragenEntry).
 * Composes: IntentWizardShell, EntitySelectStep, StatusBadge.
 */

import { useState } from 'react';
import { tx } from '@/i18n';
import { useDashboardData } from '@/hooks/useDashboardData';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import { lookupKey, formatDate } from '@/lib/formatters';
import { LOOKUP_OPTIONS } from '@/types/app';
import type { Buchungsanfragen } from '@/types/app';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { StatusBadge } from '@/components/blocks/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { IconDog, IconCalendar, IconUser, IconCheck, IconX, IconAlertCircle } from '@tabler/icons-react';

const PLATZNUMMER_OPTIONS = LOOKUP_OPTIONS['belegung_buchungen']?.['platznummer'] ?? [];

export default function AnfrageBestaetigenPage() {
  const { buchungsanfragen, loading, error, fetchAll } = useDashboardData();

  const [step, setStep] = useState(1);
  const [selectedAnfrage, setSelectedAnfrage] = useState<Buchungsanfragen | null>(null);

  // Step 2 — Bestätigen form state
  const [platznummerKey, setPlatznummerKey] = useState(PLATZNUMMER_OPTIONS[0]?.key ?? 'platz_1');
  const [preisEuro, setPreisEuro] = useState('');
  const [notizen, setNotizen] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Idempotency guards for chained creates
  const [createdBesitzerId, setCreatedBesitzerId] = useState<string | null>(null);
  const [createdHundId, setCreatedHundId] = useState<string | null>(null);

  // Only show 'neu' Anfragen
  const offeneAnfragen = buchungsanfragen.filter(
    (a) => (lookupKey(a.fields.anfrage_status) ?? a.fields.anfrage_status?.key) === 'neu',
  );

  const handleSelectAnfrage = (id: string) => {
    const found = buchungsanfragen.find((a) => a.record_id === id) ?? null;
    setSelectedAnfrage(found);
    // Reset step-2 state on new selection
    setPlatznummerKey(PLATZNUMMER_OPTIONS[0]?.key ?? 'platz_1');
    setPreisEuro('');
    setNotizen('');
    setSubmitError(null);
    setCreatedBesitzerId(null);
    setCreatedHundId(null);
    setStep(2);
  };

  const handleBestaetigen = async () => {
    if (!selectedAnfrage) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      // Step 1: Create or reuse Besitzer (idempotency guard)
      let besitzerId = createdBesitzerId;
      if (!besitzerId) {
        const newBesitzer = await LivingAppsService.createBesitzerEntry({
          vorname: selectedAnfrage.fields.interessent_vorname,
          nachname: selectedAnfrage.fields.interessent_nachname,
          telefon: selectedAnfrage.fields.interessent_telefon ?? '',
          email: selectedAnfrage.fields.interessent_email,
        });
        besitzerId = newBesitzer.record_id;
        setCreatedBesitzerId(besitzerId);
      }

      // Step 2: Create or reuse Hundekartei (idempotency guard)
      let hundId = createdHundId;
      if (!hundId) {
        const newHund = await LivingAppsService.createHundekarteiEntry({
          name: selectedAnfrage.fields.hund_name,
          rasse: selectedAnfrage.fields.hund_rasse ?? '',
          besitzer: createRecordUrl('6a855dc207a2aad7b8fd68e4', besitzerId),
        });
        hundId = newHund.record_id;
        setCreatedHundId(hundId);
      }

      // Step 3: Create BelegungBuchungen
      await LivingAppsService.createBelegungBuchungenEntry({
        hund: createRecordUrl('6a855dc86f78df9f0a5b088f', hundId),
        besitzer: createRecordUrl('6a855dc207a2aad7b8fd68e4', besitzerId),
        anreisedatum: selectedAnfrage.fields.wunsch_anreise,
        abreisedatum: selectedAnfrage.fields.wunsch_abreise,
        platznummer: platznummerKey,
        status: 'aktiv',
        preis_euro: preisEuro ? parseFloat(preisEuro) : undefined,
        notizen: notizen || undefined,
      });

      // Step 4: Update Anfrage status
      await LivingAppsService.updateBuchungsanfragenEntry(selectedAnfrage.record_id, {
        anfrage_status: 'bestaetigt',
      });

      await fetchAll();
      window.location.hash = '/';
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : tx('Unbekannter Fehler'));
    } finally {
      setSubmitting(false);
    }
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
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : tx('Unbekannter Fehler'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <IntentWizardShell
      title={tx('Anfrage bestätigen')}
      subtitle={tx('Buchungsanfrage prüfen und Aufenthalt anlegen oder ablehnen')}
      steps={[{ label: tx('Anfrage wählen') }, { label: tx('Entscheidung') }]}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* ── Step 1: Anfrage auswählen ── */}
      {step === 1 && (
        <EntitySelectStep
          items={offeneAnfragen.map((a) => ({
            id: a.record_id,
            title:
              [a.fields.interessent_vorname, a.fields.interessent_nachname]
                .filter(Boolean)
                .join(' ') || tx('Unbekannter Interessent'),
            subtitle: [
              a.fields.hund_name ? `${tx('Hund')}: ${a.fields.hund_name}` : null,
              a.fields.wunsch_anreise
                ? `${formatDate(a.fields.wunsch_anreise)} – ${a.fields.wunsch_abreise ? formatDate(a.fields.wunsch_abreise) : '?'}`
                : null,
            ]
              .filter(Boolean)
              .join(' · '),
            status: a.fields.anfrage_status
              ? { key: a.fields.anfrage_status.key, label: a.fields.anfrage_status.label }
              : undefined,
            icon: <IconDog size={20} className="text-primary" />,
          }))}
          onSelect={handleSelectAnfrage}
          searchPlaceholder={tx('Interessent oder Hund suchen …')}
          emptyText={tx('Keine offenen Anfragen vorhanden')}
          emptyIcon={<IconDog size={40} className="text-muted-foreground" />}
        />
      )}

      {/* ── Step 2: Entscheidung ── */}
      {step === 2 && (
        selectedAnfrage ? (
          <div className="space-y-6">
            {/* Read-only Anfrage summary */}
            <div className="rounded-2xl border bg-card p-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold text-foreground">{tx('Anfragedetails')}</h3>
                <StatusBadge
                  statusKey={selectedAnfrage.fields.anfrage_status?.key}
                  label={selectedAnfrage.fields.anfrage_status?.label}
                />
              </div>

              {/* Visitor info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wide">
                    <IconUser size={14} className="shrink-0" />
                    {tx('Interessent')}
                  </div>
                  <p className="text-sm font-medium">
                    {[selectedAnfrage.fields.interessent_vorname, selectedAnfrage.fields.interessent_nachname]
                      .filter(Boolean)
                      .join(' ') || '—'}
                  </p>
                  {selectedAnfrage.fields.interessent_email && (
                    <p className="text-xs text-muted-foreground">{selectedAnfrage.fields.interessent_email}</p>
                  )}
                  {selectedAnfrage.fields.interessent_telefon && (
                    <p className="text-xs text-muted-foreground">{selectedAnfrage.fields.interessent_telefon}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wide">
                    <IconDog size={14} className="shrink-0" />
                    {tx('Hund')}
                  </div>
                  <p className="text-sm font-medium">{selectedAnfrage.fields.hund_name || '—'}</p>
                  {selectedAnfrage.fields.hund_rasse && (
                    <p className="text-xs text-muted-foreground">{selectedAnfrage.fields.hund_rasse}</p>
                  )}
                  {selectedAnfrage.fields.hund_groesse && (
                    <p className="text-xs text-muted-foreground">{selectedAnfrage.fields.hund_groesse.label}</p>
                  )}
                </div>
              </div>

              {/* Dates */}
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wide">
                  <IconCalendar size={14} className="shrink-0" />
                  {tx('Gewünschter Zeitraum')}
                </div>
                <p className="text-sm">
                  {selectedAnfrage.fields.wunsch_anreise
                    ? formatDate(selectedAnfrage.fields.wunsch_anreise)
                    : '—'}
                  {' – '}
                  {selectedAnfrage.fields.wunsch_abreise
                    ? formatDate(selectedAnfrage.fields.wunsch_abreise)
                    : '—'}
                </p>
              </div>

              {selectedAnfrage.fields.nachricht && (
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{tx('Nachricht')}</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{selectedAnfrage.fields.nachricht}</p>
                </div>
              )}
            </div>

            {/* ── Action A: Bestätigen ── */}
            <div className="rounded-2xl border bg-card p-5 space-y-4">
              <h3 className="font-semibold text-foreground">{tx('Aufenthalt bestätigen')}</h3>
              <p className="text-sm text-muted-foreground">
                {tx('Platznummer und Preis festlegen, dann den Aufenthalt anlegen.')}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Platznummer */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">{tx('Platznummer')}</label>
                  <Select value={platznummerKey} onValueChange={setPlatznummerKey}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={tx('Platz wählen')} />
                    </SelectTrigger>
                    <SelectContent>
                      {PLATZNUMMER_OPTIONS.map((opt) => (
                        <SelectItem key={opt.key} value={opt.key}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Preis */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">{tx('Preis (€)')}</label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={preisEuro}
                    onChange={(e) => setPreisEuro(e.target.value)}
                    placeholder={tx('z.B. 120')}
                  />
                </div>
              </div>

              {/* Notizen */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{tx('Notizen')}</label>
                <Textarea
                  value={notizen}
                  onChange={(e) => setNotizen(e.target.value)}
                  placeholder={tx('Optionale Hinweise zur Buchung …')}
                  rows={3}
                />
              </div>

              {submitError && (
                <div className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <IconAlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span>{submitError}</span>
                </div>
              )}

              <Button
                className="w-full"
                onClick={handleBestaetigen}
                disabled={submitting || !platznummerKey}
              >
                <IconCheck size={16} className="shrink-0 mr-2" />
                {submitting ? tx('Wird angelegt …') : tx('Aufenthalt anlegen & Anfrage bestätigen')}
              </Button>
            </div>

            {/* ── Action B: Ablehnen ── */}
            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 space-y-3">
              <h3 className="font-semibold text-foreground">{tx('Anfrage ablehnen')}</h3>
              <p className="text-sm text-muted-foreground">
                {tx('Die Anfrage wird als abgelehnt markiert. Es werden keine Datensätze angelegt.')}
              </p>
              <Button
                variant="destructive"
                className="w-full"
                onClick={handleAblehnen}
                disabled={submitting}
              >
                <IconX size={16} className="shrink-0 mr-2" />
                {submitting ? tx('Wird abgelehnt …') : tx('Anfrage ablehnen')}
              </Button>
            </div>

            {/* Back link */}
            <div className="text-center">
              <button
                className="text-sm text-muted-foreground underline underline-offset-2"
                onClick={() => setStep(1)}
              >
                {tx('Andere Anfrage wählen')}
              </button>
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
