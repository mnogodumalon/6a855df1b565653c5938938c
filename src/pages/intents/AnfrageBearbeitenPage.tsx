/**
 * Anfrage bearbeiten — 3-Schritt-Wizard.
 * Steps: 1) Buchungsanfrage auswählen (nur Status 'neu') →
 *        2) Entscheidung: bestätigen oder ablehnen →
 *        3) Aufenthalt (Belegung) anlegen (nur nach Bestätigung).
 * Reads: buchungsanfragen. Writes: buchungsanfragen (updateBuchungsanfragenEntry),
 *        belegung_buchungen (createBelegungBuchungenEntry).
 * Composes: IntentWizardShell, EntitySelectStep.
 */

import { useState } from 'react';
import { format } from 'date-fns';
import { IconCheck, IconX, IconBed, IconInfoCircle, IconDog } from '@tabler/icons-react';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { StatusBadge } from '@/components/blocks/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDashboardData } from '@/hooks/useDashboardData';
import { LivingAppsService } from '@/services/livingAppsService';
import { LOOKUP_OPTIONS } from '@/types/app';
import { tx } from '@/i18n';
import { formatDate } from '@/lib/formatters';

const PLATZ_OPTIONS = LOOKUP_OPTIONS['belegung_buchungen']?.['platznummer'] ?? [];

