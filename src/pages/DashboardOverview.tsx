import { useMemo } from 'react';
import { format, addDays, parseISO } from 'date-fns';
import { IconPlus, IconPaw, IconBell, IconLogin, IconCamera } from '@tabler/icons-react';
import type { DashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import { flowActionFor } from '@/config/plan';
import { LOOKUP_OPTIONS, lookupOption } from '@/types/app';
import { LivingAppsService, extractRecordId } from '@/services/livingAppsService';
import { formatDate, lookupKey } from '@/lib/formatters';
import { dateFnsLocale, tx } from '@/i18n';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import { DashboardGrid } from '@/components/DashboardGrid';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { WorkList } from '@/components/WorkList';
import { HeroBanner } from '@/components/HeroBanner';
import { Button } from '@/components/ui/button';
import { ResourceTimeline, type ResourceEvent, type ResourceGroup } from '@/components/widgets/ResourceTimeline';
import { ChartWidget, type ChartRow } from '@/components/widgets/ChartWidget';
import type { EnrichedBelegungBuchungen } from '@/types/enriched';

const EV = 'belegung';

export default function DashboardOverview({ data }: { data: DashboardData }) {
  const { belegungBuchungen, setBelegungBuchungen, buchungsanfragen, hundekartei, pfotenPortraet, fetchAll } = data;
  const crud = useEntityCrud(data);
  const stays = crud.enriched.belegungBuchungen as EnrichedBelegungBuchungen[];
  const clock = useClock();
  const today = format(clock, 'yyyy-MM-dd');
  const in3 = format(addDays(clock, 3), 'yyyy-MM-dd');

  const platzOptions = LOOKUP_OPTIONS['belegung_buchungen']?.platznummer ?? [];
  const groups: ResourceGroup[] = platzOptions.map(o => ({ key: o.key, label: o.label }));
  const totalPlaetze = platzOptions.length || 12;

  const live = useMemo(() => stays.filter(s => lookupKey(s.fields.status) !== 'storniert'), [stays]);

  const events = useMemo<ResourceEvent[]>(() => live
    .filter(s => !!s.fields.anreisedatum && !!lookupKey(s.fields.platznummer))
    .map(s => ({
      id: `${EV}:${s.record_id}`,
      start: s.fields.anreisedatum!.slice(0, 10),
      end: (s.fields.abreisedatum ?? s.fields.anreisedatum)!.slice(0, 10),
      allDay: true,
      title: s.hundName || tx('Gast'),
      subtitle: s.besitzerName || undefined,
      tone: lookupKey(s.fields.status) === 'aktiv' ? 'primary' as const : 'default' as const,
      group: lookupKey(s.fields.platznummer) ?? '',
    })), [live]);

  const active = live.filter(s => lookupKey(s.fields.status) === 'aktiv');
  const presentNow = active.filter(s => (s.fields.anreisedatum ?? '') <= today && (s.fields.abreisedatum ?? '9999') >= today);
  const occupiedCount = new Set(presentNow.map(s => lookupKey(s.fields.platznummer))).size;
  const arrivalsToday = active.filter(s => s.fields.anreisedatum?.slice(0, 10) === today);
  const departuresToday = active.filter(s => s.fields.abreisedatum?.slice(0, 10) === today);
  const arrivalsSoon = active.filter(s => { const a = s.fields.anreisedatum?.slice(0, 10) ?? ''; return a >= today && a <= in3; });
  const departuresSoon = active.filter(s => { const a = s.fields.abreisedatum?.slice(0, 10) ?? ''; return a >= today && a <= in3; });

  const newRequests = buchungsanfragen.filter(r => lookupKey(r.fields.anfrage_status) === 'neu');

  // Gäste mit Aufenthalt, aber ohne Porträt
  const portraitDogIds = new Set(pfotenPortraet.map(p => extractRecordId(p.fields.hund)).filter(Boolean));
  const withoutPortrait = useMemo(() => {
    const seen = new Set<string>();
    const out: { dogId: string; name: string; ownerId: string | null; owner: string }[] = [];
    for (const s of live) {
      const dogId = extractRecordId(s.fields.hund);
      if (!dogId || seen.has(dogId) || portraitDogIds.has(dogId)) continue;
      seen.add(dogId);
      const dog = hundekartei.find(h => h.record_id === dogId);
      out.push({ dogId, name: dog?.fields.name ?? s.hundName ?? tx('Gast'), ownerId: extractRecordId(s.fields.besitzer), owner: s.besitzerName });
    }
    return out;
  }, [live, hundekartei, pfotenPortraet]);

  const chartRows = useMemo<ChartRow<EnrichedBelegungBuchungen>[]>(
    () => stays.map(s => ({ id: `${EV}:${s.record_id}`, data: s })), [stays]);

  const openStay = (id: string) => {
    const rec = belegungBuchungen.find(b => b.record_id === id);
    if (rec) crud.belegungBuchungen.openDetail(rec);
  };

  // Regel: ein Platz darf zu einem Zeitpunkt nur einen Gast haben (Wechsel am selben Tag ist erlaubt)
  function ruleViolation(id: string, start: string, end: string, platz: string): string | null {
    const clash = live.find(s => s.record_id !== id && lookupKey(s.fields.platznummer) === platz
      && (s.fields.anreisedatum ?? '').slice(0, 10) < end && (s.fields.abreisedatum ?? s.fields.anreisedatum ?? '').slice(0, 10) > start);
    return clash ? tx`Platz bereits belegt von ${clash.hundName || tx('einem anderen Gast')}` : null;
  }

  function reschedule(evId: string, start: string, end: string | undefined, newGroup?: string): string | void {
    const id = evId.split(':')[1];
    const rec = belegungBuchungen.find(b => b.record_id === id);
    if (!rec) return;
    const platz = newGroup ?? lookupKey(rec.fields.platznummer) ?? '';
    const newEnd = end ?? rec.fields.abreisedatum ?? start;
    const msg = ruleViolation(id, start, newEnd.slice(0, 10), platz);
    if (msg) return msg;
    const before = rec.fields;
    setBelegungBuchungen(list => list.map(b => b.record_id === id ? {
      ...b, fields: { ...b.fields, anreisedatum: start, ...(end ? { abreisedatum: end } : {}),
        ...(newGroup ? { platznummer: lookupOption('belegung_buchungen', 'platznummer', newGroup) } : {}) } } : b));
    LivingAppsService.updateBelegungBuchungenEntry(id, {
      anreisedatum: start, ...(end ? { abreisedatum: end } : {}), ...(newGroup ? { platznummer: newGroup } : {}),
    }).catch(() => fetchAll());
    undoToast(tx('Aufenthalt verschoben'), () => {
      setBelegungBuchungen(list => list.map(b => b.record_id === id ? { ...b, fields: before } : b));
      LivingAppsService.updateBelegungBuchungenEntry(id, {
        anreisedatum: before.anreisedatum, abreisedatum: before.abreisedatum, platznummer: before.platznummer?.key,
      }).catch(() => fetchAll());
    });
  }

  // Kontextzeile — nennt in jedem Zweig Namen
  const dogNames = (xs: EnrichedBelegungBuchungen[]) => namen(xs.map(s => s.hundName || tx('Gast')), 3);
  const nextArrival = active
    .filter(s => (s.fields.anreisedatum ?? '') > today)
    .sort((a, b) => (a.fields.anreisedatum ?? '').localeCompare(b.fields.anreisedatum ?? ''))[0];
  let context: string;
  if (arrivalsToday.length && departuresToday.length) context = tx`Heute reisen ${dogNames(arrivalsToday)} an — ${dogNames(departuresToday)} gehen nach Hause.`;
  else if (arrivalsToday.length) context = tx`Heute reisen ${dogNames(arrivalsToday)} an.`;
  else if (departuresToday.length) context = tx`Heute gehen ${dogNames(departuresToday)} nach Hause.`;
  else if (presentNow.length) context = tx`Zu Gast sind ${dogNames(presentNow)} — keine Wechsel heute.`;
  else if (nextArrival) context = tx`Ruhiger Tag — als Nächstes kommt ${nextArrival.hundName || tx('ein Gast')} am ${formatDate(nextArrival.fields.anreisedatum)}.`;
  else context = tx('Noch keine Aufenthalte geplant — trage den ersten Gast ein.');

  const firstReq = newRequests[0];
  const reqName = (r: typeof firstReq) => `${r.fields.hund_name ?? tx('Hund')} (${r.fields.interessent_nachname ?? ''})`;
  const goConfirm = firstReq ? flowActionFor('buchungsanfragen', 'anfrage_status', firstReq.record_id, 'bestaetigt') : null;

  const hero = newRequests.length > 0 && (
    <HeroBanner
      icon={<IconBell size={18} />}
      action={goConfirm
        ? { label: tx('Anfrage prüfen'), onClick: goConfirm }
        : { label: tx('Anfrage öffnen'), onClick: () => crud.buchungsanfragen.openDetail(firstReq) }}
    >
      <b>{namen(newRequests.map(r => r.fields.hund_name ?? tx('Hund')), 3)}</b>{' '}
      {newRequests.length === 1
        ? tx`wartet auf Antwort — ${reqName(firstReq)}, Wunsch ab ${formatDate(firstReq.fields.wunsch_anreise)}.`
        : tx`warten auf Antwort — zuerst ${reqName(firstReq)}, Wunsch ab ${formatDate(firstReq.fields.wunsch_anreise)}.`}
    </HeroBanner>
  );

  const stayLabel = (s: EnrichedBelegungBuchungen) => s.hundName || tx('Gast');
  const wechsel = [
    ...arrivalsSoon.map(s => ({ s, kind: 'an' as const, day: s.fields.anreisedatum!.slice(0, 10) })),
    ...departuresSoon.map(s => ({ s, kind: 'ab' as const, day: s.fields.abreisedatum!.slice(0, 10) })),
  ].sort((a, b) => (a.day ?? '').localeCompare(b.day ?? ''));

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
            {tx('Neuer Aufenthalt')}
          </Button>
        )}
      </div>

      <DashboardGrid
        variant="wide"
        hero={hero}
        kpis={
          <StatStrip>
            <StatStripItem
              title={tx('Plätze belegt')}
              value={`${occupiedCount} / ${totalPlaetze}`}
              icon={<IconPaw size={16} />}
              tone={occupiedCount >= totalPlaetze ? 'warning' : 'default'}
            />
            <StatStripItem
              title={tx('Anreisen (3 Tage)')}
              value={arrivalsSoon.length}
              icon={<IconLogin size={16} />}
            />
            <StatStripItem
              title={tx('Ohne Porträt')}
              value={withoutPortrait.length}
              icon={<IconCamera size={16} />}
              tone={withoutPortrait.length > 0 ? 'warning' : 'default'}
            />
          </StatStrip>
        }
        primary={
          <ResourceTimeline
            axis="day"
            defaultRange="2weeks"
            groups={groups}
            events={events}
            locale={dateFnsLocale()}
            onEventClick={ev => openStay(ev.id.split(':')[1])}
            onEventDrop={reschedule}
            onEventResize={(id, s, e) => reschedule(id, s, e)}
            onEmptyClick={(date, group) => crud.belegungBuchungen.openCreate({
              anreisedatum: format(date, 'yyyy-MM-dd'), platznummer: group, status: 'aktiv',
            })}
            onRangeCreate={(start, end, group) => crud.belegungBuchungen.openCreate({
              anreisedatum: format(start, 'yyyy-MM-dd'), abreisedatum: format(end, 'yyyy-MM-dd'),
              platznummer: group, status: 'aktiv',
            })}
          />
        }
        aside={
          <>
            <WorkList
              title={tx('Anreisen & Abreisen')}
              items={wechsel.map(({ s, kind, day }) => ({
                id: `${kind}:${s.record_id}`,
                title: stayLabel(s),
                secondLine: (
                  <>
                    <span className="font-medium text-primary">{kind === 'an' ? tx('Anreise') : tx('Abreise')}</span>
                    <span className="text-muted-foreground"> · {format(parseISO(day), 'EEE dd.MM.', { locale: dateFnsLocale() })} · {s.fields.platznummer?.label ?? ''}</span>
                  </>
                ),
              }))}
              onItemClick={id => openStay(id.split(':')[1])}
              empty={{ text: nextArrival
                ? tx`Keine Wechsel in 3 Tagen — nächste Anreise: ${nextArrival.hundName || tx('ein Gast')}, ${formatDate(nextArrival.fields.anreisedatum)}`
                : tx('Keine Wechsel in den nächsten Tagen.') }}
            />
            <WorkList
              title={tx('Gäste ohne Pfoten-Porträt')}
              items={withoutPortrait.map(w => ({
                id: w.dogId,
                title: w.name,
                secondLine: <span className="text-muted-foreground">{w.owner}</span>,
                action: crud.pfotenPortraet.canWrite
                  ? { label: tx('Porträt anlegen'), onClick: () => crud.pfotenPortraet.openCreate({ hund: w.dogId, ...(w.ownerId ? { besitzer: w.ownerId } : {}) }) }
                  : undefined,
              }))}
              onItemClick={id => { const d = hundekartei.find(h => h.record_id === id); if (d) crud.hundekartei.openDetail(d); }}
              empty={{ text: tx('Alle Gäste haben ein Porträt.') }}
            />
            <ChartWidget<EnrichedBelegungBuchungen>
              title={tx('Buchungen nach Status')}
              rows={chartRows}
              dimension={{ kind: 'category', accessor: r => r.data.fields.status, label: tx('Status') }}
              tone={seg => (seg.key === 'storniert' ? 'destructive' : 'default')}
              interaction={{
                mode: 'drill',
                onSegmentClick: seg => openStay(seg.rowIds[0].split(':')[1]),
              }}
            />
          </>
        }
      />
      {crud.surfaces}
    </div>
  );
}
