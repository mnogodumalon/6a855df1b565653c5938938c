import { useEffect, useMemo, useState } from 'react';
import { addDays, format, parseISO } from 'date-fns';
import { PublicShell } from '@/components/PublicShell';
import {
  loadPublicPagesConfig,
  type PublicPagesConfig,
  type PublicPageConfig,
} from '@/lib/publicClient';
import { createPublicPort } from '@/lib/journey/publicPort';
import {
  useStepForm,
  useJourneySubmit,
  fieldDate,
  fieldLookup,
  optionsOf,
  type JourneyPort,
  type JourneyRecord,
} from '@/lib/journey';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { AvailabilityRangePicker } from '@/components/blocks/AvailabilityRangePicker';
import { Bound } from '@/components/blocks/Bound';
import { tx } from '@/i18n';

const SLUG = 'buchungsanfrage';
const PLAETZE = 12;

function fmt(iso: string | null): string {
  return iso ? format(parseISO(iso), 'dd.MM.yyyy') : '';
}

interface Booking {
  platz: string;
  label: string;
  start: string;
  end: string;
}

function Wizard({ cfg, page }: { cfg: PublicPagesConfig; page: PublicPageConfig }) {
  const port: JourneyPort = useMemo(() => createPublicPort(cfg, page), [cfg, page]);
  const [step, setStep] = useState(1);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);

  useEffect(() => {
    let alive = true;
    port
      .list('belegung_buchungen', { limit: 500 })
      .then((recs: JourneyRecord[]) => {
        if (!alive) return;
        const out: Booking[] = [];
        recs.forEach(r => {
          const start = fieldDate(r, 'anreisedatum');
          const end = fieldDate(r, 'abreisedatum');
          const platz = fieldLookup(r, 'platznummer');
          if (start && end && platz) out.push({ platz: platz.key, label: platz.label, start, end });
        });
        setBookings(out);
      })
      .catch(() => {
        if (alive) setBookings([]);
      })
      .finally(() => {
        if (alive) setLoadingBookings(false);
      });
    return () => {
      alive = false;
    };
  }, [port]);

  const form = useStepForm('buchungsanfragen', {
    fields: [
      'wunsch_anreise',
      'wunsch_abreise',
      'interessent_vorname',
      'interessent_nachname',
      'interessent_email',
      'interessent_telefon',
      'hund_name',
      'hund_rasse',
      'hund_groesse',
      'nachricht',
    ],
    required: Object.fromEntries(page.fields.map(f => [f.key, f.required])),
    steps: {
      wunsch_anreise: 1,
      wunsch_abreise: 1,
      interessent_vorname: 2,
      interessent_nachname: 2,
      interessent_email: 2,
      interessent_telefon: 2,
      hund_name: 3,
      hund_rasse: 3,
      hund_groesse: 3,
      nachricht: 3,
    },
    autoComplete: true,
  });

  const submit = useJourneySubmit(port, [{ key: 'anfrage', entity: 'buchungsanfragen', form, primary: true }], {
    draftKey: 'buchungsanfrage',
  });

  // Nights on which every Platz is taken — the only nights a visitor cannot request.
  const fullyBooked = useMemo(() => {
    const perNight = new Map<string, Set<string>>();
    bookings.forEach(b => {
      let d = parseISO(b.start);
      const end = parseISO(b.end);
      let guard = 0;
      while (d < end && guard < 800) {
        const key = format(d, 'yyyy-MM-dd');
        const set = perNight.get(key) ?? new Set<string>();
        set.add(b.platz);
        perNight.set(key, set);
        d = addDays(d, 1);
        guard++;
      }
    });
    const ranges: { start: string; end: string }[] = [];
    perNight.forEach((set, key) => {
      if (set.size >= PLAETZE) ranges.push({ start: key, end: format(addDays(parseISO(key), 1), 'yyyy-MM-dd') });
    });
    return ranges;
  }, [bookings]);

  const perPlatz = useMemo(() => {
    const order = optionsOf('belegung_buchungen', 'platznummer');
    return order.map(o => ({
      key: o.key,
      label: o.label,
      items: bookings
        .filter(b => b.platz === o.key)
        .sort((a, b) => a.start.localeCompare(b.start)),
    }));
  }, [bookings]);

  return (
    <IntentWizardShell
      steps={[
        {
          label: tx('Zeitraum'),
          heading: tx('Wann möchtest du kommen?'),
          description: tx('Wähle An- und Abreise. Unten siehst du, welche Plätze wann belegt sind.'),
        },
        { label: tx('Kontakt'), heading: tx('Wie erreichen wir dich?') },
        { label: tx('Hund'), heading: tx('Erzähl uns von deinem Hund') },
        { label: tx('Prüfen'), heading: tx('Alles richtig?') },
      ]}
      currentStep={step}
      onStepChange={setStep}
      back={false}
      forms={[form]}
      draftKey="buchungsanfrage"
    >
      {step === 1 && (
        <div className="space-y-6">
          <AvailabilityRangePicker
            {...form.range('wunsch_anreise', 'wunsch_abreise', { blocked: fullyBooked, minNights: 1 })}
          />
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">{tx('Belegung der Plätze')}</h3>
            {loadingBookings ? (
              <p className="text-sm text-muted-foreground">{tx('Belegung wird geladen …')}</p>
            ) : (
              <ul className="divide-y rounded-lg border overflow-hidden">
                {perPlatz.map(p => (
                  <li key={p.key} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2 text-sm">
                    <span className="font-medium w-24 shrink-0">{p.label}</span>
                    {p.items.length === 0 ? (
                      <span className="text-emerald-700">{tx('Frei')}</span>
                    ) : (
                      <span className="flex flex-wrap gap-x-3 gap-y-1 min-w-0">
                        {p.items.map((b, i) => (
                          <span key={i} className="text-muted-foreground">
                            {fmt(b.start)} – {fmt(b.end)}
                          </span>
                        ))}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-muted-foreground">
              {tx('Alle Zeiträume ohne Eintrag sind frei. Die Pension prüft deine Anfrage und meldet sich bei dir.')}
            </p>
          </div>
          <StepNav
            hideBack
            onNext={() => form.validate(['wunsch_anreise', 'wunsch_abreise'])}
            nextStepLabel={tx('Kontakt')}
          />
        </div>
      )}
      {step === 2 && (
        <div className="space-y-4">
          <Bound form={form} name="interessent_vorname" />
          <Bound form={form} name="interessent_nachname" />
          <Bound form={form} name="interessent_email" />
          <Bound form={form} name="interessent_telefon" />
          <StepNav
            onBack={() => setStep(1)}
            onNext={() => form.validate(['interessent_vorname', 'interessent_nachname', 'interessent_email'])}
            nextStepLabel={tx('Hund')}
          />
        </div>
      )}
      {step === 3 && (
        <div className="space-y-4">
          <Bound form={form} name="hund_name" />
          <Bound form={form} name="hund_rasse" />
          <Bound form={form} name="hund_groesse" allowClear />
          <Bound form={form} name="nachricht" />
          <StepNav
            onBack={() => setStep(2)}
            onNext={() => form.validate(['hund_name'])}
            nextStepLabel={tx('Prüfen')}
          />
        </div>
      )}
      {step === 4 && !submit.done && (
        <SummaryStep
          forms={[form]}
          submit={submit}
          whatHappensNext={tx('Die Pension prüft deine Anfrage und meldet sich per E-Mail bei dir.')}
        />
      )}
      {submit.result && (
        <SuccessStep
          result={submit.result}
          forms={[form]}
          submit={submit}
          title={tx('Anfrage gesendet')}
          whatHappensNext={tx('Wir prüfen deine Anfrage und melden uns bei dir.')}
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
    loadPublicPagesConfig(SLUG).then(c => {
      setCfg(c);
      setPage(c?.pages[SLUG] ?? null);
      setLoading(false);
    });
  }, []);

  if (loading || !cfg || !page) {
    return <PublicShell loading={loading} unavailable={!loading} />;
  }
  return (
    <PublicShell title={page.title} description={page.description}>
      <Wizard cfg={cfg} page={page} />
    </PublicShell>
  );
}
