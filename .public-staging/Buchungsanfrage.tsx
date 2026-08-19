import { useEffect, useRef, useState } from 'react';
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
import { IconPaw, IconCheck, IconAlertCircle } from '@tabler/icons-react';

// Lookup-Optionen für hund_groesse (aus app_metadata)
const GROESSE_OPTIONS = [
  { key: 'klein', label: tx('Klein (bis 10 kg)') },
  { key: 'mittel', label: tx('Mittel (10–25 kg)') },
  { key: 'gross', label: tx('Groß (über 25 kg)') },
] as const;

type HundGroesse = 'klein' | 'mittel' | 'gross' | '';

interface FormState {
  interessent_vorname: string;
  interessent_nachname: string;
  interessent_email: string;
  interessent_telefon: string;
  hund_name: string;
  hund_rasse: string;
  hund_groesse: HundGroesse;
  wunsch_anreise: string;
  wunsch_abreise: string;
  nachricht: string;
}

const EMPTY_FORM: FormState = {
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

function LabelEl({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-medium text-foreground mb-1">
      {children}
      {required && <span className="text-destructive ml-0.5">*</span>}
    </label>
  );
}

function InputEl(props: React.InputHTMLAttributes<HTMLInputElement> & { error?: string }) {
  const { error, className, ...rest } = props;
  return (
    <input
      {...rest}
      className={[
        'w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground',
        'focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary',
        'disabled:opacity-50',
        error ? 'border-destructive' : 'border-input',
        className,
      ].filter(Boolean).join(' ')}
    />
  );
}

function TextareaEl(props: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: string }) {
  const { error, className, ...rest } = props;
  return (
    <textarea
      {...rest}
      className={[
        'w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground',
        'focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary',
        'disabled:opacity-50 resize-none',
        error ? 'border-destructive' : 'border-input',
        className,
      ].filter(Boolean).join(' ')}
    />
  );
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="mt-1 text-xs text-destructive">{msg}</p>;
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-base font-semibold text-foreground mt-6 mb-3 flex items-center gap-2">
      {children}
    </h2>
  );
}

type Errors = Partial<Record<keyof FormState, string>>;

function validate(form: FormState): Errors {
  const errs: Errors = {};
  if (!form.interessent_vorname.trim()) errs.interessent_vorname = tx('Pflichtfeld');
  if (!form.interessent_nachname.trim()) errs.interessent_nachname = tx('Pflichtfeld');
  if (!form.interessent_email.trim()) errs.interessent_email = tx('Pflichtfeld');
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.interessent_email))
    errs.interessent_email = tx('Bitte gib eine gültige E-Mail-Adresse ein.');
  if (!form.hund_name.trim()) errs.hund_name = tx('Pflichtfeld');
  if (!form.wunsch_anreise) errs.wunsch_anreise = tx('Pflichtfeld');
  if (!form.wunsch_abreise) errs.wunsch_abreise = tx('Pflichtfeld');
  if (form.wunsch_anreise && form.wunsch_abreise && form.wunsch_abreise <= form.wunsch_anreise)
    errs.wunsch_abreise = tx('Das Abreisedatum muss nach dem Anreisedatum liegen.');
  return errs;
}

