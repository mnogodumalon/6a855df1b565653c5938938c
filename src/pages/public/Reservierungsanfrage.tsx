import { useEffect, useMemo, useState } from 'react';
import { addDays, format, parseISO } from 'date-fns';
import { PublicShell } from '@/components/PublicShell';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { Bound } from '@/components/blocks/Bound';
import { AvailabilityRangePicker, rangeIsFree } from '@/components/blocks/AvailabilityRangePicker';
import {
  loadPublicPagesConfig, prepareChallenge,
  type PublicPagesConfig, type PublicPageConfig,
} from '@/lib/publicClient';
import { createPublicPort } from '@/lib/journey/publicPort';
import {
  useStepForm, useJourneySubmit, occupancyFor, optionsOf, fieldLookup,
  type JourneyRecord,
} from '@/lib/journey';
import { tx } from '@/i18n';

const SLUG = 'buchungsanfrage';

type Range = { start: string; end?: string | null };

function shortDate(iso: string): string {
  return format(parseISO(iso), 'dd.MM.');
}

function Inner({ cfg, page }: { cfg: PublicPagesConfig; page: PublicPageConfig }) {
  const port = useMemo(() => createPublicPort(cfg, page), [cfg, page]);
  const [step, setStep] = useState(1);
  const [bookings, setBookings] = useState<JourneyRecord[]>([]);
  const [occLoading, setOccLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    port.list('belegung_buchungen')
      .then(r => { if (alive) setBookings(r); })
      .catch(() => { if (alive) setBookings([]); })
      .finally(() => { if (alive) setOccLoading(false); });
    return () => { alive = false; };
  }, [port]);

  const form = useStepForm('buchungsanfragen', {
    fields: ['interessent_vorname', 'interessent_nachname', 'interessent_email', 'interessent_telefon', 'hund_name', 'hund_rasse', 'hund_groesse', 'wunsch_anreise', 'wunsch_abreise', 'nachricht'],
    autoComplete: true,
    required: {
      interessent_vorname: true, interessent_nachname: true, interessent_email: true,
      hund_name: true, wunsch_anreise: true, wunsch_abreise: true,
    },
    steps: {
      wunsch_anreise: 1, wunsch_abreise: 1,
      hund_name: 2, hund_rasse: 2, hund_groesse: 2,
      interessent_vorname: 3, interessent_nachname: 3, interessent_email: 3, interessent_telefon: 3, nachricht: 3,
    },
  });
  const submit = useJourneySubmit(
    port,
    [{ key: 'anfrage', entity: 'buchungsanfragen', form, primary: true }],
    { draftKey: SLUG },
  );

  const places = useMemo(() => optionsOf('belegung_buchungen', 'platznummer'), []);
  const perPlace = useMemo(() => places.map(p => ({
    key: p.key,
    label: p.label,
    ranges: occupancyFor('belegung_buchungen', bookings, { resource: p.key }) as Range[],
  })), [places, bookings]);

  // A night is only unavailable when every place is taken.
  const fullHouse = useMemo<Range[]>(() => {
    if (places.length === 0) return [];
    const counts = new Map<string, number>();
    for (const p of perPlace) {
      const seen = new Set<string>();
      for (const r of p.ranges) {
        if (!r.end) { seen.add(r.start); continue; }
        let d = parseISO(r.start);
        const end = parseISO(r.end);
        let guard = 0;
        while (d < end && guard++ < 800) {
          seen.add(format(d, 'yyyy-MM-dd'));
          d = addDays(d, 1);
        }
      }
      seen.forEach(k => counts.set(k, (counts.get(k) ?? 0) + 1));
    }
    const out: Range[] = [];
    counts.forEach((n, k) => {
      if (n >= places.length) out.push({ start: k, end: format(addDays(parseISO(k), 1), 'yyyy-MM-dd') });
    });
    return out;
  }, [perPlace, places]);

  const from = form.get('wunsch_anreise') as string | null;
  const to = form.get('wunsch_abreise') as string | null;
  const freePlaces = from && to && to > from
    ? perPlace.filter(p => rangeIsFree(from, to, p.ranges)).length
    : null;

  const dogSize = fieldLookup({ id: '', fields: { g: form.get('hund_groesse') }, createdAt: null }, 'g');

  const steps = [
    { label: tx('Zeitraum'), heading: tx('Wann soll dein Hund kommen?'), description: tx('Belegte Nächte sind durchgestrichen und nicht wählbar.') },
    { label: tx('Hund'), heading: tx('Erzähl uns von deinem Hund') },
    { label: tx('Kontakt'), heading: tx('Wie erreichen wir dich?') },
    { label: tx('Prüfen'), heading: tx('Alles richtig?') },
  ];

  const restart = () => { submit.reset(); form.reset(); setStep(1); };

  return (
    <IntentWizardShell
      steps={steps}
      currentStep={step}
      onStepChange={setStep}
      back={false}
      forms={[form]}
      draftKey={SLUG}
      loading={occLoading}
    >
      {step === 1 && (
        <div className="space-y-5" onFocusCapture={() => prepareChallenge(cfg, page, 'POST', `/apps/${page.endpoints?.find(e => e.op === 'create')?.app_id ?? ''}/records`)}>
          <AvailabilityRangePicker {...form.range('wunsch_anreise', 'wunsch_abreise', { blocked: fullHouse })} />
          {freePlaces !== null && (
            <p className="text-sm text-muted-foreground">
              {freePlaces > 0
                ? tx`Im gewählten Zeitraum sind noch ${freePlaces} von ${places.length} Plätzen frei.`
                : tx`Im gewählten Zeitraum ist leider kein Platz mehr frei.`}
            </p>
          )}
          {perPlace.some(p => p.ranges.length > 0) && (
            <details className="rounded-lg border p-3 text-sm">
              <summary className="cursor-pointer font-medium">{tx('Belegte Zeiträume pro Platz')}</summary>
              <ul className="mt-2 space-y-1">
                {perPlace.filter(p => p.ranges.length > 0).map(p => (
                  <li key={p.key} className="flex flex-wrap gap-x-2">
                    <span className="font-medium">{p.label}:</span>
                    <span className="text-muted-foreground">
                      {p.ranges.map(r => (r.end ? `${shortDate(r.start)}–${shortDate(r.end)}` : shortDate(r.start))).join(', ')}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
          <StepNav hideBack onNext={() => form.validate(['wunsch_anreise', 'wunsch_abreise'])} nextStepLabel={tx('Hund')} />
        </div>
      )}
      {step === 2 && (
        <div className="space-y-5">
          <Bound form={form} name="hund_name" />
          <Bound form={form} name="hund_rasse" />
          <Bound form={form} name="hund_groesse" allowClear />
          <StepNav onBack={() => setStep(1)} onNext={() => form.validate(['hund_name', 'hund_rasse', 'hund_groesse'])} nextStepLabel={tx('Kontakt')} />
        </div>
      )}
      {step === 3 && (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Bound form={form} name="interessent_vorname" />
            <Bound form={form} name="interessent_nachname" />
          </div>
          <Bound form={form} name="interessent_email" />
          <Bound form={form} name="interessent_telefon" />
          <Bound form={form} name="nachricht" />
          <StepNav
            onBack={() => setStep(2)}
            onNext={() => form.validate(['interessent_vorname', 'interessent_nachname', 'interessent_email', 'interessent_telefon', 'nachricht'])}
            nextStepLabel={tx('Prüfen')}
          />
        </div>
      )}
      {step === 4 && !submit.done && (
        <SummaryStep
          forms={[form]}
          submit={submit}
          whatHappensNext={dogSize
            ? tx`Wir prüfen deine Anfrage für ${form.get('hund_name') as string} (${dogSize.label}) und melden uns per E-Mail oder Telefon bei dir.`
            : tx('Wir prüfen deine Anfrage und melden uns per E-Mail oder Telefon bei dir.')}
        />
      )}
      {submit.result && (
        <SuccessStep
          result={submit.result}
          forms={[form]}
          title={tx('Anfrage gesendet')}
          whatHappensNext={tx('Das Team prüft deine Anfrage und meldet sich bei dir. Die Reservierung ist erst nach unserer Bestätigung verbindlich.')}
          next={[{ label: tx('Weitere Anfrage stellen'), onClick: restart }]}
        />
      )}
    </IntentWizardShell>
  );
}

export default function Reservierungsanfrage() {
  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPublicPagesConfig(SLUG)
      .then(c => { setCfg(c); setPage(c?.pages[SLUG] ?? null); })
      .catch(() => { setCfg(null); setPage(null); })
      .finally(() => setLoading(false));
  }, []);

  if (loading || !cfg || !page) {
    return <PublicShell loading={loading} unavailable={!loading} />;
  }
  return (
    <PublicShell title={page.title} description={page.description} wide>
      <Inner cfg={cfg} page={page} />
    </PublicShell>
  );
}
