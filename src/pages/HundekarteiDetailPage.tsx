import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { LivingAppsService, extractRecordId } from '@/services/livingAppsService';
import type { Hundekartei, Besitzer } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { Button } from '@/components/ui/button';
import { IconArrowLeft, IconTrash } from '@tabler/icons-react';
import {
  RecordView, RecordHeader, RecordKeyFacts, RecordSection, RecordField,
  RecordAttachments, RecordViewSkeleton, RecordViewEmpty,
} from '@/components/widgets/RecordView';
import { HundekarteiDialog } from '@/components/dialogs/HundekarteiDialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { formEnhancements } from '@/config/form-enhancements/Hundekartei';
import { evalComputed } from '@/config/form-enhancements/types';
import { t, appLabel, fieldLabel, localeTag, CURRENCY } from '@/i18n';

export default function HundekarteiDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [record, setRecord] = useState<Hundekartei | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [besitzerList, setBesitzerList] = useState<Besitzer[]>([]);

  useEffect(() => { loadData(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  async function loadData() {
    setLoading(true);
    try {
      const [mainData, besitzerData] = await Promise.all([
        LivingAppsService.getHundekartei(),
        LivingAppsService.getBesitzer(),
      ]);
      setBesitzerList(besitzerData);
      setRecord(mainData.find(r => r.record_id === id) ?? null);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdate(fields: Hundekartei['fields']) {
    if (!record) return;
    await LivingAppsService.updateHundekarteiEntry(record.record_id, fields);
    await loadData();
    setEditing(false);
  }

  async function handleDelete() {
    if (!record) return;
    await LivingAppsService.deleteHundekarteiEntry(record.record_id);
    setDeleteOpen(false);
    navigate('/hundekartei');
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
          <Button variant="ghost" onClick={() => navigate('/hundekartei')}>
            <IconArrowLeft className="h-4 w-4 mr-1.5" />
            {t('back')}
          </Button>
        }
      />
    );
  }

  return (
    <RecordView
      onBack={() => navigate('/hundekartei')}
      onEdit={() => setEditing(true)}
      backLabel={t('back')}
      editLabel={t('edit_button')}
    >
      <RecordHeader title={record.fields.name ?? appLabel('hundekartei')} />

      {(() => {
        const lookupLists: Record<string, unknown> = {
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
        <RecordField label={fieldLabel('hundekartei', 'besitzer')} value={getBesitzerDisplayName(record.fields.besitzer)} format="text" />
        <RecordField label={fieldLabel('hundekartei', 'impfstatus')} value={record.fields.impfstatus} format="pill" />
        <RecordField label={fieldLabel('hundekartei', 'gesundheitshinweise')} value={record.fields.gesundheitshinweise} format="longtext" className="md:col-span-2" />
        <RecordField label={fieldLabel('hundekartei', 'fuetterungshinweise')} value={record.fields.fuetterungshinweise} format="longtext" className="md:col-span-2" />
        <RecordField label={fieldLabel('hundekartei', 'name')} value={record.fields.name} format="text" />
        <RecordField label={fieldLabel('hundekartei', 'rasse')} value={record.fields.rasse} format="text" />
        <RecordField label={fieldLabel('hundekartei', 'geburtsdatum')} value={record.fields.geburtsdatum} format="date" />
        <RecordField label={fieldLabel('hundekartei', 'geschlecht')} value={record.fields.geschlecht} format="pill" />
        <RecordField label={fieldLabel('hundekartei', 'gewicht_kg')} value={record.fields.gewicht_kg} format="text" />
      </RecordSection>

      <RecordAttachments appId={APP_IDS.HUNDEKARTEI} recordId={record.record_id} />

      <div className="flex justify-end pt-2">
        <Button variant="ghost" onClick={() => setDeleteOpen(true)} className="text-destructive hover:text-destructive">
          <IconTrash className="h-4 w-4 mr-1.5" />
          {t('delete')}
        </Button>
      </div>

      <HundekarteiDialog
        open={editing}
        onClose={() => setEditing(false)}
        onSubmit={handleUpdate}
        defaultValues={record.fields}
        recordId={record.record_id}
        besitzerList={besitzerList}
        enablePhotoScan={AI_PHOTO_SCAN['Hundekartei']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Hundekartei']}
      />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title={t('delete_entity', { entity: appLabel('hundekartei') })}
        description={t('confirm_delete_desc')}
      />
    </RecordView>
  );
}
