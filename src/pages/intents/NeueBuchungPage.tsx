/**
 * Neue Buchung — 3-Schritt-Wizard.
 * Steps: 1) Besitzer wählen/anlegen → 2) Hund wählen/anlegen (gefiltert nach Besitzer) → 3) Buchungsdetails erfassen & speichern.
 * Reads: besitzer, hundekartei. Writes: besitzer (createBesitzerEntry), hundekartei (createHundekarteiEntry), belegung_buchungen (createBelegungBuchungenEntry).
 * Composes: IntentWizardShell, EntitySelectStep.
 */

import { useState } from 'react';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { useDashboardData } from '@/hooks/useDashboardData';
import { LivingAppsService, createRecordUrl, extractRecordId } from '@/services/livingAppsService';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { tx } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { IconUser, IconDog, IconCalendar, IconCheck, IconCircleCheck } from '@tabler/icons-react';
import { differenceInDays, parseISO } from 'date-fns';

export default function NeueBuchungPage() {
  // ── All hooks before any early returns ──────────────────────────────────
  const data = useDashboardData();
  const { besitzer, hundekartei, loading, error, fetchAll } = data;

  const [step, setStep] = useState(1);

  // Step 1 — Besitzer
  const [selectedBesitzerId, setSelectedBesitzerId] = useState<string | null>(null);
  const [showBesitzerCreate, setShowBesitzerCreate] = useState(false);
  const [newVorname, setNewVorname] = useState('');
  const [newNachname, setNewNachname] = useState('');
  const [newTelefon, setNewTelefon] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [creatingBesitzer, setCreatingBesitzer] = useState(false);

  // Step 2 — Hund
  const [selectedHundId, setSelectedHundId] = useState<string | null>(null);
  const [showHundCreate, setShowHundCreate] = useState(false);
  const [newHundName, setNewHundName] = useState('');
  const [newRasse, setNewRasse] = useState('');
  const [newGeburtsdatum, setNewGeburtsdatum] = useState('');
  const [newGeschlecht, setNewGeschlecht] = useState('none');
  const [newImpfstatus, setNewImpfstatus] = useState('none');
  const [newGewicht, setNewGewicht] = useState('');
  const [creatingHund, setCreatingHund] = useState(false);

  // Step 3 — Buchungsdetails
  const [anreisedatum, setAnreisedatum] = useState('');
  const [abreisedatum, setAbreisedatum] = useState('');
  const [platznummer, setPlatznummer] = useState('none');
  const [preisEuro, setPreisEuro] = useState('');
  const [notizen, setNotizen] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // ── Derived values (inside component body — locale-aware) ────────────────
  const GESCHLECHT_OPTIONS = LOOKUP_OPTIONS['hundekartei']?.['geschlecht'] ?? [];
  const IMPFSTATUS_OPTIONS = LOOKUP_OPTIONS['hundekartei']?.['impfstatus'] ?? [];
  const PLATZNUMMER_OPTIONS = LOOKUP_OPTIONS['belegung_buchungen']?.['platznummer'] ?? [];

  const selectedBesitzer = besitzer.find(b => b.record_id === selectedBesitzerId);
  const selectedHund = hundekartei.find(h => h.record_id === selectedHundId);

  // Hunde gefiltert nach ausgewähltem Besitzer
  const hundeForBesitzer = hundekartei.filter(
    h => extractRecordId(h.fields.besitzer) === selectedBesitzerId
  );

  // Aufenthaltsdauer berechnen
  const aufenthaltsTage =
    anreisedatum && abreisedatum
      ? differenceInDays(parseISO(abreisedatum), parseISO(anreisedatum))
      : 0;

  // ── Handler: Besitzer anlegen ────────────────────────────────────────────
  const handleCreateBesitzer = async () => {
    if (!newVorname.trim() || !newNachname.trim()) return;
    setCreatingBesitzer(true);
    try {
      const result = await LivingAppsService.createBesitzerEntry({
        vorname: newVorname.trim(),
        nachname: newNachname.trim(),
        telefon: newTelefon.trim() || undefined,
        email: newEmail.trim() || undefined,
      });
      await fetchAll();
      setSelectedBesitzerId(result.record_id);
      setShowBesitzerCreate(false);
      setNewVorname('');
      setNewNachname('');
      setNewTelefon('');
      setNewEmail('');
      setStep(2);
    } finally {
      setCreatingBesitzer(false);
    }
  };

  // ── Handler: Hund anlegen ───────────────────────────────────────────────
  const handleCreateHund = async () => {
    if (!newHundName.trim() || !selectedBesitzerId) return;
    setCreatingHund(true);
    try {
      const result = await LivingAppsService.createHundekarteiEntry({
        name: newHundName.trim(),
        rasse: newRasse.trim() || undefined,
        geburtsdatum: newGeburtsdatum || undefined,
        geschlecht: newGeschlecht !== 'none' ? newGeschlecht : undefined,
        impfstatus: newImpfstatus !== 'none' ? newImpfstatus : undefined,
        gewicht_kg: newGewicht ? parseFloat(newGewicht) : undefined,
        besitzer: createRecordUrl(APP_IDS.BESITZER, selectedBesitzerId),
      });
      await fetchAll();
      setSelectedHundId(result.record_id);
      setShowHundCreate(false);
      setNewHundName('');
      setNewRasse('');
      setNewGeburtsdatum('');
      setNewGeschlecht('none');
      setNewImpfstatus('none');
      setNewGewicht('');
      setStep(3);
    } finally {
      setCreatingHund(false);
    }
  };

  // ── Handler: Buchung anlegen ────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!selectedBesitzerId || !selectedHundId || !anreisedatum || !abreisedatum || platznummer === 'none') return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await LivingAppsService.createBelegungBuchungenEntry({
        hund: createRecordUrl(APP_IDS.HUNDEKARTEI, selectedHundId),
        besitzer: createRecordUrl(APP_IDS.BESITZER, selectedBesitzerId),
        anreisedatum,
        abreisedatum,
        platznummer,
        status: 'aktiv',
        preis_euro: preisEuro ? parseFloat(preisEuro) : undefined,
        notizen: notizen.trim() || undefined,
      });
      setSuccess(true);
    } catch {
      setSubmitError(tx('Beim Anlegen der Buchung ist ein Fehler aufgetreten. Bitte erneut versuchen.'));
    } finally {
      setSubmitting(false);
    }
  };

  // ── Wizard-Reset ─────────────────────────────────────────────────────────
  const handleReset = () => {
    setStep(1);
    setSelectedBesitzerId(null);
    setSelectedHundId(null);
    setAnreisedatum('');
    setAbreisedatum('');
    setPlatznummer('none');
    setPreisEuro('');
    setNotizen('');
    setSubmitError(null);
    setSuccess(false);
    setShowBesitzerCreate(false);
    setShowHundCreate(false);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <IntentWizardShell
      title={tx('Neue Buchung anlegen')}
      subtitle={tx('Besitzer, Hund und Aufenthaltsdaten in drei Schritten erfassen')}
      steps={[
        { label: tx('Besitzer') },
        { label: tx('Hund') },
        { label: tx('Details') },
      ]}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* ── Step 1: Besitzer wählen ─────────────────────────────────────── */}
      {step === 1 && (
        <EntitySelectStep
          items={besitzer.map(b => ({
            id: b.record_id,
            title: [b.fields.vorname, b.fields.nachname].filter(Boolean).join(' ') || b.record_id,
            subtitle: [b.fields.telefon, b.fields.email].filter(Boolean).join(' · '),
            icon: <IconUser size={20} className="text-primary" />,
          }))}
          onSelect={(id) => {
            setSelectedBesitzerId(id);
            setSelectedHundId(null);
            setStep(2);
          }}
          searchPlaceholder={tx('Besitzer suchen …')}
          createLabel={tx('Neuen Besitzer anlegen')}
          onCreateNew={() => setShowBesitzerCreate(true)}
          emptyText={tx('Kein Besitzer gefunden')}
          createDialog={showBesitzerCreate && (
            <div className="rounded-2xl border bg-card p-5 space-y-4">
              <p className="text-sm font-medium text-foreground">{tx('Neuen Besitzer erfassen')}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{tx('Vorname')} *</Label>
                  <Input
                    value={newVorname}
                    onChange={e => setNewVorname(e.target.value)}
                    placeholder={tx('Vorname')}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{tx('Nachname')} *</Label>
                  <Input
                    value={newNachname}
                    onChange={e => setNewNachname(e.target.value)}
                    placeholder={tx('Nachname')}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{tx('Telefon')}</Label>
                  <Input
                    type="tel"
                    value={newTelefon}
                    onChange={e => setNewTelefon(e.target.value)}
                    placeholder={tx('Telefonnummer')}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{tx('E-Mail')}</Label>
                  <Input
                    type="email"
                    value={newEmail}
                    onChange={e => setNewEmail(e.target.value)}
                    placeholder={tx('E-Mail-Adresse')}
                  />
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button
                  disabled={!newVorname.trim() || !newNachname.trim() || creatingBesitzer}
                  onClick={handleCreateBesitzer}
                >
                  {creatingBesitzer ? tx('Wird angelegt …') : tx('Anlegen & weiter')}
                </Button>
                <Button variant="outline" onClick={() => setShowBesitzerCreate(false)}>
                  {tx('Abbrechen')}
                </Button>
              </div>
            </div>
          )}
        />
      )}

      {/* ── Step 2: Hund wählen ────────────────────────────────────────── */}
      {step === 2 && (
        selectedBesitzerId ? (
          <div className="space-y-4">
            {selectedBesitzer && (
              <div className="flex items-center gap-2 px-1">
                <IconUser size={16} className="text-muted-foreground shrink-0" />
                <span className="text-sm text-muted-foreground">
                  {tx('Besitzer')}: <span className="font-medium text-foreground">
                    {[selectedBesitzer.fields.vorname, selectedBesitzer.fields.nachname].filter(Boolean).join(' ')}
                  </span>
                </span>
                <button
                  className="ml-auto text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                  onClick={() => { setStep(1); setSelectedHundId(null); }}
                >
                  {tx('ändern')}
                </button>
              </div>
            )}
            <EntitySelectStep
              items={hundeForBesitzer.map(h => ({
                id: h.record_id,
                title: h.fields.name ?? h.record_id,
                subtitle: [h.fields.rasse, h.fields.impfstatus?.label].filter(Boolean).join(' · '),
                icon: <IconDog size={20} className="text-primary" />,
              }))}
              onSelect={(id) => {
                setSelectedHundId(id);
                setStep(3);
              }}
              searchPlaceholder={tx('Hund suchen …')}
              createLabel={tx('Neuen Hund anlegen')}
              onCreateNew={() => setShowHundCreate(true)}
              emptyText={tx('Noch kein Hund für diesen Besitzer eingetragen')}
              createDialog={showHundCreate && (
                <div className="rounded-2xl border bg-card p-5 space-y-4">
                  <p className="text-sm font-medium text-foreground">{tx('Neuen Hund erfassen')}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{tx('Name')} *</Label>
                      <Input
                        value={newHundName}
                        onChange={e => setNewHundName(e.target.value)}
                        placeholder={tx('Hundename')}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{tx('Rasse')}</Label>
                      <Input
                        value={newRasse}
                        onChange={e => setNewRasse(e.target.value)}
                        placeholder={tx('z. B. Labrador')}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{tx('Geburtsdatum')}</Label>
                      <Input
                        type="date"
                        value={newGeburtsdatum}
                        onChange={e => setNewGeburtsdatum(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{tx('Gewicht (kg)')}</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.1"
                        value={newGewicht}
                        onChange={e => setNewGewicht(e.target.value)}
                        placeholder="0.0"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{tx('Geschlecht')}</Label>
                      <Select value={newGeschlecht} onValueChange={setNewGeschlecht}>
                        <SelectTrigger>
                          <SelectValue placeholder={tx('Auswählen …')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{tx('Keine Angabe')}</SelectItem>
                          {GESCHLECHT_OPTIONS.map(o => (
                            <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{tx('Impfstatus')}</Label>
                      <Select value={newImpfstatus} onValueChange={setNewImpfstatus}>
                        <SelectTrigger>
                          <SelectValue placeholder={tx('Auswählen …')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{tx('Keine Angabe')}</SelectItem>
                          {IMPFSTATUS_OPTIONS.map(o => (
                            <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      disabled={!newHundName.trim() || creatingHund}
                      onClick={handleCreateHund}
                    >
                      {creatingHund ? tx('Wird angelegt …') : tx('Anlegen & weiter')}
                    </Button>
                    <Button variant="outline" onClick={() => setShowHundCreate(false)}>
                      {tx('Abbrechen')}
                    </Button>
                  </div>
                </div>
              )}
            />
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">{tx('Dieser Schritt braucht die Auswahl aus Schritt 1.')}</p>
            <Button variant="outline" onClick={() => setStep(1)}>{tx('Neu starten')}</Button>
          </div>
        )
      )}

      {/* ── Step 3: Buchungsdetails ─────────────────────────────────────── */}
      {step === 3 && (
        selectedBesitzerId && selectedHundId ? (
          success ? (
            /* Erfolgszustand */
            <div className="flex flex-col items-center justify-center py-16 space-y-5 text-center">
              <IconCircleCheck size={56} className="text-emerald-500" stroke={1.5} />
              <div className="space-y-1">
                <p className="text-lg font-semibold text-foreground">{tx('Buchung erfolgreich angelegt!')}</p>
                <p className="text-sm text-muted-foreground">
                  {selectedHund?.fields.name && selectedBesitzer
                    ? tx`${selectedHund.fields.name} (${[selectedBesitzer.fields.vorname, selectedBesitzer.fields.nachname].filter(Boolean).join(' ')}) ist eingetragen.`
                    : tx('Die Buchung wurde gespeichert.')
                  }
                </p>
              </div>
              <div className="flex gap-3 flex-wrap justify-center">
                <Button onClick={handleReset}>{tx('Neue Buchung anlegen')}</Button>
                <a href="#/">
                  <Button variant="outline">{tx('Zurück zum Dashboard')}</Button>
                </a>
              </div>
            </div>
          ) : (
            /* Buchungsdetails-Formular */
            <div className="space-y-6">
              {/* Zusammenfassung der Auswahl */}
              <div className="rounded-xl bg-secondary/50 border p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <IconUser size={15} className="text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">{tx('Besitzer')}:</span>
                  <span className="font-medium">
                    {[selectedBesitzer?.fields.vorname, selectedBesitzer?.fields.nachname].filter(Boolean).join(' ')}
                  </span>
                  <button
                    className="ml-auto text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                    onClick={() => { setStep(1); setSelectedHundId(null); }}
                  >
                    {tx('ändern')}
                  </button>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <IconDog size={15} className="text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">{tx('Hund')}:</span>
                  <span className="font-medium">
                    {selectedHund?.fields.name}
                    {selectedHund?.fields.rasse ? ` (${selectedHund.fields.rasse})` : ''}
                  </span>
                  <button
                    className="ml-auto text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                    onClick={() => setStep(2)}
                  >
                    {tx('ändern')}
                  </button>
                </div>
              </div>

              {/* Datumseingabe */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <IconCalendar size={18} className="text-primary shrink-0" />
                  <h3 className="text-sm font-semibold text-foreground">{tx('Aufenthaltszeitraum')}</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{tx('Anreisedatum')} *</Label>
                    <Input
                      type="date"
                      value={anreisedatum}
                      onChange={e => setAnreisedatum(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{tx('Abreisedatum')} *</Label>
                    <Input
                      type="date"
                      value={abreisedatum}
                      min={anreisedatum || undefined}
                      onChange={e => setAbreisedatum(e.target.value)}
                    />
                  </div>
                </div>
                {aufenthaltsTage > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {tx`Aufenthaltsdauer: ${aufenthaltsTage} ${aufenthaltsTage === 1 ? tx('Tag') : tx('Tage')}`}
                  </p>
                )}
              </div>

              {/* Platznummer */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">{tx('Platznummer')} *</Label>
                <Select value={platznummer} onValueChange={setPlatznummer}>
                  <SelectTrigger>
                    <SelectValue placeholder={tx('Platz auswählen …')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{tx('Bitte wählen …')}</SelectItem>
                    {PLATZNUMMER_OPTIONS.map(o => (
                      <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Preis */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">{tx('Preis (€)')}</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={preisEuro}
                  onChange={e => setPreisEuro(e.target.value)}
                  placeholder="0,00"
                />
              </div>

              {/* Notizen */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">{tx('Notizen')}</Label>
                <Textarea
                  value={notizen}
                  onChange={e => setNotizen(e.target.value)}
                  placeholder={tx('Besonderheiten, Hinweise, …')}
                  rows={3}
                />
              </div>

              {/* Fehler */}
              {submitError && (
                <p className="text-sm text-destructive">{submitError}</p>
              )}

              {/* Aktionen */}
              <div className="flex gap-3 flex-wrap pt-1">
                <Button
                  disabled={!anreisedatum || !abreisedatum || platznummer === 'none' || submitting}
                  onClick={handleSubmit}
                  className="flex items-center gap-2"
                >
                  <IconCheck size={16} className="shrink-0" />
                  {submitting ? tx('Wird gespeichert …') : tx('Buchung anlegen')}
                </Button>
                <Button variant="outline" onClick={() => setStep(2)}>
                  {tx('Zurück')}
                </Button>
              </div>
            </div>
          )
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">{tx('Dieser Schritt braucht die Auswahl aus Schritt 1 und 2.')}</p>
            <Button variant="outline" onClick={() => setStep(1)}>{tx('Neu starten')}</Button>
          </div>
        )
      )}
    </IntentWizardShell>
  );
}
