/**
 * The INTERNAL door of the journey port — authenticated, via LivingAppsService.
 * GENERATED: one lister and one creator per entity. Do not edit.
 *
 *   import { servicePort } from '@/services/journeyPort';
 *
 * Intent pages hand this to `useJourneySubmit` and to shared step blocks. It
 * exposes only list · create · ref — the public subset — so a step written
 * against it also runs on a public page. Undo, edit and delete stay on the
 * page itself (LivingAppsService), never inside a shared step.
 */
import { LivingAppsService, createRecordUrl, type RecordQuery } from '@/services/livingAppsService';
import { toWirePayload, type InternalJourneyPort, type JourneyRecord } from '@/lib/journey/port';
import { buildSearchFilter, byIdFilter, combineFilters } from '@/lib/journey/search';
import type { EntityKey } from '@/lib/journey/rules';

type RawRecord = { record_id: string; fields: Record<string, unknown>; createdat?: string | null };
type RawMutation = { record_id: string; fields?: Record<string, unknown>; created_at?: string | null };

const listers: Record<EntityKey, () => Promise<RawRecord[]>> = {
  'besitzer': () => LivingAppsService.getBesitzer() as Promise<RawRecord[]>,
  'hundekartei': () => LivingAppsService.getHundekartei() as Promise<RawRecord[]>,
  'belegung_buchungen': () => LivingAppsService.getBelegungBuchungen() as Promise<RawRecord[]>,
  'buchungsanfragen': () => LivingAppsService.getBuchungsanfragen() as Promise<RawRecord[]>,
  'pfoten_portraet': () => LivingAppsService.getPfotenPortraet() as Promise<RawRecord[]>,
  'website_inhalte': () => LivingAppsService.getWebsiteInhalte() as Promise<RawRecord[]>,
};

/** The query/count half — the REST parameters the plain listers never send. */
const queriers: Record<EntityKey, (q: RecordQuery) => Promise<RawRecord[]>> = {
  'besitzer': q => LivingAppsService.queryBesitzer(q) as Promise<RawRecord[]>,
  'hundekartei': q => LivingAppsService.queryHundekartei(q) as Promise<RawRecord[]>,
  'belegung_buchungen': q => LivingAppsService.queryBelegungBuchungen(q) as Promise<RawRecord[]>,
  'buchungsanfragen': q => LivingAppsService.queryBuchungsanfragen(q) as Promise<RawRecord[]>,
  'pfoten_portraet': q => LivingAppsService.queryPfotenPortraet(q) as Promise<RawRecord[]>,
  'website_inhalte': q => LivingAppsService.queryWebsiteInhalte(q) as Promise<RawRecord[]>,
};

const counters: Record<EntityKey, (filter?: string, signal?: AbortSignal) => Promise<number>> = {
  'besitzer': (filter, signal) => LivingAppsService.countBesitzer(filter, signal),
  'hundekartei': (filter, signal) => LivingAppsService.countHundekartei(filter, signal),
  'belegung_buchungen': (filter, signal) => LivingAppsService.countBelegungBuchungen(filter, signal),
  'buchungsanfragen': (filter, signal) => LivingAppsService.countBuchungsanfragen(filter, signal),
  'pfoten_portraet': (filter, signal) => LivingAppsService.countPfotenPortraet(filter, signal),
  'website_inhalte': (filter, signal) => LivingAppsService.countWebsiteInhalte(filter, signal),
};

const creators: Record<EntityKey, (fields: Record<string, unknown>) => Promise<RawMutation>> = {
  'besitzer': fields => LivingAppsService.createBesitzerEntry(fields as never),
  'hundekartei': fields => LivingAppsService.createHundekarteiEntry(fields as never),
  'belegung_buchungen': fields => LivingAppsService.createBelegungBuchungenEntry(fields as never),
  'buchungsanfragen': fields => LivingAppsService.createBuchungsanfragenEntry(fields as never),
  'pfoten_portraet': fields => LivingAppsService.createPfotenPortraetEntry(fields as never),
  'website_inhalte': fields => LivingAppsService.createWebsiteInhalteEntry(fields as never),
};

const updaters: Record<EntityKey, (id: string, fields: Record<string, unknown>) => Promise<RawMutation>> = {
  'besitzer': (id, fields) => LivingAppsService.updateBesitzerEntry(id, fields as never),
  'hundekartei': (id, fields) => LivingAppsService.updateHundekarteiEntry(id, fields as never),
  'belegung_buchungen': (id, fields) => LivingAppsService.updateBelegungBuchungenEntry(id, fields as never),
  'buchungsanfragen': (id, fields) => LivingAppsService.updateBuchungsanfragenEntry(id, fields as never),
  'pfoten_portraet': (id, fields) => LivingAppsService.updatePfotenPortraetEntry(id, fields as never),
  'website_inhalte': (id, fields) => LivingAppsService.updateWebsiteInhalteEntry(id, fields as never),
};

function toJourneyRecord(r: RawRecord): JourneyRecord {
  return { id: r.record_id, fields: r.fields ?? {}, createdAt: r.createdat ?? null };
}

export const servicePort: InternalJourneyPort = {
  door: 'internal',
  async list(entity, opts) {
    // Only a bare list(entity) (or an empty options object) takes the historic
    // load-everything path. ANY explicit option — `limit` included — goes to the
    // server: useRecordSearch's first page of a big entity must not pull the
    // whole table (live 2026-09-02: all 263 employees travelled for a limit-50
    // first page because `limit` alone did not count as a query).
    const usesQuery = !!opts && (opts.search !== undefined || opts.offset !== undefined
      || opts.orderby !== undefined || opts.fields !== undefined || opts.signal !== undefined
      || opts.limit !== undefined || opts.filter !== undefined);
    if (!usesQuery) {
      const rows = await listers[entity]();
      const limited = opts?.limit ? rows.slice(0, opts.limit) : rows;
      return limited.map(toJourneyRecord);
    }
    const filter = combineFilters(opts.filter, opts.search ? buildSearchFilter(opts.search.query, opts.search.fields) : undefined);
    const rows = await queriers[entity]({
      filter, orderby: opts.orderby, limit: opts.limit, offset: opts.offset, fields: opts.fields, signal: opts.signal,
    });
    return rows.map(toJourneyRecord);
  },
  async count(entity, opts) {
    const filter = combineFilters(opts?.filter, opts?.search ? buildSearchFilter(opts.search.query, opts.search.fields) : undefined);
    return counters[entity](filter, opts?.signal);
  },
  async get(entity, id) {
    // One query on the server, not the whole table: `r.id` is the vSQL name
    // of the record id (a live page wrote `r.record_id` and got a 400).
    const rows = await queriers[entity]({ filter: byIdFilter(id), limit: 1 });
    return rows[0] ? toJourneyRecord(rows[0]) : null;
  },
  async create(entity, values) {
    const r = await creators[entity](toWirePayload(entity, values, servicePort));
    return { id: r.record_id, fields: r.fields ?? {}, createdAt: r.created_at ?? null };
  },
  // The same payload rules as create — plain ids in, references shaped here.
  async update(entity, id, values) {
    const r = await updaters[entity](id, toWirePayload(entity, values, servicePort));
    return { id: r.record_id || id, fields: r.fields ?? {}, createdAt: r.created_at ?? null };
  },
  ref: (appId, recordId) => createRecordUrl(appId, recordId),
};
