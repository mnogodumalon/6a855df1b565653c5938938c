import type { BelegungBuchungen, Hundekartei, Besitzer } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';

export interface BelegungBuchungenDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: BelegungBuchungen;
  /** N:1-Ziel „Hundekartei": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  hundekarteiList: Hundekartei[];
  /** Klick auf die Hundekartei-Relation → overlay.push auf dessen Detail. */
  onOpenHundekartei?: (record: Hundekartei) => void;
  /** N:1-Ziel „Besitzer": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  besitzerList: Besitzer[];
  /** Klick auf die Besitzer-Relation → overlay.push auf dessen Detail. */
  onOpenBesitzer?: (record: Besitzer) => void;
}

export function BelegungBuchungenDetails({
  record,
  hundekarteiList,
  onOpenHundekartei,
  besitzerList,
  onOpenBesitzer,
}: BelegungBuchungenDetailsProps) {
  const hundTarget = hundekarteiList.find(r => r.record_id === extractRecordId(record.fields.hund));
  const besitzerTarget = besitzerList.find(r => r.record_id === extractRecordId(record.fields.besitzer));
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('belegung_buchungen', 'anreisedatum')} value={record.fields.anreisedatum} format="date" />
        <RecordField label={fieldLabel('belegung_buchungen', 'abreisedatum')} value={record.fields.abreisedatum} format="date" />
        <RecordField label={fieldLabel('belegung_buchungen', 'platznummer')} value={record.fields.platznummer} format="pill" />
        <RecordField label={fieldLabel('belegung_buchungen', 'status')} value={record.fields.status} format="pill" />
        <RecordField label={fieldLabel('belegung_buchungen', 'preis_euro')} value={record.fields.preis_euro} format="text" />
        <RecordField label={fieldLabel('belegung_buchungen', 'notizen')} value={record.fields.notizen} format="longtext" className="md:col-span-2" />
      </RecordSection>

      {/* N:1 — verknüpfte Records: IMMER klickbar, nie eine Text-Sackgasse. */}
      <RecordSection title={t('relations')} cols={2}>
        <RecordRelation
          label={fieldLabel('belegung_buchungen', 'hund')}
          name={hundTarget?.fields.name ?? '—'}
          meta={[hundTarget?.fields.rasse].filter(Boolean).join(' · ') || undefined}
          onClick={hundTarget && onOpenHundekartei ? () => onOpenHundekartei!(hundTarget!) : undefined}
        />
        <RecordRelation
          label={fieldLabel('belegung_buchungen', 'besitzer')}
          name={besitzerTarget?.fields.vorname ?? '—'}
          meta={[besitzerTarget?.fields.telefon, besitzerTarget?.fields.email].filter(Boolean).join(' · ') || undefined}
          onClick={besitzerTarget && onOpenBesitzer ? () => onOpenBesitzer!(besitzerTarget!) : undefined}
        />
      </RecordSection>

      <RecordAttachments appId={APP_IDS.BELEGUNG_BUCHUNGEN} recordId={record.record_id} />
    </>
  );
}
