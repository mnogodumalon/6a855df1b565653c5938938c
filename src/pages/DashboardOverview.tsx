import { useMemo, useState } from 'react';
import { addDays, format, parseISO } from 'date-fns';
import { IconDog, IconInbox, IconLogin, IconLogout, IconPaw, IconCalendarEvent, IconHome } from '@tabler/icons-react';
import type { DashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import { flowActionFor } from '@/config/plan';
import type { EnrichedBelegungBuchungen } from '@/types/enriched';
import { LOOKUP_OPTIONS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import { formatDate, lookupKey } from '@/lib/formatters';
import { tx, dateFnsLocale, appLabel } from '@/i18n';
import { useClock, gruss, namen } from '@/lib/polish';
import { DashboardGrid } from '@/components/DashboardGrid';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { WorkList, type WorkListItem } from '@/components/WorkList';
import { HeroBanner } from '@/components/HeroBanner';
import { ResourceTimeline, type ResourceEvent, type ResourceGroup, type ResourceTone } from '@/components/widgets/ResourceTimeline';

type DayFilter = 'all' | 'anreise' | 'abreise';

export default function DashboardOverview({ data }: { data: DashboardData }) {
  const { buchungsanfragen, hundekarteiMap } = data;
  const crud = useEntityCrud(data, {
    footer: (top) => {
      if (top.type === 'belegungBuchungen') {
        const go = nextStep(top.record);
        return go ? { label: go.label, onClick: go.run } : undefined;
      }
      if (top.type === 'buchungsanfragen') {
        const go = flowActionFor('buchungsanfragen', 'anfrage_status', top.record.record_id, 'bestaetigt');
        return go ? { label: tx('Anfrage bearbeiten'), onClick: go } : undefined;
      }
      return undefined;
    },
  });
  const buchungen = crud.enriched.belegungBuchungen;
  const portraets = crud.enriched.pfotenPortraet;

  const clock = useClock();
  const today = format(clock, 'yyyy-MM-dd');
  const [filter, setFilter] = useState<DayFilter>('all');

  const statusOf = (b: EnrichedBelegungBuchungen) => lookupKey(b.fields.status) ?? 'reserviert';

  // The check-in/check-out step belongs to its flow — the helper OPENS it.
  function nextStep(b: EnrichedBelegungBuchungen): { label: string; run: () => void } | null {
    const st = statusOf(b);
    if (st === 'storniert' || st === 'abgeschlossen') return null;
    const target = st === 'aktiv' ? 'abgeschlossen' : 'aktiv';
    const go = flowActionFor('belegung_buchungen', 'status', b.record_id, target);
    if (!go) return null;
    return { label: target === 'aktiv' ? tx('Check-in') : tx('Check-out'), run: go };
  }

  const platzOptions = LOOKUP_OPTIONS['belegung_buchungen']?.platznummer ?? [];
  const platzCount = platzOptions.length;

  const live = useMemo(() => buchungen.filter(b => statusOf(b) !== 'storniert' && b.fields.anreisedatum), [buchungen]);
  const arrivalsToday = live.filter(b => b.fields.anreisedatum!.slice(0, 10) === today && statusOf(b) === 'reserviert');
  const departuresToday = live.filter(b => (b.fields.abreisedatum ?? '').slice(0, 10) === today && statusOf(b) === 'aktiv');
  const occupiedNow = live.filter(b => {
    const st = statusOf(b);
    if (st === 'abgeschlossen') return false;
    const from = b.fields.anreisedatum!.slice(0, 10);
    const to = (b.fields.abreisedatum ?? b.fields.anreisedatum!).slice(0, 10);
    return from <= today && today <= to;
  });
  const occupiedPlaces = new Set(occupiedNow.map(b => lookupKey(b.fields.platznummer)).filter(Boolean)).size;

  const newRequests = useMemo(
    () => buchungsanfragen
      .filter(a => lookupKey(a.fields.anfrage_status) === 'neu')
      .sort((a, b) => (b.createdat ?? '').localeCompare(a.createdat ?? '')),
    [buchungsanfragen],
  );

  const groups: ResourceGroup[] = platzOptions.map(o => ({ key: o.key, label: o.label }));

  const toneOf = (b: EnrichedBelegungBuchungen): ResourceTone => {
    const st = statusOf(b);
    if (st === 'aktiv') return 'primary';
    if (st === 'abgeschlossen') return 'default';
    return 'warning';
  };

  const shown = live.filter(b => {
    if (filter === 'anreise') return arrivalsToday.includes(b);
    if (filter === 'abreise') return departuresToday.includes(b);
    return true;
  });
  const events: ResourceEvent[] = shown.flatMap(b => {
    const group = lookupKey(b.fields.platznummer);
    if (!group) return [];
    return [{
      id: `buchung:${b.record_id}`,
      start: b.fields.anreisedatum!.slice(0, 10),
      end: b.fields.abreisedatum?.slice(0, 10),
      allDay: true,
      title: b.hundName || tx('Ohne Hund'),
      subtitle: b.besitzerName || undefined,
      tone: toneOf(b),
      group,
    }];
  });

  const openBuchung = (id: string) => {
    const rec = data.belegungBuchungen.find(b => b.record_id === id);
    if (rec) crud.belegungBuchungen.openDetail(rec);
  };

  const platzLabel = (b: EnrichedBelegungBuchungen) => b.fields.platznummer?.label ?? tx('ohne Platz');
  const dayLabel = (s: string) => format(parseISO(s), 'EEE dd.MM.', { locale: dateFnsLocale() });

  const todayItems: WorkListItem[] = [
    ...arrivalsToday.map(b => {
      const go = nextStep(b);
      return {
        id: b.record_id,
        title: b.hundName || tx('Ohne Hund'),
        secondLine: <><span className="font-medium text-primary">{tx('Anreise')}</span><span className="text-muted-foreground"> · {platzLabel(b)} · {b.besitzerName}</span></>,
        icon: <IconLogin size={16} className="text-muted-foreground" />,
        action: go ? { label: go.label, onClick: go.run } : undefined,
      };
    }),
    ...departuresToday.map(b => {
      const go = nextStep(b);
      return {
        id: b.record_id,
        title: b.hundName || tx('Ohne Hund'),
        secondLine: <><span className="font-medium text-amber-600">{tx('Abreise')}</span><span className="text-muted-foreground"> · {platzLabel(b)} · {b.besitzerName}</span></>,
        icon: <IconLogout size={16} className="text-muted-foreground" />,
        action: go ? { label: go.label, onClick: go.run } : undefined,
      };
    }),
  ];

  // Upcoming movements of the next 3 days (tomorrow onward)
  const horizon = format(addDays(clock, 3), 'yyyy-MM-dd');
  const upcoming = live
    .flatMap(b => {
      const out: { b: EnrichedBelegungBuchungen; kind: 'anreise' | 'abreise'; day: string }[] = [];
      const a = b.fields.anreisedatum!.slice(0, 10);
      const d = b.fields.abreisedatum?.slice(0, 10);
      if (a > today && a <= horizon && statusOf(b) !== 'abgeschlossen') out.push({ b, kind: 'anreise', day: a });
      if (d && d > today && d <= horizon && statusOf(b) !== 'abgeschlossen') out.push({ b, kind: 'abreise', day: d });
      return out;
    })
    .sort((x, y) => String(x.day).localeCompare(String(y.day)));
  const upcomingItems: WorkListItem[] = upcoming.map(u => ({
    id: u.b.record_id,
    title: u.b.hundName || tx('Ohne Hund'),
    secondLine: <>
      <span className={u.kind === 'anreise' ? 'font-medium text-primary' : 'font-medium text-amber-600'}>{u.kind === 'anreise' ? tx('Anreise') : tx('Abreise')}</span>
      <span className="text-muted-foreground"> · {dayLabel(u.day)} · {platzLabel(u.b)}</span>
    </>,
  }));
  const nextArrival = live
    .filter(b => b.fields.anreisedatum!.slice(0, 10) > horizon)
    .sort((x, y) => x.fields.anreisedatum!.localeCompare(y.fields.anreisedatum!))[0];

  const latestPortraits: WorkListItem[] = [...portraets]
    .sort((a, b) => (b.fields.erstellungsdatum ?? b.createdat ?? '').localeCompare(a.fields.erstellungsdatum ?? a.createdat ?? ''))
    .slice(0, 5)
    .map(p => ({
      id: p.record_id,
      title: p.fields.titel || p.hundName || tx('Porträt'),
      secondLine: <span className="text-muted-foreground">{p.hundName} · {formatDate(p.fields.erstellungsdatum ?? p.createdat)}</span>,
      icon: <IconPaw size={16} className="text-muted-foreground" />,
    }));

  const openAnfrage = (id: string) => {
    const rec = buchungsanfragen.find(a => a.record_id === id);
    if (rec) crud.buchungsanfragen.openDetail(rec);
  };
  const resolveAnfrage = (id: string) => {
    const go = flowActionFor('buchungsanfragen', 'anfrage_status', id, 'bestaetigt');
    if (go) go(); else openAnfrage(id);
  };

  // Context line — names in every branch
  const arrNames = namen(arrivalsToday.map(b => b.hundName).filter(Boolean));
  const depNames = namen(departuresToday.map(b => b.hundName).filter(Boolean));
  let context: string;
  if (arrivalsToday.length && departuresToday.length) context = tx`Heute reisen ${arrNames} an und ${depNames} ab.`;
  else if (arrivalsToday.length) context = tx`Heute reisen ${arrNames} an.`;
  else if (departuresToday.length) context = tx`Heute reisen ${depNames} ab.`;
  else if (nextArrival) context = tx`Heute ist es ruhig — als Nächstes kommt ${nextArrival.hundName || tx('ein Gast')} am ${formatDate(nextArrival.fields.anreisedatum)}.`;
  else context = tx`Heute stehen keine Anreisen oder Abreisen an.`;

  const hasAnything = data.belegungBuchungen.length + buchungsanfragen.length > 0;

  const hero = newRequests.length > 0 ? (
    <HeroBanner
      icon={<IconInbox size={18} />}
      tone="warning"
      action={{ label: tx('Anfrage bearbeiten'), onClick: () => resolveAnfrage(newRequests[0].record_id) }}
    >
      {newRequests.length === 1
        ? tx`Neue Anfrage von ${[newRequests[0].fields.interessent_vorname, newRequests[0].fields.interessent_nachname].filter(Boolean).join(' ')} für ${newRequests[0].fields.hund_name ?? tx('einen Hund')} — Wunschzeit ${formatDate(newRequests[0].fields.wunsch_anreise)} bis ${formatDate(newRequests[0].fields.wunsch_abreise)}.`
        : tx`${newRequests.length} neue Anfragen warten, zuletzt von ${namen(newRequests.map(a => a.fields.interessent_vorname ?? ''))}.`}
    </HeroBanner>
  ) : undefined;

  return (
    <div className="space-y-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight truncate">{gruss(clock)}</h1>
        <p className="text-sm text-muted-foreground">{context}</p>
      </div>

      <DashboardGrid
        variant="wide"
        hero={hero}
        kpis={hasAnything ? (
          <StatStrip>
            <StatStripItem
              title={tx('Anreisen heute')}
              value={arrivalsToday.length}
              icon={<IconLogin size={18} />}
              tone={arrivalsToday.length > 0 ? 'primary' : 'default'}
              onClick={() => setFilter(f => f === 'anreise' ? 'all' : 'anreise')}
              active={filter === 'anreise'}
            />
            <StatStripItem
              title={tx('Abreisen heute')}
              value={departuresToday.length}
              icon={<IconLogout size={18} />}
              tone={departuresToday.length > 0 ? 'warning' : 'default'}
              onClick={() => setFilter(f => f === 'abreise' ? 'all' : 'abreise')}
              active={filter === 'abreise'}
            />
            <StatStripItem
              title={tx('Belegte Plätze')}
              value={`${occupiedPlaces} / ${platzCount}`}
              icon={<IconHome size={18} />}
            />
          </StatStrip>
        ) : undefined}
        primary={
          <ResourceTimeline
            axis="day"
            defaultRange="2weeks"
            events={events}
            groups={groups}
            locale={dateFnsLocale()}
            onEventClick={ev => openBuchung(ev.id.split(':')[1] ?? '')}
          />
        }
        aside={<>
          <WorkList
            title={tx('Heute: Anreisen & Abreisen')}
            icon={<IconDog size={16} />}
            items={todayItems}
            onItemClick={openBuchung}
            empty={{ text: nextArrival ? tx`Nächste Anreise: ${nextArrival.hundName || tx('ein Gast')} am ${formatDate(nextArrival.fields.anreisedatum)}` : tx('Heute keine Bewegungen.') }}
          />
          <WorkList
            title={tx('Nächste 3 Tage')}
            icon={<IconCalendarEvent size={16} />}
            items={upcomingItems}
            onItemClick={openBuchung}
            empty={{ text: tx('In den nächsten Tagen ist nichts geplant.') }}
          />
          <WorkList
            title={appLabel('pfoten_portraet')}
            icon={<IconPaw size={16} />}
            items={latestPortraits}
            onItemClick={id => {
              const rec = data.pfotenPortraet.find(p => p.record_id === id);
              if (rec) crud.pfotenPortraet.openDetail(rec);
            }}
            empty={{ text: tx('Noch keine Porträts erstellt.') }}
          />
        </>}
      />
      {crud.surfaces}
    </div>
  );
}
