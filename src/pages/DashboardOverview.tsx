import { useMemo, useState, useCallback } from 'react';
import { format, parseISO, isToday, isBefore, startOfDay, addDays } from 'date-fns';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import { DashboardSkeleton, DashboardError } from '@/components/DashboardStates';
import { DashboardGrid } from '@/components/DashboardGrid';
import { HeroBanner } from '@/components/HeroBanner';
import { WorkList } from '@/components/WorkList';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { ResourceTimeline, type ResourceEvent, type ResourceGroup, type ResourceTone } from '@/components/widgets/ResourceTimeline';
import { tx, appLabel } from '@/i18n';
import { formatDate, lookupKey } from '@/lib/formatters';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import { LivingAppsService, extractRecordId, createRecordUrl } from '@/services/livingAppsService';
import { LOOKUP_OPTIONS, APP_IDS, lookupOption } from '@/types/app';
import type { BelegungBuchungen, Buchungsanfragen } from '@/types/app';
import { dateFnsLocale } from '@/i18n';
import {
  IconPaw,
  IconCalendarCheck,
  IconCalendarX,
  IconUsers,
  IconAlertTriangle,
  IconCheck,
  IconX,
  IconPlus,
  IconDog,
} from '@tabler/icons-react';

const PLATZ_OPTIONS = LOOKUP_OPTIONS['belegung_buchungen']?.['platznummer'] ?? [];

// Tone for a booking based on status
function toneForBuchung(b: BelegungBuchungen): ResourceTone {
  const s = lookupKey(b.fields.status);
  if (s === 'aktiv') return 'success';
  if (s === 'storniert') return 'destructive';
  return 'default';
}

