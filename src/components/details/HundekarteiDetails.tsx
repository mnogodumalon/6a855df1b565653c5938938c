import type { Hundekartei, Besitzer, BelegungBuchungen, PfotenPortraet } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';
import { MediaThumbnail } from '@/components/widgets/MediaViewer';
import { SatelliteSection } from '@/components/SatelliteSection';

export interface HundekarteiDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Hundekartei;
  /** N:1-Ziel „Besitzer": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  besitzerList: Besitzer[];
  /** Klick auf die Besitzer-Relation → overlay.push auf dessen Detail. */
  onOpenBesitzer?: (record: Besitzer) => void;
  /** 1:N „Belegung & Buchungen" (hund): VOLLE Liste — der Block filtert auf diesen Record. */
  belegungBuchungenList: BelegungBuchungen[];
  /** Zeilen-Klick → overlay.push auf das BelegungBuchungen-Detail (nie der Edit-Dialog). */
  onOpenBelegungBuchungen: (record: BelegungBuchungen) => void;
  /** Kontextuelles „+": öffnet den BelegungBuchungen-Dialog mit diesem Record vorgesetzt. */
  onAddBelegungBuchungen: () => void;
  /** 1:N „Pfoten-Porträt" (hund): VOLLE Liste — der Block filtert auf diesen Record. */
  pfotenPortraetList: PfotenPortraet[];
  /** Zeilen-Klick → overlay.push auf das PfotenPortraet-Detail (nie der Edit-Dialog). */
  onOpenPfotenPortraet: (record: PfotenPortraet) => void;
  /** Kontextuelles „+": öffnet den PfotenPortraet-Dialog mit diesem Record vorgesetzt. */
  onAddPfotenPortraet: () => void;
}

export function HundekarteiDetails({
  record,
  besitzerList,
  onOpenBesitzer,
  belegungBuchungenList,
  onOpenBelegungBuchungen,
  onAddBelegungBuchungen,
  pfotenPortraetList,
  onOpenPfotenPortraet,
  onAddPfotenPortraet,
}: HundekarteiDetailsProps) {
  const besitzerTarget = besitzerList.find(r => r.record_id === extractRecordId(record.fields.besitzer));
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('hundekartei', 'foto')} className="md:col-span-2">
          {record.fields.foto ? (
            <MediaThumbnail src={record.fields.foto as string} fit="contain" className="max-h-64 w-full rounded-lg" />
          ) : '—'}
        </RecordField>
        <RecordField label={fieldLabel('hundekartei', 'impfstatus')} value={record.fields.impfstatus} format="pill" />
        <RecordField label={fieldLabel('hundekartei', 'gesundheitshinweise')} value={record.fields.gesundheitshinweise} format="longtext" className="md:col-span-2" />
        <RecordField label={fieldLabel('hundekartei', 'fuetterungshinweise')} value={record.fields.fuetterungshinweise} format="longtext" className="md:col-span-2" />
        <RecordField label={fieldLabel('hundekartei', 'name')} value={record.fields.name} format="text" />
        <RecordField label={fieldLabel('hundekartei', 'rasse')} value={record.fields.rasse} format="text" />
        <RecordField label={fieldLabel('hundekartei', 'geburtsdatum')} value={record.fields.geburtsdatum} format="date" />
        <RecordField label={fieldLabel('hundekartei', 'geschlecht')} value={record.fields.geschlecht} format="pill" />
        <RecordField label={fieldLabel('hundekartei', 'gewicht_kg')} value={record.fields.gewicht_kg} format="text" />
      </RecordSection>

      {/* N:1 — verknüpfte Records: IMMER klickbar, nie eine Text-Sackgasse. */}
      <RecordSection title={t('relations')} cols={1}>
        <RecordRelation
          label={fieldLabel('hundekartei', 'besitzer')}
          name={besitzerTarget?.fields.vorname ?? '—'}
          meta={[besitzerTarget?.fields.telefon, besitzerTarget?.fields.email].filter(Boolean).join(' · ') || undefined}
          onClick={besitzerTarget && onOpenBesitzer ? () => onOpenBesitzer!(besitzerTarget!) : undefined}
        />
      </RecordSection>

      <SatelliteSection
        title={appLabel('belegung_buchungen')}
        items={belegungBuchungenList.filter(r => extractRecordId(r.fields.hund) === record.record_id)}
        map={r => ({ name: appLabel('belegung_buchungen'), meta: r.fields.anreisedatum })}
        onOpen={onOpenBelegungBuchungen}
        onAdd={onAddBelegungBuchungen}
        getKey={r => r.record_id}
      />

      <SatelliteSection
        title={appLabel('pfoten_portraet')}
        items={pfotenPortraetList.filter(r => extractRecordId(r.fields.hund) === record.record_id)}
        map={r => ({ name: r.fields.titel ?? appLabel('pfoten_portraet'), meta: r.fields.erstellungsdatum })}
        onOpen={onOpenPfotenPortraet}
        onAdd={onAddPfotenPortraet}
        getKey={r => r.record_id}
      />

      <RecordAttachments appId={APP_IDS.HUNDEKARTEI} recordId={record.record_id} />
    </>
  );
}
