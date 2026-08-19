import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { PublicShell } from '@/components/PublicShell';
import {
  loadPublicPagesConfig,
  createPublicRecord,
  prepareChallenge,
  PageUnavailableError,
  type PublicPagesConfig,
  type PublicPageConfig,
} from '@/lib/publicClient';
import { tx } from '@/i18n';
import { IconPaw, IconUser, IconCalendar, IconCheck, IconChevronRight, IconChevronLeft } from '@tabler/icons-react';

const SLUG = 'buchungsanfrage';

type Step = 1 | 2 | 3;

interface FormData {
  interessent_vorname: string;
  interessent_nachname: string;
  interessent_email: string;
  interessent_telefon: string;
  hund_name: string;
  hund_rasse: string;
  hund_groesse: '' | 'klein' | 'mittel' | 'gross';
  wunsch_anreise: string;
  wunsch_abreise: string;
  nachricht: string;
}

const EMPTY: FormData = {
  interessent_vorname: '',
  interessent_nachname: '',
  interessent_email: '',
  interessent_telefon: '',
  hund_name: '',
  hund_rasse: '',
  hund_groesse: '',
  wunsch_anreise: '',
  wunsch_abreise: '',
  nachricht: '',
};

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-medium text-foreground mb-1">
      {children}
      {required && <span className="text-destructive ml-0.5">*</span>}
    </label>
  );
}

function TextInput({
  id,
  value,
  onChange,
  placeholder,
  type = 'text',
  required,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
    />
  );
}

