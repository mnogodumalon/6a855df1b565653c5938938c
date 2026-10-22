/**
 * Required-field messages — WRITTEN BY THE BUILD AGENT, never by a heuristic.
 *
 * The layer knows two things about an empty required field: that it is
 * required and what its label is. Out of that it can only say „„Anreise" ist
 * ein Pflichtfeld". What the person should do instead („Bitte einen Gast
 * auswählen.") is meaning, and meaning is the agent's: the Phase-2 orchestrator
 * writes one short instruction per required field — what is needed, not why — to
 * `.intents-staging/messages.json`, the integration step validates it against
 * the app metadata and renders it into the block below. Scaffold updates keep
 * the block. Do not edit outside the markers.
 *
 * Every door reads this and nothing else: `useStepForm` (flows and public
 * pages), the generated {Entity}Dialog and the public form's server-error line.
 * A field without a sentence falls back to the label sentence — never to a
 * bare „Dieses Feld ist erforderlich".
 *
 * Required fields per entity (from the base view):
 *   - besitzer: vorname (Vorname), nachname (Nachname)
 *   - hundekartei: besitzer (Besitzer), name (Name des Hundes)
 *   - belegung_buchungen: hund (Hund), anreisedatum (Anreisedatum), abreisedatum (Abreisedatum), platznummer (Platznummer), status (Status)
 *   - buchungsanfragen: interessent_vorname (Vorname), interessent_nachname (Nachname), interessent_email (E-Mail-Adresse), hund_name (Name des Hundes), wunsch_anreise (Gewünschtes Anreisedatum), wunsch_abreise (Gewünschtes Abreisedatum)
 *   - pfoten_portraet: hund (Hund), titel (Titel des Porträts)
 *   - website_inhalte: unternehmensname (Name der Hundepension)
 */
import { t, tx } from '@/i18n';
import { labelOf, type EntityKey } from './rules';

/** The writable fields of each entity — the keys a message may address (generated). */
export interface MessageFields {
  "besitzer": "vorname" | "nachname" | "telefon" | "email" | "strasse" | "hausnummer" | "plz" | "ort" | "notizen";
  "hundekartei": "besitzer" | "impfstatus" | "gesundheitshinweise" | "fuetterungshinweise" | "name" | "rasse" | "geburtsdatum" | "geschlecht" | "gewicht_kg";
  "belegung_buchungen": "hund" | "besitzer" | "anreisedatum" | "abreisedatum" | "platznummer" | "status" | "preis_euro" | "notizen";
  "buchungsanfragen": "interessent_vorname" | "interessent_nachname" | "interessent_email" | "interessent_telefon" | "hund_name" | "hund_rasse" | "hund_groesse" | "wunsch_anreise" | "wunsch_abreise" | "nachricht" | "anfrage_status";
  "pfoten_portraet": "hund" | "besitzer" | "titel" | "widmung" | "charakterbeschreibung" | "lieblingsaktivitaet" | "besondere_momente" | "erstellungsdatum";
  "website_inhalte": "unternehmensname" | "slogan" | "beschreibung" | "anzahl_plaetze" | "leistungen" | "oeffnungszeiten" | "telefon" | "email" | "website_url" | "strasse" | "hausnummer" | "plz" | "ort" | "standort" | "instagram" | "facebook";
}
export type MessageFieldKey<E extends EntityKey> = E extends keyof MessageFields ? MessageFields[E] : never;

export const REQUIRED_MESSAGES: { [E in EntityKey]?: Partial<Record<MessageFieldKey<E>, string>> } = {
  // <custom:messages>
  besitzer: { vorname: "Bitte den Vornamen eingeben.", nachname: "Bitte den Nachnamen eingeben." },
  hundekartei: { name: "Bitte den Namen des Hundes eingeben.", besitzer: "Bitte einen Besitzer auswählen." },
  belegung_buchungen: { hund: "Bitte einen Hund auswählen.", anreisedatum: "Bitte das Anreisedatum wählen.", abreisedatum: "Bitte das Abreisedatum wählen.", platznummer: "Bitte einen Platz wählen.", status: "Bitte einen Status wählen." },
  buchungsanfragen: { interessent_vorname: "Bitte den Vornamen eingeben.", interessent_nachname: "Bitte den Nachnamen eingeben.", interessent_email: "Bitte die E-Mail-Adresse eingeben.", hund_name: "Bitte den Namen des Hundes eingeben.", wunsch_anreise: "Bitte die Wunsch-Anreise wählen.", wunsch_abreise: "Bitte die Wunsch-Abreise wählen." },
  pfoten_portraet: { hund: "Bitte einen Hund auswählen.", titel: "Bitte einen Titel für das Porträt eingeben." },
  website_inhalte: { unternehmensname: "Bitte den Namen der Hundepension eingeben." },
  // </custom:messages>
};

/** The sentence shown when `key` of `entity` is required and empty — the
 *  agent's own text (translated at runtime like every page string), else the
 *  label sentence. Call it while rendering, not at module scope. */
export function requiredMessage(entity: EntityKey, key: string): string {
  const own = (REQUIRED_MESSAGES as Record<string, Record<string, string | undefined> | undefined>)[entity]?.[key];
  if (own && own.trim()) return tx(own);
  return t('v_required', { label: labelOf(entity, key) });
}

/** True when the agent wrote a sentence for the field. */
export function hasOwnMessage(entity: EntityKey, key: string): boolean {
  const own = (REQUIRED_MESSAGES as Record<string, Record<string, string | undefined> | undefined>)[entity]?.[key];
  return Boolean(own && own.trim());
}
