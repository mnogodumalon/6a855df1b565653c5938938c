import { useMemo, useState, useCallback } from 'react';
import { format, parseISO, isToday, isBefore, isAfter, differenceInDays } from 'date-fns';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import { DashboardSkeleton, DashboardError } from '@/components/DashboardStates';
import { DashboardGrid } from '@/components/DashboardGrid';
import { HeroBanner } from '@/components/HeroBanner';
import { WorkList } from '@/components/WorkList';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import {
  ResourceTimeline,
  type ResourceEvent,
  type ResourceGroup,
} from '@/components/widgets/ResourceTimeline';
import { LOOKUP_OPTIONS, APP_IDS, lookupOption } from '@/types/app';
import { LivingAppsService, extractRecordId, createRecordUrl } from '@/services/livingAppsService';
import { formatDate, lookupKey } from '@/lib/formatters';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import { tx, appLabel, dateFnsLocale } from '@/i18n';
import { IconDog, IconCalendarPlus, IconAlertTriangle, IconCheck, IconX, IconBed } from '@tabler/icons-react';

// Platz-keys mapped to group labels
const PLATZ_OPTIONS = LOOKUP_OPTIONS['belegung_buchungen']?.['platznummer'] ?? [];

export default function DashboardOverview() {
  const data = useDashboardData();
  const {
    belegungBuchungen, setBelegungBuchungen,
    buchungsanfragen, setBuchungsanfragen,
    loading, error, fetchAll,
  } = data;

  const crud = useEntityCrud(data, {
    footer: (top) => {
      if (top.type === 'buchungsanfragen') {
        const rec = top.record;
        const status = lookupKey(rec.fields.anfrage_status);
        if (status === 'neu') {
          return {
            label: tx('Buchung bestätigen'),
            onClick: () => confirmAnfrage(rec),
          };
        }
      }
      return undefined;
    },
  });

  const enrichedBelegungBuchungen = crud.enriched.belegungBuchungen;

  const clock = useClock();

  // Platznummer filter state
  const [filterPlatz, setFilterPlatz] = useState<string | null>(null);

  // Confirm a booking request → update status
  const confirmAnfrage = useCallback(async (rec: typeof buchungsanfragen[0]) => {
    const prev = buchungsanfragen;
    setBuchungsanfragen(bs =>
      bs.map(b => b.record_id === rec.record_id
        ? { ...b, fields: { ...b.fields, anfrage_status: lookupOption('buchungsanfragen', 'anfrage_status', 'bestaetigt') } }
        : b
      )
    );
    undoToast(
      tx`${rec.fields.interessent_vorname ?? ''} ${rec.fields.interessent_nachname ?? ''} — bestätigt`,
      async () => {
        setBuchungsanfragen(prev);
        await LivingAppsService.updateBuchungsanfragenEntry(rec.record_id, { anfrage_status: 'neu' });
      }
    );
    try {
      await LivingAppsService.updateBuchungsanfragenEntry(rec.record_id, { anfrage_status: 'bestaetigt' });
    } catch {
      setBuchungsanfragen(prev);
      await fetchAll();
    }
  }, [buchungsanfragen, setBuchungsanfragen, fetchAll]);

  // Reject a booking request
  const rejectAnfrage = useCallback(async (rec: typeof buchungsanfragen[0]) => {
    const prev = buchungsanfragen;
    setBuchungsanfragen(bs =>
      bs.map(b => b.record_id === rec.record_id
        ? { ...b, fields: { ...b.fields, anfrage_status: lookupOption('buchungsanfragen', 'anfrage_status', 'abgelehnt') } }
        : b
      )
    );
    undoToast(
      tx`${rec.fields.interessent_vorname ?? ''} ${rec.fields.interessent_nachname ?? ''} — abgelehnt`,
      async () => {
        setBuchungsanfragen(prev);
        await LivingAppsService.updateBuchungsanfragenEntry(rec.record_id, { anfrage_status: 'neu' });
      }
    );
    try {
      await LivingAppsService.updateBuchungsanfragenEntry(rec.record_id, { anfrage_status: 'abgelehnt' });
    } catch {
      setBuchungsanfragen(prev);
      await fetchAll();
    }
  }, [buchungsanfragen, setBuchungsanfragen, fetchAll]);

  // Reschedule on drag (optimistic)
  const reschedule = useCallback(async (
    id: string,
    newStart: string,
    newEnd?: string,
    newGroup?: string
  ): Promise<void | string> => {
    const recId = id.split(':')[1] ?? '';
    if (!recId) return;

    // Overlap check: no two active bookings for the same platz on the same days
    if (newGroup) {
      const overlap = belegungBuchungen.some(b => {
        if (b.record_id === recId) return false;
        if (lookupKey(b.fields.platznummer) !== newGroup) return false;
        if (lookupKey(b.fields.status) === 'storniert') return false;
        const bStart = b.fields.anreisedatum;
        const bEnd = b.fields.abreisedatum ?? bStart;
        if (!bStart) return false;
        const newS = newStart;
        const newE = newEnd ?? newStart;
        return !(newE < bStart || newS > (bEnd ?? newS));
      });
      if (overlap) return tx('Dieser Platz ist für den gewählten Zeitraum bereits belegt.');
    }

    const prev = belegungBuchungen;
    setBelegungBuchungen(bs =>
      bs.map(b => {
        if (b.record_id !== recId) return b;
        const platzPatch = newGroup
          ? { platznummer: lookupOption('belegung_buchungen', 'platznummer', newGroup) }
          : {};
        return {
          ...b,
          fields: {
            ...b.fields,
            anreisedatum: newStart,
            ...(newEnd ? { abreisedatum: newEnd } : {}),
            ...platzPatch,
          },
        };
      })
    );

    try {
      await LivingAppsService.updateBelegungBuchungenEntry(recId, {
        anreisedatum: newStart,
        ...(newEnd ? { abreisedatum: newEnd } : {}),
        ...(newGroup ? { platznummer: newGroup } : {}),
      });
      undoToast(tx('Buchung verschoben'), async () => {
        setBelegungBuchungen(prev);
        const orig = prev.find(b => b.record_id === recId);
        if (orig) {
          await LivingAppsService.updateBelegungBuchungenEntry(recId, {
            anreisedatum: orig.fields.anreisedatum,
            abreisedatum: orig.fields.abreisedatum,
            platznummer: lookupKey(orig.fields.platznummer),
          });
        }
      });
    } catch {
      setBelegungBuchungen(prev);
      await fetchAll();
    }
  }, [belegungBuchungen, setBelegungBuchungen, fetchAll]);

  // Resize on drag edge
  const resize = useCallback(async (id: string, newStart: string, newEnd: string): Promise<void | string> => {
    const recId = id.split(':')[1] ?? '';
    if (!recId) return;
    const prev = belegungBuchungen;
    setBelegungBuchungen(bs =>
      bs.map(b =>
        b.record_id === recId
          ? { ...b, fields: { ...b.fields, anreisedatum: newStart, abreisedatum: newEnd } }
          : b
      )
    );
    try {
      await LivingAppsService.updateBelegungBuchungenEntry(recId, {
        anreisedatum: newStart,
        abreisedatum: newEnd,
      });
      undoToast(tx('Aufenthalt angepasst'), async () => {
        setBelegungBuchungen(prev);
        const orig = prev.find(b => b.record_id === recId);
        if (orig) {
          await LivingAppsService.updateBelegungBuchungenEntry(recId, {
            anreisedatum: orig.fields.anreisedatum,
            abreisedatum: orig.fields.abreisedatum,
          });
        }
      });
    } catch {
      setBelegungBuchungen(prev);
      await fetchAll();
    }
  }, [belegungBuchungen, setBelegungBuchungen, fetchAll]);

  const todayKey = format(clock, 'yyyy-MM-dd');

  // ResourceTimeline groups (spots as rows) — stable, computed before early returns
  const groups = useMemo<ResourceGroup[]>(
    () => PLATZ_OPTIONS.map(o => ({ key: o.key, label: o.label })),
    []
  );

  // Resource events — must be above early returns (hook)
  const events = useMemo<ResourceEvent[]>(() => {
    const filtered = filterPlatz
      ? enrichedBelegungBuchungen.filter(b => lookupKey(b.fields.platznummer) === filterPlatz)
      : enrichedBelegungBuchungen;
    return filtered
      .filter(b => lookupKey(b.fields.status) !== 'storniert' && b.fields.anreisedatum)
      .map(b => {
        const status = lookupKey(b.fields.status);
        const tone =
          status === 'abgeschlossen' ? 'default' as const :
          b.fields.anreisedatum === todayKey || b.fields.abreisedatum === todayKey ? 'warning' as const :
          'primary' as const;
        return {
          id: `buchung:${b.record_id}`,
          start: b.fields.anreisedatum!,
          end: b.fields.abreisedatum,
          allDay: true,
          title: b.hundName || b.besitzerName || tx('Buchung'),
          subtitle: b.besitzerName || undefined,
          tone,
          group: lookupKey(b.fields.platznummer) ?? '',
        };
      });
  }, [enrichedBelegungBuchungen, filterPlatz, todayKey]);

  // ─── All hooks above, derivations below ───
  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  // Active bookings (not storniert)
  const activeBuchungen = enrichedBelegungBuchungen.filter(
    b => lookupKey(b.fields.status) !== 'storniert' && b.fields.anreisedatum
  );

  // Currently checked in today
  const currentlyCheckedIn = activeBuchungen.filter(b => {
    const anr = b.fields.anreisedatum;
    const abr = b.fields.abreisedatum ?? anr;
    if (!anr) return false;
    return anr <= todayKey && (abr ?? anr) >= todayKey;
  });

  // Today's arrivals
  const todayArrivals = activeBuchungen.filter(b => b.fields.anreisedatum === todayKey);

  // Today's departures
  const todayDepartures = activeBuchungen.filter(b => b.fields.abreisedatum === todayKey);

  // Pending requests (neu)
  const pendingAnfragen = buchungsanfragen.filter(
    b => lookupKey(b.fields.anfrage_status) === 'neu'
  );

  // Occupied spots today
  const occupiedToday = currentlyCheckedIn.length;
  const totalPlätze = 12;
  const freieToday = totalPlätze - occupiedToday;

  // Context greeting line
  const anreisendHunde = todayArrivals.map(b => b.hundName).filter(Boolean);
  const abreisendHunde = todayDepartures.map(b => b.hundName).filter(Boolean);

  let contextLine: string;
  if (anreisendHunde.length > 0 && abreisendHunde.length > 0) {
    contextLine = tx`${namen(anreisendHunde)} reist heute an — ${namen(abreisendHunde)} reist ab.`;
  } else if (anreisendHunde.length > 0) {
    contextLine = tx`${namen(anreisendHunde)} kommt heute an.`;
  } else if (abreisendHunde.length > 0) {
    contextLine = tx`${namen(abreisendHunde)} reist heute ab.`;
  } else if (currentlyCheckedIn.length > 0) {
    contextLine = tx`${currentlyCheckedIn.length} ${currentlyCheckedIn.length === 1 ? tx('Hund') : tx('Hunde')} aktuell zu Gast.`;
  } else {
    contextLine = tx('Alle Plätze frei — bereit für neue Gäste.');
  }

  // Hero: pending requests are urgent
  const hasUrgentAnfragen = pendingAnfragen.length > 0;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {gruss(clock)}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{contextLine}</p>
        </div>
        <button
          onClick={() => crud.belegungBuchungen.openCreate({ status: 'aktiv' })}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <IconCalendarPlus size={16} className="shrink-0" />
          {tx('Neue Buchung')}
        </button>
      </div>

      <DashboardGrid
        variant="wide"
        hero={hasUrgentAnfragen && (
          <HeroBanner
            icon={<IconAlertTriangle size={18} />}
            action={{
              label: tx('Jetzt bestätigen'),
              onClick: () => crud.buchungsanfragen.openDetail(pendingAnfragen[0]),
            }}
          >
            <b>{pendingAnfragen.length} {pendingAnfragen.length === 1 ? tx('neue Buchungsanfrage') : tx('neue Buchungsanfragen')}</b>
            {' — '}
            {namen(pendingAnfragen.map(a => `${a.fields.interessent_vorname ?? ''} ${a.fields.interessent_nachname ?? ''}`.trim()))}
          </HeroBanner>
        )}
        kpis={
          <StatStrip>
            <StatStripItem
              title={tx('Belegt heute')}
              value={`${occupiedToday}/${totalPlätze}`}
              icon={<IconBed size={16} className="shrink-0" />}
              tone={occupiedToday === totalPlätze ? 'destructive' : occupiedToday > 8 ? 'warning' : 'default'}
            />
            <StatStripItem
              title={tx('Freie Plätze')}
              value={freieToday}
              icon={<IconDog size={16} className="shrink-0" />}
              tone={freieToday === 0 ? 'destructive' : 'success'}
            />
            <StatStripItem
              title={tx('Anreisen heute')}
              value={todayArrivals.length}
              tone={todayArrivals.length > 0 ? 'primary' : 'default'}
            />
            <StatStripItem
              title={tx('Abreisen heute')}
              value={todayDepartures.length}
              tone={todayDepartures.length > 0 ? 'warning' : 'default'}
            />
            <StatStripItem
              title={tx('Anfragen')}
              value={pendingAnfragen.length}
              tone={pendingAnfragen.length > 0 ? 'warning' : 'default'}
              onClick={() => pendingAnfragen.length > 0 ? crud.buchungsanfragen.openDetail(pendingAnfragen[0]) : undefined}
              active={false}
            />
          </StatStrip>
        }
        primary={
          <ResourceTimeline
            events={events}
            groups={groups}
            axis="day"
            defaultRange="week"
            defaultDate={clock}
            locale={dateFnsLocale()}
            onEventClick={ev => {
              const recId = ev.id.split(':')[1] ?? '';
              const rec = enrichedBelegungBuchungen.find(b => b.record_id === recId);
              if (rec) crud.belegungBuchungen.openDetail(rec);
            }}
            onEventDrop={reschedule}
            onEventResize={resize}
            onRangeCreate={(start, end, group) => {
              crud.belegungBuchungen.openCreate({
                anreisedatum: format(start, 'yyyy-MM-dd'),
                abreisedatum: format(end, 'yyyy-MM-dd'),
                platznummer: group,
                status: 'aktiv',
              });
            }}
            onEmptyClick={(date, group) => {
              crud.belegungBuchungen.openCreate({
                anreisedatum: format(date, 'yyyy-MM-dd'),
                platznummer: group,
                status: 'aktiv',
              });
            }}
            renderGroupHeader={group => {
              const occupied = events.filter(e => e.group === group.key).length;
              return (
                <div className="flex w-full items-center justify-between gap-1.5">
                  <span className="truncate text-sm font-medium">{group.label}</span>
                  {occupied > 0 && (
                    <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary tabular-nums">
                      {occupied}
                    </span>
                  )}
                </div>
              );
            }}
            renderEvent={(ev, meta) => (
              <div className="flex items-center gap-1 truncate text-xs">
                <IconDog className="h-3 w-3 shrink-0" />
                {meta.isStart && <span className="truncate">{ev.title}</span>}
              </div>
            )}
          />
        }
        aside={
          <>
            {/* Heute: Anreisen & Abreisen */}
            <WorkList
              title={tx('Heute')}
              items={[
                ...todayArrivals.map(b => ({
                  id: `anreise:${b.record_id}`,
                  title: b.hundName || tx('Unbekannter Hund'),
                  secondLine: (
                    <>
                      <span className="font-medium text-primary">{tx('Anreise')}</span>
                      <span className="text-muted-foreground"> · {b.besitzerName}</span>
                      {b.fields.platznummer && (
                        <span className="text-muted-foreground"> · {b.fields.platznummer.label}</span>
                      )}
                    </>
                  ),
                  action: {
                    label: tx('Eingecheckt'),
                    onClick: () => {
                      const prev = belegungBuchungen;
                      setBelegungBuchungen(bs =>
                        bs.map(x =>
                          x.record_id === b.record_id
                            ? { ...x, fields: { ...x.fields, status: lookupOption('belegung_buchungen', 'status', 'aktiv') } }
                            : x
                        )
                      );
                      undoToast(
                        tx`${b.hundName} — eingecheckt`,
                        async () => {
                          setBelegungBuchungen(prev);
                          await LivingAppsService.updateBelegungBuchungenEntry(b.record_id, { status: 'aktiv' });
                        }
                      );
                      LivingAppsService.updateBelegungBuchungenEntry(b.record_id, { status: 'aktiv' }).catch(() => {
                        setBelegungBuchungen(prev);
                        fetchAll();
                      });
                    },
                  },
                })),
                ...todayDepartures.map(b => ({
                  id: `abreise:${b.record_id}`,
                  title: b.hundName || tx('Unbekannter Hund'),
                  secondLine: (
                    <>
                      <span className="font-medium text-amber-600">{tx('Abreise')}</span>
                      <span className="text-muted-foreground"> · {b.besitzerName}</span>
                      {b.fields.platznummer && (
                        <span className="text-muted-foreground"> · {b.fields.platznummer.label}</span>
                      )}
                    </>
                  ),
                  action: {
                    label: tx('Ausgecheckt'),
                    onClick: () => {
                      const prev = belegungBuchungen;
                      setBelegungBuchungen(bs =>
                        bs.map(x =>
                          x.record_id === b.record_id
                            ? { ...x, fields: { ...x.fields, status: lookupOption('belegung_buchungen', 'status', 'abgeschlossen') } }
                            : x
                        )
                      );
                      undoToast(
                        tx`${b.hundName} — ausgecheckt`,
                        async () => {
                          setBelegungBuchungen(prev);
                          await LivingAppsService.updateBelegungBuchungenEntry(b.record_id, { status: 'aktiv' });
                        }
                      );
                      LivingAppsService.updateBelegungBuchungenEntry(b.record_id, { status: 'abgeschlossen' }).catch(() => {
                        setBelegungBuchungen(prev);
                        fetchAll();
                      });
                    },
                  },
                })),
              ]}
              onItemClick={id => {
                const recId = id.split(':')[1] ?? '';
                const rec = enrichedBelegungBuchungen.find(b => b.record_id === recId);
                if (rec) crud.belegungBuchungen.openDetail(rec);
              }}
              empty={{
                text: tx('Keine Bewegungen heute — ruhiger Tag!'),
                action: {
                  label: tx('Buchung anlegen'),
                  onClick: () => crud.belegungBuchungen.openCreate({ status: 'aktiv' }),
                },
              }}
              max={6}
            />

            {/* Buchungsanfragen */}
            <WorkList
              title={tx('Neue Anfragen')}
              items={pendingAnfragen.map(a => ({
                id: a.record_id,
                title: `${a.fields.hund_name ?? tx('Hund')} · ${a.fields.interessent_vorname ?? ''} ${a.fields.interessent_nachname ?? ''}`.trim(),
                secondLine: (
                  <>
                    <span className="font-medium text-amber-600">{tx('Unbeantwortet')}</span>
                    {a.fields.wunsch_anreise && (
                      <span className="text-muted-foreground">
                        {' · '}{formatDate(a.fields.wunsch_anreise)}
                        {a.fields.wunsch_abreise ? ` – ${formatDate(a.fields.wunsch_abreise)}` : ''}
                      </span>
                    )}
                  </>
                ),
                action: {
                  label: tx('Bestätigen'),
                  onClick: () => confirmAnfrage(a),
                },
              }))}
              onItemClick={id => {
                const rec = buchungsanfragen.find(a => a.record_id === id);
                if (rec) crud.buchungsanfragen.openDetail(rec);
              }}
              empty={{
                text: tx('Keine offenen Anfragen — alles bearbeitet.'),
                action: undefined,
              }}
              max={5}
            />
          </>
        }
      />

      {crud.surfaces}
    </div>
  );
}