export default function Buchungsanfrage() {
  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const challengePrepared = useRef(false);

  useEffect(() => {
    loadPublicPagesConfig('buchungsanfrage')
      .then(c => {
        setCfg(c);
        setPage(c?.pages['buchungsanfrage'] ?? null);
        setLoading(false);
      })
      .catch(err => {
        if (err instanceof PageUnavailableError) setUnavailable(true);
        setLoading(false);
      });
  }, []);

  function handleFirstInteraction() {
    if (challengePrepared.current || !cfg || !page) return;
    const ep = page.endpoints?.find(e => e.op === 'create');
    if (!ep) return;
    challengePrepared.current = true;
    prepareChallenge(cfg, page, 'POST', `/apps/${ep.app_id}/records`).catch(() => {/* silent */});
  }

  function set(field: keyof FormState, value: string) {
    setForm(f => ({ ...f, [field]: value }));
    if (errors[field]) setErrors(e => ({ ...e, [field]: undefined }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate(form);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
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

      await createPublicRecord(cfg!, page!, payload);
      setSubmitted(true);
    } catch {
      setSubmitError(tx('Beim Absenden ist ein Fehler aufgetreten. Bitte versuche es erneut.'));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || unavailable || !cfg || !page) {
    return <PublicShell loading={loading} unavailable={!loading && (unavailable || !page)} />;
  }

  // Schritt 2: Danke-Bestätigung
  if (submitted) {
    return (
      <PublicShell
        title={tx('Anfrage eingegangen')}
        description={tx('Wir melden uns so schnell wie möglich bei dir.')}
      >
        <div className="flex flex-col items-center text-center gap-6 py-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <IconCheck size={36} className="text-emerald-600" strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              {tx('Vielen Dank für deine Anfrage!')}
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-sm">
              {tx('Wir haben deine unverbindliche Buchungsanfrage erhalten und werden uns in Kürze per E-Mail bei dir melden.')}
            </p>
          </div>
          <div className="rounded-lg border bg-muted/40 px-5 py-4 text-left text-sm w-full max-w-sm space-y-1">
            <p className="text-muted-foreground font-medium mb-2">{tx('Deine Angaben')}</p>
            <p>
              <span className="text-muted-foreground">{tx('Name:')}</span>{' '}
              <span className="font-medium">{form.interessent_vorname} {form.interessent_nachname}</span>
            </p>
            <p>
              <span className="text-muted-foreground">{tx('Hund:')}</span>{' '}
              <span className="font-medium">{form.hund_name}</span>
            </p>
            <p>
              <span className="text-muted-foreground">{tx('Zeitraum:')}</span>{' '}
              <span className="font-medium">
                {format(new Date(form.wunsch_anreise + 'T12:00:00'), 'dd.MM.yyyy')} – {format(new Date(form.wunsch_abreise + 'T12:00:00'), 'dd.MM.yyyy')}
              </span>
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            {tx('Eine Bestätigung der Anfrage ist noch keine verbindliche Buchung.')}
          </p>
        </div>
      </PublicShell>
    );
  }

  // Schritt 1: Formular
  return (
    <PublicShell
      title={page.title || tx('Buchungsanfrage')}
      description={tx('Unverbindliche Anfrage stellen — wir melden uns bei dir.')}
    >
      <form onSubmit={handleSubmit} onFocus={handleFirstInteraction} noValidate>

        {/* Kontaktdaten */}
        <SectionHeading>{tx('Deine Kontaktdaten')}</SectionHeading>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <LabelEl required>{tx('Vorname')}</LabelEl>
            <InputEl
              type="text"
              value={form.interessent_vorname}
              onChange={e => set('interessent_vorname', e.target.value)}
              placeholder={tx('Max')}
              error={errors.interessent_vorname}
              autoComplete="given-name"
            />
            <FieldError msg={errors.interessent_vorname} />
          </div>
          <div>
            <LabelEl required>{tx('Nachname')}</LabelEl>
            <InputEl
              type="text"
              value={form.interessent_nachname}
              onChange={e => set('interessent_nachname', e.target.value)}
              placeholder={tx('Mustermann')}
              error={errors.interessent_nachname}
              autoComplete="family-name"
            />
            <FieldError msg={errors.interessent_nachname} />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <LabelEl required>{tx('E-Mail-Adresse')}</LabelEl>
            <InputEl
              type="email"
              value={form.interessent_email}
              onChange={e => set('interessent_email', e.target.value)}
              placeholder={tx('max@beispiel.de')}
              error={errors.interessent_email}
              autoComplete="email"
            />
            <FieldError msg={errors.interessent_email} />
          </div>
          <div>
            <LabelEl>{tx('Telefonnummer')}</LabelEl>
            <InputEl
              type="tel"
              value={form.interessent_telefon}
              onChange={e => set('interessent_telefon', e.target.value)}
              placeholder={tx('+49 151 …')}
              autoComplete="tel"
            />
          </div>
        </div>

        {/* Hundedaten */}
        <SectionHeading>
          <IconPaw size={18} className="shrink-0 text-amber-600" />
          {tx('Angaben zum Hund')}
        </SectionHeading>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <LabelEl required>{tx('Name des Hundes')}</LabelEl>
            <InputEl
              type="text"
              value={form.hund_name}
              onChange={e => set('hund_name', e.target.value)}
              placeholder={tx('Bello')}
              error={errors.hund_name}
            />
            <FieldError msg={errors.hund_name} />
          </div>
          <div>
            <LabelEl>{tx('Rasse')}</LabelEl>
            <InputEl
              type="text"
              value={form.hund_rasse}
              onChange={e => set('hund_rasse', e.target.value)}
              placeholder={tx('z. B. Labrador')}
            />
          </div>
        </div>
        <div className="mt-4">
          <LabelEl>{tx('Größe des Hundes')}</LabelEl>
          <div className="flex flex-wrap gap-3 mt-1">
            {GROESSE_OPTIONS.map(opt => (
              <label
                key={opt.key}
                className={[
                  'flex items-center gap-2 rounded-lg border px-4 py-2.5 cursor-pointer text-sm select-none transition-colors',
                  form.hund_groesse === opt.key
                    ? 'border-primary bg-primary/10 font-medium text-primary'
                    : 'border-input bg-background text-foreground hover:bg-muted/60',
                ].join(' ')}
              >
                <input
                  type="radio"
                  name="hund_groesse"
                  value={opt.key}
                  checked={form.hund_groesse === opt.key}
                  onChange={() => set('hund_groesse', opt.key)}
                  className="sr-only"
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        {/* Wunschzeitraum */}
        <SectionHeading>{tx('Gewünschter Zeitraum')}</SectionHeading>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <LabelEl required>{tx('Anreisedatum')}</LabelEl>
            <InputEl
              type="date"
              value={form.wunsch_anreise}
              onChange={e => set('wunsch_anreise', e.target.value)}
              min={format(new Date(), 'yyyy-MM-dd')}
              error={errors.wunsch_anreise}
            />
            <FieldError msg={errors.wunsch_anreise} />
          </div>
          <div>
            <LabelEl required>{tx('Abreisedatum')}</LabelEl>
            <InputEl
              type="date"
              value={form.wunsch_abreise}
              onChange={e => set('wunsch_abreise', e.target.value)}
              min={form.wunsch_anreise || format(new Date(), 'yyyy-MM-dd')}
              error={errors.wunsch_abreise}
            />
            <FieldError msg={errors.wunsch_abreise} />
          </div>
        </div>

        {/* Nachricht */}
        <div className="mt-6">
          <LabelEl>{tx('Nachricht / Besondere Hinweise')}</LabelEl>
          <TextareaEl
            value={form.nachricht}
            onChange={e => set('nachricht', e.target.value)}
            placeholder={tx('Besondere Bedürfnisse, Allergien, Medikamente …')}
            rows={4}
          />
        </div>

        {/* Fehler-Banner */}
        {submitError && (
          <div className="mt-4 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <IconAlertCircle size={16} className="shrink-0 mt-0.5" />
            {submitError}
          </div>
        )}

        {/* Hinweis + Absenden */}
        <p className="mt-6 text-xs text-muted-foreground">
          {tx('Diese Anfrage ist unverbindlich. Eine Buchung kommt erst nach unserer Bestätigung zustande.')}
        </p>
        <button
          type="submit"
          disabled={submitting}
          className="mt-4 w-full rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
        >
          {submitting ? tx('Wird gesendet …') : tx('Anfrage absenden')}
        </button>
      </form>
    </PublicShell>
  );
}
