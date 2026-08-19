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
  hund_groesse: string;
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

export default function Buchungsanfrage() {
  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<FormData>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    loadPublicPagesConfig(SLUG).then(c => {
      if (!c || !c.pages[SLUG]) {
        setUnavailable(true);
      } else {
        setCfg(c);
        setPage(c.pages[SLUG]);
      }
      setLoading(false);
    }).catch(err => {
      if (err instanceof PageUnavailableError) setUnavailable(true);
      setLoading(false);
    });
  }, []);

  // Warm up the challenge on first form interaction
  const handleFirstInteraction = () => {
    if (!cfg || !page) return;
    const ep = page.endpoints?.find(e => e.op === 'create');
    if (ep?.app_id) {
      prepareChallenge(cfg, page, 'POST', `/apps/${ep.app_id}/records`);
    }
  };

  const set = (field: keyof FormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setForm(f => ({ ...f, [field]: e.target.value }));
    setErrors(er => ({ ...er, [field]: undefined }));
  };

  const validateStep1 = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};
    if (!form.interessent_vorname.trim()) newErrors.interessent_vorname = tx('Pflichtfeld');
    if (!form.interessent_nachname.trim()) newErrors.interessent_nachname = tx('Pflichtfeld');
    if (!form.interessent_email.trim()) {
      newErrors.interessent_email = tx('Pflichtfeld');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.interessent_email)) {
      newErrors.interessent_email = tx('Bitte gib eine gültige E-Mail-Adresse ein');
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};
    if (!form.hund_name.trim()) newErrors.hund_name = tx('Pflichtfeld');
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep3 = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};
    if (!form.wunsch_anreise) newErrors.wunsch_anreise = tx('Pflichtfeld');
    if (!form.wunsch_abreise) newErrors.wunsch_abreise = tx('Pflichtfeld');
    if (form.wunsch_anreise && form.wunsch_abreise && form.wunsch_abreise <= form.wunsch_anreise) {
      newErrors.wunsch_abreise = tx('Das Abreisedatum muss nach dem Anreisedatum liegen');
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const nextStep = () => {
    if (step === 1 && validateStep1()) setStep(2);
    else if (step === 2 && validateStep2()) setStep(3);
  };

  const prevStep = () => {
    if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep3()) return;
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
    } catch {
      setSubmitError(tx('Die Anfrage konnte nicht gesendet werden. Bitte versuche es erneut.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || unavailable) {
    return <PublicShell loading={loading} unavailable={unavailable} />;
  }

  if (submitted) {
    return (
      <PublicShell title={tx('Buchungsanfrage')} description={tx('Unverbindliche Anfrage für einen Aufenthalt in unserer Hundepension')}>
        <div className="text-center py-10 flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
            <IconCheck size={32} className="text-emerald-600" />
          </div>
          <h2 className="text-xl font-semibold">{tx('Anfrage erfolgreich gesendet!')}</h2>
          <p className="text-muted-foreground max-w-sm text-center">
            {tx('Vielen Dank, ')}
            <span className="font-medium">{form.interessent_vorname}</span>
            {tx('! Wir haben deine Anfrage erhalten und melden uns so schnell wie möglich bei dir.')}
          </p>
          <div className="mt-4 rounded-xl border bg-muted/40 p-4 text-sm text-left w-full max-w-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{tx('Hund')}</span>
              <span className="font-medium">{form.hund_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{tx('Anreise')}</span>
              <span className="font-medium">{form.wunsch_anreise ? format(new Date(form.wunsch_anreise + 'T12:00:00'), 'dd.MM.yyyy') : '–'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{tx('Abreise')}</span>
              <span className="font-medium">{form.wunsch_abreise ? format(new Date(form.wunsch_abreise + 'T12:00:00'), 'dd.MM.yyyy') : '–'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{tx('Kontakt')}</span>
              <span className="font-medium truncate">{form.interessent_email}</span>
            </div>
          </div>
        </div>
      </PublicShell>
    );
  }

  const steps = [
    { num: 1, label: tx('Kontaktdaten'), icon: <IconUser size={16} /> },
    { num: 2, label: tx('Dein Hund'), icon: <IconPaw size={16} /> },
    { num: 3, label: tx('Wunschzeitraum'), icon: <IconCalendar size={16} /> },
  ];

  return (
    <PublicShell
      title={tx('Buchungsanfrage')}
      description={tx('Unverbindliche Anfrage für einen Aufenthalt in unserer Hundepension')}
    >
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {steps.map((s, i) => (
          <div key={s.num} className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              step === s.num
                ? 'bg-primary text-primary-foreground'
                : step > s.num
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-muted text-muted-foreground'
            }`}>
              {step > s.num ? <IconCheck size={14} /> : s.icon}
              <span className="hidden sm:inline">{s.label}</span>
              <span className="sm:hidden">{s.num}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={`w-6 h-0.5 rounded ${step > s.num ? 'bg-emerald-400' : 'bg-muted'}`} />
            )}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} onFocus={handleFirstInteraction} noValidate>
        {/* Step 1: Kontaktdaten */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <IconUser size={20} className="text-primary" />
              {tx('Deine Kontaktdaten')}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="vorname">
                  {tx('Vorname')} <span className="text-destructive">*</span>
                </label>
                <input
                  id="vorname"
                  type="text"
                  value={form.interessent_vorname}
                  onChange={set('interessent_vorname')}
                  className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 transition ${errors.interessent_vorname ? 'border-destructive' : 'border-input'}`}
                  placeholder={tx('Max')}
                  autoComplete="given-name"
                />
                {errors.interessent_vorname && (
                  <p className="text-xs text-destructive">{errors.interessent_vorname}</p>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="nachname">
                  {tx('Nachname')} <span className="text-destructive">*</span>
                </label>
                <input
                  id="nachname"
                  type="text"
                  value={form.interessent_nachname}
                  onChange={set('interessent_nachname')}
                  className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 transition ${errors.interessent_nachname ? 'border-destructive' : 'border-input'}`}
                  placeholder={tx('Mustermann')}
                  autoComplete="family-name"
                />
                {errors.interessent_nachname && (
                  <p className="text-xs text-destructive">{errors.interessent_nachname}</p>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="email">
                {tx('E-Mail-Adresse')} <span className="text-destructive">*</span>
              </label>
              <input
                id="email"
                type="email"
                value={form.interessent_email}
                onChange={set('interessent_email')}
                className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 transition ${errors.interessent_email ? 'border-destructive' : 'border-input'}`}
                placeholder={tx('max@beispiel.de')}
                autoComplete="email"
              />
              {errors.interessent_email && (
                <p className="text-xs text-destructive">{errors.interessent_email}</p>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="telefon">
                {tx('Telefonnummer')} <span className="text-muted-foreground text-xs font-normal">({tx('optional')})</span>
              </label>
              <input
                id="telefon"
                type="tel"
                value={form.interessent_telefon}
                onChange={set('interessent_telefon')}
                className="w-full rounded-lg border border-input px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 transition"
                placeholder={tx('+49 123 456789')}
                autoComplete="tel"
              />
            </div>
          </div>
        )}

        {/* Step 2: Hund */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <IconPaw size={20} className="text-primary" />
              {tx('Dein Hund')}
            </h2>
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="hund_name">
                {tx('Name des Hundes')} <span className="text-destructive">*</span>
              </label>
              <input
                id="hund_name"
                type="text"
                value={form.hund_name}
                onChange={set('hund_name')}
                className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 transition ${errors.hund_name ? 'border-destructive' : 'border-input'}`}
                placeholder={tx('Bello')}
              />
              {errors.hund_name && (
                <p className="text-xs text-destructive">{errors.hund_name}</p>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="hund_rasse">
                {tx('Rasse')} <span className="text-muted-foreground text-xs font-normal">({tx('optional')})</span>
              </label>
              <input
                id="hund_rasse"
                type="text"
                value={form.hund_rasse}
                onChange={set('hund_rasse')}
                className="w-full rounded-lg border border-input px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 transition"
                placeholder={tx('z. B. Labrador, Pudel, Mischling …')}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {tx('Größe')} <span className="text-muted-foreground text-xs font-normal">({tx('optional')})</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { key: 'klein', label: tx('Klein'), sub: tx('bis 10 kg') },
                  { key: 'mittel', label: tx('Mittel'), sub: tx('10–25 kg') },
                  { key: 'gross', label: tx('Groß'), sub: tx('über 25 kg') },
                ].map(opt => (
                  <label
                    key={opt.key}
                    className={`flex flex-col items-center justify-center gap-1 rounded-xl border-2 py-4 cursor-pointer text-center transition ${
                      form.hund_groesse === opt.key
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-input hover:border-primary/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="hund_groesse"
                      value={opt.key}
                      checked={form.hund_groesse === opt.key}
                      onChange={set('hund_groesse')}
                      className="sr-only"
                    />
                    <span className="font-medium text-sm">{opt.label}</span>
                    <span className="text-xs text-muted-foreground">{opt.sub}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Wunschzeitraum */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <IconCalendar size={20} className="text-primary" />
              {tx('Wunschzeitraum')}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="anreise">
                  {tx('Gewünschtes Anreisedatum')} <span className="text-destructive">*</span>
                </label>
                <input
                  id="anreise"
                  type="date"
                  value={form.wunsch_anreise}
                  onChange={set('wunsch_anreise')}
                  min={format(new Date(), 'yyyy-MM-dd')}
                  className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 transition ${errors.wunsch_anreise ? 'border-destructive' : 'border-input'}`}
                />
                {errors.wunsch_anreise && (
                  <p className="text-xs text-destructive">{errors.wunsch_anreise}</p>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="abreise">
                  {tx('Gewünschtes Abreisedatum')} <span className="text-destructive">*</span>
                </label>
                <input
                  id="abreise"
                  type="date"
                  value={form.wunsch_abreise}
                  onChange={set('wunsch_abreise')}
                  min={form.wunsch_anreise || format(new Date(), 'yyyy-MM-dd')}
                  className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 transition ${errors.wunsch_abreise ? 'border-destructive' : 'border-input'}`}
                />
                {errors.wunsch_abreise && (
                  <p className="text-xs text-destructive">{errors.wunsch_abreise}</p>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="nachricht">
                {tx('Nachricht / Besondere Hinweise')} <span className="text-muted-foreground text-xs font-normal">({tx('optional')})</span>
              </label>
              <textarea
                id="nachricht"
                value={form.nachricht}
                onChange={set('nachricht')}
                rows={4}
                className="w-full rounded-lg border border-input px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 transition resize-none"
                placeholder={tx('Besonderheiten deines Hundes, Allergien, Medikamente …')}
              />
            </div>

            {submitError && (
              <p className="text-sm text-destructive rounded-lg bg-destructive/10 px-3 py-2">{submitError}</p>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className={`mt-8 flex ${step > 1 ? 'justify-between' : 'justify-end'}`}>
          {step > 1 && (
            <button
              type="button"
              onClick={prevStep}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-input text-sm font-medium hover:bg-muted transition"
            >
              <IconChevronLeft size={16} className="shrink-0" />
              {tx('Zurück')}
            </button>
          )}
          {step < 3 ? (
            <button
              type="button"
              onClick={nextStep}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition"
            >
              {tx('Weiter')}
              <IconChevronRight size={16} className="shrink-0" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition disabled:opacity-60"
            >
              {submitting ? tx('Wird gesendet …') : tx('Anfrage absenden')}
              {!submitting && <IconCheck size={16} className="shrink-0" />}
            </button>
          )}
        </div>
      </form>
    </PublicShell>
  );
}
