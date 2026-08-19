/**
 * Anfrage bestätigen — 2-Schritt-Wizard.
 * Steps: 1) Buchungsanfrage (Status 'neu') auswählen → 2) Belegung bestätigen & anlegen.
 * Reads: buchungsanfragen. Writes: besitzer (createBesitzerEntry), hundekartei (createHundekarteiEntry),
 *   belegung_buchungen (createBelegungBuchungenEntry), buchungsanfragen (updateBuchungsanfragenEntry).
 * Composes: IntentWizardShell, EntitySelectStep.
 */
import { useState } from 'react';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { StatusBadge } from '@/components/blocks/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDashboardData } from '@/hooks/useDashboardData';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import type { Buchungsanfragen } from '@/types/app';
import { formatDate } from '@/lib/formatters';
import { tx } from '@/i18n';
import { IconCalendar, IconDog, IconUser, IconCheck, IconX, IconMapPin } from '@tabler/icons-react';

export default function AnfrageBestaetigenPage() {
  const { buchungsanfragen, loading, error, fetchAll } = useDashboardData();

  const [step, setStep] = useState(1);
  const [selectedAnfrage, setSelectedAnfrage] = useState<Buchungsanfragen | null>(null);

  // Step 2 form state
  const [platznummerKey, setPlatznummerKey] = useState('');
  const [preisEuro, setPreisEuro] = useState('');
  const [notizen, setNotizen] = useState('');

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Idempotency guards (retry-safe)
  const [createdBesitzerId, setCreatedBesitzerId] = useState<string | null>(null);
  const [createdHundId, setCreatedHundId] = useState<string | null>(null);

  // Filter: only 'neu' Anfragen
  const offeneAnfragen = buchungsanfragen.filter(
    (a) => a.fields.anfrage_status?.key === 'neu'
  );

  const PLATZ_OPTIONS = LOOKUP_OPTIONS['belegung_buchungen']?.['platznummer'] ?? [];

  const handleSelectAnfrage = (id: string) => {
    const anfrage = buchungsanfragen.find((a) => a.record_id === id) ?? null;
    setSelectedAnfrage(anfrage);
    setCreatedBesitzerId(null);
    setCreatedHundId(null);
    setPlatznummerKey('');
    setPreisEuro('');
    setNotizen('');
    setSubmitError(null);
    setStep(2);
  };

  const handleAblehnen = async (anfrage: Buchungsanfragen) => {
    try {
      await LivingAppsService.updateBuchungsanfragenEntry(anfrage.record_id, {
        anfrage_status: 'abgelehnt',
      });
      await fetchAll();
    } catch {
      // Fehler still — Refresh bringt aktuellen Status
    }
  };

  const handleBestaetigen = async () => {
    if (!selectedAnfrage || !platznummerKey) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      // 1) Besitzer anlegen (idempotent via guard)
      let besitzerId = createdBesitzerId;
      if (!besitzerId) {
        const b = await LivingAppsService.createBesitzerEntry({
          vorname: selectedAnfrage.fields.interessent_vorname,
          nachname: selectedAnfrage.fields.interessent_nachname,
          telefon: selectedAnfrage.fields.interessent_telefon,
          email: selectedAnfrage.fields.interessent_email,
        });
        besitzerId = b.record_id;
        setCreatedBesitzerId(besitzerId);
      }

      // 2) Hund anlegen (idempotent via guard)
      let hundId = createdHundId;
      if (!hundId) {
        const h = await LivingAppsService.createHundekarteiEntry({
          name: selectedAnfrage.fields.hund_name,
          rasse: selectedAnfrage.fields.hund_rasse,
          besitzer: createRecordUrl(APP_IDS.BESITZER, besitzerId),
        });
        hundId = h.record_id;
        setCreatedHundId(hundId);
      }

      // 3) Belegung anlegen
      await LivingAppsService.createBelegungBuchungenEntry({
        hund: createRecordUrl(APP_IDS.HUNDEKARTEI, hundId),
        besitzer: createRecordUrl(APP_IDS.BESITZER, besitzerId),
        anreisedatum: selectedAnfrage.fields.wunsch_anreise,
        abreisedatum: selectedAnfrage.fields.wunsch_abreise,
        platznummer: platznummerKey,
        status: 'aktiv',
        preis_euro: preisEuro ? parseFloat(preisEuro) : undefined,
        notizen: notizen || undefined,
      });

      // 4) Anfrage als bestätigt markieren
      await LivingAppsService.updateBuchungsanfragenEntry(selectedAnfrage.record_id, {
        anfrage_status: 'bestaetigt',
      });

      await fetchAll();
      setDone(true);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : tx('Unbekannter Fehler beim Speichern.')
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setSelectedAnfrage(null);
    setCreatedBesitzerId(null);
    setCreatedHundId(null);
    setPlatznummerKey('');
    setPreisEuro('');
    setNotizen('');
    setSubmitError(null);
    setDone(false);
  };

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
        <div className="rounded-full bg-emerald-100 p-6">
          <IconCheck size={48} className="text-emerald-600" stroke={1.5} />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold">{tx('Anfrage bestätigt!')}</h2>
          <p className="text-muted-foreground">
            {tx('Belegung wurde angelegt und Besitzer sowie Hund im System erfasst.')}
          </p>
        </div>
        <div className="flex flex-wrap gap-3 justify-center">
          <Button onClick={handleReset} variant="outline">
            {tx('Weitere Anfrage bearbeiten')}
          </Button>
          <a href="#/">
            <Button>{tx('Zurück zum Dashboard')}</Button>
          </a>
        </div>
      </div>
    );
  }

  return (
    <IntentWizardShell
      title={tx('Anfrage bestätigen')}
      subtitle={tx('Buchungsanfrage prüfen, Platz zuweisen und Belegung anlegen')}
      steps={[{ label: tx('Anfrage wählen') }, { label: tx('Belegung bestätigen') }]}
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
            title: `${a.fields.interessent_vorname ?? ''} ${a.fields.interessent_nachname ?? ''}`.trim() || tx('Unbekannter Interessent'),
            subtitle: [
              a.fields.hund_name ? `${tx('Hund')}: ${a.fields.hund_name}` : null,
              a.fields.wunsch_anreise ? `${tx('Anreise')}: ${formatDate(a.fields.wunsch_anreise)}` : null,
              a.fields.wunsch_abreise ? `${tx('Abreise')}: ${formatDate(a.fields.wunsch_abreise)}` : null,
            ]
              .filter(Boolean)
              .join(' · '),
            status: a.fields.anfrage_status
              ? { key: a.fields.anfrage_status.key, label: a.fields.anfrage_status.label }
              : undefined,
            icon: <IconUser size={20} className="text-primary" />,
          }))}
          onSelect={handleSelectAnfrage}
          searchPlaceholder={tx('Interessent oder Hund suchen …')}
          emptyText={tx('Keine offenen Anfragen vorhanden.')}
          emptyIcon={<IconDog size={40} className="text-muted-foreground" stroke={1.5} />}
          /* Ablehnen-Button als extra Action im Card-Bereich via createDialog-Slot nicht möglich;
             wir rendern die Liste manuell darunter für den Ablehnen-Pfad */
        />
      )}

      {/* Ablehnen-Buttons zusätzlich unter der Select-Liste */}
      {step === 1 && offeneAnfragen.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-sm text-muted-foreground font-medium">{tx('Anfragen ablehnen:')}</p>
          <div className="space-y-2">
            {offeneAnfragen.map((a) => (
              <div
                key={a.record_id}
                className="flex items-center justify-between rounded-xl border bg-card px-4 py-3 gap-3"
              >
                <div className="min-w-0">
                  <p className="font-medium truncate">
                    {`${a.fields.interessent_vorname ?? ''} ${a.fields.interessent_nachname ?? ''}`.trim() || tx('Unbekannt')}
                    {a.fields.hund_name ? ` — ${a.fields.hund_name}` : ''}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {a.fields.wunsch_anreise ? formatDate(a.fields.wunsch_anreise) : ''}
                    {a.fields.wunsch_abreise ? ` – ${formatDate(a.fields.wunsch_abreise)}` : ''}
                  </p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleAblehnen(a)}
                  className="shrink-0"
                >
                  <IconX size={14} className="shrink-0 mr-1" />
                  {tx('Ablehnen')}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Step 2: Belegung bestätigen ── */}
      {step === 2 && (
        selectedAnfrage ? (
          <div className="space-y-6">
            {/* Zusammenfassung der Anfrage */}
            <div className="rounded-2xl border bg-secondary/40 p-5 space-y-4">
              <h3 className="font-semibold text-base">{tx('Anfragedaten')}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-start gap-3">
                  <IconUser size={18} className="text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">{tx('Interessent')}</p>
                    <p className="font-medium">
                      {`${selectedAnfrage.fields.interessent_vorname ?? ''} ${selectedAnfrage.fields.interessent_nachname ?? ''}`.trim()}
                    </p>
                    {selectedAnfrage.fields.interessent_email && (
                      <p className="text-sm text-muted-foreground">{selectedAnfrage.fields.interessent_email}</p>
                    )}
                    {selectedAnfrage.fields.interessent_telefon && (
                      <p className="text-sm text-muted-foreground">{selectedAnfrage.fields.interessent_telefon}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <IconDog size={18} className="text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">{tx('Hund')}</p>
                    <p className="font-medium">{selectedAnfrage.fields.hund_name ?? tx('Unbekannt')}</p>
                    {selectedAnfrage.fields.hund_rasse && (
                      <p className="text-sm text-muted-foreground">{selectedAnfrage.fields.hund_rasse}</p>
                    )}
                    {selectedAnfrage.fields.hund_groesse && (
                      <p className="text-sm text-muted-foreground">{selectedAnfrage.fields.hund_groesse.label}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <IconCalendar size={18} className="text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">{tx('Wunsch-Anreise')}</p>
                    <p className="font-medium">
                      {selectedAnfrage.fields.wunsch_anreise
                        ? formatDate(selectedAnfrage.fields.wunsch_anreise)
                        : '—'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <IconCalendar size={18} className="text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">{tx('Wunsch-Abreise')}</p>
                    <p className="font-medium">
                      {selectedAnfrage.fields.wunsch_abreise
                        ? formatDate(selectedAnfrage.fields.wunsch_abreise)
                        : '—'}
                    </p>
                  </div>
                </div>
              </div>

              {selectedAnfrage.fields.nachricht && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{tx('Nachricht')}</p>
                  <p className="text-sm bg-card rounded-lg px-3 py-2 border">
                    {selectedAnfrage.fields.nachricht}
                  </p>
                </div>
              )}

              <div className="flex items-center gap-2">
                <StatusBadge statusKey={selectedAnfrage.fields.anfrage_status?.key} label={selectedAnfrage.fields.anfrage_status?.label} />
              </div>
            </div>

            {/* Belegungsfelder */}
            <div className="rounded-2xl border bg-card p-5 space-y-4">
              <h3 className="font-semibold text-base">{tx('Belegung konfigurieren')}</h3>

              {/* Platznummer */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  {tx('Platznummer')} <span className="text-destructive">*</span>
                </label>
                <Select value={platznummerKey} onValueChange={setPlatznummerKey}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={tx('Platz auswählen …')} />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATZ_OPTIONS.map((opt) => (
                      <SelectItem key={opt.key} value={opt.key}>
                        <div className="flex items-center gap-2">
                          <IconMapPin size={14} className="shrink-0" />
                          {opt.label}
                        </div>
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
                  placeholder="0.00"
                />
              </div>

              {/* Notizen */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{tx('Notizen')}</label>
                <Textarea
                  value={notizen}
                  onChange={(e) => setNotizen(e.target.value)}
                  placeholder={tx('Interne Hinweise zur Belegung …')}
                  rows={3}
                />
              </div>
            </div>

            {/* Hinweis zur automatischen Anlage */}
            <div className="rounded-xl bg-secondary/60 border px-4 py-3 text-sm text-muted-foreground">
              {tx('Es werden automatisch ein neuer Besitzer und ein neuer Hund im System angelegt und mit der Belegung verknüpft.')}
            </div>

            {/* Fehler */}
            {submitError && (
              <div className="rounded-xl bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
                {submitError}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                disabled={submitting}
              >
                {tx('Zurück')}
              </Button>
              <Button
                onClick={handleBestaetigen}
                disabled={!platznummerKey || submitting}
                className="flex-1 sm:flex-none"
              >
                {submitting ? tx('Wird gespeichert …') : tx('Bestätigen & Belegung anlegen')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">
              {tx('Dieser Schritt benötigt eine Auswahl aus Schritt 1.')}
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
