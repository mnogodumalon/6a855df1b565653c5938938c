import { useMemo } from 'react';
import { format, parseISO, addDays } from 'date-fns';
import { IconPlus, IconInbox, IconCalendarEvent, IconCamera, IconDog } from '@tabler/icons-react';
import type { DashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import { flowActionFor } from '@/config/plan';
import { LivingAppsService, extractRecordId } from '@/services/livingAppsService';
import { LOOKUP_OPTIONS, lookupOption } from '@/types/app';
import type { BelegungBuchungen } from '@/types/app';
import { lookupKey, formatDate } from '@/lib/formatters';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import { tx, dateFnsLocale } from '@/i18n';
import { DashboardGrid } from '@/components/DashboardGrid';
import { WorkList } from '@/components/WorkList';
import { HeroBanner } from '@/components/HeroBanner';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { Button } from '@/components/ui/button';
import {
  ResourceTimeline,
  type ResourceEvent,
  type ResourceGroup,
} from '@/components/widgets/ResourceTimeline';

const EVENT_PREFIX = 'buchung';

export default function DashboardOverview({ data }: { data: DashboardData }) {
  const { belegungBuchungen, buchungsanfragen, pfotenPortraet, setBelegungBuchungen, fetchAll } = data;
  const crud = useEntityCrud(data, {
    footer: (top) => {
      if (top.type === 'buchungsanfragen' && lookupKey(top.record.fields.anfrage_status) === 'neu') {
        const go = flowActionFor('buchungsanfragen', 'anfrage_status', top.record.record_id, 'bestaetigt');
        return go ? { label: tx('Anfrage prüfen & bestätigen'), onClick: go } : undefined;
      }
      if (top.type === 'belegungBuchungen' && lookupKey(top.record.fields.status) === 'aktiv') {
        const go = flowActionFor('belegung_buchungen', 'status', top.record.record_id, 'abgeschlossen');
        return go ? { label: tx('Aufenthalt abschließen'), onClick: go } : undefined;
      }
      return undefined;
    },
  });
  const enrichedBuchungen = crud.enriched.belegungBuchungen;

  const clock = useClock();
  const today = format(clock, 'yyyy-MM-dd');
  const tomorrow = format(addDays(clock, 1), 'yyyy-MM-dd');

  const plaetze = LOOKUP_OPTIONS['belegung_buchungen']?.platznummer ?? [];
  const groups: ResourceGroup[] = plaetze.map((p) => ({ key: p.key, label: p.label }));

  const aktive = useMemo(
    () => enrichedBuchungen.filter((b) => lookupKey(b.fields.status) === 'aktiv'),
    [enrichedBuchungen],
  );

  const events = useMemo<ResourceEvent[]>(
    () =>
      enrichedBuchungen
        .filter((b) => !!b.fields.anreisedatum && lookupKey(b.fields.status) !== 'storniert')
        .map((b) => ({
          id: `${EVENT_PREFIX}:${b.record_id}`,
          start: b.fields.anreisedatum!.slice(0, 10),
          end: b.fields.abreisedatum?.slice(0, 10),
          allDay: true,
          title: b.hundName || b.besitzerName || tx('Gast'),
          subtitle: b.besitzerName || undefined,
          tone: lookupKey(b.fields.status) === 'aktiv' ? 'primary' : 'default',
          group: lookupKey(b.fields.platznummer) ?? '',
        })),
    [enrichedBuchungen],
  );

  const neueAnfragen = useMemo(
    () =>
      buchungsanfragen
        .filter((a) => lookupKey(a.fields.anfrage_status) === 'neu')
        .sort((a, b) => (a.fields.wunsch_anreise ?? '').localeCompare(b.fields.wunsch_anreise ?? '')),
    [buchungsanfragen],
  );

  const aktuelleGaeste = aktive.filter(
    (b) => (b.fields.anreisedatum ?? '').slice(0, 10) <= today && (b.fields.abreisedatum ?? '9999').slice(0, 10) >= today,
  );
  const anreisenHeute = aktive.filter((b) => (b.fields.anreisedatum ?? '').slice(0, 10) === today);
  const abreisenFaellig = aktive.filter((b) => !!b.fields.abreisedatum && b.fields.abreisedatum.slice(0, 10) <= today);
  const belegtHeute = new Set(aktuelleGaeste.map((b) => lookupKey(b.fields.platznummer)).filter(Boolean)).size;
  const belegtMorgen = new Set(
    aktive
      .filter((b) => (b.fields.anreisedatum ?? '').slice(0, 10) <= tomorrow && (b.fields.abreisedatum ?? '9999').slice(0, 10) >= tomorrow)
      .map((b) => lookupKey(b.fields.platznummer))
      .filter(Boolean),
  ).size;
  const totalPlaetze = plaetze.length || 12;

  const hundeMitPortraet = new Set(pfotenPortraet.map((p) => extractRecordId(p.fields.hund)).filter(Boolean));
  const ohnePortraet = aktuelleGaeste.filter((b) => {
    const id = extractRecordId(b.fields.hund);
    return !!id && !hundeMitPortraet.has(id);
  });

  const rawOf = (id: string) => belegungBuchungen.find((b) => b.record_id === id);

  // Overlap rule: one dog per Platz and day (departure day counts as occupied, matching the bars).
  const ruleViolation = (id: string, platz: string, start: string, end: string): string | null => {
    const clash = belegungBuchungen.find((o) => {
      if (o.record_id === id) return false;
      if (lookupKey(o.fields.status) === 'storniert') return false;
      if (lookupKey(o.fields.platznummer) !== platz) return false;
      const os = (o.fields.anreisedatum ?? '').slice(0, 10);
      const oe = (o.fields.abreisedatum ?? o.fields.anreisedatum ?? '').slice(0, 10);
      return !!os && os <= end && oe >= start;
    });
    return clash ? tx('Dieser Platz ist in dem Zeitraum bereits belegt.') : null;
  };

  const patchBooking = (id: string, patch: Partial<BelegungBuchungen['fields']>, apiPatch: Record<string, string>) => {
    const before = rawOf(id);
    if (!before) return;
    setBelegungBuchungen((prev) => prev.map((b) => (b.record_id === id ? { ...b, fields: { ...b.fields, ...patch } } : b)));
    const snapshot = {
      anreisedatum: before.fields.anreisedatum,
      abreisedatum: before.fields.abreisedatum,
      platznummer: lookupKey(before.fields.platznummer),
    };
    LivingAppsService.updateBelegungBuchungenEntry(id, apiPatch).catch(() => void fetchAll());
    undoToast(tx('Aufenthalt verschoben'), () => {
      setBelegungBuchungen((prev) => prev.map((b) => (b.record_id === id ? { ...b, fields: { ...b.fields, ...before.fields } } : b)));
      LivingAppsService.updateBelegungBuchungenEntry(id, {
        ...(snapshot.anreisedatum ? { anreisedatum: snapshot.anreisedatum } : {}),
        ...(snapshot.abreisedatum ? { abreisedatum: snapshot.abreisedatum } : {}),
        ...(snapshot.platznummer ? { platznummer: snapshot.platznummer } : {}),
      }).catch(() => void fetchAll());
    });
  };

  const onEventDrop = (evId: string, newStart: string, newEnd?: string, newGroup?: string) => {
    const id = evId.split(':')[1] ?? '';
    const rec = rawOf(id);
    if (!rec) return;
    const platz = newGroup ?? lookupKey(rec.fields.platznummer) ?? '';
    const start = newStart.slice(0, 10);
    const end = (newEnd ?? rec.fields.abreisedatum ?? newStart).slice(0, 10);
    const msg = ruleViolation(id, platz, start, end);
    if (msg) return msg;
    const patch: Partial<BelegungBuchungen['fields']> = { anreisedatum: start };
    const api: Record<string, string> = { anreisedatum: start };
    if (newEnd) { patch.abreisedatum = end; api.abreisedatum = end; }
    if (newGroup) { patch.platznummer = lookupOption('belegung_buchungen', 'platznummer', newGroup); api.platznummer = newGroup; }
    patchBooking(id, patch, api);
    return undefined;
  };

  const onEventResize = (evId: string, newStart: string, newEnd: string) => {
    const id = evId.split(':')[1] ?? '';
    const rec = rawOf(id);
    if (!rec) return;
    const start = newStart.slice(0, 10);
    const end = newEnd.slice(0, 10);
    const msg = ruleViolation(id, lookupKey(rec.fields.platznummer) ?? '', start, end);
    if (msg) return msg;
    patchBooking(id, { anreisedatum: start, abreisedatum: end }, { anreisedatum: start, abreisedatum: end });
    return undefined;
  };

  // Context line — names in every branch
  const kommen = namen(anreisenHeute.map((b) => b.hundName || b.besitzerName));
  const gehen = namen(abreisenFaellig.map((b) => b.hundName || b.besitzerName));
  const bleiben = namen(aktuelleGaeste.map((b) => b.hundName || b.besitzerName), 3);
  let context: string;
  if (kommen && gehen) context = tx`Heute kommt ${kommen} — und ${gehen} reist ab.`;
  else if (kommen) context = tx`Heute kommt ${kommen}.`;
  else if (gehen) context = tx`Heute reist ${gehen} ab.`;
  else if (bleiben) context = tx`Zu Gast sind gerade ${bleiben}.`;
  else context = tx('Gerade ist kein Hund zu Gast — Zeit für neue Buchungen.');

  const firstNeu = neueAnfragen[0];
  const anfrageName = (a: (typeof neueAnfragen)[number]) =>
    a.fields.hund_name || [a.fields.interessent_vorname, a.fields.interessent_nachname].filter(Boolean).join(' ') || tx('Anfrage');
  const confirmAnfrage = (id: string) => flowActionFor('buchungsanfragen', 'anfrage_status', id, 'bestaetigt');

  const heroAction = firstNeu
    ? (() => {
        const go = confirmAnfrage(firstNeu.record_id);
        return go
          ? { label: tx('Anfrage prüfen'), onClick: go }
          : { label: tx('Anfrage öffnen'), onClick: () => crud.buchungsanfragen.openDetail(firstNeu) };
      })()
    : null;

  const canCreate = crud.belegungBuchungen.canWrite;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{gruss(clock)}</h1>
          <p className="text-sm text-muted-foreground">{context}</p>
        </div>
        {canCreate && (
          <Button onClick={() => crud.belegungBuchungen.openCreate({ status: 'aktiv', anreisedatum: today })}>
            <IconPlus size={16} className="shrink-0" />
            {tx('Neuer Aufenthalt')}
          </Button>
        )}
      </div>

      <DashboardGrid
        variant="wide"
        hero={
          firstNeu && heroAction ? (
            <HeroBanner icon={<IconInbox size={18} />} tone="warning" action={heroAction}>
              {neueAnfragen.length === 1 ? (
                <>
                  <b>{anfrageName(firstNeu)}</b> {tx('wartet auf deine Antwort')}
                  {firstNeu.fields.wunsch_anreise ? ` — ${formatDate(firstNeu.fields.wunsch_anreise)}` : ''}
                </>
              ) : (
                <>
                  <b>{namen(neueAnfragen.map(anfrageName), 3)}</b> {tx('warten auf deine Antwort')}
                  {firstNeu.fields.wunsch_anreise ? ` — ${tx('früheste Anreise')} ${formatDate(firstNeu.fields.wunsch_anreise)}` : ''}
                </>
              )}
            </HeroBanner>
          ) : undefined
        }
        kpis={
          <StatStrip>
            <StatStripItem
              title={tx('Plätze heute belegt')}
              value={`${belegtHeute} / ${totalPlaetze}`}
              icon={<IconDog size={16} className="text-muted-foreground" />}
              tone={belegtHeute >= totalPlaetze ? 'warning' : 'default'}
            />
            <StatStripItem
              title={tx('Plätze morgen belegt')}
              value={`${belegtMorgen} / ${totalPlaetze}`}
              icon={<IconCalendarEvent size={16} className="text-muted-foreground" />}
            />
            <StatStripItem
              title={tx('Gäste ohne Porträt')}
              value={ohnePortraet.length}
              icon={<IconCamera size={16} className="text-muted-foreground" />}
              tone={ohnePortraet.length > 0 ? 'primary' : 'default'}
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
            onEventClick={(ev) => {
              const rec = rawOf(ev.id.split(':')[1] ?? '');
              if (rec) crud.belegungBuchungen.openDetail(rec);
            }}
            onEventDrop={onEventDrop}
            onEventResize={onEventResize}
            onEmptyClick={
              canCreate
                ? (date, group) =>
                    crud.belegungBuchungen.openCreate({
                      status: 'aktiv',
                      platznummer: group,
                      anreisedatum: format(date, 'yyyy-MM-dd'),
                    })
                : undefined
            }
            onRangeCreate={
              canCreate
                ? (start, end, group) =>
                    crud.belegungBuchungen.openCreate({
                      status: 'aktiv',
                      platznummer: group,
                      anreisedatum: format(start, 'yyyy-MM-dd'),
                      abreisedatum: format(end, 'yyyy-MM-dd'),
                    })
                : undefined
            }
          />
        }
        aside={
          <>
            <WorkList
              title={tx('An- & Abreisen heute')}
              icon={<IconCalendarEvent size={16} />}
              items={[
                ...abreisenFaellig.map((b) => {
                  const go = flowActionFor('belegung_buchungen', 'status', b.record_id, 'abgeschlossen');
                  const overdue = (b.fields.abreisedatum ?? '').slice(0, 10) < today;
                  return {
                    id: b.record_id,
                    title: b.hundName || b.besitzerName,
                    secondLine: (
                      <>
                        <span className={overdue ? 'font-medium text-destructive' : 'font-medium text-amber-600'}>
                          {overdue ? tx('Abreise überfällig') : tx('Abreise heute')}
                        </span>
                        <span className="text-muted-foreground"> · {b.fields.platznummer?.label}</span>
                      </>
                    ),
                    action: go ? { label: tx('Abschließen'), onClick: go } : undefined,
                  };
                }),
                ...anreisenHeute
                  .filter((b) => !abreisenFaellig.includes(b))
                  .map((b) => ({
                    id: b.record_id,
                    title: b.hundName || b.besitzerName,
                    secondLine: (
                      <>
                        <span className="font-medium text-primary">{tx('Anreise heute')}</span>
                        <span className="text-muted-foreground"> · {b.fields.platznummer?.label}</span>
                      </>
                    ),
                  })),
              ]}
              onItemClick={(id) => {
                const rec = rawOf(id);
                if (rec) crud.belegungBuchungen.openDetail(rec);
              }}
              empty={{
                text: tx('Heute keine Wechsel — alles ruhig.'),
                action: canCreate
                  ? { label: tx('Neuer Aufenthalt'), onClick: () => crud.belegungBuchungen.openCreate({ status: 'aktiv' }) }
                  : undefined,
              }}
            />
            <WorkList
              title={tx('Gäste ohne Pfoten-Porträt')}
              icon={<IconCamera size={16} />}
              items={ohnePortraet.map((b) => {
                const hundId = extractRecordId(b.fields.hund);
                const besitzerId = extractRecordId(b.fields.besitzer);
                return {
                  id: b.record_id,
                  title: b.hundName || b.besitzerName,
                  secondLine: (
                    <span className="text-muted-foreground">
                      {b.fields.abreisedatum ? tx`bis ${formatDate(b.fields.abreisedatum)}` : tx('Aufenthalt läuft')}
                    </span>
                  ),
                  action: crud.pfotenPortraet.canWrite
                    ? {
                        label: tx('Porträt anlegen'),
                        onClick: () =>
                          crud.pfotenPortraet.openCreate({
                            hund: hundId ?? undefined,
                            besitzer: besitzerId ?? undefined,
                            erstellungsdatum: today,
                          }),
                      }
                    : undefined,
                };
              })}
              onItemClick={(id) => {
                const rec = rawOf(id);
                if (rec) crud.belegungBuchungen.openDetail(rec);
              }}
              empty={{
                text: aktuelleGaeste.length > 0 ? tx('Alle aktuellen Gäste haben ein Porträt.') : tx('Sobald Gäste da sind, erscheinen sie hier.'),
              }}
            />
          </>
        }
      />
      {crud.surfaces}
    </div>
  );
}
