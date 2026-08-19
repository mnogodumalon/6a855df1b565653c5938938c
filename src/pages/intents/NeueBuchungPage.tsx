/**
 * Neue Buchung — 3-Schritt-Wizard.
 * Steps: 1) Besitzer auswählen oder neu anlegen →
 *        2) Hund auswählen oder neu anlegen (gefiltert nach Besitzer) →
 *        3) Zeitraum & Platz festlegen und Buchung speichern.
 * Reads: besitzer, hundekartei. Writes: besitzer (createBesitzerEntry),
 *        hundekartei (createHundekarteiEntry),
 *        belegung_buchungen (createBelegungBuchungenEntry).
 * Composes: IntentWizardShell, EntitySelectStep.
 */

import { useState } from 'react';
import { tx } from '@/i18n';
import { useDashboardData } from '@/hooks/useDashboardData';
import { LivingAppsService, createRecordUrl, extractRecordId } from '@/services/livingAppsService';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { IconUser, IconDog, IconCalendar, IconCheck } from '@tabler/icons-react';

export default function NeueBuchungPage() {
  const data = useDashboardData();
  const { besitzer, hundekartei, loading, error, fetchAll } = data;

  // Wizard state
  const [step, setStep] = useState(1);

  // Step 1 state
  const [besitzerId, setBesitzerId] = useState<string | null>(null);
  const [showCreateBesitzer, setShowCreateBesitzer] = useState(false);
  const [newVorname, setNewVorname] = useState('');
  const [newNachname, setNewNachname] = useState('');
  const [newTelefon, setNewTelefon] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [savingBesitzer, setSavingBesitzer] = useState(false);

  // Step 2 state
  const [hundId, setHundId] = useState<string | null>(null);
  const [showCreateHund, setShowCreateHund] = useState(false);
  const [newHundName, setNewHundName] = useState('');
  const [newRasse, setNewRasse] = useState('');
  const [newGeburtsdatum, setNewGeburtsdatum] = useState('');
  const [newGeschlecht, setNewGeschlecht] = useState('none');
  const [newGewicht, setNewGewicht] = useState('');
  const [savingHund, setSavingHund] = useState(false);

  // Step 3 state
  const [anreisedatum, setAnreisedatum] = useState('');
  const [abreisedatum, setAbreisedatum] = useState('');
  const [platznummer, setPlatznummer] = useState('none');
  const [preisEuro, setPreisEuro] = useState('');
  const [notizen, setNotizen] = useState('');
  const [savingBuchung, setSavingBuchung] = useState(false);
  const [buchungError, setBuchungError] = useState<string | null>(null);
  const [buchungSuccess, setBuchungSuccess] = useState(false);

  const PLATZ_OPTIONS = LOOKUP_OPTIONS['belegung_buchungen']?.['platznummer'] ?? [];
  const GESCHLECHT_OPTIONS = LOOKUP_OPTIONS['hundekartei']?.['geschlecht'] ?? [];

  // Besitzer für die Liste aufbereiten
  const besitzerItems = besitzer.map(b => ({
    id: b.record_id,
    title: [b.fields.vorname, b.fields.nachname].filter(Boolean).join(' ') || tx('Unbekannt'),
    subtitle: [b.fields.telefon, b.fields.email].filter(Boolean).join(' · '),
    icon: <IconUser size={20} className="text-primary" />,
  }));

  // Hunde für den gewählten Besitzer filtern
  const eigenHunde = hundekartei.filter(h => {
    const hBesitzerId = extractRecordId(h.fields.besitzer);
    return hBesitzerId === besitzerId;
  });

  const hundItems = eigenHunde.map(h => ({
    id: h.record_id,
    title: h.fields.name ?? tx('Unbekannter Hund'),
    subtitle: h.fields.rasse ?? '',
    icon: <IconDog size={20} className="text-primary" />,
  }));

  // Besitzer anlegen
  const handleCreateBesitzer = async () => {
    if (!newVorname || !newNachname) return;
    setSavingBesitzer(true);
    try {
      const result = await LivingAppsService.createBesitzerEntry({
        vorname: newVorname,
        nachname: newNachname,
        telefon: newTelefon || undefined,
        email: newEmail || undefined,
      });
      await fetchAll();
      setBesitzerId(result.record_id);
      setShowCreateBesitzer(false);
      setNewVorname('');
      setNewNachname('');
      setNewTelefon('');
      setNewEmail('');
      setStep(2);
    } finally {
      setSavingBesitzer(false);
    }
  };

  // Hund anlegen
  const handleCreateHund = async () => {
    if (!newHundName || !besitzerId) return;
    setSavingHund(true);
    try {
      const result = await LivingAppsService.createHundekarteiEntry({
        name: newHundName,
        rasse: newRasse || undefined,
        geburtsdatum: newGeburtsdatum || undefined,
        geschlecht: (newGeschlecht !== 'none' ? newGeschlecht : undefined),
        gewicht_kg: newGewicht ? parseFloat(newGewicht) : undefined,
        besitzer: createRecordUrl(APP_IDS.BESITZER, besitzerId),
      });
      await fetchAll();
      setHundId(result.record_id);
      setShowCreateHund(false);
      setNewHundName('');
      setNewRasse('');
      setNewGeburtsdatum('');
      setNewGeschlecht('none');
      setNewGewicht('');
      setStep(3);
    } finally {
      setSavingHund(false);
    }
  };

  // Buchung speichern
  const handleSaveBuchung = async () => {
    if (!hundId || !besitzerId || !anreisedatum || !abreisedatum || platznummer === 'none') return;
    setSavingBuchung(true);
    setBuchungError(null);
    try {
      await LivingAppsService.createBelegungBuchungenEntry({
        hund: createRecordUrl(APP_IDS.HUNDEKARTEI, hundId),
        besitzer: createRecordUrl(APP_IDS.BESITZER, besitzerId),
        anreisedatum,
        abreisedatum,
        platznummer,
        status: 'aktiv',
        preis_euro: preisEuro ? parseFloat(preisEuro) : undefined,
        notizen: notizen || undefined,
      });
      setBuchungSuccess(true);
    } catch {
      setBuchungError(tx('Buchung konnte nicht gespeichert werden. Bitte erneut versuchen.'));
    } finally {
      setSavingBuchung(false);
    }
  };

  // Wizard zurücksetzen
  const handleReset = () => {
    setBesitzerId(null);
    setHundId(null);
    setStep(1);
    setAnreisedatum('');
    setAbreisedatum('');
    setPlatznummer('none');
    setPreisEuro('');
    setNotizen('');
    setBuchungSuccess(false);
    setBuchungError(null);
  };

  // Ausgewählten Besitzernamen ermitteln
  const selectedBesitzer = besitzerId ? besitzer.find(b => b.record_id === besitzerId) : null;
  const selectedBesitzerName = selectedBesitzer
    ? [selectedBesitzer.fields.vorname, selectedBesitzer.fields.nachname].filter(Boolean).join(' ')
    : '';

  const selectedHund = hundId ? hundekartei.find(h => h.record_id === hundId) : null;

  return (
    <IntentWizardShell
      title={tx('Neue Buchung')}
      subtitle={tx('Schritt für Schritt eine Buchung anlegen')}
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
      {/* ── Schritt 1: Besitzer auswählen ── */}
      {step === 1 && (
        <EntitySelectStep
          items={besitzerItems}
          onSelect={(id) => {
            setBesitzerId(id);
            setHundId(null);
            setStep(2);
          }}
          createLabel={tx('Neuen Besitzer anlegen')}
          onCreateNew={() => setShowCreateBesitzer(true)}
          searchPlaceholder={tx('Besitzer suchen …')}
          emptyText={tx('Noch kein Besitzer angelegt')}
          emptyIcon={<IconUser size={32} className="text-muted-foreground" />}
          createDialog={showCreateBesitzer && (
            <div className="rounded-2xl border bg-card p-4 space-y-3">
              <p className="text-sm font-medium">{tx('Neuen Besitzer anlegen')}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="new-vorname">{tx('Vorname')} *</Label>
                  <Input
                    id="new-vorname"
                    value={newVorname}
                    onChange={e => setNewVorname(e.target.value)}
                    placeholder={tx('Vorname')}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="new-nachname">{tx('Nachname')} *</Label>
                  <Input
                    id="new-nachname"
                    value={newNachname}
                    onChange={e => setNewNachname(e.target.value)}
                    placeholder={tx('Nachname')}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="new-telefon">{tx('Telefon')}</Label>
                  <Input
                    id="new-telefon"
                    type="tel"
                    value={newTelefon}
                    onChange={e => setNewTelefon(e.target.value)}
                    placeholder={tx('Telefon')}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="new-email">{tx('E-Mail')}</Label>
                  <Input
                    id="new-email"
                    type="email"
                    value={newEmail}
                    onChange={e => setNewEmail(e.target.value)}
                    placeholder={tx('E-Mail')}
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button
                  disabled={!newVorname || !newNachname || savingBesitzer}
                  onClick={handleCreateBesitzer}
                >
                  {savingBesitzer ? tx('Wird gespeichert …') : tx('Anlegen & auswählen')}
                </Button>
                <Button variant="outline" onClick={() => setShowCreateBesitzer(false)}>
                  {tx('Abbrechen')}
                </Button>
              </div>
            </div>
          )}
        />
      )}

      {/* ── Schritt 2: Hund auswählen ── */}
      {step === 2 && (
        besitzerId ? (
          <div className="space-y-4">
            {selectedBesitzerName && (
              <p className="text-sm text-muted-foreground">
                {tx('Besitzer')}: <span className="font-medium text-foreground">{selectedBesitzerName}</span>
              </p>
            )}
            <EntitySelectStep
              items={hundItems}
              onSelect={(id) => {
                setHundId(id);
                setStep(3);
              }}
              createLabel={tx('Neuen Hund anlegen')}
              onCreateNew={() => setShowCreateHund(true)}
              searchPlaceholder={tx('Hund suchen …')}
              emptyText={tx('Noch kein Hund für diesen Besitzer angelegt')}
              emptyIcon={<IconDog size={32} className="text-muted-foreground" />}
              createDialog={showCreateHund && (
                <div className="rounded-2xl border bg-card p-4 space-y-3">
                  <p className="text-sm font-medium">{tx('Neuen Hund anlegen')}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="new-hund-name">{tx('Name')} *</Label>
                      <Input
                        id="new-hund-name"
                        value={newHundName}
                        onChange={e => setNewHundName(e.target.value)}
                        placeholder={tx('Hundename')}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="new-rasse">{tx('Rasse')}</Label>
                      <Input
                        id="new-rasse"
                        value={newRasse}
                        onChange={e => setNewRasse(e.target.value)}
                        placeholder={tx('Rasse')}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="new-geburtsdatum">{tx('Geburtsdatum')}</Label>
                      <Input
                        id="new-geburtsdatum"
                        type="date"
                        value={newGeburtsdatum}
                        onChange={e => setNewGeburtsdatum(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="new-geschlecht">{tx('Geschlecht')}</Label>
                      <Select value={newGeschlecht} onValueChange={setNewGeschlecht}>
                        <SelectTrigger id="new-geschlecht">
                          <SelectValue placeholder={tx('Geschlecht wählen')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{tx('Nicht angegeben')}</SelectItem>
                          {GESCHLECHT_OPTIONS.map(o => (
                            <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="new-gewicht">{tx('Gewicht (kg)')}</Label>
                      <Input
                        id="new-gewicht"
                        type="number"
                        min="0"
                        step="0.1"
                        value={newGewicht}
                        onChange={e => setNewGewicht(e.target.value)}
                        placeholder="0.0"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button
                      disabled={!newHundName || savingHund}
                      onClick={handleCreateHund}
                    >
                      {savingHund ? tx('Wird gespeichert …') : tx('Anlegen & auswählen')}
                    </Button>
                    <Button variant="outline" onClick={() => setShowCreateHund(false)}>
                      {tx('Abbrechen')}
                    </Button>
                  </div>
                </div>
              )}
            />
            <Button variant="outline" size="sm" onClick={() => setStep(1)}>
              {tx('← Zurück zu Besitzer')}
            </Button>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">
              {tx('Dieser Schritt braucht die Auswahl aus Schritt 1.')}
            </p>
            <Button variant="outline" onClick={() => setStep(1)}>{tx('Neu starten')}</Button>
          </div>
        )
      )}

      {/* ── Schritt 3: Zeitraum & Platz ── */}
      {step === 3 && (
        hundId && besitzerId ? (
          buchungSuccess ? (
            <div className="flex flex-col items-center gap-6 py-12">
              <div className="rounded-full bg-emerald-100 p-4">
                <IconCheck size={40} className="text-emerald-600" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-lg font-semibold">{tx('Buchung gespeichert!')}</p>
                <p className="text-sm text-muted-foreground">
                  {selectedHund?.fields.name && selectedBesitzerName
                    ? tx`${selectedHund.fields.name} für ${selectedBesitzerName} wurde erfolgreich gebucht.`
                    : tx('Die Buchung wurde erfolgreich angelegt.')}
                </p>
              </div>
              <div className="flex flex-wrap gap-3 justify-center">
                <Button onClick={handleReset}>{tx('Neue Buchung anlegen')}</Button>
                <a href="#/">
                  <Button variant="outline">{tx('Zurück zum Dashboard')}</Button>
                </a>
              </div>
            </div>
          ) : (
            <div className="space-y-6 max-w-lg">
              {selectedBesitzerName && selectedHund?.fields.name && (
                <p className="text-sm text-muted-foreground">
                  {tx('Besitzer')}: <span className="font-medium text-foreground">{selectedBesitzerName}</span>
                  {' · '}
                  {tx('Hund')}: <span className="font-medium text-foreground">{selectedHund.fields.name}</span>
                </p>
              )}

              <div className="rounded-2xl border bg-card p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <IconCalendar size={18} className="text-primary shrink-0" />
                  <p className="font-medium text-sm">{tx('Zeitraum & Platz')}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="anreisedatum">{tx('Anreisedatum')} *</Label>
                    <Input
                      id="anreisedatum"
                      type="date"
                      value={anreisedatum}
                      onChange={e => setAnreisedatum(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="abreisedatum">{tx('Abreisedatum')} *</Label>
                    <Input
                      id="abreisedatum"
                      type="date"
                      value={abreisedatum}
                      min={anreisedatum || undefined}
                      onChange={e => setAbreisedatum(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="platznummer">{tx('Platz')} *</Label>
                  <Select value={platznummer} onValueChange={setPlatznummer}>
                    <SelectTrigger id="platznummer">
                      <SelectValue placeholder={tx('Platz wählen')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{tx('Bitte wählen')}</SelectItem>
                      {PLATZ_OPTIONS.map(o => (
                        <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="preis-euro">{tx('Preis (€)')}</Label>
                  <Input
                    id="preis-euro"
                    type="number"
                    min="0"
                    step="0.01"
                    value={preisEuro}
                    onChange={e => setPreisEuro(e.target.value)}
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="notizen">{tx('Notizen')}</Label>
                  <textarea
                    id="notizen"
                    className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={notizen}
                    onChange={e => setNotizen(e.target.value)}
                    placeholder={tx('Hinweise zur Buchung …')}
                  />
                </div>
              </div>

              {buchungError && (
                <p className="text-sm text-destructive">{buchungError}</p>
              )}

              <div className="flex flex-wrap gap-3">
                <Button
                  disabled={!anreisedatum || !abreisedatum || platznummer === 'none' || savingBuchung}
                  onClick={handleSaveBuchung}
                >
                  {savingBuchung ? tx('Wird gespeichert …') : tx('Buchung anlegen')}
                </Button>
                <Button variant="outline" onClick={() => setStep(2)}>
                  {tx('← Zurück zu Hund')}
                </Button>
              </div>
            </div>
          )
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">
              {tx('Dieser Schritt braucht die Auswahl aus Schritt 1 und 2.')}
            </p>
            <Button variant="outline" onClick={() => setStep(1)}>{tx('Neu starten')}</Button>
          </div>
        )
      )}
    </IntentWizardShell>
  );
}
