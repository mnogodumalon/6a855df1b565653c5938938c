/**
 * Neue Buchung — 3-Schritt-Wizard zum Anlegen einer neuen Belegung/Buchung.
 * Steps: 1) Besitzer auswählen oder neu anlegen →
 *        2) Hund auswählen oder neu anlegen (gefiltert nach Besitzer) →
 *        3) Buchungsdetails erfassen & Belegung anlegen.
 * Reads: besitzer, hundekartei. Writes: belegung_buchungen (createBelegungBuchungenEntry),
 *        besitzer (createBesitzerEntry), hundekartei (createHundekarteiEntry).
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
import { IconCheck, IconDog, IconUser, IconCalendar } from '@tabler/icons-react';
import { format } from 'date-fns';

const PLATZ_OPTIONS = LOOKUP_OPTIONS['belegung_buchungen']?.['platznummer'] ?? [];
const GESCHLECHT_OPTIONS = LOOKUP_OPTIONS['hundekartei']?.['geschlecht'] ?? [];

export default function NeueBuchungPage() {
  const data = useDashboardData();
  const { besitzer, hundekartei, loading, error, fetchAll } = data;

  // Wizard step state
  const [step, setStep] = useState(1);

  // Step 1 — Besitzer
  const [selectedBesitzerId, setSelectedBesitzerId] = useState<string | null>(null);
  const [showCreateBesitzer, setShowCreateBesitzer] = useState(false);
  const [bVorname, setBVorname] = useState('');
  const [bNachname, setBNachname] = useState('');
  const [bTelefon, setBTelefon] = useState('');
  const [bEmail, setBEmail] = useState('');
  const [bCreating, setBCreating] = useState(false);

  // Step 2 — Hund
  const [selectedHundId, setSelectedHundId] = useState<string | null>(null);
  const [showCreateHund, setShowCreateHund] = useState(false);
  const [hName, setHName] = useState('');
  const [hRasse, setHRasse] = useState('');
  const [hGeburtsdatum, setHGeburtsdatum] = useState('');
  const [hGeschlechtKey, setHGeschlechtKey] = useState('none');
  const [hGewichtKg, setHGewichtKg] = useState('');
  const [hCreating, setHCreating] = useState(false);

  // Step 3 — Buchungsdetails
  const [anreisedatum, setAnreisedatum] = useState('');
  const [abreisedatum, setAbreisedatum] = useState('');
  const [platznummerKey, setPlatznummerKey] = useState('none');
  const [preisEuro, setPreisEuro] = useState('');
  const [notizen, setNotizen] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // --- Step 1: Besitzer auswählen ---
  const selectedBesitzer = besitzer.find(b => b.record_id === selectedBesitzerId);

  const handleSelectBesitzer = (id: string) => {
    setSelectedBesitzerId(id);
    setSelectedHundId(null);
    setStep(2);
  };

  const handleCreateBesitzer = async () => {
    if (!bVorname.trim() || !bNachname.trim()) return;
    setBCreating(true);
    try {
      const created = await LivingAppsService.createBesitzerEntry({
        vorname: bVorname.trim(),
        nachname: bNachname.trim(),
        telefon: bTelefon.trim() || undefined,
        email: bEmail.trim() || undefined,
      });
      await fetchAll();
      setShowCreateBesitzer(false);
      setBVorname('');
      setBNachname('');
      setBTelefon('');
      setBEmail('');
      setSelectedBesitzerId(created.record_id);
      setSelectedHundId(null);
      setStep(2);
    } finally {
      setBCreating(false);
    }
  };

  // --- Step 2: Hund auswählen (gefiltert nach Besitzer) ---
  const besitzerUrl = selectedBesitzerId
    ? createRecordUrl(APP_IDS.BESITZER, selectedBesitzerId)
    : null;

  const hundeForBesitzer = hundekartei.filter(h => {
    if (!besitzerUrl) return false;
    return h.fields.besitzer === besitzerUrl;
  });

  const handleSelectHund = (id: string) => {
    setSelectedHundId(id);
    setStep(3);
  };

  const handleCreateHund = async () => {
    if (!hName.trim() || !selectedBesitzerId) return;
    setHCreating(true);
    try {
      const fields: Record<string, unknown> = {
        name: hName.trim(),
        besitzer: createRecordUrl(APP_IDS.BESITZER, selectedBesitzerId),
      };
      if (hRasse.trim()) fields.rasse = hRasse.trim();
      if (hGeburtsdatum) fields.geburtsdatum = hGeburtsdatum;
      if (hGeschlechtKey !== 'none') fields.geschlecht = hGeschlechtKey;
      if (hGewichtKg) fields.gewicht_kg = parseFloat(hGewichtKg);

      const created = await LivingAppsService.createHundekarteiEntry(fields as Parameters<typeof LivingAppsService.createHundekarteiEntry>[0]);
      await fetchAll();
      setShowCreateHund(false);
      setHName('');
      setHRasse('');
      setHGeburtsdatum('');
      setHGeschlechtKey('none');
      setHGewichtKg('');
      setSelectedHundId(created.record_id);
      setStep(3);
    } finally {
      setHCreating(false);
    }
  };

  // --- Step 3: Buchung anlegen ---
  const handleSubmit = async () => {
    if (!selectedBesitzerId || !selectedHundId || !anreisedatum || !abreisedatum || platznummerKey === 'none') return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const fields: Record<string, unknown> = {
        hund: createRecordUrl(APP_IDS.HUNDEKARTEI, selectedHundId),
        besitzer: createRecordUrl(APP_IDS.BESITZER, selectedBesitzerId),
        anreisedatum,
        abreisedatum,
        platznummer: platznummerKey,
        status: 'aktiv',
      };
      if (preisEuro) fields.preis_euro = parseFloat(preisEuro);
      if (notizen.trim()) fields.notizen = notizen.trim();

      await LivingAppsService.createBelegungBuchungenEntry(fields as Parameters<typeof LivingAppsService.createBelegungBuchungenEntry>[0]);
      await fetchAll();
      setSuccess(true);
    } catch {
      setSubmitError(tx('Fehler beim Anlegen der Buchung. Bitte erneut versuchen.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setSelectedBesitzerId(null);
    setSelectedHundId(null);
    setShowCreateBesitzer(false);
    setShowCreateHund(false);
    setAnreisedatum('');
    setAbreisedatum('');
    setPlatznummerKey('none');
    setPreisEuro('');
    setNotizen('');
    setSuccess(false);
    setSubmitError(null);
  };

  return (
    <IntentWizardShell
      title={tx('Neue Buchung')}
      subtitle={tx('Schritt für Schritt eine neue Belegung anlegen')}
      steps={[
        { label: tx('Besitzer') },
        { label: tx('Hund') },
        { label: tx('Buchungsdetails') },
      ]}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* ─── Schritt 1: Besitzer ─── */}
      {step === 1 && (
        <EntitySelectStep
          items={besitzer.map(b => ({
            id: b.record_id,
            title: [b.fields.vorname, b.fields.nachname].filter(Boolean).join(' ') || b.record_id,
            subtitle: [b.fields.telefon, b.fields.email].filter(Boolean).join(' · ') || undefined,
            icon: <IconUser size={20} className="text-primary" />,
          }))}
          onSelect={handleSelectBesitzer}
          searchPlaceholder={tx('Besitzer suchen …')}
          createLabel={tx('Neuen Besitzer anlegen')}
          onCreateNew={() => setShowCreateBesitzer(true)}
          createDialog={showCreateBesitzer && (
            <div className="rounded-2xl border bg-card p-4 space-y-3">
              <p className="text-sm font-medium text-foreground">{tx('Neuen Besitzer anlegen')}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{tx('Vorname')} *</Label>
                  <Input
                    value={bVorname}
                    onChange={e => setBVorname(e.target.value)}
                    placeholder={tx('Vorname')}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{tx('Nachname')} *</Label>
                  <Input
                    value={bNachname}
                    onChange={e => setBNachname(e.target.value)}
                    placeholder={tx('Nachname')}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{tx('Telefon')}</Label>
                  <Input
                    type="tel"
                    value={bTelefon}
                    onChange={e => setBTelefon(e.target.value)}
                    placeholder={tx('Telefonnummer')}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{tx('E-Mail')}</Label>
                  <Input
                    type="email"
                    value={bEmail}
                    onChange={e => setBEmail(e.target.value)}
                    placeholder={tx('E-Mail-Adresse')}
                  />
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button
                  disabled={!bVorname.trim() || !bNachname.trim() || bCreating}
                  onClick={handleCreateBesitzer}
                >
                  {bCreating ? tx('Wird angelegt …') : tx('Anlegen & auswählen')}
                </Button>
                <Button variant="outline" onClick={() => setShowCreateBesitzer(false)}>
                  {tx('Abbrechen')}
                </Button>
              </div>
            </div>
          )}
          emptyText={tx('Kein Besitzer gefunden')}
          emptyIcon={<IconUser size={32} className="text-muted-foreground" />}
        />
      )}

      {/* ─── Schritt 2: Hund ─── */}
      {step === 2 && (
        selectedBesitzerId ? (
          <div className="space-y-4">
            {selectedBesitzer && (
              <div className="flex items-center gap-2 px-1">
                <IconUser size={16} className="shrink-0 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {tx('Besitzer')}: <span className="font-medium text-foreground">
                    {[selectedBesitzer.fields.vorname, selectedBesitzer.fields.nachname].filter(Boolean).join(' ')}
                  </span>
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto text-xs"
                  onClick={() => { setStep(1); setSelectedHundId(null); }}
                >
                  {tx('Ändern')}
                </Button>
              </div>
            )}
            <EntitySelectStep
              items={hundeForBesitzer.map(h => ({
                id: h.record_id,
                title: h.fields.name ?? h.record_id,
                subtitle: [h.fields.rasse, h.fields.geschlecht?.label].filter(Boolean).join(' · ') || undefined,
                icon: <IconDog size={20} className="text-primary" />,
              }))}
              onSelect={handleSelectHund}
              searchPlaceholder={tx('Hund suchen …')}
              createLabel={tx('Neuen Hund anlegen')}
              onCreateNew={() => setShowCreateHund(true)}
              createDialog={showCreateHund && (
                <div className="rounded-2xl border bg-card p-4 space-y-3">
                  <p className="text-sm font-medium text-foreground">{tx('Neuen Hund anlegen')}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{tx('Name')} *</Label>
                      <Input
                        value={hName}
                        onChange={e => setHName(e.target.value)}
                        placeholder={tx('Hundename')}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{tx('Rasse')}</Label>
                      <Input
                        value={hRasse}
                        onChange={e => setHRasse(e.target.value)}
                        placeholder={tx('Rasse')}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{tx('Geburtsdatum')}</Label>
                      <Input
                        type="date"
                        value={hGeburtsdatum}
                        onChange={e => setHGeburtsdatum(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{tx('Geschlecht')}</Label>
                      <Select value={hGeschlechtKey} onValueChange={setHGeschlechtKey}>
                        <SelectTrigger>
                          <SelectValue placeholder={tx('Geschlecht wählen')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{tx('Nicht angegeben')}</SelectItem>
                          {GESCHLECHT_OPTIONS.map(opt => (
                            <SelectItem key={opt.key} value={opt.key}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{tx('Gewicht (kg)')}</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.1"
                        value={hGewichtKg}
                        onChange={e => setHGewichtKg(e.target.value)}
                        placeholder={tx('z. B. 12.5')}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      disabled={!hName.trim() || hCreating}
                      onClick={handleCreateHund}
                    >
                      {hCreating ? tx('Wird angelegt …') : tx('Anlegen & auswählen')}
                    </Button>
                    <Button variant="outline" onClick={() => setShowCreateHund(false)}>
                      {tx('Abbrechen')}
                    </Button>
                  </div>
                </div>
              )}
              emptyText={hundeForBesitzer.length === 0
                ? tx('Noch kein Hund für diesen Besitzer angelegt')
                : tx('Kein Hund gefunden')}
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

      {/* ─── Schritt 3: Buchungsdetails ─── */}
      {step === 3 && (
        selectedBesitzerId && selectedHundId ? (
          success ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-6 text-center">
              <div className="rounded-full bg-emerald-500/10 p-5">
                <IconCheck size={48} className="text-emerald-600" stroke={1.5} />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-foreground">{tx('Buchung erfolgreich angelegt!')}</h2>
                <p className="text-sm text-muted-foreground">
                  {tx('Die Belegung wurde gespeichert.')}
                </p>
              </div>
              <div className="flex gap-3 flex-wrap justify-center">
                <Button onClick={handleReset}>{tx('Neue Buchung anlegen')}</Button>
                <Button variant="outline" asChild>
                  <a href="#/">{tx('Zurück zum Dashboard')}</a>
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-5 max-w-lg">
              {/* Kontext-Zeile */}
              <div className="flex flex-col gap-1 px-1">
                {selectedBesitzer && (
                  <div className="flex items-center gap-2">
                    <IconUser size={14} className="shrink-0 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {[selectedBesitzer.fields.vorname, selectedBesitzer.fields.nachname].filter(Boolean).join(' ')}
                    </span>
                  </div>
                )}
                {(() => {
                  const hund = hundekartei.find(h => h.record_id === selectedHundId);
                  return hund ? (
                    <div className="flex items-center gap-2">
                      <IconDog size={14} className="shrink-0 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{hund.fields.name}</span>
                    </div>
                  ) : null;
                })()}
              </div>

              {/* Datum */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-sm font-medium">{tx('Anreisedatum')} *</Label>
                  <div className="relative">
                    <IconCalendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground shrink-0" />
                    <Input
                      type="date"
                      className="pl-9"
                      value={anreisedatum}
                      onChange={e => setAnreisedatum(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm font-medium">{tx('Abreisedatum')} *</Label>
                  <div className="relative">
                    <IconCalendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground shrink-0" />
                    <Input
                      type="date"
                      className="pl-9"
                      value={abreisedatum}
                      onChange={e => setAbreisedatum(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Platznummer */}
              <div className="space-y-1">
                <Label className="text-sm font-medium">{tx('Platznummer')} *</Label>
                <Select value={platznummerKey} onValueChange={setPlatznummerKey}>
                  <SelectTrigger>
                    <SelectValue placeholder={tx('Platz wählen')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{tx('Bitte wählen')}</SelectItem>
                    {PLATZ_OPTIONS.map(opt => (
                      <SelectItem key={opt.key} value={opt.key}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Preis */}
              <div className="space-y-1">
                <Label className="text-sm font-medium">{tx('Preis (€)')}</Label>
                <Input
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
                <Label className="text-sm font-medium">{tx('Notizen')}</Label>
                <Textarea
                  value={notizen}
                  onChange={e => setNotizen(e.target.value)}
                  placeholder={tx('Besondere Hinweise, Wünsche …')}
                  rows={3}
                />
              </div>

              {submitError && (
                <p className="text-sm text-destructive">{submitError}</p>
              )}

              <div className="flex gap-3 flex-wrap pt-2">
                <Button
                  disabled={!anreisedatum || !abreisedatum || platznummerKey === 'none' || submitting}
                  onClick={handleSubmit}
                >
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
