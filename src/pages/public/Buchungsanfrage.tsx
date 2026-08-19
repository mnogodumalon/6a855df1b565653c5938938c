import { useEffect, useRef, useState } from 'react';
import { PublicShell } from '@/components/PublicShell';
import {
  loadPublicPagesConfig, createPublicRecord,
  prepareChallenge, PageUnavailableError,
  type PublicPagesConfig, type PublicPageConfig,
} from '@/lib/publicClient';
import { tx } from '@/i18n';
import { format } from 'date-fns';
import { IconPaw, IconCheck, IconAlertCircle, IconLoader2 } from '@tabler/icons-react';

const SLUG = 'buchungsanfrage';

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

export default function Buchungsanfrage() {
  const GROESSE_OPTIONS = [
  { key: 'klein', label: tx('Klein (bis 10 kg)') },
  { key: 'mittel', label: tx('Mittel (10–25 kg)') },
  { key: 'gross', label: tx('Groß (über 25 kg)') },
];

  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const firstInteracted = useRef(false);
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadPublicPagesConfig(SLUG)
      .then(c => {
        setCfg(c);
        setPage(c?.pages[SLUG] ?? null);
        setConfigLoading(false);
      })
      .catch(err => {
        if (err instanceof PageUnavailableError) {
          setUnavailable(true);
        }
        setConfigLoading(false);
      });
  }, []);

  const handleInteraction = () => {
    if (!firstInteracted.current && cfg && page) {
      firstInteracted.current = true;
      const ep = page.endpoints?.find(e => e.op === 'create');
      if (ep?.app_id) {
        prepareChallenge(cfg, page, 'POST', `/apps/${ep.app_id}/records`);
      }
    }
  };

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof FormState, string>> = {};

    if (!form.interessent_vorname.trim()) {
      newErrors.interessent_vorname = tx('Bitte Vorname angeben');
    }
    if (!form.interessent_nachname.trim()) {
      newErrors.interessent_nachname = tx('Bitte Nachname angeben');
    }
    if (!form.interessent_email.trim()) {
      newErrors.interessent_email = tx('Bitte E-Mail-Adresse angeben');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.interessent_email)) {
      newErrors.interessent_email = tx('Bitte eine gültige E-Mail-Adresse eingeben');
    }
    if (!form.hund_name.trim()) {
      newErrors.hund_name = tx('Bitte den Namen des Hundes angeben');
    }
    if (!form.wunsch_anreise) {
      newErrors.wunsch_anreise = tx('Bitte Anreisedatum angeben');
    }
    if (!form.wunsch_abreise) {
      newErrors.wunsch_abreise = tx('Bitte Abreisedatum angeben');
    } else if (form.wunsch_anreise && form.wunsch_abreise <= form.wunsch_anreise) {
      newErrors.wunsch_abreise = tx('Das Abreisedatum muss nach dem Anreisedatum liegen');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!validate()) return;
    if (!cfg || !page) return;

    setSubmitting(true);
    try {
      const payload: Record<string, string> = {
        interessent_vorname: form.interessent_vorname.trim(),
        interessent_nachname: form.interessent_nachname.trim(),
        interessent_email: form.interessent_email.trim(),
        hund_name: form.hund_name.trim(),
        wunsch_anreise: form.wunsch_anreise,
        wunsch_abreise: form.wunsch_abreise,
      };
      if (form.interessent_telefon.trim()) {
        payload.interessent_telefon = form.interessent_telefon.trim();
      }
      if (form.hund_rasse.trim()) {
        payload.hund_rasse = form.hund_rasse.trim();
      }
      if (form.hund_groesse) {
        payload.hund_groesse = form.hund_groesse;
      }
      if (form.nachricht.trim()) {
        payload.nachricht = form.nachricht.trim();
      }

      await createPublicRecord(cfg, page, payload);
      setSubmitted(true);
      topRef.current?.scrollIntoView({ behavior: 'smooth' });
    } catch {
      setSubmitError(tx('Beim Senden ist ein Fehler aufgetreten. Bitte versuche es erneut oder kontaktiere uns direkt.'));
    } finally {
      setSubmitting(false);
    }
  };

  const set = (field: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    handleInteraction();
    setForm(prev => ({ ...prev, [field]: e.target.value }));
    if (errors[field]) {
      setErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
    }
  };

  const today = format(new Date(), 'yyyy-MM-dd');

  if (configLoading) {
    return <PublicShell loading />;
  }
  if (unavailable || !cfg || !page) {
    return <PublicShell unavailable />;
  }

  if (submitted) {
    return (
      <PublicShell title={tx('Buchungsanfrage')} description={tx('PfotenPension — Ihr Zuhause für Ihren Hund')}>
        <div ref={topRef} className="flex flex-col items-center gap-6 py-12 px-4 text-center">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100">
            <IconCheck size={32} className="text-emerald-600 shrink-0" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              {tx('Vielen Dank für deine Anfrage!')}
            </h2>
            <p className="text-muted-foreground max-w-sm mx-auto">
              {tx('Wir haben deine Buchungsanfrage erhalten und melden uns so bald wie möglich bei dir.')}
            </p>
          </div>
          <div className="rounded-xl border bg-muted/40 p-5 max-w-sm w-full text-left space-y-2">
            <p className="text-sm font-medium text-foreground">{tx('Deine Anfrage auf einen Blick')}</p>
            <dl className="text-sm space-y-1 text-muted-foreground">
              <div className="flex gap-2">
                <dt className="font-medium text-foreground">{tx('Hund:')}</dt>
                <dd>{form.hund_name}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-medium text-foreground">{tx('Anreise:')}</dt>
                <dd>{form.wunsch_anreise}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-medium text-foreground">{tx('Abreise:')}</dt>
                <dd>{form.wunsch_abreise}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-medium text-foreground">{tx('Kontakt:')}</dt>
                <dd>{form.interessent_email}</dd>
              </div>
            </dl>
          </div>
          <p className="text-xs text-muted-foreground max-w-xs">
            {tx('Bei Fragen erreichst du uns jederzeit per E-Mail oder Telefon.')}
          </p>
        </div>
      </PublicShell>
    );
  }

  return (
    <PublicShell
      title={tx('Buchungsanfrage')}
      description={tx('Fülle das Formular aus — wir melden uns innerhalb von 24 Stunden bei dir.')}
    >
      <div ref={topRef} />
      <form onSubmit={handleSubmit} noValidate className="space-y-8">

        {/* Kontaktdaten */}
        <section className="space-y-4">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            {tx('Deine Kontaktdaten')}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label={tx('Vorname')}
              required
              error={errors.interessent_vorname}
            >
              <input
                type="text"
                autoComplete="given-name"
                value={form.interessent_vorname}
                onChange={set('interessent_vorname')}
                placeholder={tx('z. B. Maria')}
                className={inputClass(!!errors.interessent_vorname)}
              />
            </Field>

            <Field
              label={tx('Nachname')}
              required
              error={errors.interessent_nachname}
            >
              <input
                type="text"
                autoComplete="family-name"
                value={form.interessent_nachname}
                onChange={set('interessent_nachname')}
                placeholder={tx('z. B. Müller')}
                className={inputClass(!!errors.interessent_nachname)}
              />
            </Field>
          </div>

          <Field
            label={tx('E-Mail-Adresse')}
            required
            error={errors.interessent_email}
          >
            <input
              type="email"
              autoComplete="email"
              value={form.interessent_email}
              onChange={set('interessent_email')}
              placeholder={tx('deine@email.de')}
              className={inputClass(!!errors.interessent_email)}
            />
          </Field>

          <Field
            label={tx('Telefonnummer')}
            error={errors.interessent_telefon}
          >
            <input
              type="tel"
              autoComplete="tel"
              value={form.interessent_telefon}
              onChange={set('interessent_telefon')}
              placeholder={tx('z. B. +49 170 1234567')}
              className={inputClass(!!errors.interessent_telefon)}
            />
          </Field>
        </section>

        <hr className="border-border" />

        {/* Angaben zum Hund */}
        <section className="space-y-4">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <IconPaw size={18} className="shrink-0 text-muted-foreground" />
            {tx('Angaben zum Hund')}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label={tx('Name des Hundes')}
              required
              error={errors.hund_name}
            >
              <input
                type="text"
                value={form.hund_name}
                onChange={set('hund_name')}
                placeholder={tx('z. B. Bello')}
                className={inputClass(!!errors.hund_name)}
              />
            </Field>

            <Field
              label={tx('Rasse')}
              error={errors.hund_rasse}
            >
              <input
                type="text"
                value={form.hund_rasse}
                onChange={set('hund_rasse')}
                placeholder={tx('z. B. Golden Retriever')}
                className={inputClass(!!errors.hund_rasse)}
              />
            </Field>
          </div>

          <Field
            label={tx('Größe des Hundes')}
            error={errors.hund_groesse}
          >
            <div className="flex flex-wrap gap-3">
              {GROESSE_OPTIONS.map(opt => (
                <label
                  key={opt.key}
                  className={[
                    'flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer text-sm transition-colors',
                    form.hund_groesse === opt.key
                      ? 'border-primary bg-primary/10 text-primary font-medium'
                      : 'border-border bg-background text-foreground hover:bg-muted/50',
                  ].join(' ')}
                >
                  <input
                    type="radio"
                    name="hund_groesse"
                    value={opt.key}
                    checked={form.hund_groesse === opt.key}
                    onChange={set('hund_groesse')}
                    className="sr-only"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </Field>
        </section>

        <hr className="border-border" />

        {/* Wunschtermin */}
        <section className="space-y-4">
          <h2 className="text-base font-semibold text-foreground">
            {tx('Wunschtermin')}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label={tx('Anreisedatum')}
              required
              error={errors.wunsch_anreise}
            >
              <input
                type="date"
                value={form.wunsch_anreise}
                onChange={set('wunsch_anreise')}
                min={today}
                className={inputClass(!!errors.wunsch_anreise)}
              />
            </Field>

            <Field
              label={tx('Abreisedatum')}
              required
              error={errors.wunsch_abreise}
            >
              <input
                type="date"
                value={form.wunsch_abreise}
                onChange={set('wunsch_abreise')}
                min={form.wunsch_anreise || today}
                className={inputClass(!!errors.wunsch_abreise)}
              />
            </Field>
          </div>
        </section>

        <hr className="border-border" />

        {/* Nachricht */}
        <section className="space-y-4">
          <Field
            label={tx('Nachricht / Besondere Hinweise')}
            error={errors.nachricht}
          >
            <textarea
              value={form.nachricht}
              onChange={set('nachricht')}
              rows={4}
              placeholder={tx('z. B. Allergien, Medikamente, besondere Gewohnheiten …')}
              className={inputClass(!!errors.nachricht) + ' resize-none'}
            />
          </Field>
        </section>

        {submitError && (
          <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <IconAlertCircle size={18} className="shrink-0 mt-0.5" />
            <span>{submitError}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground font-medium py-3 px-6 transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {submitting ? (
            <>
              <IconLoader2 size={18} className="shrink-0 animate-spin" />
              {tx('Wird gesendet …')}
            </>
          ) : (
            tx('Anfrage absenden')
          )}
        </button>

        <p className="text-xs text-muted-foreground text-center">
          {tx('Deine Daten werden vertraulich behandelt und nur zur Bearbeitung deiner Anfrage verwendet.')}
        </p>
      </form>
    </PublicShell>
  );
}

function inputClass(hasError: boolean) {
  return [
    'w-full rounded-lg border px-3 py-2 text-sm bg-background text-foreground placeholder:text-muted-foreground',
    'focus:outline-none focus:ring-2 focus:ring-primary/40 transition-shadow',
    hasError ? 'border-red-400 focus:ring-red-200' : 'border-border',
  ].join(' ');
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-red-500 ml-1" aria-hidden>*</span>}
      </label>
      {children}
      {error && (
        <p className="text-xs text-red-600 flex items-center gap-1">
          <IconAlertCircle size={12} className="shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
