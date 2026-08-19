import { useMemo, useState, useCallback } from 'react';
import { format, parseISO, isSameDay, isAfter, isBefore, addDays } from 'date-fns';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import { DashboardSkeleton, DashboardError } from '@/components/DashboardStates';
import { DashboardGrid } from '@/components/DashboardGrid';
import { HeroBanner } from '@/components/HeroBanner';
import { WorkList } from '@/components/WorkList';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { ResourceTimeline, type ResourceEvent, type ResourceGroup } from '@/components/widgets/ResourceTimeline';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import { dateFnsLocale } from '@/i18n';
import { tx, appLabel } from '@/i18n';
import { LOOKUP_OPTIONS, lookupOption, APP_IDS } from '@/types/app';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import { formatDate, formatCurrency, lookupKey } from '@/lib/formatters';
import {
  IconPaw,
  IconCalendarPlus,
  IconCheck,
  IconX,
  IconAlertCircle,
  IconDoor,
  IconDoorExit,
} from '@tabler/icons-react';

export default function DashboardOverview() {
  const data = useDashboardData();
  const {
    besitzer, hundekartei, belegungBuchungen, setBelegungBuchungen,
    buchungsanfragen, setBuchungsanfragen,
    besitzerMap, hundekarteiMap,
    loading, error, fetchAll,
  } = data;

  const crud = useEntityCrud(data, {
    footer: (top) => {
      if (top.type === 'buchungsanfragen') {
        const rec = top.record as typeof buchungsanfragen[0];
        if (rec.fields.anfrage_status?.key === 'neu') {
          return {
            label: tx('Anfrage bestätigen'),
            onClick: () => confirmAnfrage(rec),
          };
        }
      }
      if (top.type === 'belegung_buchungen') {
        const rec = top.record as typeof belegungBuchungen[0];
        if (rec.fields.status?.key === 'aktiv') {
          return {
            label: tx('Aufenthalt abschließen'),
            onClick: () => checkoutBuchung(rec),
          };
        }
      }
      return undefined;
    },
  });

  const enrichedBelegungBuchungen = crud.enriched.belegungBuchungen;
  const enrichedPfotenPortraet = crud.enriched.pfotenPortraet;

  const clock = useClock();

  const [filter, setFilter] = useState<'all' | 'aktiv' | 'heute'>('all');

  // ─── Advance helpers — shared between hero, WorkList rows, overlay footer ────

  const confirmAnfrage = useCallback(async (anfrage: typeof buchungsanfragen[0]) => {
    const prev = [...buchungsanfragen];
    setBuchungsanfragen(bs =>
      bs.map(b => b.record_id === anfrage.record_id
        ? { ...b, fields: { ...b.fields, anfrage_status: lookupOption('buchungsanfragen', 'anfrage_status', 'bestaetigt') } }
        : b)
    );
    try {
      await LivingAppsService.updateBuchungsanfragenEntry(anfrage.record_id, { anfrage_status: 'bestaetigt' });
      undoToast(
        tx`${anfrage.fields.interessent_vorname ?? ''} ${anfrage.fields.interessent_nachname ?? ''} — Anfrage bestätigt`,
        async () => {
          setBuchungsanfragen(prev);
          await LivingAppsService.updateBuchungsanfragenEntry(anfrage.record_id, { anfrage_status: 'neu' });
        }
      );
    } catch {
      setBuchungsanfragen(prev);
      await fetchAll();
    }
  }, [buchungsanfragen, setBuchungsanfragen, fetchAll]);

  const rejectAnfrage = useCallback(async (anfrage: typeof buchungsanfragen[0]) => {
    const prev = [...buchungsanfragen];
    setBuchungsanfragen(bs =>
      bs.map(b => b.record_id === anfrage.record_id
        ? { ...b, fields: { ...b.fields, anfrage_status: lookupOption('buchungsanfragen', 'anfrage_status', 'abgelehnt') } }
        : b)
    );
    try {
      await LivingAppsService.updateBuchungsanfragenEntry(anfrage.record_id, { anfrage_status: 'abgelehnt' });
      undoToast(
        tx`${anfrage.fields.interessent_vorname ?? ''} ${anfrage.fields.interessent_nachname ?? ''} — Anfrage abgelehnt`,
        async () => {
          setBuchungsanfragen(prev);
          await LivingAppsService.updateBuchungsanfragenEntry(anfrage.record_id, { anfrage_status: 'neu' });
        }
      );
    } catch {
      setBuchungsanfragen(prev);
      await fetchAll();
    }
  }, [buchungsanfragen, setBuchungsanfragen, fetchAll]);

  const checkoutBuchung = useCallback(async (buchung: typeof belegungBuchungen[0]) => {
    const prev = [...belegungBuchungen];
    setBelegungBuchungen(bs =>
      bs.map(b => b.record_id === buchung.record_id
        ? { ...b, fields: { ...b.fields, status: lookupOption('belegung_buchungen', 'status', 'abgeschlossen') } }
        : b)
    );
    try {
      await LivingAppsService.updateBelegungBuchungenEntry(buchung.record_id, { status: 'abgeschlossen' });
      undoToast(
        tx`Aufenthalt abgeschlossen`,
        async () => {
          setBelegungBuchungen(prev);
          await LivingAppsService.updateBelegungBuchungenEntry(buchung.record_id, { status: 'aktiv' });
        }
      );
    } catch {
      setBelegungBuchungen(prev);
      await fetchAll();
    }
  }, [belegungBuchungen, setBelegungBuchungen, fetchAll]);

  // ─── ResourceTimeline data ────────────────────────────────────────────────

  const platzOptions = useMemo(
    () => LOOKUP_OPTIONS['belegung_buchungen']?.['platznummer'] ?? [],
    []
  );

  const groups = useMemo<ResourceGroup[]>(
    () => platzOptions.map(o => ({ key: o.key, label: o.label })),
    [platzOptions]
  );

  const events = useMemo<ResourceEvent[]>(() => {
    return enrichedBelegungBuchungen
      .filter(b => !!b.fields.anreisedatum && b.fields.status?.key !== 'storniert')
      .map(b => {
        const statusKey = b.fields.status?.key;
        const tone = statusKey === 'abgeschlossen' ? 'default' as const
          : statusKey === 'aktiv' ? 'primary' as const
          : 'warning' as const;
        return {
          id: `buchung:${b.record_id}`,
          start: b.fields.anreisedatum!,
          end: b.fields.abreisedatum,
          allDay: true,
          title: b.hundName || b.besitzerName || tx('Hund'),
          subtitle: b.besitzerName,
          tone,
          group: b.fields.platznummer?.key ?? '',
        };
      });
  }, [enrichedBelegungBuchungen]);

  // ─── KPI derivations ──────────────────────────────────────────────────────

  const todayStr = format(clock, 'yyyy-MM-dd');

  const aktiveBuchungen = useMemo(
    () => belegungBuchungen.filter(b => b.fields.status?.key === 'aktiv'),
    [belegungBuchungen]
  );

  const belegtePlaetze = aktiveBuchungen.length;
  const freiePlaetze = 12 - belegtePlaetze;

  const heuteAnreise = useMemo(
    () => enrichedBelegungBuchungen.filter(b =>
      b.fields.anreisedatum === todayStr && b.fields.status?.key !== 'storniert'
    ),
    [enrichedBelegungBuchungen, todayStr]
  );

  const heuteAbreise = useMemo(
    () => enrichedBelegungBuchungen.filter(b =>
      b.fields.abreisedatum === todayStr && b.fields.status?.key === 'aktiv'
    ),
    [enrichedBelegungBuchungen, todayStr]
  );

  const neueAnfragen = useMemo(
    () => buchungsanfragen.filter(a => a.fields.anfrage_status?.key === 'neu'),
    [buchungsanfragen]
  );

  // ─── Context line ─────────────────────────────────────────────────────────

  const contextLine = useMemo(() => {
    const parts: string[] = [];
    if (heuteAnreise.length > 0) {
      const namen_ = namen(heuteAnreise.map(b => b.hundName || b.besitzerName).filter(Boolean));
      parts.push(tx`${namen_} reist heute an`);
    }
    if (heuteAbreise.length > 0) {
      const namen_ = namen(heuteAbreise.map(b => b.hundName || b.besitzerName).filter(Boolean));
      parts.push(tx`${namen_} reist heute ab`);
    }
    if (parts.length === 0) {
      if (freiePlaetze === 12) return tx('Noch keine Buchungen — richte deine erste Buchung ein.');
      return tx`${belegtePlaetze} von 12 Plätzen belegt.`;
    }
    return parts.join(' · ');
  }, [heuteAnreise, heuteAbreise, freiePlaetze, belegtePlaetze]);

  // ─── Drag handlers ────────────────────────────────────────────────────────

  const handleEventDrop = useCallback(async (
    id: string,
    newStart: string,
    newEnd?: string,
    newGroup?: string
  ) => {
    const rid = id.split(':')[1] ?? '';
    if (!rid) return;
    const prev = [...belegungBuchungen];
    setBelegungBuchungen(bs =>
      bs.map(b => {
        if (b.record_id !== rid) return b;
        const platznummerPatch = newGroup
          ? { platznummer: lookupOption('belegung_buchungen', 'platznummer', newGroup) }
          : {};
        return {
          ...b,
          fields: {
            ...b.fields,
            anreisedatum: newStart,
            ...(newEnd ? { abreisedatum: newEnd } : {}),
            ...platznummerPatch,
          },
        };
      })
    );
    try {
      await LivingAppsService.updateBelegungBuchungenEntry(rid, {
        anreisedatum: newStart,
        ...(newEnd ? { abreisedatum: newEnd } : {}),
        ...(newGroup ? { platznummer: newGroup } : {}),
      });
      undoToast(tx('Buchung verschoben'), async () => {
        setBelegungBuchungen(prev);
        const original = prev.find(b => b.record_id === rid);
        if (original) {
          await LivingAppsService.updateBelegungBuchungenEntry(rid, {
            anreisedatum: original.fields.anreisedatum,
            abreisedatum: original.fields.abreisedatum,
            platznummer: lookupKey(original.fields.platznummer),
          });
        }
      });
    } catch {
      setBelegungBuchungen(prev);
      await fetchAll();
    }
  }, [belegungBuchungen, setBelegungBuchungen, fetchAll]);

  const handleEventResize = useCallback(async (id: string, newStart: string, newEnd: string) => {
    const rid = id.split(':')[1] ?? '';
    if (!rid) return;
    const prev = [...belegungBuchungen];
    setBelegungBuchungen(bs =>
      bs.map(b => b.record_id === rid
        ? { ...b, fields: { ...b.fields, anreisedatum: newStart, abreisedatum: newEnd } }
        : b)
    );
    try {
      await LivingAppsService.updateBelegungBuchungenEntry(rid, {
        anreisedatum: newStart,
        abreisedatum: newEnd,
      });
      undoToast(tx('Aufenthalt angepasst'), async () => {
        setBelegungBuchungen(prev);
        const original = prev.find(b => b.record_id === rid);
        if (original) {
          await LivingAppsService.updateBelegungBuchungenEntry(rid, {
            anreisedatum: original.fields.anreisedatum,
            abreisedatum: original.fields.abreisedatum,
          });
        }
      });
    } catch {
      setBelegungBuchungen(prev);
      await fetchAll();
    }
  }, [belegungBuchungen, setBelegungBuchungen, fetchAll]);

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  // ─── Filtered view for aside list (plain derivations — no hooks below the early returns) ──

  const anAbAktivListeResult = enrichedBelegungBuchungen
    .filter(b => {
      const today = parseISO(todayStr);
      const nextWeek = addDays(today, 7);
      const key = b.fields.status?.key;
      if (key === 'storniert') return false;
      if (filter === 'aktiv') return key === 'aktiv';
      if (filter === 'heute') {
        return b.fields.anreisedatum === todayStr || b.fields.abreisedatum === todayStr;
      }
      if (!b.fields.anreisedatum) return false;
      const anreise = parseISO(b.fields.anreisedatum);
      return !isAfter(anreise, nextWeek) && !isBefore(parseISO(b.fields.abreisedatum ?? b.fields.anreisedatum), today);
    })
    .sort((a, b_) => (a.fields.anreisedatum ?? '').localeCompare(b_.fields.anreisedatum ?? ''));

  const anAbAktivListe = anAbAktivListeResult;

  const anfragenListe = buchungsanfragen
    .filter(a => a.fields.anfrage_status?.key === 'neu')
    .sort((a, b) => (a.fields.wunsch_anreise ?? '').localeCompare(b.fields.wunsch_anreise ?? ''));

  // ─── Hero: neue Buchungsanfragen ─────────────────────────────────────────

  const heroNamen = neueAnfragen.length > 0
    ? namen(neueAnfragen.map(a =>
        [a.fields.interessent_vorname, a.fields.interessent_nachname].filter(Boolean).join(' ')
      ))
    : '';

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            {gruss(clock)}
          </h1>
          <p className="text-muted-foreground mt-0.5 text-sm">{contextLine}</p>
        </div>
        <button
          onClick={() => crud.belegungBuchungen.openCreate({ status: 'aktiv' })}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shrink-0"
        >
          <IconCalendarPlus size={16} className="shrink-0" />
          {tx('Neue Buchung')}
        </button>
      </div>

      <DashboardGrid
        variant="wide"
        hero={neueAnfragen.length > 0 && (
          <HeroBanner
            icon={<IconAlertCircle size={18} />}
            action={{
              label: tx('Jetzt bestätigen'),
              onClick: () => confirmAnfrage(neueAnfragen[0]),
            }}
          >
            <b>{heroNamen}</b>
            {neueAnfragen.length === 1
              ? tx` — neue Buchungsanfrage wartet auf Bestätigung.`
              : tx` — ${neueAnfragen.length} neue Buchungsanfragen warten auf Bestätigung.`
            }
          </HeroBanner>
        )}
        kpis={
          <StatStrip>
            <StatStripItem
              title={tx('Belegt')}
              value={`${belegtePlaetze}/12`}
              icon={<IconPaw size={16} />}
              tone={belegtePlaetze >= 12 ? 'warning' : belegtePlaetze > 0 ? 'primary' : 'default'}
              onClick={() => setFilter(f => f === 'aktiv' ? 'all' : 'aktiv')}
              active={filter === 'aktiv'}
            />
            <StatStripItem
              title={tx('Frei')}
              value={freiePlaetze}
              tone={freiePlaetze === 0 ? 'warning' : 'success'}
            />
            <StatStripItem
              title={tx('Heute Anreise')}
              value={heuteAnreise.length}
              icon={<IconDoor size={16} />}
              tone={heuteAnreise.length > 0 ? 'primary' : 'default'}
              onClick={() => setFilter(f => f === 'heute' ? 'all' : 'heute')}
              active={filter === 'heute'}
            />
            <StatStripItem
              title={tx('Heute Abreise')}
              value={heuteAbreise.length}
              icon={<IconDoorExit size={16} />}
              tone={heuteAbreise.length > 0 ? 'warning' : 'default'}
            />
            <StatStripItem
              title={tx('Anfragen')}
              value={neueAnfragen.length}
              icon={<IconAlertCircle size={16} />}
              tone={neueAnfragen.length > 0 ? 'destructive' : 'default'}
            />
          </StatStrip>
        }
        primary={
          belegtePlaetze === 0 && belegungBuchungen.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
              <IconPaw size={48} className="text-muted-foreground" stroke={1.5} />
              <div>
                <p className="font-semibold text-foreground">{tx('Noch keine Buchungen')}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {tx('Lege deine erste Buchung an, um den Belegungsplan zu füllen.')}
                </p>
              </div>
              <button
                onClick={() => crud.belegungBuchungen.openCreate({})}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <IconCalendarPlus size={16} />
                {tx('Erste Buchung anlegen')}
              </button>
            </div>
          ) : (
            <ResourceTimeline
              events={events}
              groups={groups}
              axis="day"
              defaultRange="week"
              locale={dateFnsLocale()}
              onEventClick={ev => {
                const rid = ev.id.split(':')[1] ?? '';
                const rec = belegungBuchungen.find(b => b.record_id === rid);
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
            />
          )
        }
        aside={
          <>
            <WorkList
              title={tx('Buchungen')}
              items={anAbAktivListe.map(b => {
                const isHeuteAn = b.fields.anreisedatum === todayStr;
                const isHeuteAb = b.fields.abreisedatum === todayStr;
                const statusKey = b.fields.status?.key;
                return {
                  id: b.record_id,
                  title: b.hundName || tx('Unbekannter Hund'),
                  secondLine: (
                    <>
                      <span className={`font-medium ${
                        isHeuteAn ? 'text-primary' :
                        isHeuteAb ? 'text-amber-600' :
                        statusKey === 'aktiv' ? 'text-emerald-600' : 'text-muted-foreground'
                      }`}>
                        {isHeuteAn ? tx('Anreise heute') :
                         isHeuteAb ? tx('Abreise heute') :
                         statusKey === 'aktiv' ? tx('Aktiv') :
                         statusKey === 'abgeschlossen' ? tx('Abgeschlossen') : tx('Storniert')}
                      </span>
                      <span className="text-muted-foreground">
                        {' · '}{b.besitzerName}
                        {b.fields.platznummer ? ` · ${b.fields.platznummer.label}` : ''}
                      </span>
                    </>
                  ),
                  action: statusKey === 'aktiv' ? {
                    label: tx('Abschließen'),
                    onClick: () => checkoutBuchung(b),
                  } : undefined,
                };
              })}
              onItemClick={id => {
                const rec = belegungBuchungen.find(b => b.record_id === id);
                if (rec) crud.belegungBuchungen.openDetail(rec);
              }}
              empty={{
                text: tx('Keine Buchungen in den nächsten 7 Tagen.'),
                action: { label: tx('Buchung anlegen'), onClick: () => crud.belegungBuchungen.openCreate({ status: 'aktiv' }) },
              }}
            />
            <WorkList
              title={tx('Buchungsanfragen')}
              items={anfragenListe.map(a => ({
                id: a.record_id,
                title: `${a.fields.hund_name ?? tx('Hund')} (${[a.fields.interessent_vorname, a.fields.interessent_nachname].filter(Boolean).join(' ')})`,
                secondLine: (
                  <>
                    <span className="font-medium text-amber-600">{tx('Neu')}</span>
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
                text: tx('Keine neuen Anfragen — alles bearbeitet.'),
                action: { label: tx('Alle Anfragen'), onClick: () => crud.buchungsanfragen.openCreate({}) },
              }}
            />
          </>
        }
      />

      {crud.surfaces}
    </div>
  );
}
