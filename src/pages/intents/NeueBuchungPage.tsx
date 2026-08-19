/**
 * Neue Belegung — 3-Schritt-Wizard.
 * Steps: 1) Besitzer wählen/anlegen → 2) Hund wählen/anlegen → 3) Zeitraum & Platz festlegen → Belegung speichern.
 * Reads: besitzer, hundekartei. Writes: besitzer (createBesitzerEntry), hundekartei (createHundekarteiEntry), belegung_buchungen (createBelegungBuchungenEntry).
 * Composes: IntentWizardShell, EntitySelectStep.
 */
import { useState } from 'react';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { useDashboardData } from '@/hooks/useDashboardData';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService, createRecordUrl, extractRecordId } from '@/services/livingAppsService';
import { tx } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { IconUser, IconDog, IconCalendar, IconCheck, IconAlertCircle } from '@tabler/icons-react';
import { differenceInDays } from 'date-fns';

export default function NeueBuchungPage() {
  const data = useDashboardData();
  const { besitzer, hundekartei, loading, error, fetchAll } = data;

  // Wizard-Schritt
  const [step, setStep] = useState(1);

  // Schritt 1: Besitzer
  const [selectedBesitzerId, setSelectedBesitzerId] = useState<string | null>(null);
  const [showBesitzerCreate, setShowBesitzerCreate] = useState(false);
  const [bVorname, setBVorname] = useState('');
  const [bNachname, setBNachname] = useState('');
  const [bTelefon, setBTelefon] = useState('');
  const [bEmail, setBEmail] = useState('');
  const [bCreating, setBCreating] = useState(false);
  const [bError, setBError] = useState<string | null>(null);

  // Schritt 2: Hund
  const [selectedHundId, setSelectedHundId] = useState<string | null>(null);
  const [showHundCreate, setShowHundCreate] = useState(false);
  const [hName, setHName] = useState('');
  const [hRasse, setHRasse] = useState('');
  const [hGeburtsdatum, setHGeburtsdatum] = useState('');
  const [hGewicht, setHGewicht] = useState('');
  const [hCreating, setHCreating] = useState(false);
  const [hError, setHError] = useState<string | null>(null);

  // Schritt 3: Zeitraum & Platz
  const [anreisedatum, setAnreisedatum] = useState('');
  const [abreisedatum, setAbreisedatum] = useState('');
  const [platznummerKey, setPlatznummerKey] = useState('none');
  const [preisEuro, setPreisEuro] = useState('');
  const [notizen, setNotizen] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedBuchungId, setSavedBuchungId] = useState<string | null>(null);

  const PLATZ_OPTIONS = LOOKUP_OPTIONS['belegung_buchungen']?.['platznummer'] ?? [];

  // Besitzer anlegen
  const handleBesitzerCreate = async () => {
    if (!bVorname.trim() || !bNachname.trim()) return;
    setBCreating(true);
    setBError(null);
    try {
      const result = await LivingAppsService.createBesitzerEntry({
        vorname: bVorname.trim(),
        nachname: bNachname.trim(),
        telefon: bTelefon.trim() || undefined,
        email: bEmail.trim() || undefined,
      });
      await fetchAll();
      setShowBesitzerCreate(false);
      setBVorname('');
      setBNachname('');
      setBTelefon('');
      setBEmail('');
      setSelectedBesitzerId(result.record_id);
      setStep(2);
    } catch {
      setBError(tx('Besitzer konnte nicht angelegt werden. Bitte erneut versuchen.'));
    } finally {
      setBCreating(false);
    }
  };

  // Hund anlegen
  const handleHundCreate = async () => {
    if (!hName.trim() || !selectedBesitzerId) return;
    setHCreating(true);
    setHError(null);
    try {
      const result = await LivingAppsService.createHundekarteiEntry({
        name: hName.trim(),
        rasse: hRasse.trim() || undefined,
        geburtsdatum: hGeburtsdatum || undefined,
        gewicht_kg: hGewicht ? parseFloat(hGewicht) : undefined,
        besitzer: createRecordUrl(APP_IDS.BESITZER, selectedBesitzerId),
      });
      await fetchAll();
      setShowHundCreate(false);
      setHName('');
      setHRasse('');
      setHGeburtsdatum('');
      setHGewicht('');
      setSelectedHundId(result.record_id);
      setStep(3);
    } catch {
      setHError(tx('Hund konnte nicht angelegt werden. Bitte erneut versuchen.'));
    } finally {
      setHCreating(false);
    }
  };

  // Belegung speichern
  const handleSave = async () => {
    if (savedBuchungId) return; // Idempotenz-Guard
    if (!selectedBesitzerId || !selectedHundId || !anreisedatum || !abreisedatum || platznummerKey === 'none') return;
    setSaving(true);
    setSaveError(null);
    try {
      const result = await LivingAppsService.createBelegungBuchungenEntry({
        hund: createRecordUrl(APP_IDS.HUNDEKARTEI, selectedHundId),
        besitzer: createRecordUrl(APP_IDS.BESITZER, selectedBesitzerId),
        anreisedatum,
        abreisedatum,
        platznummer: platznummerKey,
        status: 'aktiv',
        preis_euro: preisEuro ? parseFloat(preisEuro) : undefined,
        notizen: notizen.trim() || undefined,
      });
      setSavedBuchungId(result.record_id);
      await fetchAll();
    } catch {
      setSaveError(tx('Belegung konnte nicht gespeichert werden. Bitte erneut versuchen.'));
    } finally {
      setSaving(false);
    }
  };

  // Wizard zurücksetzen
  const handleReset = () => {
    setStep(1);
    setSelectedBesitzerId(null);
    setSelectedHundId(null);
    setShowBesitzerCreate(false);
    setShowHundCreate(false);
    setBVorname('');
    setBNachname('');
    setBTelefon('');
    setBEmail('');
    setBError(null);
    setHName('');
    setHRasse('');
    setHGeburtsdatum('');
    setHGewicht('');
    setHError(null);
    setAnreisedatum('');
    setAbreisedatum('');
    setPlatznummerKey('none');
    setPreisEuro('');
    setNotizen('');
    setSaveError(null);
    setSavedBuchungId(null);
  };

  // Hunde gefiltert nach gewähltem Besitzer
  const hundeDesBesitzers = selectedBesitzerId
    ? hundekartei.filter(h => extractRecordId(h.fields.besitzer) === selectedBesitzerId)
    : [];

  // Anzahl Nächte
  const naechte =
    anreisedatum && abreisedatum
      ? differenceInDays(new Date(abreisedatum), new Date(anreisedatum))
      : 0;

  // Gewählter Besitzer (für Anzeige)
  const selectedBesitzer = besitzer.find(b => b.record_id === selectedBesitzerId);
  const selectedHund = hundekartei.find(h => h.record_id === selectedHundId);

  return (
    <IntentWizardShell
      title={tx('Neue Belegung anlegen')}
      subtitle={tx('In drei Schritten zur fertigen Buchung')}
      steps={[
        { label: tx('Besitzer') },
        { label: tx('Hund') },
        { label: tx('Zeitraum & Platz') },
      ]}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* ─── Schritt 1: Besitzer wählen ─── */}
      {step === 1 && (
        <EntitySelectStep
          items={besitzer.map(b => ({
            id: b.record_id,
            title: `${b.fields.vorname ?? ''} ${b.fields.nachname ?? ''}`.trim() || b.record_id,
            subtitle: [b.fields.telefon, b.fields.email].filter(Boolean).join(' · '),
            icon: <IconUser size={20} className="text-primary" />,
          }))}
          onSelect={(id) => {
            setSelectedBesitzerId(id);
            setSelectedHundId(null);
            setStep(2);
          }}
          createLabel={tx('Neuen Besitzer anlegen')}
          onCreateNew={() => setShowBesitzerCreate(true)}
          searchPlaceholder={tx('Besitzer suchen …')}
          emptyText={tx('Noch kein Besitzer vorhanden — lege jetzt den ersten an.')}
          emptyIcon={<IconUser size={32} className="text-muted-foreground" />}
          createDialog={showBesitzerCreate && (
            <div className="rounded-2xl border bg-card p-5 space-y-4">
              <p className="font-medium text-sm">{tx('Neuen Besitzer anlegen')}</p>
              {bError && (
                <div className="flex items-center gap-2 text-destructive text-sm">
                  <IconAlertCircle size={16} className="shrink-0" />
                  <span>{bError}</span>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="b-vorname">{tx('Vorname')} *</Label>
                  <Input
                    id="b-vorname"
                    value={bVorname}
                    onChange={e => setBVorname(e.target.value)}
                    placeholder={tx('Vorname')}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="b-nachname">{tx('Nachname')} *</Label>
                  <Input
                    id="b-nachname"
                    value={bNachname}
                    onChange={e => setBNachname(e.target.value)}
                    placeholder={tx('Nachname')}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="b-telefon">{tx('Telefon')}</Label>
                  <Input
                    id="b-telefon"
                    type="tel"
                    value={bTelefon}
                    onChange={e => setBTelefon(e.target.value)}
                    placeholder={tx('z. B. 0151 12345678')}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="b-email">{tx('E-Mail')}</Label>
                  <Input
                    id="b-email"
                    type="email"
                    value={bEmail}
                    onChange={e => setBEmail(e.target.value)}
                    placeholder={tx('z. B. max@example.de')}
                  />
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button
                  disabled={!bVorname.trim() || !bNachname.trim() || bCreating}
                  onClick={handleBesitzerCreate}
                >
                  {bCreating ? tx('Anlegen …') : tx('Anlegen & weiter')}
                </Button>
                <Button variant="outline" onClick={() => { setShowBesitzerCreate(false); setBError(null); }}>
                  {tx('Abbrechen')}
                </Button>
              </div>
            </div>
          )}
        />
      )}

      {/* ─── Schritt 2: Hund wählen ─── */}
      {step === 2 && (
        selectedBesitzerId ? (
          <div className="space-y-4">
            {selectedBesitzer && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <IconUser size={16} className="shrink-0" />
                <span>
                  {tx('Besitzer')}: <strong className="text-foreground">
                    {selectedBesitzer.fields.vorname} {selectedBesitzer.fields.nachname}
                  </strong>
                </span>
                <button
                  className="ml-2 underline text-xs hover:no-underline"
                  onClick={() => { setSelectedBesitzerId(null); setStep(1); }}
                >
                  {tx('ändern')}
                </button>
              </div>
            )}
            <EntitySelectStep
              items={hundeDesBesitzers.map(h => ({
                id: h.record_id,
                title: h.fields.name ?? h.record_id,
                subtitle: [
                  h.fields.rasse,
                  h.fields.gewicht_kg != null ? `${h.fields.gewicht_kg} kg` : undefined,
                ].filter(Boolean).join(' · '),
                icon: <IconDog size={20} className="text-primary" />,
              }))}
              onSelect={(id) => {
                setSelectedHundId(id);
                setStep(3);
              }}
              createLabel={tx('Neuen Hund anlegen')}
              onCreateNew={() => setShowHundCreate(true)}
              searchPlaceholder={tx('Hund suchen …')}
              emptyText={
                hundeDesBesitzers.length === 0
                  ? tx('Noch kein Hund für diesen Besitzer — lege jetzt einen an.')
                  : tx('Kein Hund gefunden.')
              }
              emptyIcon={<IconDog size={32} className="text-muted-foreground" />}
              createDialog={showHundCreate && (
                <div className="rounded-2xl border bg-card p-5 space-y-4">
                  <p className="font-medium text-sm">{tx('Neuen Hund anlegen')}</p>
                  {hError && (
                    <div className="flex items-center gap-2 text-destructive text-sm">
                      <IconAlertCircle size={16} className="shrink-0" />
                      <span>{hError}</span>
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="h-name">{tx('Name')} *</Label>
                      <Input
                        id="h-name"
                        value={hName}
                        onChange={e => setHName(e.target.value)}
                        placeholder={tx('Name des Hundes')}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="h-rasse">{tx('Rasse')}</Label>
                      <Input
                        id="h-rasse"
                        value={hRasse}
                        onChange={e => setHRasse(e.target.value)}
                        placeholder={tx('z. B. Labrador')}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="h-geburtsdatum">{tx('Geburtsdatum')}</Label>
                      <Input
                        id="h-geburtsdatum"
                        type="date"
                        value={hGeburtsdatum}
                        onChange={e => setHGeburtsdatum(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="h-gewicht">{tx('Gewicht (kg)')}</Label>
                      <Input
                        id="h-gewicht"
                        type="number"
                        min="0"
                        step="0.1"
                        value={hGewicht}
                        onChange={e => setHGewicht(e.target.value)}
                        placeholder={tx('z. B. 12.5')}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      disabled={!hName.trim() || hCreating}
                      onClick={handleHundCreate}
                    >
                      {hCreating ? tx('Anlegen …') : tx('Anlegen & weiter')}
                    </Button>
                    <Button variant="outline" onClick={() => { setShowHundCreate(false); setHError(null); }}>
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
            <Button variant="outline" onClick={() => setStep(1)}>{tx('Zu Schritt 1')}</Button>
          </div>
        )
      )}

      {/* ─── Schritt 3: Zeitraum & Platz ─── */}
      {step === 3 && (
        selectedBesitzerId && selectedHundId ? (
          savedBuchungId ? (
            /* Erfolgszustand */
            <div className="rounded-2xl border bg-card p-8 text-center space-y-5">
              <div className="flex justify-center">
                <div className="rounded-full bg-emerald-100 p-4">
                  <IconCheck size={36} className="text-emerald-600" />
                </div>
              </div>
              <div>
                <h2 className="text-xl font-semibold">{tx('Belegung gespeichert!')}</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedHund?.fields.name && selectedBesitzer
                    ? tx`${selectedHund.fields.name} (${selectedBesitzer.fields.vorname} ${selectedBesitzer.fields.nachname}) wurde erfolgreich gebucht.`
                    : tx('Die Belegung wurde erfolgreich angelegt.')}
                </p>
              </div>
              <div className="flex gap-3 justify-center flex-wrap">
                <Button onClick={handleReset}>{tx('Neue Belegung anlegen')}</Button>
                <a href="#/">
                  <Button variant="outline">{tx('Zurück zum Dashboard')}</Button>
                </a>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Kontext-Zeile */}
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <IconUser size={15} className="shrink-0" />
                  <strong className="text-foreground">
                    {selectedBesitzer?.fields.vorname} {selectedBesitzer?.fields.nachname}
                  </strong>
                  <button className="underline text-xs ml-1" onClick={() => setStep(1)}>
                    {tx('ändern')}
                  </button>
                </span>
                <span className="flex items-center gap-1">
                  <IconDog size={15} className="shrink-0" />
                  <strong className="text-foreground">{selectedHund?.fields.name}</strong>
                  <button className="underline text-xs ml-1" onClick={() => setStep(2)}>
                    {tx('ändern')}
                  </button>
                </span>
              </div>

              {/* Formular */}
              <div className="rounded-2xl border bg-card p-5 space-y-4">
                <p className="font-medium text-sm flex items-center gap-2">
                  <IconCalendar size={16} className="shrink-0 text-primary" />
                  {tx('Zeitraum & Platz')}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="anreise">{tx('Anreisedatum')} *</Label>
                    <Input
                      id="anreise"
                      type="date"
                      value={anreisedatum}
                      onChange={e => setAnreisedatum(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="abreise">{tx('Abreisedatum')} *</Label>
                    <Input
                      id="abreise"
                      type="date"
                      value={abreisedatum}
                      min={anreisedatum || undefined}
                      onChange={e => setAbreisedatum(e.target.value)}
                    />
                  </div>
                </div>

                {naechte > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {tx`Aufenthaltsdauer: ${naechte} ${naechte === 1 ? tx('Nacht') : tx('Nächte')}`}
                  </p>
                )}

                <div className="space-y-1">
                  <Label htmlFor="platz">{tx('Platznummer')} *</Label>
                  <Select value={platznummerKey} onValueChange={setPlatznummerKey}>
                    <SelectTrigger id="platz">
                      <SelectValue placeholder={tx('Platz wählen …')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{tx('Bitte wählen …')}</SelectItem>
                      {PLATZ_OPTIONS.map(opt => (
                        <SelectItem key={opt.key} value={opt.key}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="preis">{tx('Preis (€)')}</Label>
                  <Input
                    id="preis"
                    type="number"
                    min="0"
                    step="0.01"
                    value={preisEuro}
                    onChange={e => setPreisEuro(e.target.value)}
                    placeholder={tx('z. B. 350.00')}
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="notizen">{tx('Notizen')}</Label>
                  <Textarea
                    id="notizen"
                    value={notizen}
                    onChange={e => setNotizen(e.target.value)}
                    placeholder={tx('Besondere Hinweise, Wünsche …')}
                    rows={3}
                  />
                </div>
              </div>

              {saveError && (
                <div className="flex items-center gap-2 text-destructive text-sm">
                  <IconAlertCircle size={16} className="shrink-0" />
                  <span>{saveError}</span>
                </div>
              )}

              <div className="flex gap-2 flex-wrap">
                <Button
                  disabled={
                    !anreisedatum ||
                    !abreisedatum ||
                    platznummerKey === 'none' ||
                    naechte <= 0 ||
                    saving
                  }
                  onClick={handleSave}
                >
                  {saving ? tx('Speichern …') : tx('Belegung speichern')}
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
