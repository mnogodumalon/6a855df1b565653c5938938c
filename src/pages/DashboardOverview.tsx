import { useMemo, useState } from 'react';
import { format, addDays, parseISO } from 'date-fns';
import { IconPlus, IconPaw, IconAlertTriangle } from '@tabler/icons-react';
import type { DashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import { flowActionFor } from '@/config/plan';
import { tx, appLabel } from '@/i18n';
import { LOOKUP_OPTIONS, lookupOption } from '@/types/app';
import { LivingAppsService, extractRecordId } from '@/services/livingAppsService';
import { formatDate, lookupKey } from '@/lib/formatters';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import { Button } from '@/components/ui/button';
import { DashboardGrid } from '@/components/DashboardGrid';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { WorkList } from '@/components/WorkList';
import { ResourceTimeline, type ResourceEvent, type ResourceGroup } from '@/components/widgets/ResourceTimeline';

// Layout: kein Hero (Anfragen sind eine Arbeitsliste, kein Alarm); variant="wide" — die
// Belegungs-Zeitleiste braucht die volle Breite, darunter vier Arbeitslisten auf eigenen Achsen.
export default function DashboardOverview({ data }: { data: DashboardData }) {
  const {
    hundekartei, belegungBuchungen, buchungsanfragen, pfotenPortraet,
    setBelegungBuchungen, fetchAll,
  } = data;
  const crud = useEntityCrud(data, {
    footer: (top) => {
      if (top.type === 'buchungsanfragen' && lookupKey(top.record.fields.anfrage_status) === 'neu') {
        const go = flowActionFor('buchungsanfragen', 'anfrage_status', top.record.record_id, 'bestaetigt');
        return go ? { label: tx('Anfrage bestätigen'), onClick: go } : undefined;
      }
      if (top.type === 'belegungBuchungen' && lookupKey(top.record.fields.status) === 'aktiv') {
        const go = flowActionFor('belegung_buchungen', 'status', top.record.record_id);
        return go ? { label: tx('Aufenthalt abschließen'), onClick: go } : undefined;
      }
      return undefined;
    },
  });
  const enrichedBelegung = crud.enriched.belegungBuchungen;
  const enrichedPortraets = crud.enriched.pfotenPortraet;

  const clock = useClock();
  const today = format(clock, 'yyyy-MM-dd');
  const [onlyGaps, setOnlyGaps] = useState(false);

  const hundById = useMemo(() => new Map(hundekartei.map(h => [h.record_id, h])), [hundekartei]);
  const hasGap = (hundUrl: string | undefined) => {
    const h = hundById.get(extractRecordId(hundUrl) ?? '');
    return !!h && lookupKey(h.fields.impfstatus) !== 'vollstaendig';
  };

  const live = enrichedBelegung.filter(b => lookupKey(b.fields.status) !== 'storniert');
  const active = live.filter(b => lookupKey(b.fields.status) === 'aktiv');
  const guestsNow = active.filter(b => (b.fields.anreisedatum ?? '') <= today && (b.fields.abreisedatum ?? '9999') >= today);
  const arrivals = active.filter(b => b.fields.anreisedatum === today);
  const departures = active.filter(b => b.fields.abreisedatum === today);
  const horizon = format(addDays(clock, 14), 'yyyy-MM-dd');
  const upcoming = active.filter(b => (b.fields.abreisedatum ?? '9999') >= today && (b.fields.anreisedatum ?? '') <= horizon);
  const gapStays = upcoming.filter(b => hasGap(b.fields.hund));
  const newRequests = buchungsanfragen
    .filter(r => lookupKey(r.fields.anfrage_status) === 'neu')
    .sort((a, b) => (a.fields.wunsch_anreise ?? '').localeCompare(b.fields.wunsch_anreise ?? ''));
  const recentPortraits = [...enrichedPortraets]
    .sort((a, b) => (b.fields.erstellungsdatum ?? b.createdat).localeCompare(a.fields.erstellungsdatum ?? a.createdat));

  const platzOptions = LOOKUP_OPTIONS.belegung_buchungen.platznummer;
  const groups: ResourceGroup[] = platzOptions.map(o => ({ key: o.key, label: o.label }));
  const events: ResourceEvent[] = (onlyGaps ? live.filter(b => hasGap(b.fields.hund)) : live)
    .filter(b => b.fields.anreisedatum && lookupKey(b.fields.platznummer))
    .map(b => ({
      id: `belegung:${b.record_id}`,
      start: b.fields.anreisedatum!,
      end: b.fields.abreisedatum,
      allDay: true,
      title: b.hundName || tx('Gast'),
      subtitle: b.besitzerName || undefined,
      tone: hasGap(b.fields.hund) ? 'warning' : lookupKey(b.fields.status) === 'abgeschlossen' ? 'default' : 'primary',
      group: lookupKey(b.fields.platznummer) ?? '',
    }));

  // Ein Platz darf nicht doppelt belegt sein — gilt für Drag und Resize.
  const ruleViolation = (id: string, start: string, end: string | undefined, platz: string): string | null => {
    const clash = live.find(o =>
      o.record_id !== id && lookupKey(o.fields.platznummer) === platz &&
      (o.fields.anreisedatum ?? '') <= (end ?? start) && (o.fields.abreisedatum ?? o.fields.anreisedatum ?? '') >= start);
    return clash ? tx`Platz bereits belegt von ${clash.hundName}` : null;
  };

  const patchStay = async (eventId: string, start: string, end: string | undefined, newGroup?: string) => {
    const rid = eventId.split(':')[1] ?? '';
    const rec = belegungBuchungen.find(b => b.record_id === rid);
    if (!rec) return;
    const platz = newGroup ?? lookupKey(rec.fields.platznummer) ?? '';
    const blocked = ruleViolation(rid, start, end, platz);
    if (blocked) return blocked;
    const before = rec.fields;
    const next = {
      ...before, anreisedatum: start, ...(end ? { abreisedatum: end } : {}),
      ...(newGroup ? { platznummer: lookupOption('belegung_buchungen', 'platznummer', newGroup) } : {}),
    };
    setBelegungBuchungen(prev => prev.map(b => b.record_id === rid ? { ...b, fields: next } : b));
    const payload = {
      anreisedatum: start, ...(end ? { abreisedatum: end } : {}), ...(newGroup ? { platznummer: newGroup } : {}),
    };
    try {
      await LivingAppsService.updateBelegungBuchungenEntry(rid, payload);
      undoToast(tx`Aufenthalt verschoben`, () => {
        setBelegungBuchungen(prev => prev.map(b => b.record_id === rid ? { ...b, fields: before } : b));
        void LivingAppsService.updateBelegungBuchungenEntry(rid, {
          anreisedatum: before.anreisedatum, abreisedatum: before.abreisedatum, platznummer: lookupKey(before.platznummer),
        }).catch(() => fetchAll());
      });
    } catch {
      void fetchAll();
    }
    return undefined;
  };

  const openStay = (id: string) => {
    const rec = belegungBuchungen.find(b => b.record_id === id);
    if (rec) crud.belegungBuchungen.openDetail(rec);
  };

  const gaps = (n: number) => (n === 1 ? tx`Impflücke` : tx`Impflücken`);
  const contextLine = (() => {
    if (arrivals.length || departures.length) {
      const parts: string[] = [];
      if (arrivals.length) parts.push(tx`Heute kommt ${namen(arrivals.map(b => b.hundName))}`);
      if (departures.length) parts.push(tx`${namen(departures.map(b => b.hundName))} geht nach Hause`);
      return parts.join(' — ') + '.';
    }
    if (guestsNow.length) return tx`Zu Gast sind ${namen(guestsNow.map(b => b.hundName), 3)} — heute keine Wechsel.`;
    if (newRequests.length) return tx`Anfrage von ${namen(newRequests.map(r => r.fields.interessent_nachname ?? ''))} wartet auf dich.`;
    return tx`Gerade ist es ruhig — Zeit für ein neues Pfoten-Porträt.`;
  })();

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{gruss(clock)}</h1>
          <p className="text-sm text-muted-foreground">{contextLine}</p>
        </div>
        {crud.belegungBuchungen.canWrite && (
          <Button onClick={() => crud.belegungBuchungen.openCreate({ anreisedatum: today })} className="w-full sm:w-auto">
            <IconPlus size={16} className="shrink-0" /> {tx('Aufenthalt planen')}
          </Button>
        )}
      </div>

      <DashboardGrid
        variant="wide"
        kpis={
          <StatStrip>
            <StatStripItem
              title={tx('Plätze heute belegt')}
              value={`${guestsNow.length} / ${platzOptions.length}`}
              icon={<IconPaw size={18} className="text-muted-foreground" />}
            />
            <StatStripItem
              title={tx('Impfstatus offen (14 Tage)')}
              value={gapStays.length}
              icon={<IconAlertTriangle size={18} className="text-muted-foreground" />}
              tone={gapStays.length > 0 ? 'warning' : 'default'}
              onClick={() => setOnlyGaps(v => !v)}
              active={onlyGaps}
            />
          </StatStrip>
        }
        primary={
          <ResourceTimeline
            axis="day"
            defaultRange="2weeks"
            events={events}
            groups={groups}
            onEventClick={ev => openStay(ev.id.split(':')[1] ?? '')}
            onEventDrop={(id, s, e, g) => patchStay(id, s, e, g)}
            onEventResize={(id, s, e) => patchStay(id, s, e)}
            onEmptyClick={(date, group) => crud.belegungBuchungen.openCreate({
              anreisedatum: format(date, 'yyyy-MM-dd'), platznummer: group,
            })}
            onRangeCreate={(start, end, group) => crud.belegungBuchungen.openCreate({
              anreisedatum: format(start, 'yyyy-MM-dd'), abreisedatum: format(end, 'yyyy-MM-dd'), platznummer: group,
            })}
          />
        }
        aside={
          <>
            <WorkList
              title={tx('Neue Anfragen')}
              items={newRequests.map(r => {
                const go = flowActionFor('buchungsanfragen', 'anfrage_status', r.record_id, 'bestaetigt');
                return {
                  id: r.record_id,
                  title: `${r.fields.interessent_vorname ?? ''} ${r.fields.interessent_nachname ?? ''}`.trim(),
                  secondLine: (
                    <>
                      <span className="font-medium text-primary">{r.fields.hund_name ?? tx('Hund')}</span>
                      <span className="text-muted-foreground"> · {formatDate(r.fields.wunsch_anreise)} – {formatDate(r.fields.wunsch_abreise)}</span>
                    </>
                  ),
                  action: go ? { label: tx('Prüfen'), onClick: go } : undefined,
                };
              })}
              onItemClick={id => {
                const r = buchungsanfragen.find(x => x.record_id === id);
                if (r) crud.buchungsanfragen.openDetail(r);
              }}
              empty={{ text: tx('Keine offenen Anfragen — alles beantwortet.') }}
            />
            <WorkList
              title={tx('Heute: An- und Abreisen')}
              items={[
                ...arrivals.map(b => ({
                  id: b.record_id,
                  title: b.hundName,
                  secondLine: (
                    <>
                      <span className="font-medium text-emerald-600">{tx('Anreise')}</span>
                      <span className="text-muted-foreground"> · {b.fields.platznummer?.label} · {b.besitzerName}</span>
                    </>
                  ),
                })),
                ...departures.map(b => {
                  const go = flowActionFor('belegung_buchungen', 'status', b.record_id);
                  return {
                    id: b.record_id,
                    title: b.hundName,
                    secondLine: (
                      <>
                        <span className="font-medium text-amber-600">{tx('Abreise')}</span>
                        <span className="text-muted-foreground"> · {b.fields.platznummer?.label} · {b.besitzerName}</span>
                      </>
                    ),
                    action: go ? { label: tx('Abschließen'), onClick: go } : undefined,
                  };
                }),
              ]}
              onItemClick={openStay}
              empty={{
                text: tx('Heute keine Wechsel.'),
                action: crud.belegungBuchungen.canWrite
                  ? { label: tx('Aufenthalt planen'), onClick: () => crud.belegungBuchungen.openCreate({ anreisedatum: today }) }
                  : undefined,
              }}
            />
            <WorkList
              title={tx('Impfstatus prüfen')}
              items={gapStays.map(b => {
                const h = hundById.get(extractRecordId(b.fields.hund) ?? '');
                return {
                  id: b.record_id,
                  title: b.hundName,
                  secondLine: (
                    <>
                      <span className="font-medium text-amber-600">{h?.fields.impfstatus?.label ?? gaps(1)}</span>
                      <span className="text-muted-foreground"> · {tx`ab ${formatDate(b.fields.anreisedatum)}`}</span>
                    </>
                  ),
                  action: h && crud.hundekartei.canWrite
                    ? { label: tx('Hund öffnen'), onClick: () => crud.hundekartei.openEdit(h) }
                    : undefined,
                };
              })}
              onItemClick={openStay}
              empty={{ text: tx('Alle Gäste der nächsten 14 Tage sind vollständig geimpft.') }}
            />
            <WorkList
              title={tx('Zuletzt erstellte Porträts')}
              items={recentPortraits.map(p => ({
                id: p.record_id,
                title: p.fields.titel || p.hundName,
                secondLine: (
                  <span className="text-muted-foreground">
                    {p.hundName} · {formatDate(p.fields.erstellungsdatum ?? format(parseISO(p.createdat), 'yyyy-MM-dd'))}
                  </span>
                ),
              }))}
              max={4}
              onItemClick={id => {
                const p = pfotenPortraet.find(x => x.record_id === id);
                if (p) crud.pfotenPortraet.openDetail(p);
              }}
              empty={{ text: tx('Noch kein Porträt — das erste wartet auf einen Gast.') }}
            />
          </>
        }
      />
      {crud.surfaces}
    </div>
  );
}
