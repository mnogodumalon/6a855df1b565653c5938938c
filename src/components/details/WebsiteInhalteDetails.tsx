import type { WebsiteInhalte } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';
import { MediaThumbnail } from '@/components/widgets/MediaViewer';
import { MapRouteLinks } from '@/components/widgets/MapWidget';

export interface WebsiteInhalteDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: WebsiteInhalte;
}

export function WebsiteInhalteDetails({
  record,
}: WebsiteInhalteDetailsProps) {
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('website_inhalte', 'unternehmensname')} value={record.fields.unternehmensname} format="text" />
        <RecordField label={fieldLabel('website_inhalte', 'slogan')} value={record.fields.slogan} format="text" />
        <RecordField label={fieldLabel('website_inhalte', 'beschreibung')} value={record.fields.beschreibung} format="longtext" className="md:col-span-2" />
        <RecordField label={fieldLabel('website_inhalte', 'anzahl_plaetze')} value={record.fields.anzahl_plaetze} format="text" />
        <RecordField label={fieldLabel('website_inhalte', 'leistungen')} value={record.fields.leistungen} format="longtext" className="md:col-span-2" />
        <RecordField label={fieldLabel('website_inhalte', 'oeffnungszeiten')} value={record.fields.oeffnungszeiten} format="longtext" className="md:col-span-2" />
        <RecordField label={fieldLabel('website_inhalte', 'telefon')} value={record.fields.telefon} format="text" />
        <RecordField label={fieldLabel('website_inhalte', 'email')} value={record.fields.email} format="email" />
        <RecordField label={fieldLabel('website_inhalte', 'website_url')} value={record.fields.website_url} format="url" />
        <RecordField label={fieldLabel('website_inhalte', 'strasse')} value={record.fields.strasse} format="text" />
        <RecordField label={fieldLabel('website_inhalte', 'hausnummer')} value={record.fields.hausnummer} format="text" />
        <RecordField label={fieldLabel('website_inhalte', 'plz')} value={record.fields.plz} format="text" />
        <RecordField label={fieldLabel('website_inhalte', 'ort')} value={record.fields.ort} format="text" />
        <RecordField label={fieldLabel('website_inhalte', 'standort')}>
          {record.fields.standort ? (
            <div className="space-y-1">
              <div>{record.fields.standort.info ?? `${record.fields.standort.lat}, ${record.fields.standort.long}`}</div>
              {/* Directions links — the map popup is hover-fleeting; the overlay
                  is the only mobile-reachable place for navigation. */}
              <MapRouteLinks lat={record.fields.standort.lat} long={record.fields.standort.long} />
            </div>
          ) : '—'}
        </RecordField>
        <RecordField label={fieldLabel('website_inhalte', 'galerie')} className="md:col-span-2">
          {record.fields.galerie ? (
            <MediaThumbnail src={record.fields.galerie as string} fit="contain" className="max-h-64 w-full rounded-lg" />
          ) : '—'}
        </RecordField>
        <RecordField label={fieldLabel('website_inhalte', 'instagram')} value={record.fields.instagram} format="url" />
        <RecordField label={fieldLabel('website_inhalte', 'facebook')} value={record.fields.facebook} format="url" />
      </RecordSection>

      <RecordAttachments appId={APP_IDS.WEBSITE_INHALTE} recordId={record.record_id} />
    </>
  );
}
