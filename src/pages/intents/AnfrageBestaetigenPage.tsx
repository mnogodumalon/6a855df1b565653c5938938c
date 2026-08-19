/**
 * Anfrage bestätigen — 2-Schritt-Wizard.
 * Steps: 1) Offene Buchungsanfrage auswählen (nur Status 'neu') →
 *           Ablehnen direkt in der Liste möglich.
 *        2) Platz & Details festlegen → Besitzer anlegen → Hund anlegen →
 *           Belegung anlegen → Anfrage auf 'bestaetigt' setzen.
 * Reads: buchungsanfragen. Writes: besitzer (createBesitzerEntry),
 *        hundekartei (createHundekarteiEntry),
 *        belegung_buchungen (createBelegungBuchungenEntry),
 *        buchungsanfragen (updateBuchungsanfragenEntry).
 * Composes: IntentWizardShell, EntitySelectStep.
 */

import { useState } from 'react';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { StatusBadge } from '@/components/blocks/StatusBadge';
import { useDashboardData } from '@/hooks/useDashboardData';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import type { Buchungsanfragen } from '@/types/app';
import { tx } from '@/i18n';
import { formatDate } from '@/lib/formatters';
import {
  IconDog,
  IconCircleCheck,
  IconCircleX,
  IconCalendar,
  IconAlertCircle,
} from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function AnfrageBestaetigenPage() {
  const { buchungsanfragen, loading, error, fetchAll } = useDashboardData();

  const [step, setStep] = useState(1);
  const [selectedAnfrage, setSelectedAnfrage] = useState<Buchungsanfragen | null>(null);

  // Step 2 form state
  const PLATZ_OPTIONS = LOOKUP_OPTIONS['belegung_buchungen']?.['platznummer'] ?? [];
  const [platznummer, setPlatznummer] = useState('');
  const [anreisedatum, setAnreisedatum] = useState('');
  const [abreisedatum, setAbreisedatum] = useState('');
  const [preisEuro, setPreisEuro] = useState('');
  const [notizen, setNotizen] = useState('');

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [belegungId, setBelegungId] = useState<string | null>(null);

  // Rejection state
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  const neueAnfragen = buchungsanfragen.filter(
    (a) => a.fields.anfrage_status?.key === 'neu'
  );

  const handleSelectAnfrage = (id: string) => {
    const anfrage = buchungsanfragen.find((a) => a.record_id === id) ?? null;
    setSelectedAnfrage(anfrage);
    setAnreisedatum(anfrage?.fields.wunsch_anreise ?? '');
    setAbreisedatum(anfrage?.fields.wunsch_abreise ?? '');
    setPlatznummer('');
    setPreisEuro('');
    setNotizen('');
    setBelegungId(null);
    setSubmitError(null);
    setStep(2);
  };

  const handleAblehnen = async (anfrage: Buchungsanfragen) => {
    setRejectingId(anfrage.record_id);
    try {
      await LivingAppsService.updateBuchungsanfragenEntry(anfrage.record_id, {
        anfrage_status: 'abgelehnt',
      });
      await fetchAll();
    } catch {
      // silent — list will refresh regardless
    } finally {
      setRejectingId(null);
    }
  };

  const handleBestaetigen = async () => {
    if (!selectedAnfrage || !platznummer || !anreisedatum || !abreisedatum) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      // Guard: if belegungId already set, skip straight to updating the anfrage
      let bid = belegungId;
      if (!bid) {
        // a) Besitzer anlegen
        const besitzer = await LivingAppsService.createBesitzerEntry({
          vorname: selectedAnfrage.fields.interessent_vorname,
          nachname: selectedAnfrage.fields.interessent_nachname,
          email: selectedAnfrage.fields.interessent_email,
          telefon: selectedAnfrage.fields.interessent_telefon,
        });

        // b) Hund anlegen
        const hund = await LivingAppsService.createHundekarteiEntry({
          name: selectedAnfrage.fields.hund_name,
          rasse: selectedAnfrage.fields.hund_rasse,
          besitzer: createRecordUrl(APP_IDS.BESITZER, besitzer.record_id),
        });

        // c) Belegung anlegen
        const belegung = await LivingAppsService.createBelegungBuchungenEntry({
          hund: createRecordUrl(APP_IDS.HUNDEKARTEI, hund.record_id),
          besitzer: createRecordUrl(APP_IDS.BESITZER, besitzer.record_id),
          anreisedatum,
          abreisedatum,
          platznummer,
          status: 'aktiv',
          preis_euro: preisEuro ? Number(preisEuro) : undefined,
          notizen: notizen || undefined,
        });

        bid = belegung.record_id;
        setBelegungId(bid);
      }

      // d) Anfrage bestätigen
      await LivingAppsService.updateBuchungsanfragenEntry(selectedAnfrage.record_id, {
        anfrage_status: 'bestaetigt',
      });

      await fetchAll();
      setStep(3);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setSelectedAnfrage(null);
    setPlatznummer('');
    setAnreisedatum('');
    setAbreisedatum('');
    setPreisEuro('');
    setNotizen('');
    setBelegungId(null);
    setSubmitError(null);
  };

  return (
    <IntentWizardShell
      title={tx('Anfrage bestätigen')}
      subtitle={tx('Buchungsanfragen prüfen und Belegung anlegen')}
      steps={[
        { label: tx('Anfrage wählen') },
        { label: tx('Details festlegen') },
        { label: tx('Fertig') },
      ]}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* ── Step 1: Anfrage auswählen ── */}
      {step === 1 && (
        <div className="space-y-4">
          <EntitySelectStep
            items={neueAnfragen.map((a) => ({
              id: a.record_id,
              title: `${a.fields.interessent_vorname ?? ''} ${a.fields.interessent_nachname ?? ''} — ${a.fields.hund_name ?? ''}`.trim(),
              subtitle: [
                a.fields.hund_rasse,
                a.fields.hund_groesse?.label,
                a.fields.wunsch_anreise
                  ? `${tx('Anreise')} ${formatDate(a.fields.wunsch_anreise)}`
                  : undefined,
                a.fields.wunsch_abreise
                  ? `${tx('Abreise')} ${formatDate(a.fields.wunsch_abreise)}`
                  : undefined,
              ]
                .filter(Boolean)
                .join(' · '),
              status: a.fields.anfrage_status
                ? { key: a.fields.anfrage_status.key, label: a.fields.anfrage_status.label }
                : undefined,
              icon: <IconDog size={20} className="text-primary" />,
            }))}
            onSelect={handleSelectAnfrage}
            searchPlaceholder={tx('Anfrage suchen …')}
            emptyText={tx('Keine offenen Anfragen vorhanden')}
            emptyIcon={<IconCalendar size={40} className="text-muted-foreground" />}
          />

          {/* Ablehnen-Bereich */}
          {neueAnfragen.length > 0 && (
            <div className="rounded-2xl border bg-destructive/5 p-4 space-y-3">
              <p className="text-sm font-medium text-foreground">
                {tx('Anfrage direkt ablehnen')}
              </p>
              <p className="text-xs text-muted-foreground">
                {tx('Wähle eine Anfrage aus der Liste oben aus, um sie zu bestätigen. Oder lehne sie hier direkt ab:')}
              </p>
              <div className="space-y-2">
                {neueAnfragen.map((a) => (
                  <div
                    key={a.record_id}
                    className="flex items-center justify-between gap-3 rounded-xl border bg-card p-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {a.fields.interessent_vorname} {a.fields.interessent_nachname} —{' '}
                        {a.fields.hund_name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {a.fields.interessent_email}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={rejectingId === a.record_id}
                      onClick={() => handleAblehnen(a)}
                      className="shrink-0 gap-1"
                    >
                      <IconCircleX size={14} />
                      {tx('Ablehnen')}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Step 2: Details festlegen ── */}
      {step === 2 && (
        selectedAnfrage ? (
          <div className="space-y-6">
            {/* Anfrage-Zusammenfassung */}
            <div className="rounded-2xl border bg-secondary/40 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <IconDog size={20} className="text-primary shrink-0 mt-0.5" />
                <div className="min-w-0 space-y-1">
                  <p className="font-semibold text-foreground">
                    {selectedAnfrage.fields.interessent_vorname}{' '}
                    {selectedAnfrage.fields.interessent_nachname}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {selectedAnfrage.fields.interessent_email}
                    {selectedAnfrage.fields.interessent_telefon
                      ? ` · ${selectedAnfrage.fields.interessent_telefon}`
                      : ''}
                  </p>
                </div>
                <StatusBadge
                  statusKey={selectedAnfrage.fields.anfrage_status?.key}
                  label={selectedAnfrage.fields.anfrage_status?.label}
                  className="shrink-0"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">{tx('Hund:')}</span>{' '}
                  <span className="font-medium">{selectedAnfrage.fields.hund_name}</span>
                  {selectedAnfrage.fields.hund_rasse
                    ? ` (${selectedAnfrage.fields.hund_rasse})`
                    : ''}
                </div>
                {selectedAnfrage.fields.hund_groesse && (
                  <div>
                    <span className="text-muted-foreground">{tx('Größe:')}</span>{' '}
                    <span className="font-medium">
                      {selectedAnfrage.fields.hund_groesse.label}
                    </span>
                  </div>
                )}
                {selectedAnfrage.fields.wunsch_anreise && (
                  <div>
                    <span className="text-muted-foreground">{tx('Wunsch-Anreise:')}</span>{' '}
                    <span className="font-medium">
                      {formatDate(selectedAnfrage.fields.wunsch_anreise)}
                    </span>
                  </div>
                )}
                {selectedAnfrage.fields.wunsch_abreise && (
                  <div>
                    <span className="text-muted-foreground">{tx('Wunsch-Abreise:')}</span>{' '}
                    <span className="font-medium">
                      {formatDate(selectedAnfrage.fields.wunsch_abreise)}
                    </span>
                  </div>
                )}
                {selectedAnfrage.fields.nachricht && (
                  <div className="sm:col-span-2">
                    <span className="text-muted-foreground">{tx('Nachricht:')}</span>{' '}
                    <span>{selectedAnfrage.fields.nachricht}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Hinweis */}
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex gap-2">
              <IconAlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>
                {tx(
                  'Beim Bestätigen werden automatisch ein Besitzer-Eintrag, ein Hund-Eintrag und eine Belegung angelegt.'
                )}
              </span>
            </div>

            {/* Formular */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="platznummer">{tx('Platznummer')} *</Label>
                <Select value={platznummer} onValueChange={setPlatznummer}>
                  <SelectTrigger id="platznummer" className="w-full">
                    <SelectValue placeholder={tx('Platz auswählen …')} />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATZ_OPTIONS.map((opt) => (
                      <SelectItem key={opt.key} value={opt.key}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="anreisedatum">{tx('Anreisedatum')} *</Label>
                  <Input
                    id="anreisedatum"
                    type="date"
                    value={anreisedatum}
                    onChange={(e) => setAnreisedatum(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="abreisedatum">{tx('Abreisedatum')} *</Label>
                  <Input
                    id="abreisedatum"
                    type="date"
                    value={abreisedatum}
                    onChange={(e) => setAbreisedatum(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="preis_euro">{tx('Preis (€)')}</Label>
                <Input
                  id="preis_euro"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={preisEuro}
                  onChange={(e) => setPreisEuro(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="notizen">{tx('Notizen')}</Label>
                <Textarea
                  id="notizen"
                  placeholder={tx('Interne Notizen zur Buchung …')}
                  value={notizen}
                  onChange={(e) => setNotizen(e.target.value)}
                  rows={3}
                />
              </div>
            </div>

            {submitError && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive flex gap-2">
                <IconAlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{submitError}</span>
              </div>
            )}

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
                disabled={submitting || !platznummer || !anreisedatum || !abreisedatum}
                className="gap-2"
              >
                <IconCircleCheck size={16} />
                {submitting ? tx('Wird bestätigt …') : tx('Anfrage bestätigen')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">
              {tx('Dieser Schritt braucht eine ausgewählte Anfrage aus Schritt 1.')}
            </p>
            <Button variant="outline" onClick={() => setStep(1)}>
              {tx('Neu starten')}
            </Button>
          </div>
        )
      )}

      {/* ── Step 3: Fertig ── */}
      {step === 3 && (
        <div className="flex flex-col items-center text-center py-12 space-y-5">
          <div className="rounded-full bg-emerald-100 p-4">
            <IconCircleCheck size={48} className="text-emerald-600" stroke={1.5} />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-foreground">
              {tx('Anfrage bestätigt!')}
            </h2>
            <p className="text-sm text-muted-foreground max-w-sm">
              {tx(
                'Besitzer und Hund wurden angelegt, die Belegung ist eingetragen und die Anfrage als bestätigt markiert.'
              )}
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Button onClick={handleReset} variant="outline">
              {tx('Weitere Anfrage bestätigen')}
            </Button>
            <a href="#/">
              <Button>{tx('Zurück zum Dashboard')}</Button>
            </a>
          </div>
        </div>
      )}
    </IntentWizardShell>
  );
}
