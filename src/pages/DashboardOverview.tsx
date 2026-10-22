import { useMemo } from 'react';
import { addDays, format, parseISO } from 'date-fns';
import { IconBed, IconInbox, IconPlus, IconCalendarEvent, IconCamera, IconVaccine } from '@tabler/icons-react';
import type { DashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import { flowActionFor } from '@/config/plan';
import { LOOKUP_OPTIONS, lookupOption } from '@/types/app';
import { LivingAppsService, extractRecordId } from '@/services/livingAppsService';
import { lookupKey } from '@/lib/formatters';
import { dateFnsLocale, tx } from '@/i18n';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import { DashboardGrid } from '@/components/DashboardGrid';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { WorkList } from '@/components/WorkList';
import { HeroBanner } from '@/components/HeroBanner';
import { Button } from '@/components/ui/button';
import {
  ResourceTimeline,
  type ResourceEvent,
  type ResourceGroup,
} from '@/components/widgets/ResourceTimeline';

const d10 = (s?: string) => (s ? s.slice(0, 10) : '');

export default function DashboardOverview({ data }: { data: DashboardData }) {
  const {
    hundekartei, belegungBuchungen, buchungsanfragen, pfotenPortraet,
    setBelegungBuchungen, fetchAll,
  } = data;
  const clock = useClock();

  const crud = useEntityCrud(data, {
    footer: (top) => {
      if (top.type === 'belegungBuchungen' && lookupKey(top.record.fields.status) === 'aktiv') {
        const go = flowActionFor('belegung_buchungen', 'status', top.record.record_id, 'abgeschlossen');
        return go ? { label: tx('Aufenthalt abschließen'), onClick: go } : undefined;
      }
      if (top.type === 'buchungsanfragen' && lookupKey(top.record.fields.anfrage_status) === 'neu') {
        const go = flowActionFor('buchungsanfragen', 'anfrage_status', top.record.record_id, 'bestaetigt');
        return go ? { label: tx('Anfrage bearbeiten'), onClick: go } : undefined;
      }
      return undefined;
    },
  });
  const enrichedBelegung = crud.enriched.belegungBuchungen;

  const today = format(clock, 'yyyy-MM-dd');
  const horizon = format(addDays(clock, 3), 'yyyy-MM-dd');
  const platzOptions = LOOKUP_OPTIONS['belegung_buchungen']?.platznummer ?? [];
  const platzCount = platzOptions.length || 12;

  const dayLabel = (s?: string) => {
    if (!s) return '';
    try { return format(parseISO(s), 'EEE dd.MM.', { locale: dateFnsLocale() }); } catch { return s; }
  };

  const live = useMemo(
    () => enrichedBelegung.filter(b => lookupKey(b.fields.status) !== 'storniert'),
    [enrichedBelegung],
  );
  const inHouse = useMemo(
    () => live.filter(b => lookupKey(b.fields.status) === 'aktiv'
      && d10(b.fields.anreisedatum) <= today && (d10(b.fields.abreisedatum) || today) >= today),
    [live, today],
  );
  const neueAnfragen = useMemo(
    () => buchungsanfragen.filter(a => lookupKey(a.fields.anfrage_status) === 'neu'),
    [buchungsanfragen],
  );

  const upcoming = useMemo(() => {
    const rows: { b: (typeof live)[number]; kind: 'an' | 'ab'; date: string }[] = [];
    for (const b of live) {
      if (lookupKey(b.fields.status) !== 'aktiv') continue;
      const an = d10(b.fields.anreisedatum);
      const ab = d10(b.fields.abreisedatum);
      if (an >= today && an <= horizon) rows.push({ b, kind: 'an', date: an });
      if (ab && ab >= today && ab <= horizon) rows.push({ b, kind: 'ab', date: ab });
    }
    return rows.sort((x, y) => String(x.date ?? '').localeCompare(String(y.date ?? '')));
  }, [live, today, horizon]);

  const anreisenHeute = upcoming.filter(r => r.kind === 'an' && r.date === today);
  const abreisenHeute = upcoming.filter(r => r.kind === 'ab' && r.date === today);

  // Hunde mit laufendem/kommendem Aufenthalt
  const activeDogIds = useMemo(() => {
    const ids = new Set<string>();
    for (const b of live) {
      if (lookupKey(b.fields.status) !== 'aktiv') continue;
      if ((d10(b.fields.abreisedatum) || today) < today) continue;
      const id = extractRecordId(b.fields.hund);
      if (id) ids.add(id);
    }
    return ids;
  }, [live, today]);

  const portraitDogIds = useMemo(() => {
    const ids = new Set<string>();
    pfotenPortraet.forEach(p => { const id = extractRecordId(p.fields.hund); if (id) ids.add(id); });
    return ids;
  }, [pfotenPortraet]);

  const ohnePortraet = hundekartei.filter(h => activeDogIds.has(h.record_id) && !portraitDogIds.has(h.record_id));
  const impfLuecke = hundekartei.filter(
    h => activeDogIds.has(h.record_id) && lookupKey(h.fields.impfstatus) !== 'vollstaendig',
  );

  // Belegungstafel
  const groups = useMemo<ResourceGroup[]>(
    () => platzOptions.map(o => ({ key: o.key, label: o.label })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [platzOptions.length, clock],
  );
  const events = useMemo<ResourceEvent[]>(
    () => live.flatMap(b => {
      const platz = lookupKey(b.fields.platznummer);
      if (!platz || !b.fields.anreisedatum) return [];
      const running = inHouse.some(x => x.record_id === b.record_id);
      return [{
        id: `buchung:${b.record_id}`,
        start: d10(b.fields.anreisedatum),
        end: d10(b.fields.abreisedatum) || undefined,
        allDay: true,
        title: b.hundName || b.besitzerName || '—',
        subtitle: b.besitzerName || undefined,
        tone: running ? 'success' as const
          : lookupKey(b.fields.status) === 'abgeschlossen' ? 'default' as const : 'primary' as const,
        group: platz,
      }];
    }),
    [live, inHouse],
  );

  const recordOf = (id: string) => belegungBuchungen.find(b => b.record_id === id.split(':')[1]);

  const clash = (id: string, platz: string, start: string, end: string) =>
    live.some(o => o.record_id !== id
      && lookupKey(o.fields.platznummer) === platz
      && d10(o.fields.anreisedatum) < end
      && start < (d10(o.fields.abreisedatum) || d10(o.fields.anreisedatum)));

  const onEventDrop = (evId: string, newStart: string, newEnd?: string, newGroup?: string) => {
    const rec = recordOf(evId);
    if (!rec) return;
    const platz = newGroup ?? lookupKey(rec.fields.platznummer) ?? '';
    const start = d10(newStart);
    const end = d10(newEnd) || d10(rec.fields.abreisedatum) || start;
    if (clash(rec.record_id, platz, start, end)) {
      return tx('Dieser Platz ist im gewählten Zeitraum schon belegt.');
    }
    const before = { ...rec.fields };
    const patch = {
      anreisedatum: start,
      ...(newEnd ? { abreisedatum: end } : {}),
      ...(newGroup ? { platznummer: newGroup } : {}),
    };
    setBelegungBuchungen(prev => prev.map(b => b.record_id === rec.record_id
      ? { ...b, fields: { ...b.fields, anreisedatum: start, ...(newEnd ? { abreisedatum: end } : {}),
          ...(newGroup ? { platznummer: lookupOption('belegung_buchungen', 'platznummer', newGroup) } : {}) } }
      : b));
    LivingAppsService.updateBelegungBuchungenEntry(rec.record_id, patch).catch(() => { void fetchAll(); });
    undoToast(tx('Buchung verschoben'), () => {
      setBelegungBuchungen(prev => prev.map(b => b.record_id === rec.record_id ? { ...b, fields: before } : b));
      LivingAppsService.updateBelegungBuchungenEntry(rec.record_id, {
        anreisedatum: before.anreisedatum,
        abreisedatum: before.abreisedatum,
        platznummer: lookupKey(before.platznummer),
      }).catch(() => { void fetchAll(); });
    });
  };

  const onEventResize = (evId: string, newStart: string, newEnd: string) => onEventDrop(evId, newStart, newEnd);

  // Kopfzeile
  const inHouseNames = namen(inHouse.map(b => b.hundName).filter(Boolean), 3);
  const context = (() => {
    if (anreisenHeute.length > 0 && abreisenHeute.length > 0) {
      return tx`Heute reisen ${namen(anreisenHeute.map(r => r.b.hundName).filter(Boolean))} an — ${namen(abreisenHeute.map(r => r.b.hundName).filter(Boolean))} geht nach Hause.`;
    }
    if (anreisenHeute.length > 0) {
      return tx`Heute kommt ${namen(anreisenHeute.map(r => r.b.hundName).filter(Boolean))} zu Besuch.`;
    }
    if (abreisenHeute.length > 0) {
      return tx`Heute wird ${namen(abreisenHeute.map(r => r.b.hundName).filter(Boolean))} abgeholt.`;
    }
    if (inHouse.length > 0) {
      return tx`Aktuell zu Gast: ${inHouseNames}.`;
    }
    const next = upcoming.find(r => r.kind === 'an');
    if (next) return tx`Als Nächstes kommt ${next.b.hundName || tx('ein neuer Gast')} am ${dayLabel(next.date)}.`;
    return tx`Alle Plätze sind frei — Zeit für neue Gäste.`;
  })();

  const firstNeu = neueAnfragen[0];
  const anfrageName = (a: (typeof buchungsanfragen)[number]) =>
    `${a.fields.hund_name ?? tx('Hund')} (${[a.fields.interessent_vorname, a.fields.interessent_nachname].filter(Boolean).join(' ')})`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{gruss(clock)}</h1>
          <p className="text-sm text-muted-foreground">{context}</p>
        </div>
        {crud.belegungBuchungen.canWrite && (
          <Button onClick={() => crud.belegungBuchungen.openCreate({ status: 'aktiv', anreisedatum: today })}>
            <IconPlus size={16} className="shrink-0" />
            {tx('Neue Buchung')}
          </Button>
        )}
      </div>

      <DashboardGrid
        variant="wide"
        hero={firstNeu ? (
          <HeroBanner
            icon={<IconInbox size={18} />}
            action={{ label: tx('Anfrage prüfen'), onClick: () => crud.buchungsanfragen.openDetail(firstNeu) }}
          >
            {neueAnfragen.length === 1
              ? <><b>{anfrageName(firstNeu)}</b> {tx('wartet auf deine Antwort')}</>
              : <><b>{namen(neueAnfragen.map(anfrageName))}</b> {tx`— ${neueAnfragen.length} neue Buchungsanfragen warten auf deine Antwort`}</>}
          </HeroBanner>
        ) : undefined}
        kpis={
          <StatStrip>
            <StatStripItem
              title={tx('Heute belegt')}
              value={`${new Set(inHouse.map(b => lookupKey(b.fields.platznummer))).size} / ${platzCount}`}
              icon={<IconBed size={16} className="text-muted-foreground" />}
            />
            <StatStripItem
              title={tx('Anreisen (3 Tage)')}
              value={upcoming.filter(r => r.kind === 'an').length}
              icon={<IconCalendarEvent size={16} className="text-muted-foreground" />}
            />
            <StatStripItem
              title={tx('Ohne Porträt')}
              value={ohnePortraet.length}
              tone={ohnePortraet.length > 0 ? 'warning' : 'default'}
              icon={<IconCamera size={16} className="text-muted-foreground" />}
            />
          </StatStrip>
        }
        primary={
          <ResourceTimeline
            axis="day"
            events={events}
            groups={groups}
            defaultRange="2weeks"
            locale={dateFnsLocale()}
            onEventClick={ev => {
              const rec = recordOf(ev.id);
              if (rec) crud.belegungBuchungen.openDetail(rec);
            }}
            onEventDrop={crud.belegungBuchungen.canWrite ? onEventDrop : undefined}
            onEventResize={crud.belegungBuchungen.canWrite ? onEventResize : undefined}
            onEmptyClick={crud.belegungBuchungen.canWrite ? (date, group) => crud.belegungBuchungen.openCreate({
              status: 'aktiv', anreisedatum: format(date, 'yyyy-MM-dd'), platznummer: group,
            }) : undefined}
            onRangeCreate={crud.belegungBuchungen.canWrite ? (start, end, group) => crud.belegungBuchungen.openCreate({
              status: 'aktiv',
              anreisedatum: format(start, 'yyyy-MM-dd'),
              abreisedatum: format(end, 'yyyy-MM-dd'),
              platznummer: group,
            }) : undefined}
          />
        }
        aside={
          <>
            <WorkList
              title={tx('Anreisen & Abreisen')}
              icon={<IconCalendarEvent size={16} />}
              items={upcoming.map(r => {
                const go = r.kind === 'ab'
                  ? flowActionFor('belegung_buchungen', 'status', r.b.record_id, 'abgeschlossen')
                  : null;
                return {
                  id: `${r.kind}:${r.b.record_id}`,
                  title: r.b.hundName || r.b.besitzerName || '—',
                  secondLine: (
                    <>
                      <span className={r.kind === 'an' ? 'font-medium text-primary' : 'font-medium text-amber-600'}>
                        {r.kind === 'an' ? tx('Anreise') : tx('Abreise')}
                      </span>
                      <span className="text-muted-foreground"> · {dayLabel(r.date)} · {r.b.fields.platznummer?.label ?? tx('ohne Platz')}</span>
                    </>
                  ),
                  action: go ? { label: tx('Abschließen'), onClick: go } : undefined,
                };
              })}
              onItemClick={id => {
                const rec = belegungBuchungen.find(b => b.record_id === id.split(':')[1]);
                if (rec) crud.belegungBuchungen.openDetail(rec);
              }}
              empty={{
                text: tx('Keine Anreisen oder Abreisen in den nächsten Tagen.'),
                action: crud.belegungBuchungen.canWrite
                  ? { label: tx('Neue Buchung'), onClick: () => crud.belegungBuchungen.openCreate({ status: 'aktiv' }) }
                  : undefined,
              }}
            />
            <WorkList
              title={tx('Gäste ohne Pfoten-Porträt')}
              icon={<IconCamera size={16} />}
              items={ohnePortraet.map(h => ({
                id: h.record_id,
                title: h.fields.name ?? '—',
                secondLine: <span className="text-muted-foreground">{crud.enriched.hundekartei.find(x => x.record_id === h.record_id)?.besitzerName}</span>,
                action: crud.pfotenPortraet.canWrite ? {
                  label: tx('Porträt anlegen'),
                  onClick: () => crud.pfotenPortraet.openCreate({
                    hund: h.record_id,
                    besitzer: extractRecordId(h.fields.besitzer) ?? undefined,
                  }),
                } : undefined,
              }))}
              onItemClick={id => {
                const h = hundekartei.find(x => x.record_id === id);
                if (h) crud.hundekartei.openDetail(h);
              }}
              empty={{ text: tx('Alle aktuellen Gäste haben ein Porträt.') }}
            />
            <WorkList
              title={tx('Impfstatus prüfen')}
              icon={<IconVaccine size={16} />}
              items={impfLuecke.map(h => ({
                id: h.record_id,
                title: h.fields.name ?? '—',
                secondLine: (
                  <span className="font-medium text-destructive">
                    {h.fields.impfstatus?.label ?? tx('Unbekannt')}
                  </span>
                ),
                action: crud.hundekartei.canWrite ? {
                  label: tx('Ergänzen'),
                  onClick: () => crud.hundekartei.openEdit(h),
                } : undefined,
              }))}
              onItemClick={id => {
                const h = hundekartei.find(x => x.record_id === id);
                if (h) crud.hundekartei.openDetail(h);
              }}
              empty={{ text: tx('Alle aktuellen Gäste sind vollständig geimpft.') }}
            />
          </>
        }
      />
      {crud.surfaces}
    </div>
  );
}
