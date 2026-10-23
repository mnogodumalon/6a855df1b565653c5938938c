import { useMemo } from 'react';
import { addDays, format } from 'date-fns';
import { IconPaw, IconPlus, IconInbox } from '@tabler/icons-react';
import type { DashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import { flowActionFor } from '@/config/plan';
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
import { LivingAppsService } from '@/services/livingAppsService';
import { LOOKUP_OPTIONS, lookupOption } from '@/types/app';
import { lookupKey, formatDate } from '@/lib/formatters';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import { tx, dateFnsLocale, appLabel } from '@/i18n';

const TOTAL_PLAETZE = 12;

export default function DashboardOverview({ data }: { data: DashboardData }) {
  const { buchungsanfragen, setBelegungBuchungen, fetchAll } = data;
  const clock = useClock();
  const today = format(clock, 'yyyy-MM-dd');
  const inAWeek = format(addDays(clock, 7), 'yyyy-MM-dd');

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
  const enrichedHundekartei = crud.enriched.hundekartei;
  const enrichedBelegung = crud.enriched.belegungBuchungen;

  const aktive = useMemo(
    () => enrichedBelegung.filter(b => lookupKey(b.fields.status) === 'aktiv'),
    [enrichedBelegung],
  );
  const anreisenHeute = aktive.filter(b => b.fields.anreisedatum?.slice(0, 10) === today);
  const abreisenHeute = aktive.filter(b => b.fields.abreisedatum?.slice(0, 10) === today);
  const belegtJetzt = aktive.filter(
    b => (b.fields.anreisedatum?.slice(0, 10) ?? '9999') <= today && (b.fields.abreisedatum?.slice(0, 10) ?? '0000') >= today,
  );
  const belegtePlaetze = new Set(belegtJetzt.map(b => lookupKey(b.fields.platznummer)).filter(Boolean)).size;
  const kommende = aktive
    .filter(b => {
      const a = b.fields.anreisedatum?.slice(0, 10);
      return !!a && a > today && a <= inAWeek;
    })
    .sort((a, b) => (a.fields.anreisedatum ?? '').localeCompare(b.fields.anreisedatum ?? ''));
  const neueAnfragen = buchungsanfragen
    .filter(a => lookupKey(a.fields.anfrage_status) === 'neu')
    .sort((a, b) => (a.fields.wunsch_anreise ?? '').localeCompare(b.fields.wunsch_anreise ?? ''));

  // Hunde mit fehlendem/unbekanntem Impfstatus — zuerst die, die gerade oder bald zu Gast sind.
  const gaesteIds = new Set(
    aktive
      .filter(b => (b.fields.abreisedatum?.slice(0, 10) ?? '9999') >= today && (b.fields.anreisedatum?.slice(0, 10) ?? '') <= inAWeek)
      .map(b => b.fields.hund?.split('/').pop()),
  );
  const impfLuecken = enrichedHundekartei
    .filter(h => {
      const k = lookupKey(h.fields.impfstatus);
      return !k || k === 'unbekannt' || k === 'nicht_geimpft';
    })
    .sort((a, b) => Number(gaesteIds.has(b.record_id)) - Number(gaesteIds.has(a.record_id)));

  const groups: ResourceGroup[] = (LOOKUP_OPTIONS['belegung_buchungen']?.platznummer ?? []).map(o => ({
    key: o.key,
    label: o.label,
  }));

  const events: ResourceEvent[] = enrichedBelegung
    .filter(b => !!b.fields.anreisedatum && !!lookupKey(b.fields.platznummer) && lookupKey(b.fields.status) !== 'storniert')
    .map(b => ({
      id: `belegung:${b.record_id}`,
      start: b.fields.anreisedatum!.slice(0, 10),
      end: b.fields.abreisedatum?.slice(0, 10),
      allDay: true,
      title: b.hundName || appLabel('belegung_buchungen'),
      subtitle: b.besitzerName || undefined,
      tone: lookupKey(b.fields.status) === 'aktiv' ? 'primary' : 'default',
      group: lookupKey(b.fields.platznummer) ?? '',
    }));

  const idOf = (eventId: string) => eventId.split(':')[1] ?? '';

  // Drag/resize: Platz-Doppelbelegung blockieren, optimistisch schreiben, Undo anbieten.
  const move = (eventId: string, newStart: string, newEnd?: string, newGroup?: string): string | void => {
    const rid = idOf(eventId);
    const rec = enrichedBelegung.find(b => b.record_id === rid);
    if (!rec) return;
    const platz = newGroup ?? lookupKey(rec.fields.platznummer) ?? '';
    const start = newStart.slice(0, 10);
    const end = (newEnd ?? rec.fields.abreisedatum ?? newStart).slice(0, 10);
    const clash = aktive.find(
      o =>
        o.record_id !== rid &&
        lookupKey(o.fields.platznummer) === platz &&
        (o.fields.anreisedatum?.slice(0, 10) ?? '') < end &&
        (o.fields.abreisedatum?.slice(0, 10) ?? '') > start,
    );
    if (clash) return tx`Platz ist in diesem Zeitraum schon von ${clash.hundName} belegt.`;

    const before = {
      anreisedatum: rec.fields.anreisedatum,
      abreisedatum: rec.fields.abreisedatum,
      platznummer: lookupKey(rec.fields.platznummer),
    };
    const apply = (f: { anreisedatum?: string; abreisedatum?: string; platznummer?: string }) =>
      setBelegungBuchungen(prev =>
        prev.map(b =>
          b.record_id === rid
            ? {
                ...b,
                fields: {
                  ...b.fields,
                  anreisedatum: f.anreisedatum,
                  abreisedatum: f.abreisedatum,
                  platznummer: f.platznummer ? lookupOption('belegung_buchungen', 'platznummer', f.platznummer) : undefined,
                },
              }
            : b,
        ),
      );
    apply({ anreisedatum: start, abreisedatum: newEnd ? end : rec.fields.abreisedatum, platznummer: platz });
    LivingAppsService.updateBelegungBuchungenEntry(rid, {
      anreisedatum: start,
      ...(newEnd ? { abreisedatum: end } : {}),
      platznummer: platz,
    }).catch(() => void fetchAll());
    undoToast(tx`${rec.hundName} — verschoben`, () => {
      apply(before);
      LivingAppsService.updateBelegungBuchungenEntry(rid, {
        anreisedatum: before.anreisedatum,
        abreisedatum: before.abreisedatum,
        platznummer: before.platznummer,
      }).catch(() => void fetchAll());
    });
  };

  const resize = (eventId: string, newStart: string, newEnd: string) => move(eventId, newStart, newEnd);

  // Kontextzeile — nennt in jedem Zweig Namen.
  const context = (() => {
    const an = namen(anreisenHeute.map(b => b.hundName).filter(Boolean));
    const ab = namen(abreisenHeute.map(b => b.hundName).filter(Boolean));
    if (anreisenHeute.length && abreisenHeute.length) return tx`Heute kommen ${an} an — ${ab} reist ab.`;
    if (anreisenHeute.length) return tx`Heute kommen ${an} an.`;
    if (abreisenHeute.length) return tx`Heute reist ${ab} ab.`;
    if (belegtJetzt.length) return tx`Gerade zu Gast: ${namen(belegtJetzt.map(b => b.hundName).filter(Boolean), 3)}.`;
    if (kommende.length) return tx`Als Nächstes kommt ${kommende[0].hundName} am ${formatDate(kommende[0].fields.anreisedatum)}.`;
    return tx`Die Pension ist leer — trag den nächsten Gast ein.`;
  })();

  const firstNew = neueAnfragen[0];
  const confirmNew = firstNew ? flowActionFor('buchungsanfragen', 'anfrage_status', firstNew.record_id, 'bestaetigt') : null;
  const anfrageName = (a: (typeof neueAnfragen)[number]) =>
    [a.fields.interessent_vorname, a.fields.interessent_nachname].filter(Boolean).join(' ') || a.fields.hund_name || '—';

  const hero =
    neueAnfragen.length > 0 && firstNew ? (
      <HeroBanner
        icon={<IconInbox size={18} />}
        action={{
          label: confirmNew ? tx('Anfrage prüfen & bestätigen') : tx('Anfrage öffnen'),
          onClick: confirmNew ?? (() => crud.buchungsanfragen.openDetail(firstNew)),
        }}
      >
        <b>{namen(neueAnfragen.map(anfrageName), 3)}</b>{' '}
        {neueAnfragen.length === 1
          ? tx`wartet auf Antwort — Wunschzeitraum ${formatDate(firstNew.fields.wunsch_anreise)} bis ${formatDate(firstNew.fields.wunsch_abreise)}.`
          : tx`warten auf Antwort — als Erstes ${formatDate(firstNew.fields.wunsch_anreise)}.`}
      </HeroBanner>
    ) : undefined;

  const kpis = (
    <StatStrip>
      <StatStripItem
        title={tx('Plätze belegt')}
        value={`${belegtePlaetze} / ${TOTAL_PLAETZE}`}
        tone={belegtePlaetze >= TOTAL_PLAETZE ? 'warning' : 'default'}
      />
      <StatStripItem
        title={tx('Anreisen heute')}
        value={anreisenHeute.length}
        tone={anreisenHeute.length > 0 ? 'primary' : 'default'}
        onClick={anreisenHeute[0] ? () => crud.belegungBuchungen.openDetail(anreisenHeute[0]) : undefined}
      />
      <StatStripItem
        title={tx('Abreisen heute')}
        value={abreisenHeute.length}
        onClick={abreisenHeute[0] ? () => crud.belegungBuchungen.openDetail(abreisenHeute[0]) : undefined}
      />
      <StatStripItem
        title={tx('Impfstatus offen')}
        value={impfLuecken.length}
        tone={impfLuecken.length > 0 ? 'warning' : 'default'}
      />
    </StatStrip>
  );

  type HeuteRow = { id: string; rec: (typeof enrichedBelegung)[number]; kind: 'an' | 'ab' };
  const heuteRows: HeuteRow[] = [
    ...abreisenHeute.map(rec => ({ id: `ab:${rec.record_id}`, rec, kind: 'ab' as const })),
    ...anreisenHeute.map(rec => ({ id: `an:${rec.record_id}`, rec, kind: 'an' as const })),
  ];

  const aside = (
    <>
      <WorkList
        title={tx('Heute')}
        items={heuteRows.map(({ id, rec, kind }) => {
          const go = kind === 'ab' ? flowActionFor('belegung_buchungen', 'status', rec.record_id, 'abgeschlossen') : null;
          return {
            id,
            title: rec.hundName || '—',
            secondLine: (
              <>
                <span className={kind === 'an' ? 'font-medium text-primary' : 'font-medium text-amber-600'}>
                  {kind === 'an' ? tx('Anreise') : tx('Abreise')}
                </span>
                <span className="text-muted-foreground">
                  {' · '}
                  {lookupKey(rec.fields.platznummer) ? rec.fields.platznummer?.label : tx('ohne Platz')}
                  {rec.besitzerName ? ` · ${rec.besitzerName}` : ''}
                </span>
              </>
            ),
            action: go ? { label: tx('Abschließen'), onClick: go } : undefined,
          };
        })}
        onItemClick={id => {
          const row = heuteRows.find(r => r.id === id);
          if (row) crud.belegungBuchungen.openDetail(row.rec);
        }}
        empty={{
          text: kommende[0]
            ? tx`Heute ruhig — nächste Anreise: ${kommende[0].hundName} am ${formatDate(kommende[0].fields.anreisedatum)}`
            : tx('Heute keine An- oder Abreisen.'),
          action: crud.belegungBuchungen.canWrite
            ? { label: tx('Aufenthalt eintragen'), onClick: () => crud.belegungBuchungen.openCreate({ status: 'aktiv', anreisedatum: today }) }
            : undefined,
        }}
      />
      <WorkList
        title={tx('Kommende Anreisen (7 Tage)')}
        items={kommende.map(b => ({
          id: b.record_id,
          title: b.hundName || '—',
          secondLine: (
            <>
              <span className="font-medium text-primary">{formatDate(b.fields.anreisedatum)}</span>
              <span className="text-muted-foreground">
                {' · '}
                {lookupKey(b.fields.platznummer) ? b.fields.platznummer?.label : tx('ohne Platz')}
                {b.besitzerName ? ` · ${b.besitzerName}` : ''}
              </span>
            </>
          ),
        }))}
        onItemClick={id => {
          const rec = kommende.find(b => b.record_id === id);
          if (rec) crud.belegungBuchungen.openDetail(rec);
        }}
        empty={{ text: tx('In den nächsten 7 Tagen kommt niemand an.') }}
      />
      <WorkList
        title={tx('Impfstatus prüfen')}
        items={impfLuecken.map(h => ({
          id: h.record_id,
          title: h.fields.name || '—',
          secondLine: (
            <>
              <span className="font-medium text-destructive">
                {lookupKey(h.fields.impfstatus) === 'nicht_geimpft' ? tx('Nicht geimpft') : tx('Unbekannt')}
              </span>
              <span className="text-muted-foreground">
                {gaesteIds.has(h.record_id) ? tx(' · aktuell/bald zu Gast') : ''}
                {h.besitzerName ? ` · ${h.besitzerName}` : ''}
              </span>
            </>
          ),
          action: crud.hundekartei.canWrite ? { label: tx('Eintragen'), onClick: () => crud.hundekartei.openEdit(h) } : undefined,
        }))}
        onItemClick={id => {
          const rec = impfLuecken.find(h => h.record_id === id);
          if (rec) crud.hundekartei.openDetail(rec);
        }}
        empty={{ text: tx('Alle Hunde haben einen Impfstatus.') }}
      />
    </>
  );

  const primary = (
    <ResourceTimeline
      events={events}
      groups={groups}
      axis="day"
      defaultRange="2weeks"
      locale={dateFnsLocale()}
      onEventClick={ev => {
        const rec = enrichedBelegung.find(b => b.record_id === idOf(ev.id));
        if (rec) crud.belegungBuchungen.openDetail(rec);
      }}
      onEventDrop={move}
      onEventResize={resize}
      onEmptyClick={(date, group) => {
        if (!crud.belegungBuchungen.canWrite) return;
        crud.belegungBuchungen.openCreate({ status: 'aktiv', anreisedatum: format(date, 'yyyy-MM-dd'), platznummer: group });
      }}
      onRangeCreate={(start, end, group) => {
        if (!crud.belegungBuchungen.canWrite) return;
        crud.belegungBuchungen.openCreate({
          status: 'aktiv',
          anreisedatum: format(start, 'yyyy-MM-dd'),
          abreisedatum: format(end, 'yyyy-MM-dd'),
          platznummer: group,
        });
      }}
    />
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <IconPaw size={24} className="shrink-0 text-primary" />
            <span className="truncate">{gruss(clock)}</span>
          </h1>
          <p className="text-sm text-muted-foreground">{context}</p>
        </div>
        {crud.belegungBuchungen.canWrite && (
          <Button onClick={() => crud.belegungBuchungen.openCreate({ status: 'aktiv', anreisedatum: today })}>
            <IconPlus size={16} className="shrink-0" />
            {tx('Neuer Aufenthalt')}
          </Button>
        )}
      </div>
      <DashboardGrid variant="wide" hero={hero} kpis={kpis} aside={aside} primary={primary} />
      {crud.surfaces}
    </div>
  );
}
