/**
 * Neue Pension-Buchung — 3-Schritt-Wizard.
 * Steps: 1) Besitzer auswählen oder neu erstellen →
 *         2) Hund auswählen oder neu erstellen (gefiltert nach Besitzer) →
 *         3) Zeitraum & Platz festlegen → Buchung anlegen.
 * Reads: besitzer, hundekartei. Writes: besitzer (createBesitzerEntry),
 *        hundekartei (createHundekarteiEntry),
 *        belegung_buchungen (createBelegungBuchungenEntry).
 * Composes: IntentWizardShell, EntitySelectStep.
 */

import { useState } from 'react';
import { tx } from '@/i18n';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService, createRecordUrl, extractRecordId } from '@/services/livingAppsService';
import { useDashboardData } from '@/hooks/useDashboardData';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { IconDog, IconUser, IconCalendar, IconCheck, IconAlertCircle } from '@tabler/icons-react';
import { differenceInDays } from 'date-fns';

const PLATZNUMMER_OPTIONS = LOOKUP_OPTIONS['belegung_buchungen']?.['platznummer'] ?? [];
const GESCHLECHT_OPTIONS = LOOKUP_OPTIONS['hundekartei']?.['geschlecht'] ?? [];
const IMPFSTATUS_OPTIONS = LOOKUP_OPTIONS['hundekartei']?.['impfstatus'] ?? [];

