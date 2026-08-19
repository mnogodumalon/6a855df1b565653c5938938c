import type { Besitzer, Hundekartei, BelegungBuchungen, PfotenPortraet } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';
import { SatelliteSection } from '@/components/SatelliteSection';

export interface BesitzerDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Besitzer;
  /** 1:N „Hundekartei" (besitzer): VOLLE Liste — der Block filtert auf diesen Record. */
  hundekarteiList: Hundekartei[];
  /** Zeilen-Klick → overlay.push auf das Hundekartei-Detail (nie der Edit-Dialog). */
  onOpenHundekartei: (record: Hundekartei) => void;
  /** Kontextuelles „+": öffnet den Hundekartei-Dialog mit diesem Record vorgesetzt. */
  onAddHundekartei: () => void;
  /** 1:N „Belegung & Buchungen" (besitzer): VOLLE Liste — der Block filtert auf diesen Record. */
  belegungBuchungenList: BelegungBuchungen[];
  /** Zeilen-Klick → overlay.push auf das BelegungBuchungen-Detail (nie der Edit-Dialog). */
  onOpenBelegungBuchungen: (record: BelegungBuchungen) => void;
  /** Kontextuelles „+": öffnet den BelegungBuchungen-Dialog mit diesem Record vorgesetzt. */
  onAddBelegungBuchungen: () => void;
  /** 1:N „Pfoten-Porträt" (besitzer): VOLLE Liste — der Block filtert auf diesen Record. */
  pfotenPortraetList: PfotenPortraet[];
  /** Zeilen-Klick → overlay.push auf das PfotenPortraet-Detail (nie der Edit-Dialog). */
  onOpenPfotenPortraet: (record: PfotenPortraet) => void;
  /** Kontextuelles „+": öffnet den PfotenPortraet-Dialog mit diesem Record vorgesetzt. */
  onAddPfotenPortraet: () => void;
}

export function BesitzerDetails({
  record,
  hundekarteiList,
  onOpenHundekartei,
  onAddHundekartei,
  belegungBuchungenList,
  onOpenBelegungBuchungen,
  onAddBelegungBuchungen,
  pfotenPortraetList,
  onOpenPfotenPortraet,
  onAddPfotenPortraet,
}: BesitzerDetailsProps) {
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('besitzer', 'vorname')} value={record.fields.vorname} format="text" />
        <RecordField label={fieldLabel('besitzer', 'nachname')} value={record.fields.nachname} format="text" />
        <RecordField label={fieldLabel('besitzer', 'telefon')} value={record.fields.telefon} format="text" />
        <RecordField label={fieldLabel('besitzer', 'email')} value={record.fields.email} format="email" />
        <RecordField label={fieldLabel('besitzer', 'strasse')} value={record.fields.strasse} format="text" />
        <RecordField label={fieldLabel('besitzer', 'hausnummer')} value={record.fields.hausnummer} format="text" />
        <RecordField label={fieldLabel('besitzer', 'plz')} value={record.fields.plz} format="text" />
        <RecordField label={fieldLabel('besitzer', 'ort')} value={record.fields.ort} format="text" />
        <RecordField label={fieldLabel('besitzer', 'notizen')} value={record.fields.notizen} format="longtext" className="md:col-span-2" />
      </RecordSection>

      <SatelliteSection
        title={appLabel('hundekartei')}
        items={hundekarteiList.filter(r => extractRecordId(r.fields.besitzer) === record.record_id)}
        map={r => ({ name: r.fields.name ?? appLabel('hundekartei'), meta: r.fields.geburtsdatum })}
        onOpen={onOpenHundekartei}
        onAdd={onAddHundekartei}
        getKey={r => r.record_id}
      />

      <SatelliteSection
        title={appLabel('belegung_buchungen')}
        items={belegungBuchungenList.filter(r => extractRecordId(r.fields.besitzer) === record.record_id)}
        map={r => ({ name: appLabel('belegung_buchungen'), meta: r.fields.anreisedatum })}
        onOpen={onOpenBelegungBuchungen}
        onAdd={onAddBelegungBuchungen}
        getKey={r => r.record_id}
      />

      <SatelliteSection
        title={appLabel('pfoten_portraet')}
        items={pfotenPortraetList.filter(r => extractRecordId(r.fields.besitzer) === record.record_id)}
        map={r => ({ name: r.fields.titel ?? appLabel('pfoten_portraet'), meta: r.fields.erstellungsdatum })}
        onOpen={onOpenPfotenPortraet}
        onAdd={onAddPfotenPortraet}
        getKey={r => r.record_id}
      />

      <RecordAttachments appId={APP_IDS.BESITZER} recordId={record.record_id} />
    </>
  );
}
