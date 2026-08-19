import { useDashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import { DashboardSkeleton, DashboardError } from '@/components/DashboardStates';
import { DashboardGrid } from '@/components/DashboardGrid';
import { WorkList } from '@/components/WorkList';
import { HeroBanner } from '@/components/HeroBanner';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import { tx, appLabel, dateFnsLocale, lookupLabel } from '@/i18n';
import { format, parseISO, isSameDay, isAfter, isBefore, isWithinInterval } from 'date-fns';
import { formatDate, formatCurrency, lookupKey } from '@/lib/formatters';
import { LOOKUP_OPTIONS, APP_IDS, lookupOption } from '@/types/app';
import { LivingAppsService, extractRecordId, createRecordUrl } from '@/services/livingAppsService';
import { useState, useMemo, useCallback } from 'react';
import {
  ResourceTimeline,
  ResourceTimelineSkeleton,
  ResourceTimelineError,
  type ResourceEvent,
  type ResourceGroup,
} from '@/components/widgets/ResourceTimeline';
import {
  IconDog,
  IconAlertCircle,
  IconCalendar,
  IconLogout,
  IconLogin,
  IconClipboardList,
  IconCheck,
  IconX,
} from '@tabler/icons-react';


function buchungIdOf(id: string): string {
  return id.split(':')[1] ?? '';
}

export default function DashboardOverview() {
  const clock = useClock();
  const data = useDashboardData();
  const {
    besitzer, hundekartei, belegungBuchungen, buchungsanfragen,
    besitzerMap, hundekarteiMap,
    loading, error, fetchAll,
    setBelegungBuchungen, setBuchungsanfragen,
  } = data;

  const crud = useEntityCrud(data, {
    footer: (top) => {
      if (top.type === 'buchungsanfragen') {
        const anfrage = buchungsanfragen.find(a => a.record_id === top.record.record_id);
        const status = lookupKey(anfrage?.fields.anfrage_status);
        if (status === 'neu') {
          return {
            label: tx('Anfrage bestätigen'),
            onClick: () => confirmAnfrage(top.record.record_id),
          };
        }
      }
      return undefined;
    },
  });
  const enrichedBelegungBuchungen = crud.enriched.belegungBuchungen;

  // ─── All hooks ABOVE the early returns ───

  const [timelineError, setTimelineError] = useState<Error | null>(null);

  // 12 feste Plätze als Gruppen — muss im Component-Body stehen (locale-aware getter)
  const platzGroups = useMemo<ResourceGroup[]>(
    () =>
      LOOKUP_OPTIONS['belegung_buchungen']?.['platznummer']?.map(o => ({
        key: o.key,
        label: o.label,
      })) ?? [],
    []
  );

  const today = format(clock, 'yyyy-MM-dd');

  // KPI-Berechnungen
  const aktiveBuchungen = useMemo(
    () => enrichedBelegungBuchungen.filter(b => lookupKey(b.fields.status) === 'aktiv'),
    [enrichedBelegungBuchungen]
  );

  const heuteBelegte = useMemo(() => {
    return aktiveBuchungen.filter(b => {
      if (!b.fields.anreisedatum) return false;
      const anreise = b.fields.anreisedatum;
      const abreise = b.fields.abreisedatum;
      if (!abreise) return anreise <= today;
      return anreise <= today && abreise >= today;
    });
  }, [aktiveBuchungen, today]);

  const heuteAnreise = useMemo(
    () => aktiveBuchungen.filter(b => b.fields.anreisedatum === today),
    [aktiveBuchungen, today]
  );

  const heuteAbreise = useMemo(
    () => aktiveBuchungen.filter(b => b.fields.abreisedatum === today),
    [aktiveBuchungen, today]
  );

  const neueAnfragen = useMemo(
    () => buchungsanfragen.filter(a => lookupKey(a.fields.anfrage_status) === 'neu'),
    [buchungsanfragen]
  );

  // Events für ResourceTimeline (nur aktive Buchungen)
  const events = useMemo<ResourceEvent[]>(
    () =>
      aktiveBuchungen
        .filter(b => !!b.fields.anreisedatum && !!b.fields.platznummer)
        .map(b => {
          const platzKey = lookupKey(b.fields.platznummer) ?? '';
          const isToday = b.fields.anreisedatum === today;
          return {
            id: `buchung:${b.record_id}`,
            start: b.fields.anreisedatum!,
            end: b.fields.abreisedatum,
            allDay: true,
            title: b.hundName || b.besitzerName || tx('Buchung'),
            subtitle: b.besitzerName,
            tone: isToday ? 'success' : 'primary',
            group: platzKey,
          };
        }),
    [aktiveBuchungen, today]
  );

  // Reschedule via Drag
  const handleEventDrop = useCallback(
    async (id: string, newStart: string, newEnd?: string, newGroup?: string) => {
      const rid = buchungIdOf(id);
      if (!rid) return;

      // Kapazitäts-Check: Doppelbelegung verhindern
      const isConflict = enrichedBelegungBuchungen.some(b => {
        if (b.record_id === rid) return false;
        if (lookupKey(b.fields.status) !== 'aktiv') return false;
        if (!newGroup || lookupKey(b.fields.platznummer) !== newGroup) return false;
        const bStart = b.fields.anreisedatum;
        const bEnd = b.fields.abreisedatum ?? bStart;
        if (!bStart) return false;
        const end = newEnd ?? newStart;
        return newStart <= (bEnd ?? bStart) && end >= bStart;
      });

      if (isConflict) {
        return tx('Dieser Platz ist im gewählten Zeitraum bereits belegt.');
      }

      const platzPatch = newGroup
        ? { platznummer: lookupOption('belegung_buchungen', 'platznummer', newGroup) }
        : {};
      const prevBuchungen = [...enrichedBelegungBuchungen];

      setBelegungBuchungen(prev =>
        prev.map(b =>
          b.record_id === rid
            ? {
                ...b,
                fields: {
                  ...b.fields,
                  anreisedatum: newStart,
                  ...(newEnd ? { abreisedatum: newEnd } : {}),
                  ...(newGroup ? { platznummer: lookupOption('belegung_buchungen', 'platznummer', newGroup) } : {}),
                },
              }
            : b
        )
      );

      try {
        await LivingAppsService.updateBelegungBuchungenEntry(rid, {
          anreisedatum: newStart,
          ...(newEnd ? { abreisedatum: newEnd } : {}),
          ...(newGroup ? { platznummer: newGroup } : {}),
        });
        undoToast(tx`Buchung verschoben`, () => {
          const orig = prevBuchungen.find(b => b.record_id === rid);
          if (!orig) return;
          setBelegungBuchungen(prev =>
            prev.map(b => (b.record_id === rid ? orig : b))
          );
          LivingAppsService.updateBelegungBuchungenEntry(rid, {
            anreisedatum: orig.fields.anreisedatum,
            abreisedatum: orig.fields.abreisedatum,
            platznummer: lookupKey(orig.fields.platznummer),
          }).catch(() => fetchAll());
        });
      } catch {
        await fetchAll();
      }
    },
    [enrichedBelegungBuchungen, setBelegungBuchungen, fetchAll]
  );

  // Resize
  const handleEventResize = useCallback(
    async (id: string, newStart: string, newEnd: string) => {
      const rid = buchungIdOf(id);
      if (!rid) return;
      const prevBuchungen = [...enrichedBelegungBuchungen];

      setBelegungBuchungen(prev =>
        prev.map(b =>
          b.record_id === rid
            ? { ...b, fields: { ...b.fields, anreisedatum: newStart, abreisedatum: newEnd } }
            : b
        )
      );

      try {
        await LivingAppsService.updateBelegungBuchungenEntry(rid, {
          anreisedatum: newStart,
          abreisedatum: newEnd,
        });
        undoToast(tx`Aufenthalt angepasst`, () => {
          const orig = prevBuchungen.find(b => b.record_id === rid);
          if (!orig) return;
          setBelegungBuchungen(prev =>
            prev.map(b => (b.record_id === rid ? orig : b))
          );
          LivingAppsService.updateBelegungBuchungenEntry(rid, {
            anreisedatum: orig.fields.anreisedatum,
            abreisedatum: orig.fields.abreisedatum,
          }).catch(() => fetchAll());
        });
      } catch {
        await fetchAll();
      }
    },
    [enrichedBelegungBuchungen, setBelegungBuchungen, fetchAll]
  );

  // Anfrage bestätigen → wird zur Buchung
  const confirmAnfrage = useCallback(
    async (anfragenId: string) => {
      const anfrage = buchungsanfragen.find(a => a.record_id === anfragenId);
      if (!anfrage) return;
      const prevAnfragen = [...buchungsanfragen];

      setBuchungsanfragen(prev =>
        prev.map(a =>
          a.record_id === anfragenId
            ? { ...a, fields: { ...a.fields, anfrage_status: lookupOption('buchungsanfragen', 'anfrage_status', 'bestaetigt') } }
            : a
        )
      );

      try {
        await LivingAppsService.updateBuchungsanfragenEntry(anfragenId, {
          anfrage_status: 'bestaetigt',
        });
        undoToast(
          tx`Anfrage von ${anfrage.fields.interessent_vorname ?? ''} ${anfrage.fields.interessent_nachname ?? ''} bestätigt`,
          () => {
            setBuchungsanfragen(prev =>
              prev.map(a => (a.record_id === anfragenId ? (prevAnfragen.find(p => p.record_id === anfragenId) ?? a) : a))
            );
            LivingAppsService.updateBuchungsanfragenEntry(anfragenId, {
              anfrage_status: 'neu',
            }).catch(() => fetchAll());
          }
        );
      } catch {
        await fetchAll();
      }
    },
    [buchungsanfragen, setBuchungsanfragen, fetchAll]
  );

  // Anfrage ablehnen
  const rejectAnfrage = useCallback(
    async (anfragenId: string) => {
      const anfrage = buchungsanfragen.find(a => a.record_id === anfragenId);
      if (!anfrage) return;
      const prevAnfragen = [...buchungsanfragen];

      setBuchungsanfragen(prev =>
        prev.map(a =>
          a.record_id === anfragenId
            ? { ...a, fields: { ...a.fields, anfrage_status: lookupOption('buchungsanfragen', 'anfrage_status', 'abgelehnt') } }
            : a
        )
      );

      try {
        await LivingAppsService.updateBuchungsanfragenEntry(anfragenId, {
          anfrage_status: 'abgelehnt',
        });
        undoToast(
          tx`Anfrage abgelehnt`,
          () => {
            setBuchungsanfragen(prev =>
              prev.map(a => (a.record_id === anfragenId ? (prevAnfragen.find(p => p.record_id === anfragenId) ?? a) : a))
            );
            LivingAppsService.updateBuchungsanfragenEntry(anfragenId, {
              anfrage_status: 'neu',
            }).catch(() => fetchAll());
          }
        );
      } catch {
        await fetchAll();
      }
    },
    [buchungsanfragen, setBuchungsanfragen, fetchAll]
  );

  // Kontext-Satz für Begrüßung
  const contextLine = useMemo(() => {
    const names: string[] = [];
    heuteAnreise.forEach(b => { if (b.besitzerName) names.push(b.besitzerName); });
    heuteAbreise.forEach(b => { if (b.besitzerName) names.push(b.besitzerName); });
    if (heuteAnreise.length > 0 && heuteAbreise.length > 0) {
      return tx`Heute reisen ${namen(heuteAnreise.map(b => b.hundName || b.besitzerName))} an und ${namen(heuteAbreise.map(b => b.hundName || b.besitzerName))} ab.`;
    }
    if (heuteAnreise.length > 0) {
      return tx`Heute ${heuteAnreise.length === 1 ? tx('kommt') : tx('kommen')} ${namen(heuteAnreise.map(b => b.hundName || b.besitzerName))} an.`;
    }
    if (heuteAbreise.length > 0) {
      return tx`Heute ${heuteAbreise.length === 1 ? tx('reist') : tx('reisen')} ${namen(heuteAbreise.map(b => b.hundName || b.besitzerName))} ab.`;
    }
    if (heuteBelegte.length > 0) {
      return tx`${heuteBelegte.length} von 12 Plätzen sind heute belegt.`;
    }
    return tx('Alle Plätze frei — perfekter Moment für eine neue Buchung.');
  }, [heuteAnreise, heuteAbreise, heuteBelegte]);

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  // ─── Plain derivations ───

  const freierPlätze = 12 - heuteBelegte.length;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{gruss(clock)}</h1>
          <p className="mt-1 text-muted-foreground">{contextLine}</p>
        </div>
        <button
          className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          onClick={() => crud.belegungBuchungen.openCreate({ status: 'aktiv', anreisedatum: today })}
        >
          {tx('Neue Buchung')}
        </button>
      </div>

      <DashboardGrid
        variant="wide"
        hero={
          neueAnfragen.length > 0 ? (
            <HeroBanner
              icon={<IconAlertCircle size={18} />}
              action={{
                label: tx('Anfrage bestätigen'),
                onClick: () => confirmAnfrage(neueAnfragen[0].record_id),
              }}
            >
              <b>
                {namen(
                  neueAnfragen.map(
                    a =>
                      `${a.fields.interessent_vorname ?? ''} ${a.fields.interessent_nachname ?? ''}`.trim() ||
                      a.fields.hund_name ||
                      tx('Unbekannt')
                  )
                )}
              </b>{' '}
              {neueAnfragen.length === 1
                ? tx('hat eine unverbindliche Buchungsanfrage gestellt.')
                : tx('haben unverbindliche Buchungsanfragen gestellt.')}
            </HeroBanner>
          ) : undefined
        }
        kpis={
          <StatStrip>
            <StatStripItem
              title={tx('Heute belegt')}
              value={`${heuteBelegte.length} / 12`}
              icon={<IconDog size={16} className="shrink-0" />}
              tone={heuteBelegte.length >= 11 ? 'warning' : heuteBelegte.length > 0 ? 'primary' : 'default'}
            />
            <StatStripItem
              title={tx('Heute Anreise')}
              value={heuteAnreise.length}
              icon={<IconLogin size={16} className="shrink-0" />}
              tone={heuteAnreise.length > 0 ? 'success' : 'default'}
            />
            <StatStripItem
              title={tx('Heute Abreise')}
              value={heuteAbreise.length}
              icon={<IconLogout size={16} className="shrink-0" />}
              tone={heuteAbreise.length > 0 ? 'warning' : 'default'}
            />
            <StatStripItem
              title={tx('Neue Anfragen')}
              value={neueAnfragen.length}
              icon={<IconClipboardList size={16} className="shrink-0" />}
              tone={neueAnfragen.length > 0 ? 'destructive' : 'default'}
            />
          </StatStrip>
        }
        primary={
          enrichedBelegungBuchungen.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 gap-4 text-center">
              <IconCalendar size={48} className="text-muted-foreground" />
              <div>
                <p className="font-semibold text-foreground">{tx('Noch keine Buchungen')}</p>
                <p className="text-sm text-muted-foreground mt-1">{tx('Lege die erste Buchung an, um den Belegungsplan zu füllen.')}</p>
              </div>
              <button
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                onClick={() => crud.belegungBuchungen.openCreate({ status: 'aktiv', anreisedatum: today })}
              >
                {tx('Erste Buchung anlegen')}
              </button>
            </div>
          ) : (
            <ResourceTimeline
              events={events}
              groups={platzGroups}
              axis="day"
              defaultRange="week"
              locale={dateFnsLocale()}
              onEventClick={ev => {
                const rid = buchungIdOf(ev.id);
                const rec = enrichedBelegungBuchungen.find(b => b.record_id === rid);
                if (rec) crud.belegungBuchungen.openDetail(rec);
              }}
              onEventDrop={handleEventDrop}
              onEventResize={handleEventResize}
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
              cellClassName={(date, _group) => {
                const d = format(date, 'yyyy-MM-dd');
                return d === today ? 'bg-primary/5' : '';
              }}
            />
          )
        }
        aside={
          <>
            <WorkList
              title={tx('Heute an- & abreisend')}
              items={[
                ...heuteAnreise.map(b => ({
                  id: `an-${b.record_id}`,
                  title: b.hundName || b.besitzerName || tx('Hund'),
                  secondLine: (
                    <>
                      <span className="font-medium text-emerald-600">{tx('Anreise')}</span>
                      <span className="text-muted-foreground"> · {b.besitzerName}</span>
                      {b.fields.platznummer?.label && (
                        <span className="text-muted-foreground"> · {b.fields.platznummer.label}</span>
                      )}
                    </>
                  ),
                  action: {
                    label: tx('Details'),
                    onClick: () => crud.belegungBuchungen.openDetail(b),
                  },
                })),
                ...heuteAbreise.map(b => ({
                  id: `ab-${b.record_id}`,
                  title: b.hundName || b.besitzerName || tx('Hund'),
                  secondLine: (
                    <>
                      <span className="font-medium text-amber-600">{tx('Abreise')}</span>
                      <span className="text-muted-foreground"> · {b.besitzerName}</span>
                      {b.fields.platznummer?.label && (
                        <span className="text-muted-foreground"> · {b.fields.platznummer.label}</span>
                      )}
                    </>
                  ),
                  action: {
                    label: tx('Abschließen'),
                    onClick: async () => {
                      const prev = { ...b.fields };
                      setBelegungBuchungen(bs =>
                        bs.map(x =>
                          x.record_id === b.record_id
                            ? { ...x, fields: { ...x.fields, status: lookupOption('belegung_buchungen', 'status', 'abgeschlossen') } }
                            : x
                        )
                      );
                      try {
                        await LivingAppsService.updateBelegungBuchungenEntry(b.record_id, { status: 'abgeschlossen' });
                        undoToast(tx`${b.hundName || b.besitzerName || ''} abgereist`, () => {
                          setBelegungBuchungen(bs =>
                            bs.map(x =>
                              x.record_id === b.record_id
                                ? { ...x, fields: { ...x.fields, status: lookupOption('belegung_buchungen', 'status', 'aktiv') } }
                                : x
                            )
                          );
                          LivingAppsService.updateBelegungBuchungenEntry(b.record_id, { status: 'aktiv' }).catch(() => fetchAll());
                        });
                      } catch {
                        fetchAll();
                      }
                    },
                  },
                })),
              ]}
              onItemClick={id => {
                const rid = id.replace(/^(an|ab)-/, '');
                const rec = enrichedBelegungBuchungen.find(b => b.record_id === rid);
                if (rec) crud.belegungBuchungen.openDetail(rec);
              }}
              empty={{
                text: tx('Heute reist niemand an oder ab.'),
                action: {
                  label: tx('Buchung anlegen'),
                  onClick: () => crud.belegungBuchungen.openCreate({ status: 'aktiv', anreisedatum: today }),
                },
              }}
            />

            <WorkList
              title={tx('Neue Buchungsanfragen')}
              items={neueAnfragen.map(a => ({
                id: a.record_id,
                title: `${a.fields.hund_name ?? tx('Hund')} (${[a.fields.interessent_vorname, a.fields.interessent_nachname].filter(Boolean).join(' ') || tx('Interessent')})`,
                secondLine: (
                  <>
                    <span className="font-medium text-destructive">{tx('Neu')}</span>
                    {a.fields.wunsch_anreise && (
                      <span className="text-muted-foreground">
                        {' '}· {formatDate(a.fields.wunsch_anreise)}
                        {a.fields.wunsch_abreise ? ` – ${formatDate(a.fields.wunsch_abreise)}` : ''}
                      </span>
                    )}
                  </>
                ),
                action: {
                  label: tx('Bestätigen'),
                  onClick: () => confirmAnfrage(a.record_id),
                },
              }))}
              onItemClick={id => {
                const rec = buchungsanfragen.find(a => a.record_id === id);
                if (rec) crud.buchungsanfragen.openDetail(rec);
              }}
              empty={{
                text: tx('Keine neuen Anfragen — alles bearbeitet.'),
                action: {
                  label: tx('Anfrage erfassen'),
                  onClick: () => crud.buchungsanfragen.openCreate({ anfrage_status: 'neu' }),
                },
              }}
            />
          </>
        }
      />

      {crud.surfaces}
    </div>
  );
}
