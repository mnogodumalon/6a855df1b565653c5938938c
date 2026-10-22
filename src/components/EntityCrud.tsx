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
 *   `top.type` is the SAME camelCase key as `crud.<entity>` — one spelling
 *   per entity, everywhere in this API.
 *   …
 *   crud.besitzer.openCreate({ …defaults })   // create dialog, prefilled — defaults are
 *                                       // shape-tolerant: bare lookup keys / record ids are fine
 *   crud.besitzer.openEdit(record)            // edit dialog (recordId + defaults wired)
 *   crud.besitzer.openDetail(record)          // record overlay — pass the RAW record,
 *                                       // enrichment is resolved inside
 *   crud.overlay                         // RecordOverlayStack<OverlayItem> for drills:
 *                                       // push / pop / replace / close
 *   crud.enriched.besitzer              // the display-ready array for EVERY entity —
 *                                       // Enriched* where relations exist, the raw array
 *                                       // otherwise. Reuse these; never call enrich*()
 *                                       // in the page, and never guess which entity has
 *                                       // one: they all do.
 *   {crud.surfaces}                      // render ONCE at the end of the page JSX:
 *                                       // all entity dialogs + the overlay host
 *
 * Built in (do NOT re-implement): optimistic update + Rückgängig counter-write
 * on edit, fetchAll-on-error, edit-from-overlay, and per-entity overlay bodies
 * (RecordHeader + <{Entity}Details> with every relation reachable and the
 * contextual "+" prefilled; list-field back-references additionally get a
 * "choose existing" picker that links an EXISTING record — built in, do not
 * re-roll). Drag writes (onEventDrop/onCardMove) stay YOURS:
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
import { usePermissions } from '@/lib/permissions';
import { toast } from 'sonner';
import { formatDate } from '@/lib/formatters';

// The overlay union — one branch per entity, `record` typed the way the data
// flows: Enriched* where enrichment exists, the raw record type otherwise.
// The host resolves enrichment itself; pages pass raw records everywhere.
export type OverlayItem =
  | { type: 'besitzer'; record: Besitzer }
  | { type: 'hundekartei'; record: EnrichedHundekartei }
  | { type: 'belegungBuchungen'; record: EnrichedBelegungBuchungen }
  | { type: 'buchungsanfragen'; record: Buchungsanfragen }
  | { type: 'pfotenPortraet'; record: EnrichedPfotenPortraet }
  | { type: 'websiteInhalte'; record: WebsiteInhalte };

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
  /** May the signed-in user create/change records of this list? (the
   *  platform's rights — show a „+ Neu“ only when true; openCreate/openEdit
   *  refuse with a notice otherwise). */
  canWrite: boolean;
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
  /** The display-ready array per entity: Enriched* where an enrich function
   *  exists, the raw array otherwise. One key per entity so no page has to
   *  know which is which. Reuse these; never re-enrich in the page. */
  enriched: { besitzer: Besitzer[]; hundekartei: EnrichedHundekartei[]; belegungBuchungen: EnrichedBelegungBuchungen[]; buchungsanfragen: Buchungsanfragen[]; pfotenPortraet: EnrichedPfotenPortraet[]; websiteInhalte: WebsiteInhalte[] };
}