export default function NeueBuchungPage() {
  const data = useDashboardData();
  const { besitzer, hundekartei, loading, error, fetchAll } = data;

  // Wizard step
  const [step, setStep] = useState(1);

  // Step 1: Besitzer
  const [selectedBesitzerId, setSelectedBesitzerId] = useState<string | null>(null);
  const [showCreateBesitzer, setShowCreateBesitzer] = useState(false);
  const [bVorname, setBVorname] = useState('');
  const [bNachname, setBNachname] = useState('');
  const [bTelefon, setBTelefon] = useState('');
  const [bEmail, setBEmail] = useState('');
  const [bSaving, setBSaving] = useState(false);
  const [bError, setBError] = useState<string | null>(null);

  // Step 2: Hund
  const [selectedHundId, setSelectedHundId] = useState<string | null>(null);
  const [showCreateHund, setShowCreateHund] = useState(false);
  const [hName, setHName] = useState('');
  const [hRasse, setHRasse] = useState('');
  const [hGeschlecht, setHGeschlecht] = useState('none');
  const [hGeburtsdatum, setHGeburtsdatum] = useState('');
  const [hImpfstatus, setHImpfstatus] = useState('none');
  const [hSaving, setHSaving] = useState(false);
  const [hError, setHError] = useState<string | null>(null);

  // Step 3: Zeitraum & Platz
  const [anreisedatum, setAnreisedatum] = useState('');
  const [abreisedatum, setAbreisedatum] = useState('');
  const [platznummer, setPlatznummer] = useState('none');
  const [preisEuro, setPreisEuro] = useState('');
  const [notizen, setNotizen] = useState('');
  const [buchungSaving, setBuchungSaving] = useState(false);
  const [buchungError, setBuchungError] = useState<string | null>(null);
  const [buchungErfolg, setBuchungErfolg] = useState(false);

  // Hooks ABOVE all early returns (Rules of Hooks)

  if (loading || error) {
    return (
      <IntentWizardShell
        title={tx('Neue Buchung')}
        subtitle={tx('Besitzer, Hund und Aufenthalt in drei Schritten anlegen')}
        steps={[{ label: tx('Besitzer') }, { label: tx('Hund') }, { label: tx('Zeitraum & Platz') }]}
        currentStep={step}
        onStepChange={setStep}
        loading={loading}
        error={error}
        onRetry={fetchAll}
      >
        <div />
      </IntentWizardShell>
    );
  }

  // Derived data
  const selectedBesitzer = besitzer.find(b => b.record_id === selectedBesitzerId);
  const besitzerUrl = selectedBesitzerId
    ? createRecordUrl(APP_IDS.BESITZER, selectedBesitzerId)
    : null;
  const hundeFuerBesitzer = selectedBesitzerId
    ? hundekartei.filter(h => {
        const id = extractRecordId(h.fields.besitzer);
        return id === selectedBesitzerId;
      })
    : [];
  const selectedHund = hundekartei.find(h => h.record_id === selectedHundId);

  // Anzahl Nächte
  const naechte =
    anreisedatum && abreisedatum
      ? differenceInDays(new Date(abreisedatum), new Date(anreisedatum))
      : 0;

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleCreateBesitzer = async () => {
    if (!bVorname || !bNachname) return;
    setBSaving(true);
    setBError(null);
    try {
      const res = await LivingAppsService.createBesitzerEntry({
        vorname: bVorname,
        nachname: bNachname,
        telefon: bTelefon || undefined,
        email: bEmail || undefined,
      });
      await fetchAll();
      setSelectedBesitzerId(res.record_id);
      setShowCreateBesitzer(false);
      setBVorname('');
      setBNachname('');
      setBTelefon('');
      setBEmail('');
      setStep(2);
    } catch {
      setBError(tx('Besitzer konnte nicht angelegt werden. Bitte versuche es erneut.'));
    } finally {
      setBSaving(false);
    }
  };

  const handleCreateHund = async () => {
    if (!hName || !selectedBesitzerId) return;
    setHSaving(true);
    setHError(null);
    try {
      const res = await LivingAppsService.createHundekarteiEntry({
        name: hName,
        besitzer: createRecordUrl(APP_IDS.BESITZER, selectedBesitzerId),
        rasse: hRasse || undefined,
        geschlecht: hGeschlecht !== 'none' ? hGeschlecht : undefined,
        geburtsdatum: hGeburtsdatum || undefined,
        impfstatus: hImpfstatus !== 'none' ? hImpfstatus : undefined,
      });
      await fetchAll();
      setSelectedHundId(res.record_id);
      setShowCreateHund(false);
      setHName('');
      setHRasse('');
      setHGeschlecht('none');
      setHGeburtsdatum('');
      setHImpfstatus('none');
      setStep(3);
    } catch {
      setHError(tx('Hund konnte nicht angelegt werden. Bitte versuche es erneut.'));
    } finally {
      setHSaving(false);
    }
  };

  const handleCreateBuchung = async () => {
    if (!selectedBesitzerId || !selectedHundId || !anreisedatum || !abreisedatum || platznummer === 'none') return;
    setBuchungSaving(true);
    setBuchungError(null);
    try {
      await LivingAppsService.createBelegungBuchungenEntry({
        hund: createRecordUrl(APP_IDS.HUNDEKARTEI, selectedHundId),
        besitzer: createRecordUrl(APP_IDS.BESITZER, selectedBesitzerId),
        anreisedatum,
        abreisedatum,
        platznummer,
        status: 'aktiv',
        preis_euro: preisEuro ? parseFloat(preisEuro) : undefined,
        notizen: notizen || undefined,
      });
      setBuchungErfolg(true);
    } catch {
      setBuchungError(tx('Buchung konnte nicht gespeichert werden. Bitte versuche es erneut.'));
    } finally {
      setBuchungSaving(false);
    }
  };

  const handleReset = () => {
    setSelectedBesitzerId(null);
    setSelectedHundId(null);
    setAnreisedatum('');
    setAbreisedatum('');
    setPlatznummer('none');
    setPreisEuro('');
    setNotizen('');
    setBuchungErfolg(false);
    setBuchungError(null);
    setStep(1);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <IntentWizardShell
      title={tx('Neue Buchung')}
      subtitle={tx('Besitzer, Hund und Aufenthalt in drei Schritten anlegen')}
      steps={[{ label: tx('Besitzer') }, { label: tx('Hund') }, { label: tx('Zeitraum & Platz') }]}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* ── Schritt 1: Besitzer ─────────────────────────────────────────── */}
      {step === 1 && (
        <EntitySelectStep
          items={besitzer.map(b => ({
            id: b.record_id,
            title: [b.fields.vorname, b.fields.nachname].filter(Boolean).join(' ') || b.record_id,
            subtitle: [b.fields.telefon, b.fields.email].filter(Boolean).join(' · ') || undefined,
            icon: <IconUser size={20} className="text-primary" />,
          }))}
          onSelect={(id) => {
            setSelectedBesitzerId(id);
            setSelectedHundId(null);
            setStep(2);
          }}
          searchPlaceholder={tx('Besitzer suchen …')}
          createLabel={tx('Neuen Besitzer anlegen')}
          onCreateNew={() => setShowCreateBesitzer(true)}
          createDialog={showCreateBesitzer && (
            <div className="rounded-2xl border bg-card p-5 space-y-4">
              <p className="text-sm font-medium text-foreground">{tx('Neuen Besitzer anlegen')}</p>
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
                    placeholder={tx('z. B. 0171 12345678')}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="b-email">{tx('E-Mail')}</Label>
                  <Input
                    id="b-email"
                    type="email"
                    value={bEmail}
                    onChange={e => setBEmail(e.target.value)}
                    placeholder={tx('z. B. max@beispiel.de')}
                  />
                </div>
              </div>
              {bError && (
                <p className="flex items-center gap-2 text-sm text-destructive">
                  <IconAlertCircle size={16} className="shrink-0" />
                  {bError}
                </p>
              )}
              <div className="flex gap-2">
                <Button
                  disabled={!bVorname || !bNachname || bSaving}
                  onClick={handleCreateBesitzer}
                >
                  {bSaving ? tx('Wird gespeichert …') : tx('Anlegen & weiter')}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => { setShowCreateBesitzer(false); setBError(null); }}
                >
                  {tx('Abbrechen')}
                </Button>
              </div>
            </div>
          )}
          emptyText={tx('Kein Besitzer gefunden')}
          emptyIcon={<IconUser size={32} className="text-muted-foreground" />}
        />
      )}

      {/* ── Schritt 2: Hund ─────────────────────────────────────────────── */}
      {step === 2 && (
        selectedBesitzerId ? (
          <div className="space-y-4">
            {/* Kontext-Chip */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <IconUser size={15} className="shrink-0" />
              <span>
                {tx('Besitzer')}:{' '}
                <span className="font-medium text-foreground">
                  {[selectedBesitzer?.fields.vorname, selectedBesitzer?.fields.nachname]
                    .filter(Boolean)
                    .join(' ')}
                </span>
              </span>
              <button
                className="ml-auto text-xs underline text-muted-foreground"
                onClick={() => setStep(1)}
              >
                {tx('Ändern')}
              </button>
            </div>

            <EntitySelectStep
              items={hundeFuerBesitzer.map(h => ({
                id: h.record_id,
                title: h.fields.name ?? h.record_id,
                subtitle: [h.fields.rasse, h.fields.geschlecht?.label].filter(Boolean).join(' · ') || undefined,
                status: h.fields.impfstatus
                  ? { key: h.fields.impfstatus.key, label: h.fields.impfstatus.label }
                  : undefined,
                icon: <IconDog size={20} className="text-primary" />,
              }))}
              onSelect={(id) => {
                setSelectedHundId(id);
                setStep(3);
              }}
              searchPlaceholder={tx('Hund suchen …')}
              createLabel={tx('Neuen Hund anlegen')}
              onCreateNew={() => setShowCreateHund(true)}
              createDialog={showCreateHund && (
                <div className="rounded-2xl border bg-card p-5 space-y-4">
                  <p className="text-sm font-medium text-foreground">{tx('Neuen Hund anlegen')}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="h-name">{tx('Name')} *</Label>
                      <Input
                        id="h-name"
                        value={hName}
                        onChange={e => setHName(e.target.value)}
                        placeholder={tx('Hundename')}
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
                      <Label htmlFor="h-geschlecht">{tx('Geschlecht')}</Label>
                      <Select value={hGeschlecht} onValueChange={setHGeschlecht}>
                        <SelectTrigger id="h-geschlecht">
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
                      <Label htmlFor="h-geburtsdatum">{tx('Geburtsdatum')}</Label>
                      <Input
                        id="h-geburtsdatum"
                        type="date"
                        value={hGeburtsdatum}
                        onChange={e => setHGeburtsdatum(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label htmlFor="h-impfstatus">{tx('Impfstatus')}</Label>
                      <Select value={hImpfstatus} onValueChange={setHImpfstatus}>
                        <SelectTrigger id="h-impfstatus">
                          <SelectValue placeholder={tx('Impfstatus wählen')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{tx('Nicht angegeben')}</SelectItem>
                          {IMPFSTATUS_OPTIONS.map(o => (
                            <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {hError && (
                    <p className="flex items-center gap-2 text-sm text-destructive">
                      <IconAlertCircle size={16} className="shrink-0" />
                      {hError}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      disabled={!hName || hSaving}
                      onClick={handleCreateHund}
                    >
                      {hSaving ? tx('Wird gespeichert …') : tx('Anlegen & weiter')}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => { setShowCreateHund(false); setHError(null); }}
                    >
                      {tx('Abbrechen')}
                    </Button>
                  </div>
                </div>
              )}
              emptyText={
                hundeFuerBesitzer.length === 0
                  ? tx('Noch kein Hund für diesen Besitzer — bitte Hund anlegen')
                  : tx('Kein Hund gefunden')
              }
              emptyIcon={<IconDog size={32} className="text-muted-foreground" />}
            />
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

      {/* ── Schritt 3: Zeitraum & Platz ─────────────────────────────────── */}
      {step === 3 && (
        selectedBesitzerId && selectedHundId ? (
          buchungErfolg ? (
            /* Erfolgs-State */
            <div className="flex flex-col items-center py-16 space-y-6 text-center">
              <div className="rounded-full bg-emerald-100 p-4">
                <IconCheck size={40} className="text-emerald-600" stroke={1.5} />
              </div>
              <div className="space-y-1">
                <p className="text-lg font-semibold text-foreground">{tx('Buchung gespeichert!')}</p>
                <p className="text-sm text-muted-foreground">
                  {selectedHund?.fields.name ?? tx('Hund')}{' '}
                  {tx('wurde erfolgreich eingebucht.')}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button onClick={handleReset}>{tx('Neue Buchung anlegen')}</Button>
                <a href="#/">
                  <Button variant="outline">{tx('Zurück zum Dashboard')}</Button>
                </a>
              </div>
            </div>
          ) : (
            <div className="space-y-6 max-w-lg">
              {/* Kontext */}
              <div className="rounded-xl border bg-secondary/40 p-4 space-y-1 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <IconUser size={15} className="shrink-0" />
                  <span>
                    {[selectedBesitzer?.fields.vorname, selectedBesitzer?.fields.nachname]
                      .filter(Boolean)
                      .join(' ')}
                  </span>
                  <button className="ml-auto text-xs underline" onClick={() => setStep(1)}>
                    {tx('Ändern')}
                  </button>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <IconDog size={15} className="shrink-0" />
                  <span>{selectedHund?.fields.name}</span>
                  {selectedHund?.fields.rasse && (
                    <span className="text-xs">· {selectedHund.fields.rasse}</span>
                  )}
                  <button className="ml-auto text-xs underline" onClick={() => setStep(2)}>
                    {tx('Ändern')}
                  </button>
                </div>
              </div>

              {/* Zeitraum */}
              <div className="space-y-3">
                <p className="text-sm font-medium flex items-center gap-2">
                  <IconCalendar size={16} className="shrink-0 text-primary" />
                  {tx('Zeitraum')}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="anreise">{tx('Anreisedatum')} *</Label>
                    <Input
                      id="anreise"
                      type="date"
                      value={anreisedatum}
                      onChange={e => {
                        setAnreisedatum(e.target.value);
                        if (abreisedatum && e.target.value >= abreisedatum) setAbreisedatum('');
                      }}
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
                  <p className="text-xs text-muted-foreground">
                    {tx('Aufenthaltsdauer')}: <span className="font-medium">{naechte} {naechte === 1 ? tx('Nacht') : tx('Nächte')}</span>
                  </p>
                )}
              </div>

              {/* Platznummer */}
              <div className="space-y-2">
                <Label htmlFor="platznummer">{tx('Platznummer')} *</Label>
                <Select value={platznummer} onValueChange={setPlatznummer}>
                  <SelectTrigger id="platznummer" className="w-full">
                    <SelectValue placeholder={tx('Platz wählen')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{tx('Platz wählen')}</SelectItem>
                    {PLATZNUMMER_OPTIONS.map(o => (
                      <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Preis */}
              <div className="space-y-1">
                <Label htmlFor="preis">{tx('Preis (€)')}</Label>
                <Input
                  id="preis"
                  type="number"
                  min="0"
                  step="0.01"
                  value={preisEuro}
                  onChange={e => setPreisEuro(e.target.value)}
                  placeholder={tx('z. B. 25.00')}
                />
              </div>

              {/* Notizen */}
              <div className="space-y-1">
                <Label htmlFor="notizen">{tx('Notizen')}</Label>
                <Textarea
                  id="notizen"
                  value={notizen}
                  onChange={e => setNotizen(e.target.value)}
                  placeholder={tx('Besonderheiten, Hinweise …')}
                  rows={3}
                />
              </div>

              {buchungError && (
                <p className="flex items-center gap-2 text-sm text-destructive">
                  <IconAlertCircle size={16} className="shrink-0" />
                  {buchungError}
                </p>
              )}

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button
                  disabled={
                    !anreisedatum ||
                    !abreisedatum ||
                    platznummer === 'none' ||
                    naechte <= 0 ||
                    buchungSaving
                  }
                  onClick={handleCreateBuchung}
                  className="flex-1"
                >
                  {buchungSaving ? tx('Wird gespeichert …') : tx('Buchung anlegen')}
                </Button>
                <Button variant="outline" onClick={() => setStep(2)}>
                  {tx('Zurück')}
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
