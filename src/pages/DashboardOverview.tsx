import { useMemo, useState } from 'react';
import { addDays, format, parseISO } from 'date-fns';
import { IconCalendarPlus, IconDog, IconInbox, IconLogin2, IconLogout2, IconPaw } from '@tabler/icons-react';
import type { DashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import { flowActionFor } from '@/config/plan';
import { LivingAppsService } from '@/services/livingAppsService';
import { LOOKUP_OPTIONS, lookupOption } from '@/types/app';
import { lookupKey, formatDate } from '@/lib/formatters';
import { dateFnsLocale, tx, appLabel } from '@/i18n';
import { gruss, namen, undoToast, useClock } from '@/lib/polish';
import { DashboardGrid } from '@/components/DashboardGrid';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { WorkList } from '@/components/WorkList';
import { Button } from '@/components/ui/button';
import {
  ResourceTimeline,
  type ResourceEvent,
  type ResourceGroup,
} from '@/components/widgets/ResourceTimeline';

const day = (s?: string) => (s ? s.slice(0, 10) : '');

export default function DashboardOverview({ data }: { data: DashboardData }) {
  const { buchungsanfragen, setBelegungBuchungen, fetchAll } = data;
  const crud = useEntityCrud(data, {
    footer: (top) => {
      if (top.type === 'belegungBuchungen') {
        const st = lookupKey(top.record.fields.status);
        const to = st === 'aktiv' ? 'abgeschlossen' : st === 'abgeschlossen' || st === 'storniert' ? null : 'aktiv';
        const go = to ? flowActionFor('belegung_buchungen', 'status', top.record.record_id, to) : null;
        return go ? { label: to === 'aktiv' ? tx('Einchecken') : tx('Auschecken'), onClick: go } : undefined;
      }
      if (top.type === 'buchungsanfragen') {
        const go = lookupKey(top.record.fields.anfrage_status) === 'neu'
          ? flowActionFor('buchungsanfragen', 'anfrage_status', top.record.record_id, 'bestaetigt')
          : null;
        return go ? { label: tx('Anfrage bearbeiten'), onClick: go } : undefined;
      }
      return undefined;
    },
  });
  const bookings = crud.enriched.belegungBuchungen;
  const clock = useClock();
  const today = format(clock, 'yyyy-MM-dd');
  const [todayFilter, setTodayFilter] = useState<'ein' | 'aus' | null>(null);

  const platzOptions = LOOKUP_OPTIONS['belegung_buchungen']?.platznummer ?? [];
  const groups: ResourceGroup[] = platzOptions.map(o => ({ key: o.key, label: o.label }));

  const live = useMemo(() => bookings.filter(b => lookupKey(b.fields.status) !== 'storniert'), [bookings]);

  const events = useMemo<ResourceEvent[]>(
    () => live
      .filter(b => b.fields.anreisedatum && b.fields.platznummer)
      .map(b => {
        const st = lookupKey(b.fields.status);
        return {
          id: `buchung:${b.record_id}`,
          start: day(b.fields.anreisedatum),
          end: day(b.fields.abreisedatum) || undefined,
          allDay: true,
          title: b.hundName || tx('Buchung'),
          subtitle: b.besitzerName || undefined,
          tone: st === 'aktiv' ? 'primary' : 'default',
          group: lookupKey(b.fields.platznummer) ?? '',
        };
      }),
    [live],
  );

  const occupiedToday = useMemo(() => {
    const set = new Set<string>();
    for (const b of live) {
      if (lookupKey(b.fields.status) !== 'aktiv') continue;
      const a = day(b.fields.anreisedatum);
      const e = day(b.fields.abreisedatum) || a;
      if (a <= today && today <= e) set.add(lookupKey(b.fields.platznummer) ?? '');
    }
    set.delete('');
    return set.size;
  }, [live, today]);

  const arrivals = useMemo(
    () => live.filter(b => day(b.fields.anreisedatum) === today && lookupKey(b.fields.status) !== 'abgeschlossen'),
    [live, today],
  );
  const departures = useMemo(
    () => live.filter(b => lookupKey(b.fields.status) === 'aktiv' && day(b.fields.abreisedatum) !== '' && day(b.fields.abreisedatum) <= today),
    [live, today],
  );
  const openRequests = useMemo(
    () => buchungsanfragen
      .filter(a => lookupKey(a.fields.anfrage_status) === 'neu')
      .sort((x, y) => (x.fields.wunsch_anreise ?? '').localeCompare(y.fields.wunsch_anreise ?? '')),
    [buchungsanfragen],
  );

  // One place may hold only one stay per period (departure day = free again).
  const ruleViolation = (id: string, start: string, end: string | undefined, platz: string): string | null => {
    const s = day(start);
    const e = day(end) || s;
    const clash = live.find(b => {
      if (b.record_id === id || (lookupKey(b.fields.platznummer) ?? '') !== platz) return false;
      const bs = day(b.fields.anreisedatum);
      const be = day(b.fields.abreisedatum) || bs;
      return s < be && bs < e || (s === e && bs <= s && s < be);
    });
    return clash ? tx`Platz bereits belegt von ${clash.hundName || tx('einer anderen Buchung')}` : null;
  };

  const reschedule = (evId: string, newStart: string, newEnd?: string, newGroup?: string): string | void => {
    const id = evId.split(':')[1] ?? '';
    const rec = bookings.find(b => b.record_id === id);
    if (!rec) return;
    const platz = newGroup ?? lookupKey(rec.fields.platznummer) ?? '';
    const msg = ruleViolation(id, newStart, newEnd ?? rec.fields.abreisedatum, platz);
    if (msg) return msg;
    const before = {
      anreisedatum: rec.fields.anreisedatum,
      abreisedatum: rec.fields.abreisedatum,
      platznummer: rec.fields.platznummer,
    };
    const patch = {
      anreisedatum: day(newStart),
      ...(newEnd ? { abreisedatum: day(newEnd) } : {}),
      ...(newGroup ? { platznummer: lookupOption('belegung_buchungen', 'platznummer', newGroup) } : {}),
    };
    setBelegungBuchungen(prev => prev.map(b => (b.record_id === id ? { ...b, fields: { ...b.fields, ...patch } } : b)));
    const apiPatch = {
      anreisedatum: day(newStart),
      ...(newEnd ? { abreisedatum: day(newEnd) } : {}),
      ...(newGroup ? { platznummer: newGroup } : {}),
    };
    LivingAppsService.updateBelegungBuchungenEntry(id, apiPatch).catch(() => { void fetchAll(); });
    undoToast(tx`${rec.hundName || tx('Buchung')} — verschoben`, () => {
      setBelegungBuchungen(prev => prev.map(b => (b.record_id === id ? { ...b, fields: { ...b.fields, ...before } } : b)));
      LivingAppsService.updateBelegungBuchungenEntry(id, {
        anreisedatum: day(before.anreisedatum),
        abreisedatum: day(before.abreisedatum) || undefined,
        platznummer: before.platznummer?.key,
      }).catch(() => { void fetchAll(); });
    });
  };

  const bookingRow = (kind: 'ein' | 'aus') => (b: (typeof bookings)[number]) => {
    const st = lookupKey(b.fields.status);
    const to = kind === 'ein' ? 'aktiv' : 'abgeschlossen';
    const go = kind === 'ein' && st === 'aktiv' ? null : flowActionFor('belegung_buchungen', 'status', b.record_id, to);
    const late = kind === 'aus' && day(b.fields.abreisedatum) < today;
    return {
      id: b.record_id,
      title: b.hundName || tx('Hund'),
      icon: kind === 'ein' ? <IconLogin2 size={16} className="text-muted-foreground" /> : <IconLogout2 size={16} className="text-muted-foreground" />,
      secondLine: (
        <>
          <span className={late ? 'font-medium text-destructive' : 'font-medium text-foreground'}>
            {kind === 'ein' ? (st === 'aktiv' ? tx('Eingecheckt') : tx('Reist heute an')) : late ? tx('Abreise überfällig') : tx('Reist heute ab')}
          </span>
          <span className="text-muted-foreground"> · {b.fields.platznummer?.label ?? tx('ohne Platz')} · {b.besitzerName}</span>
        </>
      ),
      action: go ? { label: kind === 'ein' ? tx('Einchecken') : tx('Auschecken'), onClick: go } : undefined,
    };
  };

  const todayItems =
    todayFilter === 'ein' ? arrivals.map(bookingRow('ein'))
    : todayFilter === 'aus' ? departures.map(bookingRow('aus'))
    : [...arrivals.map(bookingRow('ein')), ...departures.map(bookingRow('aus'))];

  const nextArrival = live
    .filter(b => day(b.fields.anreisedatum) > today && lookupKey(b.fields.status) === 'aktiv')
    .sort((a, b) => day(a.fields.anreisedatum).localeCompare(day(b.fields.anreisedatum)))[0];

  const context = (() => {
    const inNames = namen(arrivals.map(b => b.hundName).filter(Boolean));
    const outNames = namen(departures.map(b => b.hundName).filter(Boolean));
    if (arrivals.length && departures.length) return tx`Heute kommen ${inNames} an — ${outNames} reist ab.`;
    if (arrivals.length) return tx`Heute kommen ${inNames} an.`;
    if (departures.length) return tx`Heute reist ${outNames} ab.`;
    if (openRequests.length) {
      const who = namen(openRequests.map(a => a.fields.interessent_nachname ?? '').filter(Boolean));
      return tx`Heute ist ruhig — ${who} wartet auf Antwort zur Anfrage.`;
    }
    return tx`Heute ist ruhig — keine An- oder Abreisen, keine offenen Anfragen.`;
  })();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{gruss(clock)}</h1>
          <p className="text-sm text-muted-foreground">{context}</p>
        </div>
        {crud.belegungBuchungen.canWrite && (
          <Button onClick={() => crud.belegungBuchungen.openCreate({ anreisedatum: today })}>
            <IconCalendarPlus size={16} className="mr-2 shrink-0" />
            {tx('Neue Buchung')}
          </Button>
        )}
      </div>

      <DashboardGrid
        variant="wide"
        kpis={
          <StatStrip>
            <StatStripItem
              title={tx('Plätze belegt')}
              value={`${occupiedToday} / ${groups.length}`}
              icon={<IconPaw size={18} className="text-muted-foreground" />}
              tone={groups.length > 0 && occupiedToday >= groups.length ? 'warning' : 'default'}
            />
            <StatStripItem
              title={tx('Anreisen heute')}
              value={arrivals.length}
              icon={<IconLogin2 size={18} className="text-muted-foreground" />}
              onClick={() => setTodayFilter(f => (f === 'ein' ? null : 'ein'))}
              active={todayFilter === 'ein'}
            />
            <StatStripItem
              title={tx('Abreisen heute')}
              value={departures.length}
              icon={<IconLogout2 size={18} className="text-muted-foreground" />}
              onClick={() => setTodayFilter(f => (f === 'aus' ? null : 'aus'))}
              active={todayFilter === 'aus'}
            />
          </StatStrip>
        }
        primary={
          <ResourceTimeline
            axis="day"
            defaultRange="2weeks"
            events={events}
            groups={groups}
            locale={dateFnsLocale()}
            onEventClick={ev => {
              const rec = bookings.find(b => b.record_id === ev.id.split(':')[1]);
              if (rec) crud.belegungBuchungen.openDetail(rec);
            }}
            onEventDrop={reschedule}
            onEventResize={(id, s, e) => reschedule(id, s, e)}
            onEmptyClick={crud.belegungBuchungen.canWrite
              ? (date, group) => {
                  const end = format(addDays(parseISO(format(date, 'yyyy-MM-dd')), 1), 'yyyy-MM-dd');
                  crud.belegungBuchungen.openCreate({
                    anreisedatum: format(date, 'yyyy-MM-dd'),
                    abreisedatum: end,
                    platznummer: group,
                  });
                }
              : undefined}
          />
        }
        aside={
          <>
            <WorkList
              title={tx('Heute: An- & Abreisen')}
              icon={<IconDog size={14} />}
              items={todayItems}
              onItemClick={id => {
                const rec = bookings.find(b => b.record_id === id);
                if (rec) crud.belegungBuchungen.openDetail(rec);
              }}
              empty={{
                text: nextArrival
                  ? tx`Nächste Anreise: ${formatDate(nextArrival.fields.anreisedatum)} — ${nextArrival.hundName}`
                  : tx('Keine Anreisen oder Abreisen geplant.'),
              }}
            />
            <WorkList
              title={`${appLabel('buchungsanfragen')} — ${tx('neu')}`}
              icon={<IconInbox size={14} />}
              items={openRequests.map(a => {
                const go = flowActionFor('buchungsanfragen', 'anfrage_status', a.record_id, 'bestaetigt');
                return {
                  id: a.record_id,
                  title: `${a.fields.interessent_vorname ?? ''} ${a.fields.interessent_nachname ?? ''}`.trim() || tx('Interessent'),
                  secondLine: (
                    <>
                      <span className="font-medium text-foreground">{a.fields.hund_name ?? tx('Hund')}</span>
                      <span className="text-muted-foreground">
                        {' · '}{formatDate(a.fields.wunsch_anreise)} – {formatDate(a.fields.wunsch_abreise)}
                      </span>
                    </>
                  ),
                  action: go ? { label: tx('Bearbeiten'), onClick: go } : undefined,
                };
              })}
              onItemClick={id => {
                const rec = buchungsanfragen.find(a => a.record_id === id);
                if (rec) crud.buchungsanfragen.openDetail(rec);
              }}
              empty={{ text: tx('Keine neuen Anfragen — alles beantwortet.') }}
            />
          </>
        }
      />
      {crud.surfaces}
    </div>
  );
}
