import type { PfotenPortraet, Hundekartei, Besitzer } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';
import { MediaThumbnail } from '@/components/widgets/MediaViewer';

export interface PfotenPortraetDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: PfotenPortraet;
  /** N:1-Ziel „Hundekartei": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  hundekarteiList: Hundekartei[];
  /** Klick auf die Hundekartei-Relation → overlay.push auf dessen Detail. */
  onOpenHundekartei?: (record: Hundekartei) => void;
  /** N:1-Ziel „Besitzer": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  besitzerList: Besitzer[];
  /** Klick auf die Besitzer-Relation → overlay.push auf dessen Detail. */
  onOpenBesitzer?: (record: Besitzer) => void;
}

export function PfotenPortraetDetails({
  record,
  hundekarteiList,
  onOpenHundekartei,
  besitzerList,
  onOpenBesitzer,
}: PfotenPortraetDetailsProps) {
  const hundTarget = hundekarteiList.find(r => r.record_id === extractRecordId(record.fields.hund));
  const besitzerTarget = besitzerList.find(r => r.record_id === extractRecordId(record.fields.besitzer));
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('pfoten_portraet', 'titel')} value={record.fields.titel} format="text" />
        <RecordField label={fieldLabel('pfoten_portraet', 'widmung')} value={record.fields.widmung} format="longtext" className="md:col-span-2" />
        <RecordField label={fieldLabel('pfoten_portraet', 'charakterbeschreibung')} value={record.fields.charakterbeschreibung} format="longtext" className="md:col-span-2" />
        <RecordField label={fieldLabel('pfoten_portraet', 'lieblingsaktivitaet')} value={record.fields.lieblingsaktivitaet} format="text" />
        <RecordField label={fieldLabel('pfoten_portraet', 'besondere_momente')} value={record.fields.besondere_momente} format="longtext" className="md:col-span-2" />
        <RecordField label={fieldLabel('pfoten_portraet', 'portraet_foto')} className="md:col-span-2">
          {record.fields.portraet_foto ? (
            <MediaThumbnail src={record.fields.portraet_foto as string} fit="contain" className="max-h-64 w-full rounded-lg" />
          ) : '—'}
        </RecordField>
        <RecordField label={fieldLabel('pfoten_portraet', 'erstellungsdatum')} value={record.fields.erstellungsdatum} format="date" />
      </RecordSection>

      {/* N:1 — verknüpfte Records: IMMER klickbar, nie eine Text-Sackgasse. */}
      <RecordSection title={t('relations')} cols={2}>
        <RecordRelation
          label={fieldLabel('pfoten_portraet', 'hund')}
          name={hundTarget?.fields.name ?? '—'}
          meta={[hundTarget?.fields.rasse].filter(Boolean).join(' · ') || undefined}
          onClick={hundTarget && onOpenHundekartei ? () => onOpenHundekartei!(hundTarget!) : undefined}
        />
        <RecordRelation
          label={fieldLabel('pfoten_portraet', 'besitzer')}
          name={besitzerTarget?.fields.vorname ?? '—'}
          meta={[besitzerTarget?.fields.telefon, besitzerTarget?.fields.email].filter(Boolean).join(' · ') || undefined}
          onClick={besitzerTarget && onOpenBesitzer ? () => onOpenBesitzer!(besitzerTarget!) : undefined}
        />
      </RecordSection>

      <RecordAttachments appId={APP_IDS.PFOTEN_PORTRAET} recordId={record.record_id} />
    </>
  );
}
