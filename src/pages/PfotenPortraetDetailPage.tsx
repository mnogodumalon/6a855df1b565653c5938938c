import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { LivingAppsService, extractRecordId } from '@/services/livingAppsService';
import type { PfotenPortraet, Hundekartei, Besitzer } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { Button } from '@/components/ui/button';
import { IconArrowLeft, IconTrash } from '@tabler/icons-react';
import {
  RecordView, RecordHeader, RecordKeyFacts, RecordSection, RecordField,
  RecordAttachments, RecordViewSkeleton, RecordViewEmpty,
} from '@/components/widgets/RecordView';
import { PfotenPortraetDialog } from '@/components/dialogs/PfotenPortraetDialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { formEnhancements } from '@/config/form-enhancements/PfotenPortraet';
import { evalComputed } from '@/config/form-enhancements/types';
import { t, appLabel, fieldLabel, localeTag, CURRENCY } from '@/i18n';

export default function PfotenPortraetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [record, setRecord] = useState<PfotenPortraet | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [hundekarteiList, setHundekarteiList] = useState<Hundekartei[]>([]);
  const [besitzerList, setBesitzerList] = useState<Besitzer[]>([]);

  useEffect(() => { loadData(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  async function loadData() {
    setLoading(true);
    try {
      const [mainData, hundekarteiData, besitzerData] = await Promise.all([
        LivingAppsService.getPfotenPortraet(),
        LivingAppsService.getHundekartei(),
        LivingAppsService.getBesitzer(),
      ]);
      setHundekarteiList(hundekarteiData);
      setBesitzerList(besitzerData);
      setRecord(mainData.find(r => r.record_id === id) ?? null);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdate(fields: PfotenPortraet['fields']) {
    if (!record) return;
    await LivingAppsService.updatePfotenPortraetEntry(record.record_id, fields);
    await loadData();
    setEditing(false);
  }

  async function handleDelete() {
    if (!record) return;
    await LivingAppsService.deletePfotenPortraetEntry(record.record_id);
    setDeleteOpen(false);
    navigate('/pfoten-portraet');
  }

  function getHundekarteiDisplayName(url?: unknown) {
    if (!url) return '—';
    const refId = extractRecordId(url);
    return hundekarteiList.find(r => r.record_id === refId)?.fields.name ?? '—';
  }

  function getBesitzerDisplayName(url?: unknown) {
    if (!url) return '—';
    const refId = extractRecordId(url);
    return besitzerList.find(r => r.record_id === refId)?.fields.vorname ?? '—';
  }

  if (loading) {
    return <RecordViewSkeleton />;
  }

  if (!record) {
    return (
      <RecordViewEmpty
        title={t('not_found')}
        action={
          <Button variant="ghost" onClick={() => navigate('/pfoten-portraet')}>
            <IconArrowLeft className="h-4 w-4 mr-1.5" />
            {t('back')}
          </Button>
        }
      />
    );
  }

  return (
    <RecordView
      onBack={() => navigate('/pfoten-portraet')}
      onEdit={() => setEditing(true)}
      backLabel={t('back')}
      editLabel={t('edit_button')}
    >
      <RecordHeader title={record.fields.titel ?? appLabel('pfoten_portraet')} />

      {(() => {
        const lookupLists: Record<string, unknown> = {
          hund: hundekarteiList,
          besitzer: besitzerList,
        };
        const fmtComputed = (k: string, n: number) =>
          /(?:kosten|preis|betrag|gesamt|netto|brutto|summe|mwst|rabatt|anzahlung|umsatz|saldo)/i.test(k)
            ? n.toLocaleString(localeTag(), { style: 'currency', currency: CURRENCY, minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : n.toLocaleString(localeTag(), { maximumFractionDigits: 2 });
        const computedFacts = Object.entries(formEnhancements.computed)
          .map(([key, formula]) => {
            const v = evalComputed(formula, record!.fields as Record<string, unknown>, { lookupLists });
            return v != null
              ? { label: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '), value: fmtComputed(key, v) }
              : null;
          })
          .filter((f): f is { label: string; value: string } => f !== null);
        return computedFacts.length > 0 ? <RecordKeyFacts items={computedFacts} /> : null;
      })()}

      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('pfoten_portraet', 'hund')} value={getHundekarteiDisplayName(record.fields.hund)} format="text" />
        <RecordField label={fieldLabel('pfoten_portraet', 'besitzer')} value={getBesitzerDisplayName(record.fields.besitzer)} format="text" />
        <RecordField label={fieldLabel('pfoten_portraet', 'titel')} value={record.fields.titel} format="text" />
        <RecordField label={fieldLabel('pfoten_portraet', 'widmung')} value={record.fields.widmung} format="longtext" className="md:col-span-2" />
        <RecordField label={fieldLabel('pfoten_portraet', 'charakterbeschreibung')} value={record.fields.charakterbeschreibung} format="longtext" className="md:col-span-2" />
        <RecordField label={fieldLabel('pfoten_portraet', 'lieblingsaktivitaet')} value={record.fields.lieblingsaktivitaet} format="text" />
        <RecordField label={fieldLabel('pfoten_portraet', 'besondere_momente')} value={record.fields.besondere_momente} format="longtext" className="md:col-span-2" />
        <RecordField label={fieldLabel('pfoten_portraet', 'erstellungsdatum')} value={record.fields.erstellungsdatum} format="date" />
      </RecordSection>

      <RecordAttachments appId={APP_IDS.PFOTEN_PORTRAET} recordId={record.record_id} />

      <div className="flex justify-end pt-2">
        <Button variant="ghost" onClick={() => setDeleteOpen(true)} className="text-destructive hover:text-destructive">
          <IconTrash className="h-4 w-4 mr-1.5" />
          {t('delete')}
        </Button>
      </div>

      <PfotenPortraetDialog
        open={editing}
        onClose={() => setEditing(false)}
        onSubmit={handleUpdate}
        defaultValues={record.fields}
        recordId={record.record_id}
        hundekarteiList={hundekarteiList}
        besitzerList={besitzerList}
        enablePhotoScan={AI_PHOTO_SCAN['PfotenPortraet']}
        enablePhotoLocation={AI_PHOTO_LOCATION['PfotenPortraet']}
      />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title={t('delete_entity', { entity: appLabel('pfoten_portraet') })}
        description={t('confirm_delete_desc')}
      />
    </RecordView>
  );
}
