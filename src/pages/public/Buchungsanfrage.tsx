import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { IconPaw, IconUser, IconDog, IconCalendar, IconCheck } from '@tabler/icons-react';
import { format } from 'date-fns';

const SLUG = 'buchungsanfrage';

type Step = 1 | 2 | 3 | 4;

interface FormState {
  interessent_vorname: string;
  interessent_nachname: string;
  interessent_email: string;
  interessent_telefon: string;
  hund_name: string;
  hund_rasse: string;
  hund_groesse: string;
  wunsch_anreise: string;
  wunsch_abreise: string;
  nachricht: string;
}

const INITIAL: FormState = {
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

function StepIndicator({ step }: { step: Step }) {
  const steps = [
    { num: 1, icon: <IconUser size={16} />, label: tx('Kontakt') },
    { num: 2, icon: <IconDog size={16} />, label: tx('Hund') },
    { num: 3, icon: <IconCalendar size={16} />, label: tx('Zeitraum') },
  ];
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {steps.map((s, i) => (
        <div key={s.num} className="flex items-center">
          <div className="flex flex-col items-center gap-1">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                step > s.num
                  ? 'bg-emerald-500 text-white'
                  : step === s.num
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {step > s.num ? <IconCheck size={16} /> : s.icon}
            </div>
            <span className={`text-xs ${step === s.num ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={`w-12 h-0.5 mb-4 mx-1 transition-colors ${
                step > s.num + 1 ? 'bg-emerald-500' : step > s.num ? 'bg-primary' : 'bg-muted'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-medium text-foreground mb-1.5">
      {children}
      {required && <span className="text-destructive ml-1">*</span>}
    </label>
  );
}

function Input({
  type = 'text',
  value,
  onChange,
  placeholder,
  required,
  autoComplete,
}: {
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      autoComplete={autoComplete}
      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0 transition"
    />
  );
}

export default function Buchungsanfrage() {
  const GROESSE_OPTIONS = [
  { key: 'klein', label: tx('Klein (bis 10 kg)') },
  { key: 'mittel', label: tx('Mittel (10–25 kg)') },
  { key: 'gross', label: tx('Groß (über 25 kg)') },
];

  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<FormState>(INITIAL);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const challengePrepped = useRef(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadPublicPagesConfig(SLUG).then(c => {
      if (!c) { setLoading(false); return; }
      setCfg(c);
      setPage(c.pages[SLUG] ?? null);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const set = (key: keyof FormState) => (val: string) => {
    setForm(f => ({ ...f, [key]: val }));
    setErrors(e => ({ ...e, [key]: undefined }));
  };

  const prepChallenge = () => {
    if (!cfg || !page || challengePrepped.current) return;
    challengePrepped.current = true;
    const ep = page.endpoints?.find(e => e.op === 'create');
    if (ep?.app_id) {
      void prepareChallenge(cfg, page, 'POST', `/apps/${ep.app_id}/records`);
    }
  };

  const validateStep1 = () => {
    const e: typeof errors = {};
    if (!form.interessent_vorname.trim()) e.interessent_vorname = tx('Pflichtfeld');
    if (!form.interessent_nachname.trim()) e.interessent_nachname = tx('Pflichtfeld');
    if (!form.interessent_email.trim()) e.interessent_email = tx('Pflichtfeld');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.interessent_email)) e.interessent_email = tx('Ungültige E-Mail-Adresse');
    return e;
  };

  const validateStep2 = () => {
    const e: typeof errors = {};
    if (!form.hund_name.trim()) e.hund_name = tx('Pflichtfeld');
    return e;
  };

  const validateStep3 = () => {
    const e: typeof errors = {};
    if (!form.wunsch_anreise) e.wunsch_anreise = tx('Pflichtfeld');
    if (!form.wunsch_abreise) e.wunsch_abreise = tx('Pflichtfeld');
    if (form.wunsch_anreise && form.wunsch_abreise && form.wunsch_abreise <= form.wunsch_anreise) {
      e.wunsch_abreise = tx('Abreise muss nach Anreise liegen');
    }
    return e;
  };

  const nextStep = () => {
    if (step === 1) {
      const e = validateStep1();
      if (Object.keys(e).length) { setErrors(e); return; }
    }
    if (step === 2) {
      const e = validateStep2();
      if (Object.keys(e).length) { setErrors(e); return; }
    }
    setStep(s => (s < 4 ? ((s + 1) as Step) : s));
  };

  const prevStep = () => setStep(s => (s > 1 ? ((s - 1) as Step) : s));

  const handleSubmit = async () => {
    const e = validateStep3();
    if (Object.keys(e).length) { setErrors(e); return; }
    if (!cfg || !page) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const payload: Record<string, string> = {
        interessent_vorname: form.interessent_vorname.trim(),
        interessent_nachname: form.interessent_nachname.trim(),
        interessent_email: form.interessent_email.trim(),
        hund_name: form.hund_name.trim(),
        wunsch_anreise: form.wunsch_anreise,
        wunsch_abreise: form.wunsch_abreise,
      };
      if (form.interessent_telefon.trim()) payload.interessent_telefon = form.interessent_telefon.trim();
      if (form.hund_rasse.trim()) payload.hund_rasse = form.hund_rasse.trim();
      if (form.hund_groesse) payload.hund_groesse = form.hund_groesse;
      if (form.nachricht.trim()) payload.nachricht = form.nachricht.trim();

      await createPublicRecord(cfg, page, payload);
      setSubmitted(true);
    } catch (_err) {
      setSubmitError(tx('Es ist ein Fehler aufgetreten. Bitte versuche es erneut.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || (!cfg && !loading)) {
    return <PublicShell loading={loading} unavailable={!loading && !cfg} />;
  }
  if (!page) {
    return <PublicShell unavailable />;
  }

  if (submitted) {
    return (
      <PublicShell title={tx('Buchungsanfrage')} description={tx('Unverbindliche Anfrage an die Hundepension')}>
        <div className="flex flex-col items-center gap-6 py-8 text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center">
            <IconCheck size={40} className="text-emerald-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground mb-2">{tx('Anfrage gesendet!')}</h2>
            <p className="text-muted-foreground text-base">{tx('Wir melden uns bald bei dir!')}</p>
          </div>
          <button
            onClick={() => navigate('/public/hundepension')}
            className="mt-2 inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition"
          >
            <IconPaw size={16} />
            {tx('Zurück zur Startseite')}
          </button>
        </div>
      </PublicShell>
    );
  }

  return (
    <PublicShell title={tx('Buchungsanfrage')} description={tx('Unverbindliche Anfrage an die Hundepension')}>
      <div onFocus={prepChallenge} onTouchStart={prepChallenge}>
        <StepIndicator step={step < 4 ? step : 3} />

        {step === 1 && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 mb-1 text-primary">
              <IconUser size={18} className="shrink-0" />
              <span className="font-semibold">{tx('Deine Kontaktdaten')}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FieldLabel required>{tx('Vorname')}</FieldLabel>
                <Input
                  value={form.interessent_vorname}
                  onChange={set('interessent_vorname')}
                  placeholder={tx('z. B. Maria')}
                  required
                  autoComplete="given-name"
                />
                {errors.interessent_vorname && (
                  <p className="text-destructive text-xs mt-1">{errors.interessent_vorname}</p>
                )}
              </div>
              <div>
                <FieldLabel required>{tx('Nachname')}</FieldLabel>
                <Input
                  value={form.interessent_nachname}
                  onChange={set('interessent_nachname')}
                  placeholder={tx('z. B. Müller')}
                  required
                  autoComplete="family-name"
                />
                {errors.interessent_nachname && (
                  <p className="text-destructive text-xs mt-1">{errors.interessent_nachname}</p>
                )}
              </div>
            </div>

            <div>
              <FieldLabel required>{tx('E-Mail-Adresse')}</FieldLabel>
              <Input
                type="email"
                value={form.interessent_email}
                onChange={set('interessent_email')}
                placeholder={tx('z. B. maria@beispiel.de')}
                required
                autoComplete="email"
              />
              {errors.interessent_email && (
                <p className="text-destructive text-xs mt-1">{errors.interessent_email}</p>
              )}
            </div>

            <div>
              <FieldLabel>{tx('Telefonnummer')}</FieldLabel>
              <Input
                type="tel"
                value={form.interessent_telefon}
                onChange={set('interessent_telefon')}
                placeholder={tx('z. B. +49 151 12345678')}
                autoComplete="tel"
              />
            </div>

            <div className="flex justify-end mt-2">
              <button
                onClick={nextStep}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition"
              >
                {tx('Weiter')} →
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 mb-1 text-primary">
              <IconDog size={18} className="shrink-0" />
              <span className="font-semibold">{tx('Angaben zu deinem Hund')}</span>
            </div>

            <div>
              <FieldLabel required>{tx('Name des Hundes')}</FieldLabel>
              <Input
                value={form.hund_name}
                onChange={set('hund_name')}
                placeholder={tx('z. B. Bello')}
                required
              />
              {errors.hund_name && (
                <p className="text-destructive text-xs mt-1">{errors.hund_name}</p>
              )}
            </div>

            <div>
              <FieldLabel>{tx('Rasse')}</FieldLabel>
              <Input
                value={form.hund_rasse}
                onChange={set('hund_rasse')}
                placeholder={tx('z. B. Labrador')}
              />
            </div>

            <div>
              <FieldLabel>{tx('Größe')}</FieldLabel>
              <div className="flex flex-col sm:flex-row gap-2 mt-1">
                {GROESSE_OPTIONS.map(opt => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => set('hund_groesse')(form.hund_groesse === opt.key ? '' : opt.key)}
                    className={`flex-1 rounded-md border px-4 py-2.5 text-sm font-medium transition ${
                      form.hund_groesse === opt.key
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-input bg-background text-foreground hover:bg-muted'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-between mt-2">
              <button
                onClick={prevStep}
                className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-5 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition"
              >
                ← {tx('Zurück')}
              </button>
              <button
                onClick={nextStep}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition"
              >
                {tx('Weiter')} →
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 mb-1 text-primary">
              <IconCalendar size={18} className="shrink-0" />
              <span className="font-semibold">{tx('Wunschzeitraum')}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FieldLabel required>{tx('Anreise')}</FieldLabel>
                <input
                  type="date"
                  value={form.wunsch_anreise}
                  min={format(new Date(), 'yyyy-MM-dd')}
                  onChange={e => set('wunsch_anreise')(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition"
                />
                {errors.wunsch_anreise && (
                  <p className="text-destructive text-xs mt-1">{errors.wunsch_anreise}</p>
                )}
              </div>
              <div>
                <FieldLabel required>{tx('Abreise')}</FieldLabel>
                <input
                  type="date"
                  value={form.wunsch_abreise}
                  min={form.wunsch_anreise || format(new Date(), 'yyyy-MM-dd')}
                  onChange={e => set('wunsch_abreise')(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition"
                />
                {errors.wunsch_abreise && (
                  <p className="text-destructive text-xs mt-1">{errors.wunsch_abreise}</p>
                )}
              </div>
            </div>

            <div>
              <FieldLabel>{tx('Nachricht / Besondere Hinweise')}</FieldLabel>
              <textarea
                value={form.nachricht}
                onChange={e => set('nachricht')(e.target.value)}
                placeholder={tx('z. B. besondere Ernährungsbedürfnisse, Medikamente, …')}
                rows={4}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition resize-none"
              />
            </div>

            {submitError && (
              <p className="rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
                {submitError}
              </p>
            )}

            <div className="flex justify-between mt-2">
              <button
                onClick={prevStep}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-5 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition disabled:opacity-50"
              >
                ← {tx('Zurück')}
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition disabled:opacity-60"
              >
                {submitting ? tx('Wird gesendet …') : tx('Anfrage absenden')}
              </button>
            </div>
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground mt-6">
          {tx('Unverbindlich — wir melden uns bei dir zur Bestätigung.')}
        </p>
      </div>
    </PublicShell>
  );
}