function StepIndicator({ current }: { current: Step }) {
  const steps: { label: string; icon: React.ReactNode }[] = [
    { label: tx('Kontakt'), icon: <IconUser size={16} /> },
    { label: tx('Hund'), icon: <IconPaw size={16} /> },
    { label: tx('Zeitraum'), icon: <IconCalendar size={16} /> },
  ];
  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map((s, i) => {
        const n = (i + 1) as Step;
        const done = current > n;
        const active = current === n;
        return (
          <div key={n} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 transition-colors ${
                  done
                    ? 'bg-primary text-primary-foreground'
                    : active
                    ? 'bg-primary text-primary-foreground ring-4 ring-primary/20'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {done ? <IconCheck size={14} /> : s.icon}
              </div>
              <span
                className={`mt-1 text-xs font-medium ${
                  active ? 'text-primary' : done ? 'text-foreground' : 'text-muted-foreground'
                }`}
              >
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`h-0.5 flex-1 mx-1 mb-5 transition-colors ${
                  current > n ? 'bg-primary' : 'bg-muted'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function Buchungsanfrage() {
  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<FormData>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    loadPublicPagesConfig(SLUG)
      .then(c => {
        setCfg(c);
        setPage(c?.pages[SLUG] ?? null);
        setLoading(false);
      })
      .catch(err => {
        if (err instanceof PageUnavailableError) {
          setLoading(false);
        }
      });
  }, []);

  const set = (key: keyof FormData) => (v: string) =>
    setForm(f => ({ ...f, [key]: v }));

  const clearError = (key: keyof FormData) =>
    setErrors(e => { const n = { ...e }; delete n[key]; return n; });

  const validateStep1 = (): boolean => {
    const e: Partial<Record<keyof FormData, string>> = {};
    if (!form.interessent_vorname.trim()) e.interessent_vorname = tx('Bitte Vornamen angeben');
    if (!form.interessent_nachname.trim()) e.interessent_nachname = tx('Bitte Nachnamen angeben');
    if (!form.interessent_email.trim()) {
      e.interessent_email = tx('Bitte E-Mail angeben');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.interessent_email)) {
      e.interessent_email = tx('Ungültige E-Mail-Adresse');
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep2 = (): boolean => {
    const e: Partial<Record<keyof FormData, string>> = {};
    if (!form.hund_name.trim()) e.hund_name = tx('Bitte Namen des Hundes angeben');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep3 = (): boolean => {
    const e: Partial<Record<keyof FormData, string>> = {};
    if (!form.wunsch_anreise) e.wunsch_anreise = tx('Bitte Anreisedatum wählen');
    if (!form.wunsch_abreise) e.wunsch_abreise = tx('Bitte Abreisedatum wählen');
    if (form.wunsch_anreise && form.wunsch_abreise && form.wunsch_abreise <= form.wunsch_anreise) {
      e.wunsch_abreise = tx('Abreise muss nach Anreise liegen');
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const goNext = () => {
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    setStep(s => (s < 3 ? ((s + 1) as Step) : s));
  };

  const goBack = () => setStep(s => (s > 1 ? ((s - 1) as Step) : s));

  const onFirstInteraction = () => {
    if (!cfg || !page) return;
    const ep = page.endpoints?.find(e => e.op === 'create');
    if (!ep) return;
    prepareChallenge(cfg, page, 'POST', `/apps/${ep.app_id}/records`);
  };

  const handleSubmit = async () => {
    if (!validateStep3()) return;
    if (!cfg || !page) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const payload: Record<string, unknown> = {
        interessent_vorname: form.interessent_vorname.trim(),
        interessent_nachname: form.interessent_nachname.trim(),
        interessent_email: form.interessent_email.trim(),
        wunsch_anreise: form.wunsch_anreise,
        wunsch_abreise: form.wunsch_abreise,
      };
      if (form.interessent_telefon.trim()) payload.interessent_telefon = form.interessent_telefon.trim();
      if (form.hund_name.trim()) payload.hund_name = form.hund_name.trim();
      if (form.hund_rasse.trim()) payload.hund_rasse = form.hund_rasse.trim();
      if (form.hund_groesse) payload.hund_groesse = form.hund_groesse;
      if (form.nachricht.trim()) payload.nachricht = form.nachricht.trim();
      await createPublicRecord(cfg, page, payload);
      setSubmitted(true);
    } catch {
      setSubmitError(tx('Ein Fehler ist aufgetreten. Bitte versuche es erneut.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <PublicShell loading />;
  if (!cfg || !page) return <PublicShell unavailable />;

  if (submitted) {
    return (
      <PublicShell title={tx('Buchungsanfrage')} description={tx('Unverbindliche Anfrage für einen Aufenthalt in der Hundepension')}>
        <div className="flex flex-col items-center text-center gap-6 py-8">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
            <IconCheck size={32} className="text-emerald-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground mb-2">{tx('Anfrage gesendet!')}</h2>
            <p className="text-muted-foreground max-w-sm">
              {tx('Vielen Dank, ')}{form.interessent_vorname}! {tx('Wir haben deine Buchungsanfrage erhalten und melden uns in Kürze bei dir.')}
            </p>
          </div>
          <div className="w-full max-w-sm rounded-lg border border-border bg-muted/40 p-4 text-left text-sm space-y-1">
            <div className="font-medium text-foreground mb-2">{tx('Deine Angaben')}</div>
            <div className="text-muted-foreground">
              <span className="font-medium text-foreground">{tx('Hund:')}</span> {form.hund_name}
            </div>
            <div className="text-muted-foreground">
              <span className="font-medium text-foreground">{tx('Zeitraum:')}</span>{' '}
              {form.wunsch_anreise && format(new Date(form.wunsch_anreise), 'dd.MM.yyyy')} –{' '}
              {form.wunsch_abreise && format(new Date(form.wunsch_abreise), 'dd.MM.yyyy')}
            </div>
            <div className="text-muted-foreground">
              <span className="font-medium text-foreground">{tx('Kontakt:')}</span> {form.interessent_email}
            </div>
          </div>
        </div>
      </PublicShell>
    );
  }

  return (
    <PublicShell
      title={tx('Buchungsanfrage')}
      description={tx('Unverbindliche Anfrage für einen Aufenthalt in der Hundepension')}
    >
      <StepIndicator current={step} />

      {/* Schritt 1: Kontaktdaten */}
      {step === 1 && (
        <div className="space-y-4" onFocus={onFirstInteraction}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel required>{tx('Vorname')}</FieldLabel>
              <TextInput
                id="interessent_vorname"
                value={form.interessent_vorname}
                onChange={v => { set('interessent_vorname')(v); clearError('interessent_vorname'); }}
                placeholder={tx('z. B. Maria')}
                required
              />
              {errors.interessent_vorname && (
                <p className="mt-1 text-xs text-destructive">{errors.interessent_vorname}</p>
              )}
            </div>
            <div>
              <FieldLabel required>{tx('Nachname')}</FieldLabel>
              <TextInput
                id="interessent_nachname"
                value={form.interessent_nachname}
                onChange={v => { set('interessent_nachname')(v); clearError('interessent_nachname'); }}
                placeholder={tx('z. B. Müller')}
                required
              />
              {errors.interessent_nachname && (
                <p className="mt-1 text-xs text-destructive">{errors.interessent_nachname}</p>
              )}
            </div>
          </div>
          <div>
            <FieldLabel required>{tx('E-Mail-Adresse')}</FieldLabel>
            <TextInput
              id="interessent_email"
              type="email"
              value={form.interessent_email}
              onChange={v => { set('interessent_email')(v); clearError('interessent_email'); }}
              placeholder={tx('z. B. maria@beispiel.de')}
              required
            />
            {errors.interessent_email && (
              <p className="mt-1 text-xs text-destructive">{errors.interessent_email}</p>
            )}
          </div>
          <div>
            <FieldLabel>{tx('Telefonnummer')}</FieldLabel>
            <TextInput
              id="interessent_telefon"
              type="tel"
              value={form.interessent_telefon}
              onChange={set('interessent_telefon')}
              placeholder={tx('z. B. +49 170 1234567')}
            />
          </div>
        </div>
      )}

      {/* Schritt 2: Angaben zum Hund */}
      {step === 2 && (
        <div className="space-y-4">
          <div>
            <FieldLabel required>{tx('Name des Hundes')}</FieldLabel>
            <TextInput
              id="hund_name"
              value={form.hund_name}
              onChange={v => { set('hund_name')(v); clearError('hund_name'); }}
              placeholder={tx('z. B. Bello')}
              required
            />
            {errors.hund_name && (
              <p className="mt-1 text-xs text-destructive">{errors.hund_name}</p>
            )}
          </div>
          <div>
            <FieldLabel>{tx('Rasse')}</FieldLabel>
            <TextInput
              id="hund_rasse"
              value={form.hund_rasse}
              onChange={set('hund_rasse')}
              placeholder={tx('z. B. Labrador')}
            />
          </div>
          <div>
            <FieldLabel>{tx('Größe des Hundes')}</FieldLabel>
            <div className="grid grid-cols-3 gap-3 mt-1">
              {([
                { key: 'klein', label: tx('Klein'), sub: tx('bis 10 kg') },
                { key: 'mittel', label: tx('Mittel'), sub: tx('10–25 kg') },
                { key: 'gross', label: tx('Groß'), sub: tx('über 25 kg') },
              ] as const).map(opt => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => set('hund_groesse')(opt.key)}
                  className={`rounded-lg border-2 p-3 text-center transition-colors ${
                    form.hund_groesse === opt.key
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border bg-background text-foreground hover:border-muted-foreground'
                  }`}
                >
                  <div className="font-semibold text-sm">{opt.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{opt.sub}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Schritt 3: Wunschzeitraum */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel required>{tx('Gewünschtes Anreisedatum')}</FieldLabel>
              <input
                id="wunsch_anreise"
                type="date"
                value={form.wunsch_anreise}
                onChange={e => { set('wunsch_anreise')(e.target.value); clearError('wunsch_anreise'); }}
                min={format(new Date(), 'yyyy-MM-dd')}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {errors.wunsch_anreise && (
                <p className="mt-1 text-xs text-destructive">{errors.wunsch_anreise}</p>
              )}
            </div>
            <div>
              <FieldLabel required>{tx('Gewünschtes Abreisedatum')}</FieldLabel>
              <input
                id="wunsch_abreise"
                type="date"
                value={form.wunsch_abreise}
                onChange={e => { set('wunsch_abreise')(e.target.value); clearError('wunsch_abreise'); }}
                min={form.wunsch_anreise || format(new Date(), 'yyyy-MM-dd')}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {errors.wunsch_abreise && (
                <p className="mt-1 text-xs text-destructive">{errors.wunsch_abreise}</p>
              )}
            </div>
          </div>
          <div>
            <FieldLabel>{tx('Nachricht / Besondere Hinweise')}</FieldLabel>
            <textarea
              id="nachricht"
              value={form.nachricht}
              onChange={e => set('nachricht')(e.target.value)}
              placeholder={tx('z. B. Besonderheiten beim Futter, Medikamente, Verhalten mit anderen Hunden …')}
              rows={4}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>
          {submitError && (
            <p className="text-sm text-destructive">{submitError}</p>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3 mt-8">
        {step > 1 && (
          <button
            type="button"
            onClick={goBack}
            className="flex items-center gap-1.5 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            <IconChevronLeft size={16} className="shrink-0" />
            {tx('Zurück')}
          </button>
        )}
        <div className="flex-1" />
        {step < 3 ? (
          <button
            type="button"
            onClick={goNext}
            className="flex items-center gap-1.5 rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {tx('Weiter')}
            <IconChevronRight size={16} className="shrink-0" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-1.5 rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            <IconCheck size={16} className="shrink-0" />
            {submitting ? tx('Wird gesendet …') : tx('Anfrage absenden')}
          </button>
        )}
      </div>
    </PublicShell>
  );
}
