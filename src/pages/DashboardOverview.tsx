import { useMemo, useState } from 'react';
import { addDays, format } from 'date-fns';
import { IconBell, IconPaw, IconPlus, IconShieldCheck } from '@tabler/icons-react';
import type { DashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import { flowActionFor } from '@/config/plan';
import type { BelegungBuchungen } from '@/types/app';
import { LOOKUP_OPTIONS, lookupOption } from '@/types/app';
import { LivingAppsService, extractRecordId } from '@/services/livingAppsService';
import { formatDate, lookupKey } from '@/lib/formatters';
import { tx, dateFnsLocale } from '@/i18n';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import { DashboardGrid } from '@/components/DashboardGrid';
import { WorkList } from '@/components/WorkList';
import { HeroBanner } from '@/components/HeroBanner';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { ResourceTimeline, type ResourceEvent, type ResourceGroup } from '@/components/widgets/ResourceTimeline';

const TOTAL_PLAETZE = 12;

export default function DashboardOverview({ data }: { data: DashboardData }) {
  const {
    buchungsanfragen, belegungBuchungen, pfotenPortraet, hundekarteiMap,
    setBelegungBuchungen, fetchAll,
  } = data;
  const clock = useClock();
  const [impfOnly, setImpfOnly] = useState(false);

  const todayKey = format(clock, 'yyyy-MM-dd');
  const weekKey = format(addDays(clock, 7), 'yyyy-MM-dd');
  const tomorrowKey = format(addDays(clock, 2), 'yyyy-MM-dd');

  const neueAnfragen = useMemo(
    () => buchungsanfragen
      .filter(a => lookupKey(a.fields.anfrage_status) === 'neu')
      .sort((a, b) => (a.fields.wunsch_anreise ?? '').localeCompare(b.fields.wunsch_anreise ?? '')),
    [buchungsanfragen],
  );

  const crud = useEntityCrud(data, {
    footer: (top) => {
      if (top.type === 'buchungsanfragen' && lookupKey(top.record.fields.anfrage_status) === 'neu') {
        const go = flowActionFor('buchungsanfragen', 'anfrage_status', top.record.record_id, 'bestaetigt');
        return go ? { label: tx('Prüfen & bestätigen'), onClick: go } : undefined;
      }
      return undefined;
    },
  });
  const enrichedBelegung = crud.enriched.belegungBuchungen;

  // Cancelled stays never count towards occupancy.
  const aktive = useMemo(
    () => enrichedBelegung.filter(b => lookupKey(b.fields.status) !== 'storniert' && !!b.fields.anreisedatum),
    [enrichedBelegung],
  );
  const dayOf = (s?: string) => (s ? s.slice(0, 10) : '');
  const impfOffen = (hundId: string | null) => {
    const h = hundId ? hundekarteiMap.get(hundId) : undefined;
    return !!h && lookupKey(h.fields.impfstatus) !== 'vollstaendig';
  };

  const aktuelleGaeste = aktive.filter(b => lookupKey(b.fields.status) === 'aktiv'
    && dayOf(b.fields.anreisedatum) <= todayKey && (dayOf(b.fields.abreisedatum) || todayKey) >= todayKey);
  const anreisenHeute = aktive.filter(b => dayOf(b.fields.anreisedatum) === todayKey);
  const abreisenHeute = aktive.filter(b => dayOf(b.fields.abreisedatum) === todayKey && lookupKey(b.fields.status) === 'aktiv');
  const impfAnreisen = aktive.filter(b => {
    const d = dayOf(b.fields.anreisedatum);
    return d >= todayKey && d <= weekKey && impfOffen(extractRecordId(b.fields.hund));
  });

  // Dogs staying now without a Pfoten-Porträt.
  const portraetHunde = useMemo(() => new Set(pfotenPortraet.map(p => extractRecordId(p.fields.hund)).filter(Boolean)), [pfotenPortraet]);
  const ohnePortraet = aktuelleGaeste.filter(b => {
    const id = extractRecordId(b.fields.hund);
    return !!id && !portraetHunde.has(id);
  });

  // --- Timeline ---
  const groups: ResourceGroup[] = (LOOKUP_OPTIONS['belegung_buchungen']?.platznummer ?? []).map(o => ({ key: o.key, label: o.label }));
  const events: ResourceEvent[] = aktive.map(b => ({
    id: `buchung:${b.record_id}`,
    start: b.fields.anreisedatum!.slice(0, 10),
    end: b.fields.abreisedatum?.slice(0, 10),
    allDay: true,
    title: b.hundName || tx('Gast'),
    subtitle: b.besitzerName || undefined,
    tone: impfOffen(extractRecordId(b.fields.hund)) ? 'warning' : lookupKey(b.fields.status) === 'abgeschlossen' ? 'default' : 'primary',
    group: lookupKey(b.fields.platznummer) ?? '',
  }));

  const conflict = (id: string, start: string, end: string | undefined, platz: string): string | undefined => {
    const e = end ?? start;
    const clash = aktive.find(o => o.record_id !== id && lookupKey(o.fields.platznummer) === platz
      && dayOf(o.fields.anreisedatum) < e && start < (dayOf(o.fields.abreisedatum) || dayOf(o.fields.anreisedatum)));
    return clash ? tx`Platz ist in diesem Zeitraum schon an ${clash.hundName || tx('einen Gast')} vergeben` : undefined;
  };

  const move = (id: string, newStart: string, newEnd?: string, newGroup?: string): string | void => {
    const rid = id.split(':')[1];
    const rec = belegungBuchungen.find(b => b.record_id === rid);
    if (!rec) return;
    const platz = newGroup ?? lookupKey(rec.fields.platznummer) ?? '';
    const msg = conflict(rid, newStart, newEnd ?? dayOf(rec.fields.abreisedatum), platz);
    if (msg) return msg;
    const before = rec.fields;
    const apply = (f: BelegungBuchungen['fields']) =>
      setBelegungBuchungen(list => list.map(x => (x.record_id === rid ? { ...x, fields: f } : x)));
    apply({
      ...before,
      anreisedatum: newStart,
      ...(newEnd ? { abreisedatum: newEnd } : {}),
      ...(newGroup ? { platznummer: lookupOption('belegung_buchungen', 'platznummer', newGroup) } : {}),
    });
    LivingAppsService.updateBelegungBuchungenEntry(rid, {
      anreisedatum: newStart,
      ...(newEnd ? { abreisedatum: newEnd } : {}),
      ...(newGroup ? { platznummer: newGroup } : {}),
    }).catch(() => fetchAll());
    undoToast(tx('Aufenthalt verschoben'), () => {
      apply(before);
      LivingAppsService.updateBelegungBuchungenEntry(rid, {
        anreisedatum: before.anreisedatum,
        abreisedatum: before.abreisedatum,
        platznummer: before.platznummer?.key,
      }).catch(() => fetchAll());
    });
  };

  const openEventRecord = (evId: string) => {
    const rec = belegungBuchungen.find(b => b.record_id === evId.split(':')[1]);
    if (rec) crud.belegungBuchungen.openDetail(rec);
  };

  // --- Header context line ---
  const ankommende = namen(anreisenHeute.map(b => b.hundName));
  const abreisende = namen(abreisenHeute.map(b => b.hundName));
  const gaesteNamen = namen(aktuelleGaeste.map(b => b.hundName));
  let context: string;
  if (anreisenHeute.length > 0 && abreisenHeute.length > 0) context = tx`Heute kommen ${ankommende} an, ${abreisende} ${abreisenHeute.length === 1 ? tx('geht') : tx('gehen')} nach Hause.`;
  else if (anreisenHeute.length > 0) context = tx`Heute kommen ${ankommende} an.`;
  else if (abreisenHeute.length > 0) context = tx`Heute gehen ${abreisende} nach Hause.`;
  else if (aktuelleGaeste.length > 0) context = tx`Zu Gast sind aktuell ${gaesteNamen} — keine Anreisen oder Abreisen heute.`;
  else context = tx`Aktuell ist kein Gast im Haus — Zeit für Anfragen und Porträts.`;

  const firstNeu = neueAnfragen[0];
  const confirmFirst = () => {
    if (!firstNeu) return;
    const go = flowActionFor('buchungsanfragen', 'anfrage_status', firstNeu.record_id, 'bestaetigt');
    if (go) go(); else crud.buchungsanfragen.openDetail(firstNeu);
  };
  const anfrageName = (a: (typeof neueAnfragen)[number]) =>
    [a.fields.interessent_vorname, a.fields.interessent_nachname].filter(Boolean).join(' ') || tx('Interessent');

  const arrivalRows = impfOnly
    ? impfAnreisen
    : aktive.filter(b => (dayOf(b.fields.anreisedatum) >= todayKey && dayOf(b.fields.anreisedatum) <= tomorrowKey)
        || (dayOf(b.fields.abreisedatum) >= todayKey && dayOf(b.fields.abreisedatum) <= tomorrowKey && lookupKey(b.fields.status) === 'aktiv'));
  const sortedRows = [...arrivalRows].sort((a, b) => dayOf(a.fields.anreisedatum).localeCompare(dayOf(b.fields.anreisedatum)));
  const nextArrival = aktive.filter(b => dayOf(b.fields.anreisedatum) > todayKey).sort((a, b) => dayOf(a.fields.anreisedatum).localeCompare(dayOf(b.fields.anreisedatum)))[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{gruss(clock)}</h1>
          <p className="text-sm text-muted-foreground">{context}</p>
        </div>
        {crud.belegungBuchungen.canWrite && (
          <button
            type="button"
            onClick={() => crud.belegungBuchungen.openCreate({ status: 'aktiv', anreisedatum: todayKey })}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <IconPlus size={16} className="shrink-0" />
            {tx('Neuer Aufenthalt')}
          </button>
        )}
      </div>

      <DashboardGrid
        variant="wide"
        hero={firstNeu ? (
          <HeroBanner
            tone="primary"
            icon={<IconBell size={18} />}
            action={{ label: tx('Prüfen & bestätigen'), onClick: confirmFirst }}
          >
            {neueAnfragen.length === 1
              ? tx`Neue Anfrage von ${anfrageName(firstNeu)} für ${firstNeu.fields.hund_name ?? tx('einen Hund')} — Wunsch ab ${formatDate(firstNeu.fields.wunsch_anreise)}.`
              : tx`${neueAnfragen.length} neue Anfragen warten auf Antwort: ${namen(neueAnfragen.map(anfrageName))} — als Nächstes ${firstNeu.fields.hund_name ?? tx('ein Hund')} ab ${formatDate(firstNeu.fields.wunsch_anreise)}.`}
          </HeroBanner>
        ) : undefined}
        kpis={(
          <StatStrip>
            <StatStripItem
              title={tx('Plätze belegt heute')}
              value={`${aktuelleGaeste.length} / ${TOTAL_PLAETZE}`}
              icon={<IconPaw size={18} className="text-muted-foreground" />}
              tone={aktuelleGaeste.length >= TOTAL_PLAETZE ? 'warning' : 'default'}
            />
            <StatStripItem
              title={tx('Impfstatus prüfen (7 Tage)')}
              value={impfAnreisen.length}
              icon={<IconShieldCheck size={18} className="text-muted-foreground" />}
              tone={impfAnreisen.length > 0 ? 'warning' : 'default'}
              onClick={() => setImpfOnly(v => !v)}
              active={impfOnly}
            />
          </StatStrip>
        )}
        primary={(
          <ResourceTimeline
            events={events}
            groups={groups}
            axis="day"
            defaultRange="2weeks"
            locale={dateFnsLocale()}
            onEventClick={ev => openEventRecord(ev.id)}
            onEventDrop={move}
            onEventResize={(id, s, e) => move(id, s, e)}
            onEmptyClick={crud.belegungBuchungen.canWrite
              ? (date, group) => crud.belegungBuchungen.openCreate({ status: 'aktiv', anreisedatum: format(date, 'yyyy-MM-dd'), platznummer: group })
              : undefined}
            onRangeCreate={crud.belegungBuchungen.canWrite
              ? (start, end, group) => crud.belegungBuchungen.openCreate({
                  status: 'aktiv',
                  anreisedatum: format(start, 'yyyy-MM-dd'),
                  abreisedatum: format(end, 'yyyy-MM-dd'),
                  platznummer: group,
                })
              : undefined}
          />
        )}
        aside={(
          <>
            <WorkList
              title={impfOnly ? tx('Impfstatus bei Anreise') : tx('An- & Abreisen heute und morgen')}
              items={sortedRows.map(b => {
                const arriving = dayOf(b.fields.anreisedatum) >= todayKey;
                const day = arriving ? b.fields.anreisedatum : b.fields.abreisedatum;
                const impf = impfOffen(extractRecordId(b.fields.hund));
                return {
                  id: b.record_id,
                  title: `${b.hundName || tx('Gast')} · ${b.besitzerName}`,
                  secondLine: (
                    <>
                      <span className="font-medium text-foreground">{arriving ? tx('Anreise') : tx('Abreise')}</span>
                      <span className="text-muted-foreground"> · {formatDate(day)} · {b.fields.platznummer?.label}</span>
                      {impf && <span className="font-medium text-amber-600"> · {tx('Impfstatus unvollständig')}</span>}
                    </>
                  ),
                };
              })}
              onItemClick={id => {
                const rec = belegungBuchungen.find(b => b.record_id === id);
                if (rec) crud.belegungBuchungen.openDetail(rec);
              }}
              empty={{
                text: nextArrival
                  ? tx`Nächste Anreise: ${formatDate(nextArrival.fields.anreisedatum)} — ${nextArrival.hundName}`
                  : tx('Keine Anreisen geplant.'),
              }}
            />
            <WorkList
              title={tx('Gäste ohne Pfoten-Porträt')}
              icon={<IconPaw size={14} />}
              items={ohnePortraet.map(b => {
                const hundId = extractRecordId(b.fields.hund);
                return {
                  id: b.record_id,
                  title: b.hundName || tx('Gast'),
                  secondLine: (
                    <span className="text-muted-foreground">
                      {tx`Zu Gast bis ${formatDate(b.fields.abreisedatum)}`} · {b.besitzerName}
                    </span>
                  ),
                  action: crud.pfotenPortraet.canWrite && hundId
                    ? { label: tx('Porträt anlegen'), onClick: () => crud.pfotenPortraet.openCreate({ hund: hundId, besitzer: extractRecordId(b.fields.besitzer) ?? undefined }) }
                    : undefined,
                };
              })}
              onItemClick={id => {
                const rec = belegungBuchungen.find(b => b.record_id === id);
                if (rec) crud.belegungBuchungen.openDetail(rec);
              }}
              empty={{ text: tx('Alle aktuellen Gäste haben ihr Porträt.') }}
            />
          </>
        )}
      />
      {crud.surfaces}
    </div>
  );
}