export function useEntityCrud(data: EntityCrudData, options?: EntityCrudOptions): EntityCrud {
  const overlay = useRecordOverlayStack<OverlayItem>();
  // the platform's rights of the signed-in user (lib/permissions.ts) — unknown = allowed
  const perms = usePermissions();
  const refuse = () => { toast.error(t('perm_denied_title'), { description: t('perm_denied_desc') }); };
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
    const item: OverlayItem = { type: 'belegungBuchungen', record: rec };
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
    const item: OverlayItem = { type: 'pfotenPortraet', record: rec };
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
    const item: OverlayItem = { type: 'websiteInhalte', record };
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
                  onAddHundekartei={perms.canWrite('hundekartei') ? () => setHundekarteiDialog({ defaults: { besitzer: createRecordUrl(APP_IDS.BESITZER, top.record.record_id) } }) : undefined}
                  belegungBuchungenList={data.belegungBuchungen}
                  onOpenBelegungBuchungen={(r) => detailBelegungBuchungen(r, true)}
                  onAddBelegungBuchungen={perms.canWrite('belegung_buchungen') ? () => setBelegungBuchungenDialog({ defaults: { besitzer: createRecordUrl(APP_IDS.BESITZER, top.record.record_id) } }) : undefined}
                  pfotenPortraetList={data.pfotenPortraet}
                  onOpenPfotenPortraet={(r) => detailPfotenPortraet(r, true)}
                  onAddPfotenPortraet={perms.canWrite('pfoten_portraet') ? () => setPfotenPortraetDialog({ defaults: { besitzer: createRecordUrl(APP_IDS.BESITZER, top.record.record_id) } }) : undefined}
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
                  onAddBelegungBuchungen={perms.canWrite('belegung_buchungen') ? () => setBelegungBuchungenDialog({ defaults: { hund: createRecordUrl(APP_IDS.HUNDEKARTEI, top.record.record_id) } }) : undefined}
                  pfotenPortraetList={data.pfotenPortraet}
                  onOpenPfotenPortraet={(r) => detailPfotenPortraet(r, true)}
                  onAddPfotenPortraet={perms.canWrite('pfoten_portraet') ? () => setPfotenPortraetDialog({ defaults: { hund: createRecordUrl(APP_IDS.HUNDEKARTEI, top.record.record_id) } }) : undefined}
                />
              </>
            );
          }
          if (top.type === 'belegungBuchungen') {
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
          if (top.type === 'pfotenPortraet') {
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
          if (top.type === 'websiteInhalte') {
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
        canEdit={(top) => {
          if (top.type === 'besitzer') return perms.canWrite('besitzer');
          if (top.type === 'hundekartei') return perms.canWrite('hundekartei');
          if (top.type === 'belegungBuchungen') return perms.canWrite('belegung_buchungen');
          if (top.type === 'buchungsanfragen') return perms.canWrite('buchungsanfragen');
          if (top.type === 'pfotenPortraet') return perms.canWrite('pfoten_portraet');
          if (top.type === 'websiteInhalte') return perms.canWrite('website_inhalte');
          return true;
        }}
        onEdit={(top) => {
          overlay.close();
          if (top.type === 'besitzer') setBesitzerDialog({ editing: top.record, defaults: top.record.fields });
          if (top.type === 'hundekartei') setHundekarteiDialog({ editing: top.record, defaults: top.record.fields });
          if (top.type === 'belegungBuchungen') setBelegungBuchungenDialog({ editing: top.record, defaults: top.record.fields });
          if (top.type === 'buchungsanfragen') setBuchungsanfragenDialog({ editing: top.record, defaults: top.record.fields });
          if (top.type === 'pfotenPortraet') setPfotenPortraetDialog({ editing: top.record, defaults: top.record.fields });
          if (top.type === 'websiteInhalte') setWebsiteInhalteDialog({ editing: top.record, defaults: top.record.fields });
        }}
      />
    </>
  );

  return {
    overlay,
    surfaces,
    besitzer: {
      openCreate: (defaults?: BesitzerDialogDefaults) => (perms.canWrite('besitzer') ? setBesitzerDialog({ defaults }) : refuse()),
      openEdit: (record: Besitzer) => (perms.canWrite('besitzer') ? setBesitzerDialog({ editing: record, defaults: record.fields }) : refuse()),
      openDetail: (record: Besitzer) => detailBesitzer(record, false),
      canWrite: perms.canWrite('besitzer'),
    },
    hundekartei: {
      openCreate: (defaults?: HundekarteiDialogDefaults) => (perms.canWrite('hundekartei') ? setHundekarteiDialog({ defaults }) : refuse()),
      openEdit: (record: Hundekartei) => (perms.canWrite('hundekartei') ? setHundekarteiDialog({ editing: record, defaults: record.fields }) : refuse()),
      openDetail: (record: Hundekartei) => detailHundekartei(record, false),
      canWrite: perms.canWrite('hundekartei'),
    },
    belegungBuchungen: {
      openCreate: (defaults?: BelegungBuchungenDialogDefaults) => (perms.canWrite('belegung_buchungen') ? setBelegungBuchungenDialog({ defaults }) : refuse()),
      openEdit: (record: BelegungBuchungen) => (perms.canWrite('belegung_buchungen') ? setBelegungBuchungenDialog({ editing: record, defaults: record.fields }) : refuse()),
      openDetail: (record: BelegungBuchungen) => detailBelegungBuchungen(record, false),
      canWrite: perms.canWrite('belegung_buchungen'),
    },
    buchungsanfragen: {
      openCreate: (defaults?: BuchungsanfragenDialogDefaults) => (perms.canWrite('buchungsanfragen') ? setBuchungsanfragenDialog({ defaults }) : refuse()),
      openEdit: (record: Buchungsanfragen) => (perms.canWrite('buchungsanfragen') ? setBuchungsanfragenDialog({ editing: record, defaults: record.fields }) : refuse()),
      openDetail: (record: Buchungsanfragen) => detailBuchungsanfragen(record, false),
      canWrite: perms.canWrite('buchungsanfragen'),
    },
    pfotenPortraet: {
      openCreate: (defaults?: PfotenPortraetDialogDefaults) => (perms.canWrite('pfoten_portraet') ? setPfotenPortraetDialog({ defaults }) : refuse()),
      openEdit: (record: PfotenPortraet) => (perms.canWrite('pfoten_portraet') ? setPfotenPortraetDialog({ editing: record, defaults: record.fields }) : refuse()),
      openDetail: (record: PfotenPortraet) => detailPfotenPortraet(record, false),
      canWrite: perms.canWrite('pfoten_portraet'),
    },
    websiteInhalte: {
      openCreate: (defaults?: WebsiteInhalteDialogDefaults) => (perms.canWrite('website_inhalte') ? setWebsiteInhalteDialog({ defaults }) : refuse()),
      openEdit: (record: WebsiteInhalte) => (perms.canWrite('website_inhalte') ? setWebsiteInhalteDialog({ editing: record, defaults: record.fields }) : refuse()),
      openDetail: (record: WebsiteInhalte) => detailWebsiteInhalte(record, false),
      canWrite: perms.canWrite('website_inhalte'),
    },
    enriched: { besitzer: data.besitzer, hundekartei: enrichedHundekartei, belegungBuchungen: enrichedBelegungBuchungen, buchungsanfragen: data.buchungsanfragen, pfotenPortraet: enrichedPfotenPortraet, websiteInhalte: data.websiteInhalte },
  };
}
