/**
 * EntityCrud — pre-generated CRUD + overlay plumbing for the dashboard.
 * Compose it; NEVER re-roll dialog state, submit handlers, an overlay stack
 * or a RecordOverlayHost in the page — this file owns all of it.
 *
 * API at a glance:
 *   const data = useDashboardData();
 *   const crud = useEntityCrud(data, {
 *     // optional — the ONE semantic slot on the overlay: the record's next
 *     // workflow step. Return undefined for types without one.
 *     footer: (top) => top.type === 'besitzer'
 *       ? { label: …, onClick: () => … }
 *       : undefined,
 *   });
 *
 *   `top.type` carries the snake_case IDENTIFIER, NOT the camelCase key that
 *   `crud.<entity>` uses — for multi-word entities the two differ. Take each
 *   from its own column below, verbatim; a camelCase top.type narrows `top`
 *   to `never` and costs a build cycle (TS2367 "have no overlap", then
 *   TS2339 on top.record):
 *     crud.besitzer  ·  top.type === 'besitzer'
 *     crud.hundekartei  ·  top.type === 'hundekartei'
 *     crud.belegungBuchungen  ·  top.type === 'belegung_buchungen'
 *     crud.buchungsanfragen  ·  top.type === 'buchungsanfragen'
 *     crud.pfotenPortraet  ·  top.type === 'pfoten_portraet'
 *     crud.websiteInhalte  ·  top.type === 'website_inhalte'
 *   …
 *   crud.besitzer.openCreate({ …defaults })   // create dialog, prefilled — defaults are
 *                                       // shape-tolerant: bare lookup keys / record ids are fine
 *   crud.besitzer.openEdit(record)            // edit dialog (recordId + defaults wired)
 *   crud.besitzer.openDetail(record)          // record overlay — pass the RAW record,
 *                                       // enrichment is resolved inside
 *   crud.overlay                         // RecordOverlayStack<OverlayItem> for drills:
 *                                       // push / pop / replace / close
 *   crud.enriched.hundekartei              // memoized Enriched* arrays — reuse these,
 *                                       // never call enrich*() yourself in the page
 *   {crud.surfaces}                      // render ONCE at the end of the page JSX:
 *                                       // all entity dialogs + the overlay host
 *
 * Built in (do NOT re-implement): optimistic update + Rückgängig counter-write
 * on edit, fetchAll-on-error, edit-from-overlay, and per-entity overlay bodies
 * (RecordHeader + <{Entity}Details> with every relation reachable and the
 * contextual "+" prefilled). Drag writes (onEventDrop/onCardMove) stay YOURS:
 * optimistic setter first, PATCH in background, undoToast with counter-write.
 *
 * Overlay content per entity (the host renders these — you never compose
 * Details blocks yourself):
 *   besitzer: vorname, nachname, telefon, email, strasse, hausnummer, plz, ort, …  ·  ← hundekartei (list + contextual +) · ← belegung_buchungen (list + contextual +) · ← pfoten_portraet (list + contextual +)
 *   hundekartei: foto, besitzer, impfstatus, gesundheitshinweise, fuetterungshinweise, name, rasse, geburtsdatum, …  ·  → besitzer · ← belegung_buchungen (list + contextual +) · ← pfoten_portraet (list + contextual +)
 *   belegung_buchungen: hund, besitzer, anreisedatum, abreisedatum, platznummer, status, preis_euro, notizen  ·  → hundekartei · → besitzer
 *   buchungsanfragen: interessent_vorname, interessent_nachname, interessent_email, interessent_telefon, hund_name, hund_rasse, hund_groesse, wunsch_anreise, …
 *   pfoten_portraet: hund, besitzer, titel, widmung, charakterbeschreibung, lieblingsaktivitaet, besondere_momente, portraet_foto, …  ·  → hundekartei · → besitzer
 *   website_inhalte: unternehmensname, slogan, beschreibung, anzahl_plaetze, leistungen, oeffnungszeiten, telefon, email, …
 */
