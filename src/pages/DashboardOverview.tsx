import { useMemo, useState, useCallback } from 'react';
import { format, parseISO, isToday, isBefore, startOfDay } from 'date-fns';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import { DashboardSkeleton, DashboardError } from '@/components/DashboardStates';
import { DashboardGrid } from '@/components/DashboardGrid';
import { HeroBanner } from '@/components/HeroBanner';
import { WorkList } from '@/components/WorkList';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { tx, appLabel } from '@/i18n';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import { lookupKey, formatDate } from '@/lib/formatters';
import { LOOKUP_OPTIONS, APP_IDS, lookupOption } from '@/types/app';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import {
  ResourceTimeline,
  ResourceTimelineSkeleton,
  type ResourceEvent,
  type ResourceGroup,
} from '@/components/widgets/ResourceTimeline';
import { dateFnsLocale } from '@/i18n';
import {
  IconAlertCircle,
  IconCalendar,
  IconCheck,
  IconX,
  IconDog,
  IconUsers,
  IconHome,
  IconClock,
} from '@tabler/icons-react';

export default function DashboardOverview() {
  const data = useDashboardData();
  const {
    besitzer,
    hundekartei,
    belegungBuchungen,
    setBelegungBuchungen,
    buchungsanfragen,
    setBuchungsanfragen,
    loading,
    error,
    fetchAll,
  } = data;

  const clock = useClock();

  const crud = useEntityCrud(data, {
    footer: (top) => {
      if (top.type === 'buchungsanfragen') {
        const r = top.record;
        if (lookupKey(r.fields.anfrage_status) === 'neu') {
          return {
            label: tx('Bestätigen'),
            onClick: () => void handleConfirmAnfrage(r),
          };
        }
      }
      if (top.type === 'belegung_buchungen') {
        const r = top.record;
        if (lookupKey(r.fields.status) === 'aktiv') {
          return {
            label: tx('Abschluss'),
            onClick: () => void handleCheckout(r),
          };
        }
      }
      return undefined;
    },
  });

  const enrichedBelegungBuchungen = crud.enriched.belegungBuchungen;
  const enrichedBuchungsanfragen = buchungsanfragen;

  // ─── Derived values for today ───────────────────────────────────────────────
  const todayKey = format(clock, 'yyyy-MM-dd');

  const aktiveBookings = useMemo(
    () => enrichedBelegungBuchungen.filter(b => lookupKey(b.fields.status) === 'aktiv'),
    [enrichedBelegungBuchungen],
  );

  const arrivals = useMemo(
    () => enrichedBelegungBuchungen.filter(b => b.fields.anreisedatum === todayKey),
    [enrichedBelegungBuchungen, todayKey],
  );

  const departures = useMemo(
    () => enrichedBelegungBuchungen.filter(b => b.fields.abreisedatum === todayKey),
    [enrichedBelegungBuchungen, todayKey],
  );

  const pendingAnfragen = useMemo(
    () => buchungsanfragen.filter(a => lookupKey(a.fields.anfrage_status) === 'neu'),
    [buchungsanfragen],
  );

  const belegtePlatze = useMemo(() => {
    const platzSet = new Set<string>();
    aktiveBookings.forEach(b => {
      const p = lookupKey(b.fields.platznummer);
      if (p) platzSet.add(p);
    });
    return platzSet.size;
  }, [aktiveBookings]);

  const freePlatze = 12 - belegtePlatze;

  // ─── Context line ────────────────────────────────────────────────────────────
  const contextLine = useMemo(() => {
    const anreiseNamen = arrivals.map(b => b.hundName || b.besitzerName).filter(Boolean);
    const abreiseNamen = departures.map(b => b.hundName || b.besitzerName).filter(Boolean);
    if (anreiseNamen.length === 0 && abreiseNamen.length === 0) {
      if (freePlatze === 12) return tx('Heute sind noch alle Plätze frei.');
      return tx`${freePlatze} von 12 Plätzen heute frei — keine An- oder Abreisen.`;
    }
    if (anreiseNamen.length > 0 && abreiseNamen.length > 0) {
      return tx`Heute kommen ${namen(anreiseNamen)} — ${namen(abreiseNamen)} reist ab.`;
    }
    if (anreiseNamen.length > 0) {
      return tx`Heute kommt ${namen(anreiseNamen)} — ${freePlatze} Plätze noch frei.`;
    }
    return tx`Heute reist ${namen(abreiseNamen)} ab — ${freePlatze} Plätze werden frei.`;
  }, [arrivals, departures, freePlatze]);

  // ─── ResourceTimeline groups (12 static spots) ───────────────────────────────
  const platznummerOptions = LOOKUP_OPTIONS['belegung_buchungen']?.['platznummer'] ?? [];

  const groups = useMemo<ResourceGroup[]>(
    () => platznummerOptions.map(opt => ({ key: opt.key, label: opt.label })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const events = useMemo<ResourceEvent[]>(
    () =>
      enrichedBelegungBuchungen
        .filter(b => !!b.fields.anreisedatum && !!b.fields.platznummer)
        .map(b => {
          const statusKey = lookupKey(b.fields.status);
          const tone =
            statusKey === 'storniert'
              ? 'default'
              : statusKey === 'abgeschlossen'
              ? 'success'
              : 'primary';
          return {
            id: `buchung:${b.record_id}`,
            start: b.fields.anreisedatum!,
            end: b.fields.abreisedatum,
            allDay: true,
            title: b.hundName || b.besitzerName || tx('Buchung'),
            subtitle: b.besitzerName,
            tone,
            group: lookupKey(b.fields.platznummer) ?? '',
          };
        }),
    [enrichedBelegungBuchungen],
  );

  // ─── Drag: reschedule ────────────────────────────────────────────────────────
  const handleEventDrop = useCallback(
    async (id: string, newStart: string, newEnd?: string, newGroup?: string) => {
      const rid = id.split(':')[1] ?? '';
      if (!rid) return;
      const prev = belegungBuchungen.find(b => b.record_id === rid);
      if (!prev) return;

      // optimistic
      setBelegungBuchungen(bs =>
        bs.map(b =>
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
        ),
      );

      const undo = () => {
        setBelegungBuchungen(bs =>
          bs.map(b => (b.record_id === rid ? prev : b)),
        );
        void LivingAppsService.updateBelegungBuchungenEntry(rid, {
          anreisedatum: prev.fields.anreisedatum,
          abreisedatum: prev.fields.abreisedatum,
          platznummer: lookupKey(prev.fields.platznummer),
        });
      };

      undoToast(
        tx`Buchung verschoben`,
        undo,
      );

      try {
        await LivingAppsService.updateBelegungBuchungenEntry(rid, {
          anreisedatum: newStart,
          ...(newEnd ? { abreisedatum: newEnd } : {}),
          ...(newGroup ? { platznummer: newGroup } : {}),
        });
      } catch {
        await fetchAll();
      }
    },
    [belegungBuchungen, setBelegungBuchungen, fetchAll],
  );

  const handleEventResize = useCallback(
    async (id: string, newStart: string, newEnd: string) => {
      const rid = id.split(':')[1] ?? '';
      if (!rid) return;
      const prev = belegungBuchungen.find(b => b.record_id === rid);
      if (!prev) return;

      setBelegungBuchungen(bs =>
        bs.map(b =>
          b.record_id === rid
            ? { ...b, fields: { ...b.fields, anreisedatum: newStart, abreisedatum: newEnd } }
            : b,
        ),
      );

      const undo = () => {
        setBelegungBuchungen(bs =>
          bs.map(b => (b.record_id === rid ? prev : b)),
        );
        void LivingAppsService.updateBelegungBuchungenEntry(rid, {
          anreisedatum: prev.fields.anreisedatum,
          abreisedatum: prev.fields.abreisedatum,
        });
      };

      undoToast(tx`Aufenthalt angepasst`, undo);

      try {
        await LivingAppsService.updateBelegungBuchungenEntry(rid, {
          anreisedatum: newStart,
          abreisedatum: newEnd,
        });
      } catch {
        await fetchAll();
      }
    },
    [belegungBuchungen, setBelegungBuchungen, fetchAll],
  );

  // ─── Confirm / Reject Anfrage ─────────────────────────────────────────────────
  const handleConfirmAnfrage = useCallback(
    async (anfrage: (typeof buchungsanfragen)[0]) => {
      const prevStatus = anfrage.fields.anfrage_status;

      setBuchungsanfragen(as =>
        as.map(a =>
          a.record_id === anfrage.record_id
            ? { ...a, fields: { ...a.fields, anfrage_status: lookupOption('buchungsanfragen', 'anfrage_status', 'bestaetigt') } }
            : a,
        ),
      );

      const undo = () => {
        setBuchungsanfragen(as =>
          as.map(a =>
            a.record_id === anfrage.record_id
              ? { ...a, fields: { ...a.fields, anfrage_status: prevStatus } }
              : a,
          ),
        );
        void LivingAppsService.updateBuchungsanfragenEntry(anfrage.record_id, {
          anfrage_status: lookupKey(prevStatus),
        });
      };

      const name = `${anfrage.fields.interessent_vorname ?? ''} ${anfrage.fields.interessent_nachname ?? ''}`.trim();
      undoToast(tx`${name} — Anfrage bestätigt`, undo);

      try {
        await LivingAppsService.updateBuchungsanfragenEntry(anfrage.record_id, {
          anfrage_status: 'bestaetigt',
        });
      } catch {
        await fetchAll();
      }
    },
    [buchungsanfragen, setBuchungsanfragen, fetchAll],
  );

  const handleRejectAnfrage = useCallback(
    async (anfrage: (typeof buchungsanfragen)[0]) => {
      const prevStatus = anfrage.fields.anfrage_status;

      setBuchungsanfragen(as =>
        as.map(a =>
          a.record_id === anfrage.record_id
            ? { ...a, fields: { ...a.fields, anfrage_status: lookupOption('buchungsanfragen', 'anfrage_status', 'abgelehnt') } }
            : a,
        ),
      );

      const undo = () => {
        setBuchungsanfragen(as =>
          as.map(a =>
            a.record_id === anfrage.record_id
              ? { ...a, fields: { ...a.fields, anfrage_status: prevStatus } }
              : a,
          ),
        );
        void LivingAppsService.updateBuchungsanfragenEntry(anfrage.record_id, {
          anfrage_status: lookupKey(prevStatus),
        });
      };

      const name = `${anfrage.fields.interessent_vorname ?? ''} ${anfrage.fields.interessent_nachname ?? ''}`.trim();
      undoToast(tx`${name} — Anfrage abgelehnt`, undo);

      try {
        await LivingAppsService.updateBuchungsanfragenEntry(anfrage.record_id, {
          anfrage_status: 'abgelehnt',
        });
      } catch {
        await fetchAll();
      }
    },
    [buchungsanfragen, setBuchungsanfragen, fetchAll],
  );

  // ─── Checkout ────────────────────────────────────────────────────────────────
  const handleCheckout = useCallback(
    async (buchung: (typeof belegungBuchungen)[0]) => {
      const prevStatus = buchung.fields.status;

      setBelegungBuchungen(bs =>
        bs.map(b =>
          b.record_id === buchung.record_id
            ? { ...b, fields: { ...b.fields, status: lookupOption('belegung_buchungen', 'status', 'abgeschlossen') } }
            : b,
        ),
      );

      const enriched = enrichedBelegungBuchungen.find(b => b.record_id === buchung.record_id);
      const name = enriched?.hundName || enriched?.besitzerName || '';
      const undo = () => {
        setBelegungBuchungen(bs =>
          bs.map(b => (b.record_id === buchung.record_id ? { ...b, fields: { ...b.fields, status: prevStatus } } : b)),
        );
        void LivingAppsService.updateBelegungBuchungenEntry(buchung.record_id, {
          status: lookupKey(prevStatus),
        });
      };

      undoToast(tx`${name} — ausgecheckt`, undo);

      try {
        await LivingAppsService.updateBelegungBuchungenEntry(buchung.record_id, {
          status: 'abgeschlossen',
        });
      } catch {
        await fetchAll();
      }
    },
    [belegungBuchungen, setBelegungBuchungen, enrichedBelegungBuchungen, fetchAll],
  );

  // ─── Early returns ────────────────────────────────────────────────────────────
  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  // ─── Empty state ─────────────────────────────────────────────────────────────
  if (belegungBuchungen.length === 0 && hundekartei.length === 0 && besitzer.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-6 text-center">
        <IconDog size={48} className="text-muted-foreground" />
        <div>
          <h2 className="text-xl font-semibold mb-2">{tx('Willkommen in deiner Hundepension!')}</h2>
          <p className="text-muted-foreground">{tx('Lege zuerst Besitzer und Hunde an, dann kannst du Buchungen erfassen.')}</p>
        </div>
        <div className="flex gap-3 flex-wrap justify-center">
          <button
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            onClick={() => crud.besitzer.openCreate({})}
          >
            <IconUsers size={16} className="shrink-0" />
            {tx('Ersten Besitzer anlegen')}
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium"
            onClick={() => crud.belegungBuchungen.openCreate({})}
          >
            <IconCalendar size={16} className="shrink-0" />
            {tx('Erste Buchung erfassen')}
          </button>
        </div>
        {crud.surfaces}
      </div>
    );
  }

  // ─── Work lists ──────────────────────────────────────────────────────────────
  const todayItems = [
    ...arrivals.map(b => ({
      id: `anreise:${b.record_id}`,
      title: b.hundName || b.besitzerName || tx('Unbekannt'),
      secondLine: (
        <>
          <span className="font-medium text-emerald-600">{tx('Anreise')}</span>
          {b.fields.platznummer && (
            <span className="text-muted-foreground"> · {b.fields.platznummer.label}</span>
          )}
          {b.besitzerName && <span className="text-muted-foreground"> · {b.besitzerName}</span>}
        </>
      ),
      action: {
        label: tx('Details'),
        onClick: () => crud.belegungBuchungen.openDetail(b),
      },
    })),
    ...departures.map(b => ({
      id: `abreise:${b.record_id}`,
      title: b.hundName || b.besitzerName || tx('Unbekannt'),
      secondLine: (
        <>
          <span className="font-medium text-amber-600">{tx('Abreise')}</span>
          {b.fields.platznummer && (
            <span className="text-muted-foreground"> · {b.fields.platznummer.label}</span>
          )}
          {lookupKey(b.fields.status) === 'aktiv' && (
            <span className="text-muted-foreground"> · {tx('noch aktiv')}</span>
          )}
        </>
      ),
      action:
        lookupKey(b.fields.status) === 'aktiv'
          ? { label: tx('Auschecken'), onClick: () => void handleCheckout(b) }
          : { label: tx('Details'), onClick: () => crud.belegungBuchungen.openDetail(b) },
    })),
  ];

  const anfrageItems = pendingAnfragen.map(a => ({
    id: a.record_id,
    title: `${a.fields.interessent_vorname ?? ''} ${a.fields.interessent_nachname ?? ''}`.trim() || tx('Interessent'),
    secondLine: (
      <>
        <span className="font-medium text-primary">{a.fields.hund_name ?? ''}</span>
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
      onClick: () => void handleConfirmAnfrage(a),
    },
  }));

  // ─── Hero: pending requests ───────────────────────────────────────────────────
  const firstPending = pendingAnfragen[0];
  const hero =
    pendingAnfragen.length > 0 && firstPending ? (
      <HeroBanner
        icon={<IconAlertCircle size={18} />}
        action={{
          label: tx('Jetzt bestätigen'),
          onClick: () => void handleConfirmAnfrage(firstPending),
        }}
      >
        {pendingAnfragen.length === 1 ? (
          <>
            <b>{`${firstPending.fields.interessent_vorname ?? ''} ${firstPending.fields.interessent_nachname ?? ''}`.trim()}</b>
            {' '}{tx('hat eine Buchungsanfrage gestellt')}
            {firstPending.fields.hund_name ? ` — ${firstPending.fields.hund_name}` : ''}.
          </>
        ) : (
          <>
            <b>{pendingAnfragen.length}</b>{' '}{tx('neue Buchungsanfragen warten auf deine Antwort.')}
          </>
        )}
      </HeroBanner>
    ) : undefined;

  return (
    <>
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">
          {gruss(clock)}
        </h1>
        <p className="text-muted-foreground mt-1">{contextLine}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            onClick={() => crud.belegungBuchungen.openCreate({ status: 'aktiv' })}
          >
            <IconCalendar size={16} className="shrink-0" />
            {tx('Neue Buchung')}
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium"
            onClick={() => crud.hundekartei.openCreate({})}
          >
            <IconDog size={16} className="shrink-0" />
            {tx('Neuer Hund')}
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium"
            onClick={() => crud.besitzer.openCreate({})}
          >
            <IconUsers size={16} className="shrink-0" />
            {tx('Neuer Besitzer')}
          </button>
        </div>
      </div>

      <DashboardGrid
        variant="wide"
        hero={hero}
        kpis={
          <StatStrip>
            <StatStripItem
              title={tx('Belegt')}
              value={`${belegtePlatze}/12`}
              icon={<IconHome size={16} />}
              tone={belegtePlatze === 12 ? 'destructive' : belegtePlatze > 9 ? 'warning' : 'primary'}
            />
            <StatStripItem
              title={tx('Frei')}
              value={freePlatze}
              icon={<IconCheck size={16} />}
              tone={freePlatze === 0 ? 'destructive' : freePlatze < 3 ? 'warning' : 'success'}
            />
            <StatStripItem
              title={tx('Heute Anreise')}
              value={arrivals.length}
              icon={<IconClock size={16} />}
              tone={arrivals.length > 0 ? 'primary' : 'default'}
            />
            <StatStripItem
              title={tx('Heute Abreise')}
              value={departures.length}
              icon={<IconClock size={16} />}
              tone={departures.length > 0 ? 'warning' : 'default'}
            />
            <StatStripItem
              title={tx('Anfragen')}
              value={pendingAnfragen.length}
              icon={<IconAlertCircle size={16} />}
              tone={pendingAnfragen.length > 0 ? 'destructive' : 'default'}
            />
            <StatStripItem
              title={appLabel('hundekartei')}
              value={hundekartei.length}
              icon={<IconDog size={16} />}
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
              const rec = belegungBuchungen.find(b => b.record_id === rid);
              if (rec) crud.belegungBuchungen.openDetail(rec);
            }}
            onEventDrop={handleEventDrop}
            onEventResize={handleEventResize}
            onEmptyClick={(date, group) => {
              crud.belegungBuchungen.openCreate({
                anreisedatum: format(date, 'yyyy-MM-dd'),
                platznummer: group,
                status: 'aktiv',
              });
            }}
            onRangeCreate={(start, end, group) => {
              crud.belegungBuchungen.openCreate({
                anreisedatum: format(start, 'yyyy-MM-dd'),
                abreisedatum: format(end, 'yyyy-MM-dd'),
                platznummer: group,
                status: 'aktiv',
              });
            }}
          />
        }
        aside={
          <>
            <WorkList
              title={tx('Heute')}
              items={todayItems.map(item => ({
                id: item.id,
                title: item.title,
                secondLine: item.secondLine,
                action: item.action,
              }))}
              onItemClick={id => {
                const rid = id.replace(/^(anreise|abreise):/, '');
                const rec = belegungBuchungen.find(b => b.record_id === rid);
                if (rec) crud.belegungBuchungen.openDetail(rec);
              }}
              empty={{
                text: tx('Heute keine An- oder Abreisen geplant.'),
                action: {
                  label: tx('Buchung erfassen'),
                  onClick: () => crud.belegungBuchungen.openCreate({ anreisedatum: todayKey, status: 'aktiv' }),
                },
              }}
            />
            <WorkList
              title={tx('Neue Anfragen')}
              items={anfrageItems.map(item => ({
                id: item.id,
                title: item.title,
                secondLine: item.secondLine,
                action: item.action,
              }))}
              onItemClick={id => {
                const rec = buchungsanfragen.find(a => a.record_id === id);
                if (rec) crud.buchungsanfragen.openDetail(rec);
              }}
              empty={{
                text: tx('Keine offenen Anfragen — alles bearbeitet.'),
              }}
            />
          </>
        }
      />

      {crud.surfaces}
    </>
  );
}