export default function AnfrageBearbeitenPage() {
  const data = useDashboardData();
  const { buchungsanfragen, loading, error, fetchAll } = data;

  const [step, setStep] = useState(1);
  const [selectedAnfrageId, setSelectedAnfrageId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Schritt 3 Felder
  const [platznummer, setPlatznummer] = useState('');
  const [preisEuro, setPreisEuro] = useState('');
  const [notizen, setNotizen] = useState('');
  const [createdBelegungId, setCreatedBelegungId] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<'bestaetigt' | 'abgelehnt' | null>(null);

  const neueAnfragen = buchungsanfragen.filter(
    (a) => a.fields.anfrage_status?.key === 'neu',
  );

  const selectedAnfrage = selectedAnfrageId
    ? buchungsanfragen.find((a) => a.record_id === selectedAnfrageId) ?? null
    : null;

  const handleSelectAnfrage = (id: string) => {
    setSelectedAnfrageId(id);
    setStep(2);
  };

  const handleAblehnen = async () => {
    if (!selectedAnfrageId) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await LivingAppsService.updateBuchungsanfragenEntry(selectedAnfrageId, {
        anfrage_status: 'abgelehnt',
      });
      await fetchAll();
      setOutcome('abgelehnt');
      setStep(4);
    } catch {
      setSubmitError(tx('Fehler beim Ablehnen der Anfrage. Bitte erneut versuchen.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleBestaetigen = async () => {
    if (!selectedAnfrageId) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await LivingAppsService.updateBuchungsanfragenEntry(selectedAnfrageId, {
        anfrage_status: 'bestaetigt',
      });
      await fetchAll();
      setOutcome('bestaetigt');
      setStep(3);
    } catch {
      setSubmitError(tx('Fehler beim Bestätigen der Anfrage. Bitte erneut versuchen.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleAufenthaltAnlegen = async () => {
    if (!selectedAnfrage || createdBelegungId) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const anreise = selectedAnfrage.fields.wunsch_anreise ?? '';
      const abreise = selectedAnfrage.fields.wunsch_abreise ?? '';
      const result = await LivingAppsService.createBelegungBuchungenEntry({
        anreisedatum: anreise,
        abreisedatum: abreise,
        platznummer: platznummer || undefined,
        status: 'aktiv',
        preis_euro: preisEuro ? parseFloat(preisEuro) : undefined,
        notizen: notizen || undefined,
      });
      setCreatedBelegungId(result.record_id);
      await fetchAll();
      setStep(4);
    } catch {
      setSubmitError(tx('Fehler beim Anlegen des Aufenthalts. Bitte erneut versuchen.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setSelectedAnfrageId(null);
    setPlatznummer('');
    setPreisEuro('');
    setNotizen('');
    setCreatedBelegungId(null);
    setOutcome(null);
    setSubmitError(null);
  };

  return (
    <IntentWizardShell
      title={tx('Anfrage bearbeiten')}
      subtitle={tx('Buchungsanfrage prüfen, bestätigen oder ablehnen und Aufenthalt anlegen')}
      steps={[
        { label: tx('Anfrage wählen') },
        { label: tx('Entscheidung') },
        { label: tx('Aufenthalt') },
        { label: tx('Fertig') },
      ]}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* Schritt 1: Anfrage auswählen */}
      {step === 1 && (
        <EntitySelectStep
          items={neueAnfragen.map((a) => ({
            id: a.record_id,
            title: `${a.fields.interessent_vorname ?? ''} ${a.fields.interessent_nachname ?? ''}`.trim() || tx('Unbekannt'),
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
          emptyIcon={<IconDog size={32} className="text-muted-foreground" />}
        />
      )}

      {/* Schritt 2: Entscheidung */}
      {step === 2 && (
        selectedAnfrage ? (
          <div className="space-y-6">
            {/* Anfrage-Details */}
            <div className="rounded-2xl border bg-card p-5 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-lg">
                    {`${selectedAnfrage.fields.interessent_vorname ?? ''} ${selectedAnfrage.fields.interessent_nachname ?? ''}`.trim() || tx('Unbekannt')}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedAnfrage.fields.interessent_email}
                    {selectedAnfrage.fields.interessent_telefon && ` · ${selectedAnfrage.fields.interessent_telefon}`}
                  </p>
                </div>
                <StatusBadge
                  statusKey={selectedAnfrage.fields.anfrage_status?.key}
                  label={selectedAnfrage.fields.anfrage_status?.label}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <p className="text-muted-foreground font-medium">{tx('Hund')}</p>
                  <p>{selectedAnfrage.fields.hund_name ?? '—'}</p>
                  {selectedAnfrage.fields.hund_rasse && (
                    <p className="text-muted-foreground">{selectedAnfrage.fields.hund_rasse}</p>
                  )}
                  {selectedAnfrage.fields.hund_groesse && (
                    <p className="text-muted-foreground">{selectedAnfrage.fields.hund_groesse.label}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground font-medium">{tx('Gewünschter Zeitraum')}</p>
                  <p>
                    {selectedAnfrage.fields.wunsch_anreise
                      ? formatDate(selectedAnfrage.fields.wunsch_anreise)
                      : '—'}
                    {' – '}
                    {selectedAnfrage.fields.wunsch_abreise
                      ? formatDate(selectedAnfrage.fields.wunsch_abreise)
                      : '—'}
                  </p>
                </div>
              </div>

              {selectedAnfrage.fields.nachricht && (
                <div className="space-y-1 text-sm">
                  <p className="text-muted-foreground font-medium">{tx('Nachricht')}</p>
                  <p className="text-foreground">{selectedAnfrage.fields.nachricht}</p>
                </div>
              )}
            </div>

            {submitError && (
              <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive flex gap-2 items-start">
                <IconInfoCircle size={16} className="shrink-0 mt-0.5" />
                {submitError}
              </div>
            )}

            {/* Aktionsbuttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                className="flex-1 gap-2"
                onClick={handleBestaetigen}
                disabled={submitting}
              >
                <IconCheck size={16} className="shrink-0" />
                {tx('Bestätigen & Aufenthalt anlegen')}
              </Button>
              <Button
                variant="outline"
                className="flex-1 gap-2 border-destructive/40 text-destructive hover:bg-destructive/10"
                onClick={handleAblehnen}
                disabled={submitting}
              >
                <IconX size={16} className="shrink-0" />
                {tx('Ablehnen')}
              </Button>
            </div>

            <Button
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={() => setStep(1)}
              disabled={submitting}
            >
              {tx('Andere Anfrage wählen')}
            </Button>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">
              {tx('Dieser Schritt braucht eine Auswahl aus Schritt 1.')}
            </p>
            <Button variant="outline" onClick={() => setStep(1)}>
              {tx('Neu starten')}
            </Button>
          </div>
        )
      )}

      {/* Schritt 3: Aufenthalt anlegen */}
      {step === 3 && (
        selectedAnfrage ? (
          <div className="space-y-6">
            {/* Vorausgefüllte Infos aus der Anfrage */}
            <div className="rounded-2xl border bg-secondary/40 p-4 space-y-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <IconInfoCircle size={15} className="shrink-0" />
                <span className="font-medium">{tx('Aus der Anfrage übernommen')}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <span className="text-muted-foreground">{tx('Anreise')}: </span>
                  <span className="font-medium">
                    {selectedAnfrage.fields.wunsch_anreise
                      ? formatDate(selectedAnfrage.fields.wunsch_anreise)
                      : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">{tx('Abreise')}: </span>
                  <span className="font-medium">
                    {selectedAnfrage.fields.wunsch_abreise
                      ? formatDate(selectedAnfrage.fields.wunsch_abreise)
                      : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">{tx('Hund')}: </span>
                  <span className="font-medium">{selectedAnfrage.fields.hund_name ?? '—'}</span>
                </div>
              </div>
              <p className="text-muted-foreground text-xs pt-1">
                {tx('Hund- und Besitzer-Verknüpfung können nach dem Anlegen in der Buchungsübersicht ergänzt werden.')}
              </p>
            </div>

            {/* Formular für neue Felder */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="platznummer">{tx('Platznummer')}</Label>
                <Select value={platznummer || 'none'} onValueChange={(v) => setPlatznummer(v === 'none' ? '' : v)}>
                  <SelectTrigger id="platznummer">
                    <SelectValue placeholder={tx('Platz auswählen …')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{tx('Kein Platz (später zuweisen)')}</SelectItem>
                    {PLATZ_OPTIONS.map((opt) => (
                      <SelectItem key={opt.key} value={opt.key}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="preis_euro">{tx('Preis (€)')}</Label>
                <Input
                  id="preis_euro"
                  type="number"
                  min="0"
                  step="0.01"
                  value={preisEuro}
                  onChange={(e) => setPreisEuro(e.target.value)}
                  placeholder={tx('z. B. 150')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notizen">{tx('Notizen')}</Label>
                <Textarea
                  id="notizen"
                  value={notizen}
                  onChange={(e) => setNotizen(e.target.value)}
                  placeholder={tx('Besonderheiten, Hinweise zum Hund …')}
                  rows={3}
                />
              </div>
            </div>

            {submitError && (
              <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive flex gap-2 items-start">
                <IconInfoCircle size={16} className="shrink-0 mt-0.5" />
                {submitError}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                className="flex-1 gap-2"
                onClick={handleAufenthaltAnlegen}
                disabled={submitting || !!createdBelegungId}
              >
                <IconBed size={16} className="shrink-0" />
                {tx('Aufenthalt anlegen')}
              </Button>
              <Button
                variant="outline"
                onClick={() => setStep(2)}
                disabled={submitting}
              >
                {tx('Zurück')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">
              {tx('Dieser Schritt braucht eine bestätigte Anfrage aus Schritt 2.')}
            </p>
            <Button variant="outline" onClick={() => setStep(1)}>
              {tx('Neu starten')}
            </Button>
          </div>
        )
      )}

      {/* Schritt 4: Abschluss */}
      {step === 4 && (
        <div className="text-center py-10 space-y-6">
          {outcome === 'abgelehnt' ? (
            <>
              <div className="mx-auto w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
                <IconX size={32} className="text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">{tx('Anfrage abgelehnt')}</h3>
                <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                  {tx('Die Buchungsanfrage wurde als abgelehnt markiert. Der Interessent kann bei Bedarf kontaktiert werden.')}
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <IconCheck size={32} className="text-primary" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">{tx('Aufenthalt angelegt!')}</h3>
                <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                  {tx('Die Anfrage wurde bestätigt und der Aufenthalt wurde erfolgreich angelegt. Hund- und Besitzer-Verknüpfung können in der Buchungsübersicht ergänzt werden.')}
                </p>
              </div>
            </>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Button onClick={handleReset}>
              {tx('Weitere Anfrage bearbeiten')}
            </Button>
            <Button variant="outline" asChild>
              <a href="#/">{tx('Zurück zum Dashboard')}</a>
            </Button>
          </div>
        </div>
      )}
    </IntentWizardShell>
  );
}
