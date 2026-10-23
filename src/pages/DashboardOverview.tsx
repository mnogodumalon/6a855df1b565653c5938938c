import { useMemo } from 'react';
import { addDays, format, parseISO } from 'date-fns';
import { IconAlertTriangle, IconPaw, IconPlus } from '@tabler/icons-react';
import type { DashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import { flowActionFor } from '@/config/plan';
import { LOOKUP_OPTIONS, lookupOption } from '@/types/app';
import { LivingAppsService, extractRecordId } from '@/services/livingAppsService';
import { formatDate, lookupKey } from '@/lib/formatters';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import { tx, dateFnsLocale } from '@/i18n';
import { DashboardGrid } from '@/components/DashboardGrid';
import { WorkList } from '@/components/WorkList';
import { HeroBanner } from '@/components/HeroBanner';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { Button } from '@/components/ui/button';
import { ResourceTimeline, type ResourceEvent, type ResourceGroup } from '@/components/widgets/ResourceTimeline';

export default function DashboardOverview({ data }: { data: DashboardData }) {
  const { hundekartei, belegungBuchungen, buchungsanfragen, pfotenPortraet, setBelegungBuchungen, fetchAll } = data;
  const crud = useEntityCrud(data, {
    footer: (top) => {
      if (top.type === 'belegungBuchungen' && lookupKey(top.record.fields.status) === 'aktiv') {
        const go = flowActionFor('belegung_buchungen', 'status', top.record.record_id, 'abgeschlossen');
        return go ? { label: tx('Aufenthalt abschließen'), onClick: go } : undefined;
      }
      if (top.type === 'buchungsanfragen' && lookupKey(top.record.fields.anfrage_status) === 'neu') {
        const go = flowActionFor('buchungsanfragen', 'anfrage_status', top.record.record_id, 'bestaetigt');
        return go ? { label: tx('Anfrage bestätigen'), onClick: go } : undefined;
      }
      return undefined;
    },
  });
  const enrichedBelegung = crud.enriched.belegungBuchungen;
  const clock = useClock();
  const todayKey = format(clock, 'yyyy-MM-dd');
  const horizonKey = format(addDays(clock, 3), 'yyyy-MM-dd');
  const weekEndKey = format(addDays(clock, 6), 'yyyy-MM-dd');

  const platzOptions = LOOKUP_OPTIONS['belegung_buchungen']?.platznummer ?? [];
  const groups: ResourceGroup[] = platzOptions.map(o => ({ key: o.key, label: o.label }));

  const liveStays = useMemo(
    () => enrichedBelegung.filter(b => lookupKey(b.fields.status) !== 'storniert'),
    [enrichedBelegung],
  );

  const events = useMemo<ResourceEvent[]>(() => liveStays
    .filter(b => !!b.fields.anreisedatum && !!lookupKey(b.fields.platznummer))
    .map(b => {
      const a = b.fields.anreisedatum!.slice(0, 10);
      const e = b.fields.abreisedatum?.slice(0, 10);
      const active = lookupKey(b.fields.status) === 'aktiv';
      return {
        id: `stay:${b.record_id}`,
        start: a,
        end: e,
        allDay: true,
        title: b.hundName || b.besitzerName || '—',
        subtitle: b.besitzerName || undefined,
        tone: active && a <= todayKey && (e ?? a) >= todayKey ? 'success' : active ? 'primary' : 'default',
        group: lookupKey(b.fields.platznummer) ?? '',
      };
    }), [liveStays, todayKey]);

  const activeToday = liveStays.filter(b => lookupKey(b.fields.status) === 'aktiv'
    && (b.fields.anreisedatum?.slice(0, 10) ?? '') <= todayKey
    && (b.fields.abreisedatum?.slice(0, 10) ?? todayKey) >= todayKey);
  const occupiedPlaces = new Set(activeToday.map(b => lookupKey(b.fields.platznummer))).size;
  const totalPlaces = groups.length || 12;

  // Auslastung der nächsten 7 Tage (Platz-Tage)
  const weekLoad = useMemo(() => {
    let used = 0;
    for (let i = 0; i < 7; i++) {
      const d = format(addDays(clock, i), 'yyyy-MM-dd');
      used += liveStays.filter(b => lookupKey(b.fields.status) === 'aktiv'
        && (b.fields.anreisedatum?.slice(0, 10) ?? '9') <= d
        && (b.fields.abreisedatum?.slice(0, 10) ?? b.fields.anreisedatum?.slice(0, 10) ?? '0') >= d).length;
    }
    return Math.round((used / (7 * totalPlaces)) * 100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveStays, todayKey, totalPlaces]);

  const neueAnfragen = buchungsanfragen
    .filter(a => lookupKey(a.fields.anfrage_status) === 'neu')
    .sort((a, b) => (a.fields.wunsch_anreise ?? '').localeCompare(b.fields.wunsch_anreise ?? ''));

  const arrivalsToday = liveStays.filter(b => lookupKey(b.fields.status) === 'aktiv' && b.fields.anreisedatum?.slice(0, 10) === todayKey);
  const departuresToday = liveStays.filter(b => lookupKey(b.fields.status) === 'aktiv' && b.fields.abreisedatum?.slice(0, 10) === todayKey);

  const movements = useMemo(() => {
    const rows: { id: string; kind: 'an' | 'ab'; date: string; rec: (typeof liveStays)[number] }[] = [];
    for (const b of liveStays) {
      if (lookupKey(b.fields.status) !== 'aktiv') continue;
      const a = b.fields.anreisedatum?.slice(0, 10);
      const e = b.fields.abreisedatum?.slice(0, 10);
      if (a && a >= todayKey && a <= horizonKey) rows.push({ id: `an:${b.record_id}`, kind: 'an', date: a, rec: b });
      if (e && e >= todayKey && e <= horizonKey) rows.push({ id: `ab:${b.record_id}`, kind: 'ab', date: e, rec: b });
    }
    return rows.sort((x, y) => (x.date ?? '').localeCompare(y.date ?? ''));
  }, [liveStays, todayKey, horizonKey]);

  const portraitDogIds = new Set(pfotenPortraet.map(p => extractRecordId(p.fields.hund)).filter(Boolean));
  const ohnePortraet = enrichedBelegung
    .filter(b => lookupKey(b.fields.status) === 'abgeschlossen' && !portraitDogIds.has(extractRecordId(b.fields.hund)))
    .sort((a, b) => (b.fields.abreisedatum ?? '').localeCompare(a.fields.abreisedatum ?? ''));

  const impfLuecken = hundekartei
    .filter(h => lookupKey(h.fields.impfstatus) !== 'vollstaendig')
    .sort((a, b) => (lookupKey(a.fields.impfstatus) === 'nicht_geimpft' ? 0 : 1) - (lookupKey(b.fields.impfstatus) === 'nicht_geimpft' ? 0 : 1));
  const besitzerName = (id?: string) => {
    const o = id ? data.besitzerMap.get(extractRecordId(id) ?? '') : undefined;
    return o ? `${o.fields.vorname ?? ''} ${o.fields.nachname ?? ''}`.trim() : '';
  };

  const platzLabel = (b: { fields: { platznummer?: { key: string; label: string } } }) => b.fields.platznummer?.label ?? '';
  const dayLabel = (d: string) => format(parseISO(d), 'EEE dd.MM.', { locale: dateFnsLocale() });

  // Drag/resize write — plan allows anreisedatum, abreisedatum, platznummer.
  const moveStay = async (id: string, newStart: string, newEnd?: string, newGroup?: string): Promise<void | string> => {
    const rid = id.split(':')[1];
    const rec = belegungBuchungen.find(b => b.record_id === rid);
    if (!rec) return;
    const start = newStart.slice(0, 10);
    const end = (newEnd ?? rec.fields.abreisedatum)?.slice(0, 10);
    const group = newGroup ?? lookupKey(rec.fields.platznummer);
    const clash = belegungBuchungen.some(o => {
      if (o.record_id === rid || lookupKey(o.fields.status) === 'storniert') return false;
      if (lookupKey(o.fields.platznummer) !== group) return false;
      const os = o.fields.anreisedatum?.slice(0, 10);
      const oe = o.fields.abreisedatum?.slice(0, 10) ?? os;
      if (!os || !oe) return false;
      return start < oe && os < (end ?? start) || (!end && start >= os && start < oe);
    });
    if (clash) return tx('Dieser Platz ist im gewählten Zeitraum bereits belegt.');
    const before = {
      anreisedatum: rec.fields.anreisedatum,
      abreisedatum: rec.fields.abreisedatum,
      platznummer: rec.fields.platznummer,
    };
    const patch = {
      anreisedatum: start,
      ...(end ? { abreisedatum: end } : {}),
      ...(newGroup ? { platznummer: lookupOption('belegung_buchungen', 'platznummer', newGroup) } : {}),
    };
    setBelegungBuchungen(prev => prev.map(b => b.record_id === rid ? { ...b, fields: { ...b.fields, ...patch } } : b));
    try {
      await LivingAppsService.updateBelegungBuchungenEntry(rid, patch);
      undoToast(tx('Aufenthalt verschoben'), () => {
        setBelegungBuchungen(prev => prev.map(b => b.record_id === rid ? { ...b, fields: { ...b.fields, ...before } } : b));
        LivingAppsService.updateBelegungBuchungenEntry(rid, {
          anreisedatum: before.anreisedatum,
          abreisedatum: before.abreisedatum,
          platznummer: before.platznummer,
        }).catch(() => fetchAll());
      });
    } catch {
      fetchAll();
    }
  };

  const hasNothing = belegungBuchungen.length === 0 && hundekartei.length === 0;

  // Context line — names in every branch
  const gaesteNamen = namen(activeToday.map(b => b.hundName));
  let context: string;
  if (arrivalsToday.length > 0 && departuresToday.length > 0) {
    context = tx`Heute kommen ${namen(arrivalsToday.map(b => b.hundName))} an — ${namen(departuresToday.map(b => b.hundName))} wird abgeholt.`;
  } else if (arrivalsToday.length > 0) {
    context = tx`Heute kommen ${namen(arrivalsToday.map(b => b.hundName))} an.`;
  } else if (departuresToday.length > 0) {
    context = tx`Heute wird ${namen(departuresToday.map(b => b.hundName))} abgeholt.`;
  } else if (activeToday.length > 0) {
    context = tx`Zu Gast sind gerade ${gaesteNamen}.`;
  } else if (neueAnfragen.length > 0) {
    context = tx`Gerade ist kein Gast im Haus — ${namen(neueAnfragen.map(a => a.fields.hund_name ?? ''))} wartet auf eine Antwort.`;
  } else {
    context = tx`Gerade ist kein Gast im Haus — alle zwölf Plätze sind frei.`;
  }

  let hero: React.ReactNode = null;
  if (neueAnfragen.length > 0) {
    const first = neueAnfragen[0];
    const go = flowActionFor('buchungsanfragen', 'anfrage_status', first.record_id, 'bestaetigt');
    hero = (
      <HeroBanner
        icon={<IconAlertTriangle size={18} />}
        action={{ label: go ? tx('Anfrage prüfen') : tx('Anfrage öffnen'), onClick: go ?? (() => crud.buchungsanfragen.openDetail(first)) }}
      >
        <b>{namen(neueAnfragen.map(a => `${a.fields.interessent_vorname ?? ''} ${a.fields.interessent_nachname ?? ''}`.trim()))}</b>{' '}
        {neueAnfragen.length === 1
          ? tx`wartet auf eine Antwort — ${first.fields.hund_name ?? ''} möchte ab ${formatDate(first.fields.wunsch_anreise)} kommen.`
          : tx`warten auf eine Antwort — zuerst ${first.fields.hund_name ?? ''} ab ${formatDate(first.fields.wunsch_anreise)}.`}
      </HeroBanner>
    );
  } else if (hasNothing) {
    hero = (
      <HeroBanner
        icon={<IconPaw size={48} />}
        action={{ label: tx('Ersten Gast aufnehmen'), onClick: () => crud.hundekartei.openCreate({}) }}
      >
        {tx('Richte deine Hundepension ein: lege den ersten Hund an und plane seinen Aufenthalt.')}
      </HeroBanner>
    );
  }

  const kpis = hasNothing ? undefined : (
    <StatStrip>
      <StatStripItem title={tx('Belegt heute')} value={`${occupiedPlaces} / ${totalPlaces}`} tone={occupiedPlaces >= totalPlaces ? 'warning' : 'default'} />
      <StatStripItem title={tx('Auslastung 7 Tage')} value={`${weekLoad} %`} />
      <StatStripItem title={tx('Anreisen heute')} value={arrivalsToday.length} />
    </StatStrip>
  );

  const aside = (
    <>
      <WorkList
        title={tx('Anreisen & Abreisen')}
        items={movements.map(m => {
          const go = m.kind === 'ab' ? flowActionFor('belegung_buchungen', 'status', m.rec.record_id, 'abgeschlossen') : null;
          return {
            id: m.id,
            title: m.rec.hundName || m.rec.besitzerName || '—',
            secondLine: (
              <>
                <span className={m.kind === 'an' ? 'font-medium text-emerald-600' : 'font-medium text-amber-600'}>
                  {m.kind === 'an' ? tx('Anreise') : tx('Abreise')}
                </span>
                <span className="text-muted-foreground"> · {dayLabel(m.date)} · {platzLabel(m.rec)}</span>
              </>
            ),
            action: go ? { label: tx('Abschließen'), onClick: go } : undefined,
          };
        })}
        onItemClick={id => {
          const rec = enrichedBelegung.find(b => b.record_id === id.split(':')[1]);
          if (rec) crud.belegungBuchungen.openDetail(rec);
        }}
        empty={{
          text: tx`Keine Bewegungen bis ${formatDate(horizonKey)}.`,
          action: crud.belegungBuchungen.canWrite ? { label: tx('Neuer Aufenthalt'), onClick: () => crud.belegungBuchungen.openCreate({ status: 'aktiv' }) } : undefined,
        }}
      />
      <WorkList
        title={tx('Porträt fehlt')}
        items={ohnePortraet.map(b => ({
          id: b.record_id,
          title: b.hundName || '—',
          secondLine: (
            <>
              <span className="font-medium text-amber-600">{tx('Ohne Porträt')}</span>
              <span className="text-muted-foreground"> · {tx`abgereist ${formatDate(b.fields.abreisedatum)}`}</span>
            </>
          ),
          action: crud.pfotenPortraet.canWrite ? {
            label: tx('Porträt erstellen'),
            onClick: () => crud.pfotenPortraet.openCreate({
              hund: extractRecordId(b.fields.hund) ?? undefined,
              besitzer: extractRecordId(b.fields.besitzer) ?? undefined,
              erstellungsdatum: todayKey,
            }),
          } : undefined,
        }))}
        onItemClick={id => {
          const rec = enrichedBelegung.find(b => b.record_id === id);
          if (rec) crud.belegungBuchungen.openDetail(rec);
        }}
        empty={{ text: tx('Alle abgeschlossenen Aufenthalte haben ein Porträt.') }}
      />
      <WorkList
        title={tx('Impfstatus prüfen')}
        items={impfLuecken.map(h => ({
          id: h.record_id,
          title: h.fields.name ?? '—',
          secondLine: (
            <>
              <span className={lookupKey(h.fields.impfstatus) === 'nicht_geimpft' ? 'font-medium text-destructive' : 'font-medium text-amber-600'}>
                {h.fields.impfstatus?.label ?? tx('Unbekannt')}
              </span>
              <span className="text-muted-foreground"> · {besitzerName(h.fields.besitzer)}</span>
            </>
          ),
          action: crud.hundekartei.canWrite ? { label: tx('Ergänzen'), onClick: () => crud.hundekartei.openEdit(h) } : undefined,
        }))}
        onItemClick={id => {
          const rec = hundekartei.find(h => h.record_id === id);
          if (rec) crud.hundekartei.openDetail(rec);
        }}
        empty={{ text: tx('Alle Hunde sind vollständig geimpft.') }}
      />
    </>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{gruss(clock)}</h1>
          <p className="text-sm text-muted-foreground">{context}</p>
        </div>
        {crud.belegungBuchungen.canWrite && (
          <Button onClick={() => crud.belegungBuchungen.openCreate({ status: 'aktiv', anreisedatum: todayKey })}>
            <IconPlus size={16} className="shrink-0" />
            <span>{tx('Neuer Aufenthalt')}</span>
          </Button>
        )}
      </div>
      <DashboardGrid
        variant="wide"
        hero={hero}
        kpis={kpis}
        aside={aside}
        primary={
          <ResourceTimeline
            axis="day"
            defaultRange="2weeks"
            events={events}
            groups={groups}
            locale={dateFnsLocale()}
            onEventClick={ev => {
              const rec = enrichedBelegung.find(b => b.record_id === ev.id.split(':')[1]);
              if (rec) crud.belegungBuchungen.openDetail(rec);
            }}
            onEventDrop={moveStay}
            onEventResize={(id, s, e) => moveStay(id, s, e)}
            onEmptyClick={(date, group) => {
              if (!crud.belegungBuchungen.canWrite) return;
              crud.belegungBuchungen.openCreate({ anreisedatum: format(date, 'yyyy-MM-dd'), platznummer: group, status: 'aktiv' });
            }}
            onRangeCreate={(start, end, group) => {
              if (!crud.belegungBuchungen.canWrite) return;
              crud.belegungBuchungen.openCreate({
                anreisedatum: format(start, 'yyyy-MM-dd'),
                abreisedatum: format(end, 'yyyy-MM-dd'),
                platznummer: group,
                status: 'aktiv',
              });
            }}
          />
        }
      />
      {crud.surfaces}
    </div>
  );
}
