import { useMemo, useState } from 'react';
import { format, parseISO, addDays } from 'date-fns';
import { IconPlus, IconInbox, IconBed, IconPlaneArrival, IconPlaneDeparture, IconPaw } from '@tabler/icons-react';
import type { DashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import { flowActionFor } from '@/config/plan';
import { LOOKUP_OPTIONS, lookupOption } from '@/types/app';
import type { BelegungBuchungen } from '@/types/app';
import { LivingAppsService, extractRecordId } from '@/services/livingAppsService';
import { formatDate, lookupKey } from '@/lib/formatters';
import { gruss, namen, useClock, undoToast } from '@/lib/polish';
import { tx, dateFnsLocale } from '@/i18n';
import { Button } from '@/components/ui/button';
import { DashboardGrid } from '@/components/DashboardGrid';
import { HeroBanner } from '@/components/HeroBanner';
import { WorkList } from '@/components/WorkList';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import {
  ResourceTimeline,
  type ResourceEvent,
  type ResourceGroup,
} from '@/components/widgets/ResourceTimeline';

const dayKey = (d: Date) => format(d, 'yyyy-MM-dd');
const day = (s?: string) => (s ? s.slice(0, 10) : '');

export default function DashboardOverview({ data }: { data: DashboardData }) {
  const { buchungsanfragen, belegungBuchungen, setBelegungBuchungen, fetchAll } = data;
  const crud = useEntityCrud(data, {
    footer: (top) => {
      if (top.type === 'belegungBuchungen' && lookupKey(top.record.fields.status) === 'aktiv') {
        const go = flowActionFor('belegung_buchungen', 'status', top.record.record_id, 'abgeschlossen');
        return go ? { label: tx('Aufenthalt abschließen'), onClick: go } : undefined;
      }
      if (top.type === 'buchungsanfragen' && lookupKey(top.record.fields.anfrage_status) === 'neu') {
        const go = flowActionFor('buchungsanfragen', 'anfrage_status', top.record.record_id, 'bestaetigt');
        return go ? { label: tx('Anfrage prüfen'), onClick: go } : undefined;
      }
      return undefined;
    },
  });
  const stays = crud.enriched.belegungBuchungen;
  const portraits = crud.enriched.pfotenPortraet;
  const clock = useClock();
  const todayKey = dayKey(clock);
  const [filter, setFilter] = useState<'all' | 'anreise' | 'abreise'>('all');

  const platzOptions = LOOKUP_OPTIONS['belegung_buchungen']?.platznummer ?? [];
  const groups: ResourceGroup[] = platzOptions.map((o) => ({ key: o.key, label: o.label }));
  const totalPlaetze = platzOptions.length || 12;

  const live = useMemo(
    () => stays.filter((s) => lookupKey(s.fields.status) !== 'storniert'),
    [stays],
  );
  const active = useMemo(() => live.filter((s) => lookupKey(s.fields.status) === 'aktiv'), [live]);

  const inHouse = active.filter((s) => day(s.fields.anreisedatum) <= todayKey && todayKey <= day(s.fields.abreisedatum));
  const occupiedPlaces = new Set(inHouse.map((s) => lookupKey(s.fields.platznummer)).filter(Boolean)).size;
  const freePlaces = Math.max(0, totalPlaetze - occupiedPlaces);

  const horizon = dayKey(addDays(clock, 7));
  const arrivals = active
    .filter((s) => day(s.fields.anreisedatum) >= todayKey && day(s.fields.anreisedatum) <= horizon)
    .sort((a, b) => day(a.fields.anreisedatum).localeCompare(day(b.fields.anreisedatum)));
  const departures = active
    .filter((s) => day(s.fields.abreisedatum) >= todayKey && day(s.fields.abreisedatum) <= horizon)
    .sort((a, b) => day(a.fields.abreisedatum).localeCompare(day(b.fields.abreisedatum)));

  const newRequests = useMemo(
    () =>
      buchungsanfragen
        .filter((r) => lookupKey(r.fields.anfrage_status) === 'neu')
        .sort((a, b) => day(a.fields.wunsch_anreise).localeCompare(day(b.fields.wunsch_anreise))),
    [buchungsanfragen],
  );

  const events: ResourceEvent[] = live
    .filter((s) => s.fields.anreisedatum && lookupKey(s.fields.platznummer))
    .map((s) => ({
      id: `buchung:${s.record_id}`,
      start: day(s.fields.anreisedatum),
      end: day(s.fields.abreisedatum) || undefined,
      allDay: true,
      title: s.hundName || tx('Gast'),
      subtitle: s.besitzerName || undefined,
      tone: lookupKey(s.fields.status) === 'aktiv' ? 'primary' : 'default',
      group: lookupKey(s.fields.platznummer) ?? '',
    }));

  const nameOf = (s: { hundName: string; besitzerName: string }) => s.hundName || s.besitzerName || tx('Gast');

  // Rule: one dog per place — no overlapping stays on the same place.
  const ruleViolation = (id: string, platz: string, start: string, end: string): string | null => {
    const clash = live.find(
      (o) =>
        o.record_id !== id &&
        lookupKey(o.fields.platznummer) === platz &&
        day(o.fields.anreisedatum) < (end || start) &&
        start < day(o.fields.abreisedatum),
    );
    return clash ? tx`Der Platz ist in diesem Zeitraum schon an ${nameOf(clash)} vergeben.` : null;
  };

  const moveStay = (id: string, newStart: string, newEnd?: string, newGroup?: string): string | void => {
    const rid = id.split(':')[1];
    const rec = belegungBuchungen.find((b) => b.record_id === rid);
    if (!rec) return;
    const start = day(newStart);
    const end = newEnd ? day(newEnd) : day(rec.fields.abreisedatum);
    const platz = newGroup ?? lookupKey(rec.fields.platznummer) ?? '';
    const err = ruleViolation(rid, platz, start, end);
    if (err) return err;
    const before = rec.fields;
    const patch: Partial<BelegungBuchungen['fields']> = {
      anreisedatum: start,
      abreisedatum: end || undefined,
      ...(newGroup ? { platznummer: lookupOption('belegung_buchungen', 'platznummer', newGroup) } : {}),
    };
    setBelegungBuchungen((prev) => prev.map((b) => (b.record_id === rid ? { ...b, fields: { ...b.fields, ...patch } } : b)));
    const wire = {
      anreisedatum: start,
      ...(end ? { abreisedatum: end } : {}),
      ...(newGroup ? { platznummer: newGroup } : {}),
    };
    LivingAppsService.updateBelegungBuchungenEntry(rid, wire).catch(() => fetchAll());
    undoToast(tx`${nameOf(stays.find((s) => s.record_id === rid) ?? { hundName: '', besitzerName: '' })} — verschoben`, () => {
      setBelegungBuchungen((prev) => prev.map((b) => (b.record_id === rid ? { ...b, fields: before } : b)));
      LivingAppsService.updateBelegungBuchungenEntry(rid, {
        anreisedatum: day(before.anreisedatum),
        abreisedatum: day(before.abreisedatum),
        platznummer: lookupKey(before.platznummer),
      }).catch(() => fetchAll());
    });
  };

  // Header sentence — names in every branch
  const arrToday = arrivals.filter((s) => day(s.fields.anreisedatum) === todayKey);
  const depToday = departures.filter((s) => day(s.fields.abreisedatum) === todayKey);
  const hundNames = (xs: typeof stays) => namen(xs.map(nameOf));
  let context: string;
  if (arrToday.length > 0 && depToday.length > 0) context = tx`Heute kommt ${hundNames(arrToday)} an, ${hundNames(depToday)} wird abgeholt.`;
  else if (arrToday.length > 0) context = tx`Heute kommt ${hundNames(arrToday)} an.`;
  else if (depToday.length > 0) context = tx`Heute wird ${hundNames(depToday)} abgeholt.`;
  else if (inHouse.length > 0) context = tx`Zu Gast sind gerade ${hundNames(inHouse)}.`;
  else if (arrivals.length > 0) context = tx`Nächste Anreise: ${nameOf(arrivals[0])} am ${formatDate(arrivals[0].fields.anreisedatum)}.`;
  else context = tx`Gerade ist die Pension leer — Zeit für neue Buchungen.`;

  const listRows = (filter === 'abreise' ? departures : filter === 'anreise' ? arrivals : [...arrivals, ...departures.filter((d) => !arrivals.includes(d))])
    .slice()
    .sort((a, b) => {
      const ka = filter === 'abreise' ? day(a.fields.abreisedatum) : day(a.fields.anreisedatum);
      const kb = filter === 'abreise' ? day(b.fields.abreisedatum) : day(b.fields.anreisedatum);
      return ka.localeCompare(kb);
    });

  const isDeparture = (s: (typeof stays)[number]) => filter === 'abreise' || (filter === 'all' && !arrivals.includes(s));

  // Portrait reminders for completed stays
  const doneStays = stays
    .filter((s) => lookupKey(s.fields.status) === 'abgeschlossen')
    .sort((a, b) => day(b.fields.abreisedatum).localeCompare(day(a.fields.abreisedatum)));
  const portraitFor = (hundUrl?: string) => {
    const id = extractRecordId(hundUrl);
    return id ? portraits.find((p) => extractRecordId(p.fields.hund) === id) : undefined;
  };

  const firstReq = newRequests[0];
  const reqGo = firstReq ? flowActionFor('buchungsanfragen', 'anfrage_status', firstReq.record_id, 'bestaetigt') : null;

  const weekday = (s?: string) => (s ? format(parseISO(day(s)), 'EEE, d. MMM', { locale: dateFnsLocale() }) : '');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{gruss(clock)}</h1>
          <p className="text-sm text-muted-foreground">{context}</p>
        </div>
        {crud.belegungBuchungen.canWrite && (
          <Button onClick={() => crud.belegungBuchungen.openCreate({ status: 'aktiv', anreisedatum: todayKey })} className="w-full sm:w-auto">
            <IconPlus size={16} className="shrink-0" />
            {tx('Neuer Aufenthalt')}
          </Button>
        )}
      </div>

      <DashboardGrid
        variant="wide"
        hero={
          firstReq ? (
            <HeroBanner
              tone="primary"
              icon={<IconInbox size={18} />}
              action={{
                label: reqGo ? tx('Anfrage prüfen') : tx('Anfrage öffnen'),
                onClick: reqGo ?? (() => crud.buchungsanfragen.openDetail(firstReq)),
              }}
            >
              <b>{namen(newRequests.map((r) => `${r.fields.interessent_vorname ?? ''} ${r.fields.interessent_nachname ?? ''}`.trim() || (r.fields.hund_name ?? '')), 3)}</b>{' '}
              {newRequests.length === 1
                ? tx`wartet auf Antwort — ${r_dog(firstReq.fields.hund_name)} möchte ab ${formatDate(firstReq.fields.wunsch_anreise)} kommen.`
                : tx`warten auf Antwort — als Erstes ${r_dog(firstReq.fields.hund_name)} ab ${formatDate(firstReq.fields.wunsch_anreise)}.`}
            </HeroBanner>
          ) : undefined
        }
        kpis={
          <StatStrip>
            <StatStripItem
              title={tx('Heute im Haus')}
              value={`${inHouse.length} / ${totalPlaetze}`}
              icon={<IconPaw size={16} />}
              tone={occupiedPlaces >= totalPlaetze ? 'warning' : 'default'}
            />
            <StatStripItem
              title={tx('Freie Plätze heute')}
              value={freePlaces}
              icon={<IconBed size={16} />}
              tone={freePlaces === 0 ? 'warning' : 'success'}
            />
            <StatStripItem
              title={tx('Anreisen (7 Tage)')}
              value={arrivals.length}
              icon={<IconPlaneArrival size={16} />}
              onClick={() => setFilter((f) => (f === 'anreise' ? 'all' : 'anreise'))}
              active={filter === 'anreise'}
            />
            <StatStripItem
              title={tx('Abreisen (7 Tage)')}
              value={departures.length}
              icon={<IconPlaneDeparture size={16} />}
              onClick={() => setFilter((f) => (f === 'abreise' ? 'all' : 'abreise'))}
              active={filter === 'abreise'}
            />
          </StatStrip>
        }
        primary={
          <ResourceTimeline
            events={events}
            groups={groups}
            axis="day"
            defaultRange="2weeks"
            locale={dateFnsLocale()}
            onEventClick={(ev) => {
              const rec = belegungBuchungen.find((b) => b.record_id === ev.id.split(':')[1]);
              if (rec) crud.belegungBuchungen.openDetail(rec);
            }}
            onEventDrop={crud.belegungBuchungen.canWrite ? moveStay : undefined}
            onEventResize={crud.belegungBuchungen.canWrite ? (id, s, e) => moveStay(id, s, e) : undefined}
            onEmptyClick={
              crud.belegungBuchungen.canWrite
                ? (date, group) => crud.belegungBuchungen.openCreate({ status: 'aktiv', anreisedatum: dayKey(date), platznummer: group })
                : undefined
            }
            onRangeCreate={
              crud.belegungBuchungen.canWrite
                ? (start, end, group) =>
                    crud.belegungBuchungen.openCreate({
                      status: 'aktiv',
                      anreisedatum: dayKey(start),
                      abreisedatum: dayKey(end),
                      platznummer: group,
                    })
                : undefined
            }
          />
        }
        aside={
          <>
            <WorkList
              title={filter === 'abreise' ? tx('Abreisen der nächsten Tage') : filter === 'anreise' ? tx('Anreisen der nächsten Tage') : tx('An- & Abreisen')}
              icon={<IconPlaneArrival size={16} />}
              items={listRows.map((s) => {
                const dep = isDeparture(s);
                const go = dep ? flowActionFor('belegung_buchungen', 'status', s.record_id, 'abgeschlossen') : null;
                return {
                  id: s.record_id,
                  title: nameOf(s),
                  secondLine: (
                    <>
                      <span className="font-medium">{dep ? tx('Abreise') : tx('Anreise')}</span>
                      <span className="text-muted-foreground">
                        {' · '}
                        {weekday(dep ? s.fields.abreisedatum : s.fields.anreisedatum)}
                        {s.fields.platznummer ? ` · ${s.fields.platznummer.label}` : ''}
                      </span>
                    </>
                  ),
                  action: go ? { label: tx('Abschließen'), onClick: go } : undefined,
                };
              })}
              onItemClick={(id) => {
                const rec = belegungBuchungen.find((b) => b.record_id === id);
                if (rec) crud.belegungBuchungen.openDetail(rec);
              }}
              empty={{
                text: tx('In den nächsten 7 Tagen steht keine An- oder Abreise an.'),
                action: crud.belegungBuchungen.canWrite
                  ? { label: tx('Aufenthalt planen'), onClick: () => crud.belegungBuchungen.openCreate({ status: 'aktiv' }) }
                  : undefined,
              }}
            />
            <WorkList
              title={tx('Erinnerungen: Pfoten-Porträts')}
              icon={<IconPaw size={16} />}
              items={doneStays.map((s) => {
                const p = portraitFor(s.fields.hund);
                return {
                  id: s.record_id,
                  title: nameOf(s),
                  secondLine: p ? (
                    <span className="text-muted-foreground">{p.fields.titel || tx('Porträt vorhanden')}</span>
                  ) : (
                    <>
                      <span className="font-medium text-amber-600">{tx('Porträt fehlt')}</span>
                      <span className="text-muted-foreground"> · {tx`Aufenthalt bis ${formatDate(s.fields.abreisedatum)}`}</span>
                    </>
                  ),
                  action:
                    !p && crud.pfotenPortraet.canWrite
                      ? {
                          label: tx('Porträt erstellen'),
                          onClick: () => crud.pfotenPortraet.openCreate({ hund: extractRecordId(s.fields.hund) ?? undefined, besitzer: extractRecordId(s.fields.besitzer) ?? undefined }),
                        }
                      : undefined,
                };
              })}
              onItemClick={(id) => {
                const s = doneStays.find((x) => x.record_id === id);
                if (!s) return;
                const p = portraitFor(s.fields.hund);
                if (p) crud.pfotenPortraet.openDetail(p);
                else crud.belegungBuchungen.openDetail(belegungBuchungen.find((b) => b.record_id === id) ?? s);
              }}
              empty={{ text: tx('Sobald Aufenthalte abgeschlossen sind, erscheinen hier ihre Porträts als Erinnerung.') }}
            />
          </>
        }
      />
      {crud.surfaces}
    </div>
  );
}

function r_dog(name?: string) {
  return name || '—';
}