import { useState, useMemo, type ReactNode } from 'react';
import type { Besitzer, Hundekartei, BelegungBuchungen, Buchungsanfragen, PfotenPortraet, WebsiteInhalte } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import { enrichHundekartei, enrichBelegungBuchungen, enrichPfotenPortraet } from '@/lib/enrich';
import type { EnrichedHundekartei, EnrichedBelegungBuchungen, EnrichedPfotenPortraet } from '@/types/enriched';
import { useDashboardData } from '@/hooks/useDashboardData';
import {
  useRecordOverlayStack, RecordOverlayHost, RecordHeader,
  type RecordOverlayStack,
} from '@/components/widgets/RecordView';
import { BesitzerDialog, type BesitzerDialogDefaults } from '@/components/dialogs/BesitzerDialog';
import { BesitzerDetails } from '@/components/details/BesitzerDetails';
import { HundekarteiDialog, type HundekarteiDialogDefaults } from '@/components/dialogs/HundekarteiDialog';
import { HundekarteiDetails } from '@/components/details/HundekarteiDetails';
import { BelegungBuchungenDialog, type BelegungBuchungenDialogDefaults } from '@/components/dialogs/BelegungBuchungenDialog';
import { BelegungBuchungenDetails } from '@/components/details/BelegungBuchungenDetails';
import { BuchungsanfragenDialog, type BuchungsanfragenDialogDefaults } from '@/components/dialogs/BuchungsanfragenDialog';
import { BuchungsanfragenDetails } from '@/components/details/BuchungsanfragenDetails';
import { PfotenPortraetDialog, type PfotenPortraetDialogDefaults } from '@/components/dialogs/PfotenPortraetDialog';
import { PfotenPortraetDetails } from '@/components/details/PfotenPortraetDetails';
import { WebsiteInhalteDialog, type WebsiteInhalteDialogDefaults } from '@/components/dialogs/WebsiteInhalteDialog';
import { WebsiteInhalteDetails } from '@/components/details/WebsiteInhalteDetails';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { t, appLabel } from '@/i18n';
import { undoToast } from '@/lib/polish';
import { formatDate } from '@/lib/formatters';

// The overlay union — one branch per entity, `record` typed the way the data
// flows: Enriched* where enrichment exists, the raw record type otherwise.
// The host resolves enrichment itself; pages pass raw records everywhere.
export type OverlayItem =
  | { type: 'besitzer'; record: Besitzer }
  | { type: 'hundekartei'; record: EnrichedHundekartei }
  | { type: 'belegung_buchungen'; record: EnrichedBelegungBuchungen }
  | { type: 'buchungsanfragen'; record: Buchungsanfragen }
  | { type: 'pfoten_portraet'; record: EnrichedPfotenPortraet }
  | { type: 'website_inhalte'; record: WebsiteInhalte };

/** The useDashboardData() return — pass it in, never re-fetch inside. */
export type EntityCrudData = ReturnType<typeof useDashboardData>;