export default function DashboardOverview() {
  const data = useDashboardData();
  const {
    belegungBuchungen, setBelegungBuchungen,
    buchungsanfragen, setBuchungsanfragen,
    hundekartei,
    besitzer,
    loading, error, fetchAll,
  } = data;

  const crud = useEntityCrud(data, {
    footer: (top) => {
      if (top.type === 'buchungsanfragen') {
        const anfrage = buchungsanfragen.find(a => a.record_id === top.record.record_id);
        const status = lookupKey(anfrage?.fields.anfrage_status);
        if (status === 'neu') {
          return {
            label: tx('Anfrage bestätigen'),
            onClick: () => confirmAnfrage(top.record as Buchungsanfragen),
          };
        }
      }
      return undefined;
    },
  });

  const enrichedBelegungBuchungen = crud.enriched.belegungBuchungen;

  const clock = useClock();

  // --- Derived data (all hooks above the returns) ---
  const todayKey = format(clock, 'yyyy-MM-dd');

  const anreisenHeute = useMemo(
    () => enrichedBelegungBuchungen.filter(b => b.fields.anreisedatum === todayKey && lookupKey(b.fields.status) === 'aktiv'),
    [enrichedBelegungBuchungen, todayKey],
  );

  const abreisenHeute = useMemo(
    () => enrichedBelegungBuchungen.filter(b => b.fields.abreisedatum === todayKey && lookupKey(b.fields.status) === 'aktiv'),
    [enrichedBelegungBuchungen, todayKey],
  );

  const aktiveAnfragen = useMemo(
    () => buchungsanfragen.filter(a => lookupKey(a.fields.anfrage_status) === 'neu'),
    [buchungsanfragen],
  );

  const aktiveBuchungen = useMemo(
    () => belegungBuchungen.filter(b => lookupKey(b.fields.status) === 'aktiv'),
    [belegungBuchungen],
  );

  // Belegte Plätze heute
  const belegteHeuteCount = useMemo(
    () => aktiveBuchungen.filter(b => {
      const an = b.fields.anreisedatum;
      const ab = b.fields.abreisedatum;
      if (!an) return false;
      const anDate = parseISO(an);
      const abDate = ab ? parseISO(ab) : anDate;
      const today = parseISO(todayKey);
      return anDate <= today && abDate >= today;
    }).length,
    [aktiveBuchungen, todayKey],
  );

  // Groups = 12 Plätze als Resource-Rows
  const groups = useMemo<ResourceGroup[]>(
    () => PLATZ_OPTIONS.map(p => ({ key: p.key, label: p.label })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Events = aktive Buchungen als Timeline-Bars
  const events = useMemo<ResourceEvent[]>(
    () =>
      enrichedBelegungBuchungen
        .filter(b => !!b.fields.anreisedatum && lookupKey(b.fields.status) !== 'storniert')
        .map(b => ({
          id: `buchung:${b.record_id}`,
          start: b.fields.anreisedatum!,
          end: b.fields.abreisedatum,
          allDay: true,
          title: b.hundName || b.besitzerName || tx('Buchung'),
          subtitle: b.besitzerName || undefined,
          tone: toneForBuchung(b),
          group: lookupKey(b.fields.platznummer) ?? '',
        })),
    [enrichedBelegungBuchungen],
  );

  // Context line
  const contextLine = useMemo(() => {
    const parts: string[] = [];
    if (anreisenHeute.length > 0) {
      const names = namen(anreisenHeute.map(b => b.hundName || b.besitzerName).filter(Boolean));
      parts.push(tx`${names} reist heute an.`);
    }
    if (abreisenHeute.length > 0) {
      const names = namen(abreisenHeute.map(b => b.hundName || b.besitzerName).filter(Boolean));
      parts.push(tx`${names} reist heute ab.`);
    }
    if (parts.length === 0 && belegteHeuteCount > 0) {
      return tx`${String(belegteHeuteCount)} von 12 Plätzen belegt.`;
    }
    if (parts.length === 0) {
      return tx('Heute sind keine An- oder Abreisen geplant.');
    }
    return parts.join(' ');
  }, [anreisenHeute, abreisenHeute, belegteHeuteCount]);

  // Confirm Anfrage
  const confirmAnfrage = useCallback(async (anfrage: Buchungsanfragen) => {
    const prev = [...buchungsanfragen];
    setBuchungsanfragen(buchungsanfragen.map(a =>
      a.record_id === anfrage.record_id
        ? { ...a, fields: { ...a.fields, anfrage_status: lookupOption('buchungsanfragen', 'anfrage_status', 'bestaetigt') } }
        : a,
    ));
    try {
      await LivingAppsService.updateBuchungsanfragenEntry(anfrage.record_id, { anfrage_status: 'bestaetigt' });
      undoToast(
        tx`Anfrage von ${(anfrage.fields.interessent_vorname ?? '') + ' ' + (anfrage.fields.interessent_nachname ?? '')} bestätigt.`,
        async () => {
          setBuchungsanfragen(prev);
          await LivingAppsService.updateBuchungsanfragenEntry(anfrage.record_id, { anfrage_status: 'neu' });
        },
      );
    } catch {
      await fetchAll();
    }
  }, [buchungsanfragen, setBuchungsanfragen, fetchAll]);

  const rejectAnfrage = useCallback(async (anfrage: Buchungsanfragen) => {
    const prev = [...buchungsanfragen];
    setBuchungsanfragen(buchungsanfragen.map(a =>
      a.record_id === anfrage.record_id
        ? { ...a, fields: { ...a.fields, anfrage_status: lookupOption('buchungsanfragen', 'anfrage_status', 'abgelehnt') } }
        : a,
    ));
    try {
      await LivingAppsService.updateBuchungsanfragenEntry(anfrage.record_id, { anfrage_status: 'abgelehnt' });
      undoToast(
        tx`Anfrage von ${(anfrage.fields.interessent_vorname ?? '') + ' ' + (anfrage.fields.interessent_nachname ?? '')} abgelehnt.`,
        async () => {
          setBuchungsanfragen(prev);
          await LivingAppsService.updateBuchungsanfragenEntry(anfrage.record_id, { anfrage_status: 'neu' });
        },
      );
    } catch {
      await fetchAll();
    }
  }, [buchungsanfragen, setBuchungsanfragen, fetchAll]);

  // Drag: Buchung verschieben
  const handleEventDrop = useCallback(async (id: string, newStart: string, newEnd?: string, newGroup?: string) => {
    const rid = id.split(':')[1] ?? '';
    if (!rid) return;
    const prev = [...belegungBuchungen];

    // Overlap-Check: gleicher Platz, überlappender Zeitraum
    if (newGroup) {
      const overlap = belegungBuchungen.find(b => {
        if (b.record_id === rid) return false;
        if (lookupKey(b.fields.status) === 'storniert') return false;
        if (lookupKey(b.fields.platznummer) !== newGroup) return false;
        const bAn = b.fields.anreisedatum;
        const bAb = b.fields.abreisedatum;
        if (!bAn) return false;
        const newAnDate = parseISO(newStart);
        const newAbDate = newEnd ? parseISO(newEnd) : newAnDate;
        const bAnDate = parseISO(bAn);
        const bAbDate = bAb ? parseISO(bAb) : bAnDate;
        return newAnDate <= bAbDate && newAbDate >= bAnDate;
      });
      if (overlap) {
        const enriched = crud.enriched.belegungBuchungen.find(b => b.record_id === overlap.record_id);
        return tx`Platz bereits belegt durch ${enriched?.hundName ?? tx('eine andere Buchung')}.`;
      }
    }

    setBelegungBuchungen(prev.map(b =>
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
        : b,
    ));
    try {
      await LivingAppsService.updateBelegungBuchungenEntry(rid, {
        anreisedatum: newStart,
        ...(newEnd ? { abreisedatum: newEnd } : {}),
        ...(newGroup ? { platznummer: newGroup } : {}),
      });
      undoToast(tx('Buchung verschoben.'), async () => {
        setBelegungBuchungen(prev);
        const origB = prev.find(b => b.record_id === rid);
        if (origB) {
          await LivingAppsService.updateBelegungBuchungenEntry(rid, {
            anreisedatum: origB.fields.anreisedatum,
            abreisedatum: origB.fields.abreisedatum,
            platznummer: lookupKey(origB.fields.platznummer),
          });
        }
      });
    } catch {
      await fetchAll();
    }
    return undefined;
  }, [belegungBuchungen, setBelegungBuchungen, fetchAll, crud.enriched.belegungBuchungen]);

  const handleEventResize = useCallback(async (id: string, newStart: string, newEnd: string) => {
    const rid = id.split(':')[1] ?? '';
    if (!rid) return;
    const prev = [...belegungBuchungen];
    setBelegungBuchungen(prev.map(b =>
      b.record_id === rid
        ? { ...b, fields: { ...b.fields, anreisedatum: newStart, abreisedatum: newEnd } }
        : b,
    ));
    try {
      await LivingAppsService.updateBelegungBuchungenEntry(rid, { anreisedatum: newStart, abreisedatum: newEnd });
      undoToast(tx('Aufenthaltsdauer angepasst.'), async () => {
        setBelegungBuchungen(prev);
        const origB = prev.find(b => b.record_id === rid);
        if (origB) {
          await LivingAppsService.updateBelegungBuchungenEntry(rid, {
            anreisedatum: origB.fields.anreisedatum,
            abreisedatum: origB.fields.abreisedatum,
          });
        }
      });
    } catch {
      await fetchAll();
    }
    return undefined;
  }, [belegungBuchungen, setBelegungBuchungen, fetchAll]);

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  // ─── Derivations below (no hooks) ───
  const firstAnfrage = aktiveAnfragen[0];

  const heroBanner = firstAnfrage && aktiveAnfragen.length > 0 ? (
    <HeroBanner
      icon={<IconAlertTriangle size={18} />}
      action={{
        label: tx('Anfrage bestätigen'),
        onClick: () => confirmAnfrage(firstAnfrage),
      }}
    >
      <b>{aktiveAnfragen.length === 1
        ? tx`${(firstAnfrage.fields.interessent_vorname ?? '') + ' ' + (firstAnfrage.fields.interessent_nachname ?? '')} hat eine Buchungsanfrage gestellt`
        : tx`${String(aktiveAnfragen.length)} neue Buchungsanfragen warten auf Bearbeitung`
      }</b>
      {firstAnfrage.fields.wunsch_anreise && tx` — Wunschtermin ${formatDate(firstAnfrage.fields.wunsch_anreise)}.`}
    </HeroBanner>
  ) : undefined;

  const isEmpty = belegungBuchungen.length === 0 && buchungsanfragen.length === 0;

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{gruss(clock)}</h1>
            <p className="text-muted-foreground mt-0.5">{contextLine}</p>
          </div>
          <button
            type="button"
            onClick={() => crud.belegungBuchungen.openCreate({ status: 'aktiv' })}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shrink-0"
          >
            <IconPlus size={16} className="shrink-0" />
            {tx('Neue Buchung')}
          </button>
        </div>
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
          <IconDog size={48} className="text-muted-foreground" />
          <div>
            <h2 className="text-lg font-semibold">{tx('Willkommen in deiner Hundepension!')}</h2>
            <p className="text-muted-foreground mt-1">{tx('Lege deine erste Buchung an und behalte den Überblick über alle Aufenthalte.')}</p>
          </div>
          <button
            type="button"
            onClick={() => crud.belegungBuchungen.openCreate({ status: 'aktiv' })}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <IconPlus size={16} className="shrink-0" />
            {tx('Erste Buchung erfassen')}
          </button>
        </div>
      ) : (
        <DashboardGrid
          variant="wide"
          hero={heroBanner}
          kpis={
            <StatStrip>
              <StatStripItem
                title={tx('Anreisen heute')}
                value={anreisenHeute.length}
                icon={<IconCalendarCheck size={16} />}
                tone={anreisenHeute.length > 0 ? 'success' : 'default'}
              />
              <StatStripItem
                title={tx('Abreisen heute')}
                value={abreisenHeute.length}
                icon={<IconCalendarX size={16} />}
                tone={abreisenHeute.length > 0 ? 'warning' : 'default'}
              />
              <StatStripItem
                title={tx('Belegt heute')}
                value={`${belegteHeuteCount} / 12`}
                icon={<IconPaw size={16} />}
                tone={belegteHeuteCount >= 10 ? 'destructive' : belegteHeuteCount >= 6 ? 'primary' : 'default'}
              />
              <StatStripItem
                title={tx('Neue Anfragen')}
                value={aktiveAnfragen.length}
                icon={<IconUsers size={16} />}
                tone={aktiveAnfragen.length > 0 ? 'warning' : 'default'}
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
                const rid = ev.id.split(':')[1] ?? '';
                const record = belegungBuchungen.find(b => b.record_id === rid);
                if (record) crud.belegungBuchungen.openDetail(record);
              }}
              onEventDrop={handleEventDrop}
              onEventResize={handleEventResize}
              onRangeCreate={(start, end, group) => {
                crud.belegungBuchungen.openCreate({
                  anreisedatum: format(start, 'yyyy-MM-dd'),
                  abreisedatum: format(end, 'yyyy-MM-dd'),
                  platznummer: group ?? undefined,
                  status: 'aktiv',
                });
              }}
              onEmptyClick={(date, group) => {
                crud.belegungBuchungen.openCreate({
                  anreisedatum: format(date, 'yyyy-MM-dd'),
                  platznummer: group ?? undefined,
                  status: 'aktiv',
                });
              }}
            />
          }
          aside={
            <>
              <WorkList
                title={tx('Heute')}
                items={[
                  ...anreisenHeute.map(b => ({
                    id: `an:${b.record_id}`,
                    title: b.hundName || tx('Unbekannter Hund'),
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
                      label: tx('Eingecheckt'),
                      onClick: async () => {
                        const raw = belegungBuchungen.find(r => r.record_id === b.record_id);
                        if (raw) crud.belegungBuchungen.openDetail(raw);
                      },
                    },
                  })),
                  ...abreisenHeute.map(b => ({
                    id: `ab:${b.record_id}`,
                    title: b.hundName || tx('Unbekannter Hund'),
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
                      label: tx('Ausgecheckt'),
                      onClick: async () => {
                        const raw = belegungBuchungen.find(r => r.record_id === b.record_id);
                        if (raw) crud.belegungBuchungen.openDetail(raw);
                      },
                    },
                  })),
                ]}
                onItemClick={id => {
                  const rid = id.replace(/^(an|ab):/, '');
                  const raw = belegungBuchungen.find(r => r.record_id === rid);
                  if (raw) crud.belegungBuchungen.openDetail(raw);
                }}
                empty={{
                  text: tx('Heute sind keine An- oder Abreisen geplant — die Pension ist ruhig.'),
                  action: {
                    label: tx('Buchung anlegen'),
                    onClick: () => crud.belegungBuchungen.openCreate({
                      anreisedatum: todayKey,
                      status: 'aktiv',
                    }),
                  },
                }}
              />

              <WorkList
                title={tx('Neue Anfragen')}
                items={aktiveAnfragen.map(a => ({
                  id: a.record_id,
                  title: `${a.fields.hund_name ?? tx('Hund')} (${a.fields.interessent_vorname ?? ''} ${a.fields.interessent_nachname ?? ''})`.trim(),
                  secondLine: (
                    <>
                      <span className="font-medium text-amber-600">{tx('Neu')}</span>
                      {a.fields.wunsch_anreise && (
                        <span className="text-muted-foreground"> · {formatDate(a.fields.wunsch_anreise)}</span>
                      )}
                      {a.fields.wunsch_abreise && (
                        <span className="text-muted-foreground"> – {formatDate(a.fields.wunsch_abreise)}</span>
                      )}
                    </>
                  ),
                  action: {
                    label: tx('Bestätigen'),
                    onClick: () => confirmAnfrage(a),
                  },
                }))}
                onItemClick={id => {
                  const raw = buchungsanfragen.find(a => a.record_id === id);
                  if (raw) crud.buchungsanfragen.openDetail(raw);
                }}
                empty={{
                  text: tx('Keine offenen Anfragen — alle wurden bearbeitet.'),
                }}
              />
            </>
          }
        />
      )}

      {crud.surfaces}
    </div>
  );
}