export interface EntityCrudOptions {
  /** Per-type overlay footer — the record's next workflow step. */
  footer?: (top: OverlayItem) => ReactNode | { label: ReactNode; onClick: () => void } | undefined;
  placement?: 'side' | 'center';
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export interface EntityCrudApi<TRecord, TDefaults> {
  /** Open the create dialog, optionally prefilled (shape-tolerant defaults). */
  openCreate: (defaults?: TDefaults) => void;
  /** Open the edit dialog for a record (recordId + defaults are wired). */
  openEdit: (record: TRecord) => void;
  /** Open the record overlay (raw record is fine — enrichment resolved inside). */
  openDetail: (record: TRecord) => void;
}

export interface EntityCrud {
  /** The overlay stack for drills: push / pop / replace / close. */
  overlay: RecordOverlayStack<OverlayItem>;
  /** Render ONCE at the end of the page JSX — all dialogs + the overlay host. */
  surfaces: ReactNode;
  besitzer: EntityCrudApi<Besitzer, BesitzerDialogDefaults>;
  hundekartei: EntityCrudApi<Hundekartei, HundekarteiDialogDefaults>;
  belegungBuchungen: EntityCrudApi<BelegungBuchungen, BelegungBuchungenDialogDefaults>;
  buchungsanfragen: EntityCrudApi<Buchungsanfragen, BuchungsanfragenDialogDefaults>;
  pfotenPortraet: EntityCrudApi<PfotenPortraet, PfotenPortraetDialogDefaults>;
  websiteInhalte: EntityCrudApi<WebsiteInhalte, WebsiteInhalteDialogDefaults>;
  /** Memoized Enriched* arrays — reuse these, never re-enrich in the page. */
  enriched: { hundekartei: EnrichedHundekartei[]; belegungBuchungen: EnrichedBelegungBuchungen[]; pfotenPortraet: EnrichedPfotenPortraet[] };
}

export function useEntityCrud(data: EntityCrudData, options?: EntityCrudOptions): EntityCrud {
  const overlay = useRecordOverlayStack<OverlayItem>();
  const [besitzerDialog, setBesitzerDialog] = useState<{ defaults?: BesitzerDialogDefaults; editing?: Besitzer } | null>(null);
  const [hundekarteiDialog, setHundekarteiDialog] = useState<{ defaults?: HundekarteiDialogDefaults; editing?: Hundekartei } | null>(null);
  const [belegungBuchungenDialog, setBelegungBuchungenDialog] = useState<{ defaults?: BelegungBuchungenDialogDefaults; editing?: BelegungBuchungen } | null>(null);
  const [buchungsanfragenDialog, setBuchungsanfragenDialog] = useState<{ defaults?: BuchungsanfragenDialogDefaults; editing?: Buchungsanfragen } | null>(null);
  const [pfotenPortraetDialog, setPfotenPortraetDialog] = useState<{ defaults?: PfotenPortraetDialogDefaults; editing?: PfotenPortraet } | null>(null);
  const [websiteInhalteDialog, setWebsiteInhalteDialog] = useState<{ defaults?: WebsiteInhalteDialogDefaults; editing?: WebsiteInhalte } | null>(null);
  const enrichedHundekartei = useMemo(() => enrichHundekartei(data.hundekartei, { besitzerMap: data.besitzerMap }), [data.hundekartei, data.besitzerMap]);
  const enrichedBelegungBuchungen = useMemo(() => enrichBelegungBuchungen(data.belegungBuchungen, { hundekarteiMap: data.hundekarteiMap, besitzerMap: data.besitzerMap }), [data.belegungBuchungen, data.hundekarteiMap, data.besitzerMap]);
  const enrichedPfotenPortraet = useMemo(() => enrichPfotenPortraet(data.pfotenPortraet, { hundekarteiMap: data.hundekarteiMap, besitzerMap: data.besitzerMap }), [data.pfotenPortraet, data.hundekarteiMap, data.besitzerMap]);

  function detailBesitzer(record: Besitzer, push = false) {
    const item: OverlayItem = { type: 'besitzer', record };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitBesitzer(fields: Besitzer['fields']) {
    const editing = besitzerDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setBesitzer(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateBesitzerEntry(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('besitzer')} — ${t('crud_updated')}`, async () => {
        data.setBesitzer(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateBesitzerEntry(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createBesitzerEntry(fields);
      undoToast(`${appLabel('besitzer')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  function detailHundekartei(record: Hundekartei, push = false) {
    const rec = enrichedHundekartei.find(r => r.record_id === record.record_id);
    if (!rec) return;
    const item: OverlayItem = { type: 'hundekartei', record: rec };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitHundekartei(fields: Hundekartei['fields']) {
    const editing = hundekarteiDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setHundekartei(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateHundekarteiEntry(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('hundekartei')} — ${t('crud_updated')}`, async () => {
        data.setHundekartei(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateHundekarteiEntry(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createHundekarteiEntry(fields);
      undoToast(`${appLabel('hundekartei')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  function detailBelegungBuchungen(record: BelegungBuchungen, push = false) {
    const rec = enrichedBelegungBuchungen.find(r => r.record_id === record.record_id);
    if (!rec) return;
    const item: OverlayItem = { type: 'belegung_buchungen', record: rec };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitBelegungBuchungen(fields: BelegungBuchungen['fields']) {
    const editing = belegungBuchungenDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setBelegungBuchungen(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateBelegungBuchungenEntry(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('belegung_buchungen')} — ${t('crud_updated')}`, async () => {
        data.setBelegungBuchungen(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateBelegungBuchungenEntry(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createBelegungBuchungenEntry(fields);
      undoToast(`${appLabel('belegung_buchungen')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  function detailBuchungsanfragen(record: Buchungsanfragen, push = false) {
    const item: OverlayItem = { type: 'buchungsanfragen', record };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitBuchungsanfragen(fields: Buchungsanfragen['fields']) {
    const editing = buchungsanfragenDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setBuchungsanfragen(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateBuchungsanfragenEntry(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('buchungsanfragen')} — ${t('crud_updated')}`, async () => {
        data.setBuchungsanfragen(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateBuchungsanfragenEntry(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createBuchungsanfragenEntry(fields);
      undoToast(`${appLabel('buchungsanfragen')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  function detailPfotenPortraet(record: PfotenPortraet, push = false) {
    const rec = enrichedPfotenPortraet.find(r => r.record_id === record.record_id);
    if (!rec) return;
    const item: OverlayItem = { type: 'pfoten_portraet', record: rec };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitPfotenPortraet(fields: PfotenPortraet['fields']) {
    const editing = pfotenPortraetDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setPfotenPortraet(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updatePfotenPortraetEntry(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('pfoten_portraet')} — ${t('crud_updated')}`, async () => {
        data.setPfotenPortraet(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updatePfotenPortraetEntry(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createPfotenPortraetEntry(fields);
      undoToast(`${appLabel('pfoten_portraet')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  function detailWebsiteInhalte(record: WebsiteInhalte, push = false) {
    const item: OverlayItem = { type: 'website_inhalte', record };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitWebsiteInhalte(fields: WebsiteInhalte['fields']) {
    const editing = websiteInhalteDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setWebsiteInhalte(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateWebsiteInhalteEntry(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('website_inhalte')} — ${t('crud_updated')}`, async () => {
        data.setWebsiteInhalte(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateWebsiteInhalteEntry(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createWebsiteInhalteEntry(fields);
      undoToast(`${appLabel('website_inhalte')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  const surfaces = (
    <>
      <BesitzerDialog
        open={besitzerDialog !== null}
        onClose={() => setBesitzerDialog(null)}
        onSubmit={submitBesitzer}
        defaultValues={besitzerDialog?.defaults}
        recordId={besitzerDialog?.editing?.record_id}
        enablePhotoScan={AI_PHOTO_SCAN['Besitzer']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Besitzer']}
      />
      <HundekarteiDialog
        open={hundekarteiDialog !== null}
        onClose={() => setHundekarteiDialog(null)}
        onSubmit={submitHundekartei}
        defaultValues={hundekarteiDialog?.defaults}
        recordId={hundekarteiDialog?.editing?.record_id}
        besitzerList={data.besitzer}
        enablePhotoScan={AI_PHOTO_SCAN['Hundekartei']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Hundekartei']}
      />
      <BelegungBuchungenDialog
        open={belegungBuchungenDialog !== null}
        onClose={() => setBelegungBuchungenDialog(null)}
        onSubmit={submitBelegungBuchungen}
        defaultValues={belegungBuchungenDialog?.defaults}
        recordId={belegungBuchungenDialog?.editing?.record_id}
        hundekarteiList={data.hundekartei}
        besitzerList={data.besitzer}
        enablePhotoScan={AI_PHOTO_SCAN['BelegungBuchungen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['BelegungBuchungen']}
      />
      <BuchungsanfragenDialog
        open={buchungsanfragenDialog !== null}
        onClose={() => setBuchungsanfragenDialog(null)}
        onSubmit={submitBuchungsanfragen}
        defaultValues={buchungsanfragenDialog?.defaults}
        recordId={buchungsanfragenDialog?.editing?.record_id}
        enablePhotoScan={AI_PHOTO_SCAN['Buchungsanfragen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Buchungsanfragen']}
      />
      <PfotenPortraetDialog
        open={pfotenPortraetDialog !== null}
        onClose={() => setPfotenPortraetDialog(null)}
        onSubmit={submitPfotenPortraet}
        defaultValues={pfotenPortraetDialog?.defaults}
        recordId={pfotenPortraetDialog?.editing?.record_id}
        hundekarteiList={data.hundekartei}
        besitzerList={data.besitzer}
        enablePhotoScan={AI_PHOTO_SCAN['PfotenPortraet']}
        enablePhotoLocation={AI_PHOTO_LOCATION['PfotenPortraet']}
      />
      <WebsiteInhalteDialog
        open={websiteInhalteDialog !== null}
        onClose={() => setWebsiteInhalteDialog(null)}
        onSubmit={submitWebsiteInhalte}
        defaultValues={websiteInhalteDialog?.defaults}
        recordId={websiteInhalteDialog?.editing?.record_id}
        enablePhotoScan={AI_PHOTO_SCAN['WebsiteInhalte']}
        enablePhotoLocation={AI_PHOTO_LOCATION['WebsiteInhalte']}
      />
      <RecordOverlayHost
        overlay={overlay}
        placement={options?.placement}
        size={options?.size}
        footer={options?.footer}
        render={(top) => {
          if (top.type === 'besitzer') {
            return (
              <>
                <RecordHeader title={top.record.fields.vorname ?? appLabel('besitzer')} subtitle={undefined} />
                <BesitzerDetails
                  record={top.record}
                  hundekarteiList={data.hundekartei}
                  onOpenHundekartei={(r) => detailHundekartei(r, true)}
                  onAddHundekartei={() => setHundekarteiDialog({ defaults: { besitzer: createRecordUrl(APP_IDS.BESITZER, top.record.record_id) } })}
                  belegungBuchungenList={data.belegungBuchungen}
                  onOpenBelegungBuchungen={(r) => detailBelegungBuchungen(r, true)}
                  onAddBelegungBuchungen={() => setBelegungBuchungenDialog({ defaults: { besitzer: createRecordUrl(APP_IDS.BESITZER, top.record.record_id) } })}
                  pfotenPortraetList={data.pfotenPortraet}
                  onOpenPfotenPortraet={(r) => detailPfotenPortraet(r, true)}
                  onAddPfotenPortraet={() => setPfotenPortraetDialog({ defaults: { besitzer: createRecordUrl(APP_IDS.BESITZER, top.record.record_id) } })}
                />
              </>
            );
          }
          if (top.type === 'hundekartei') {
            return (
              <>
                <RecordHeader title={top.record.fields.name ?? appLabel('hundekartei')} subtitle={top.record.fields.geburtsdatum ? formatDate(top.record.fields.geburtsdatum) : undefined} />
                <HundekarteiDetails
                  record={top.record}
                  besitzerList={data.besitzer}
                  onOpenBesitzer={(r) => detailBesitzer(r, true)}
                  belegungBuchungenList={data.belegungBuchungen}
                  onOpenBelegungBuchungen={(r) => detailBelegungBuchungen(r, true)}
                  onAddBelegungBuchungen={() => setBelegungBuchungenDialog({ defaults: { hund: createRecordUrl(APP_IDS.HUNDEKARTEI, top.record.record_id) } })}
                  pfotenPortraetList={data.pfotenPortraet}
                  onOpenPfotenPortraet={(r) => detailPfotenPortraet(r, true)}
                  onAddPfotenPortraet={() => setPfotenPortraetDialog({ defaults: { hund: createRecordUrl(APP_IDS.HUNDEKARTEI, top.record.record_id) } })}
                />
              </>
            );
          }
          if (top.type === 'belegung_buchungen') {
            return (
              <>
                <RecordHeader title={appLabel('belegung_buchungen')} subtitle={top.record.fields.anreisedatum ? formatDate(top.record.fields.anreisedatum) : undefined} />
                <BelegungBuchungenDetails
                  record={top.record}
                  hundekarteiList={data.hundekartei}
                  onOpenHundekartei={(r) => detailHundekartei(r, true)}
                  besitzerList={data.besitzer}
                  onOpenBesitzer={(r) => detailBesitzer(r, true)}
                />
              </>
            );
          }
          if (top.type === 'buchungsanfragen') {
            return (
              <>
                <RecordHeader title={top.record.fields.interessent_vorname ?? appLabel('buchungsanfragen')} subtitle={top.record.fields.wunsch_anreise ? formatDate(top.record.fields.wunsch_anreise) : undefined} />
                <BuchungsanfragenDetails
                  record={top.record}
                />
              </>
            );
          }
          if (top.type === 'pfoten_portraet') {
            return (
              <>
                <RecordHeader title={top.record.fields.titel ?? appLabel('pfoten_portraet')} subtitle={top.record.fields.erstellungsdatum ? formatDate(top.record.fields.erstellungsdatum) : undefined} />
                <PfotenPortraetDetails
                  record={top.record}
                  hundekarteiList={data.hundekartei}
                  onOpenHundekartei={(r) => detailHundekartei(r, true)}
                  besitzerList={data.besitzer}
                  onOpenBesitzer={(r) => detailBesitzer(r, true)}
                />
              </>
            );
          }
          if (top.type === 'website_inhalte') {
            return (
              <>
                <RecordHeader title={top.record.fields.unternehmensname ?? appLabel('website_inhalte')} subtitle={undefined} />
                <WebsiteInhalteDetails
                  record={top.record}
                />
              </>
            );
          }
          return null;
        }}
        onEdit={(top) => {
          overlay.close();
          if (top.type === 'besitzer') setBesitzerDialog({ editing: top.record, defaults: top.record.fields });
          if (top.type === 'hundekartei') setHundekarteiDialog({ editing: top.record, defaults: top.record.fields });
          if (top.type === 'belegung_buchungen') setBelegungBuchungenDialog({ editing: top.record, defaults: top.record.fields });
          if (top.type === 'buchungsanfragen') setBuchungsanfragenDialog({ editing: top.record, defaults: top.record.fields });
          if (top.type === 'pfoten_portraet') setPfotenPortraetDialog({ editing: top.record, defaults: top.record.fields });
          if (top.type === 'website_inhalte') setWebsiteInhalteDialog({ editing: top.record, defaults: top.record.fields });
        }}
      />
    </>
  );

  return {
    overlay,
    surfaces,
    besitzer: {
      openCreate: (defaults?: BesitzerDialogDefaults) => setBesitzerDialog({ defaults }),
      openEdit: (record: Besitzer) => setBesitzerDialog({ editing: record, defaults: record.fields }),
      openDetail: (record: Besitzer) => detailBesitzer(record, false),
    },
    hundekartei: {
      openCreate: (defaults?: HundekarteiDialogDefaults) => setHundekarteiDialog({ defaults }),
      openEdit: (record: Hundekartei) => setHundekarteiDialog({ editing: record, defaults: record.fields }),
      openDetail: (record: Hundekartei) => detailHundekartei(record, false),
    },
    belegungBuchungen: {
      openCreate: (defaults?: BelegungBuchungenDialogDefaults) => setBelegungBuchungenDialog({ defaults }),
      openEdit: (record: BelegungBuchungen) => setBelegungBuchungenDialog({ editing: record, defaults: record.fields }),
      openDetail: (record: BelegungBuchungen) => detailBelegungBuchungen(record, false),
    },
    buchungsanfragen: {
      openCreate: (defaults?: BuchungsanfragenDialogDefaults) => setBuchungsanfragenDialog({ defaults }),
      openEdit: (record: Buchungsanfragen) => setBuchungsanfragenDialog({ editing: record, defaults: record.fields }),
      openDetail: (record: Buchungsanfragen) => detailBuchungsanfragen(record, false),
    },
    pfotenPortraet: {
      openCreate: (defaults?: PfotenPortraetDialogDefaults) => setPfotenPortraetDialog({ defaults }),
      openEdit: (record: PfotenPortraet) => setPfotenPortraetDialog({ editing: record, defaults: record.fields }),
      openDetail: (record: PfotenPortraet) => detailPfotenPortraet(record, false),
    },
    websiteInhalte: {
      openCreate: (defaults?: WebsiteInhalteDialogDefaults) => setWebsiteInhalteDialog({ defaults }),
      openEdit: (record: WebsiteInhalte) => setWebsiteInhalteDialog({ editing: record, defaults: record.fields }),
      openDetail: (record: WebsiteInhalte) => detailWebsiteInhalte(record, false),
    },
    enriched: { hundekartei: enrichedHundekartei, belegungBuchungen: enrichedBelegungBuchungen, pfotenPortraet: enrichedPfotenPortraet },
  };
}
