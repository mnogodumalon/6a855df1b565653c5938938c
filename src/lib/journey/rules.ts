/**
 * Field rules — GENERATED from the app metadata. Do not edit.
 *
 * The mechanical truth about every field: what kind it is, whether the
 * platform's base view marks it required, which lookup keys exist, where an
 * applookup points, what the label is. `useStepForm` validates against these
 * rules and phrases its messages with the real labels; `toWirePayload` uses
 * them to shape the create payload; `SHAPES` tells a page which input FORM
 * fits the data (a date pair wants a calendar, not two fields) — it is a
 * signal, not a gate.
 */
import { appLabel, fieldLabel, lookupLabel } from '@/i18n';
import { policyLabel } from './policy';
import { LOOKUP_OPTIONS } from '@/types/app';

export type EntityKey = 'besitzer' | 'hundekartei' | 'belegung_buchungen' | 'buchungsanfragen' | 'pfoten_portraet' | 'website_inhalte';

/** The text fields of each entity — what a search may run over (generated;
 *  `never` for an entity without text of its own, e.g. a link table). */
export interface StringFields {
  "besitzer": "vorname" | "nachname" | "telefon" | "email" | "strasse" | "hausnummer" | "plz" | "ort" | "notizen";
  "hundekartei": "gesundheitshinweise" | "fuetterungshinweise" | "name" | "rasse";
  "belegung_buchungen": "notizen";
  "buchungsanfragen": "interessent_vorname" | "interessent_nachname" | "interessent_email" | "interessent_telefon" | "hund_name" | "hund_rasse" | "nachricht";
  "pfoten_portraet": "titel" | "widmung" | "charakterbeschreibung" | "lieblingsaktivitaet" | "besondere_momente";
  "website_inhalte": "unternehmensname" | "slogan" | "beschreibung" | "leistungen" | "oeffnungszeiten" | "telefon" | "email" | "website_url" | "strasse" | "hausnummer" | "plz" | "ort" | "instagram" | "facebook";
}
export type StringFieldKey<E extends EntityKey> = E extends keyof StringFields ? StringFields[E] : never;

/** The applookup fields of each entity (generated). A pick stored through
 *  `form.set` on one of these must carry its display name — at compile time
 *  (`StepForm.set`), because the review would otherwise show the id. */
export interface RecordFields {
  "besitzer": never;
  "hundekartei": "besitzer";
  "belegung_buchungen": "hund" | "besitzer";
  "buchungsanfragen": never;
  "pfoten_portraet": "hund" | "besitzer";
  "website_inhalte": never;
}
export type RecordFieldKey<E extends EntityKey> = E extends keyof RecordFields ? RecordFields[E] : never;

export type FieldKind =
  | 'text'
  | 'textarea'
  | 'email'
  | 'tel'
  | 'url'
  | 'number'
  | 'bool'
  | 'date'
  | 'datetime'
  | 'lookup'
  | 'multilookup'
  | 'record'
  | 'multirecord'
  | 'file'
  | 'geo';

export interface FieldRule {
  key: string;
  fulltype: string;
  kind: FieldKind;
  /** From the app's base view. A public page may override this per field. */
  required: boolean;
  /** Build-time label — `labelOf()` prefers the runtime i18n bundle. */
  label: string;
  /** Whether a journey may write it as a value. `file` is false: a file is UPLOADED
   *  (`form.file(key)` → FileField; the chosen file travels in the create as a data URL). */
  writable: boolean;
  maxLength?: number;
  /** lookup / multilookup: the ONLY valid write values. */
  options?: string[];
  /** record / multirecord: the target app (always) and its entity key (when inside this appgroup). */
  targetAppId?: string;
  targetEntity?: EntityKey;
  format?: 'currency';
  /** HTML autocomplete token derived from the field name (given-name, email, tel, …). */
  autoComplete?: string;
}

export interface EntityInfo {
  key: EntityKey;
  appId: string;
  label: string;
  /** PascalCase plural — `get<pascal>()` on the service. */
  pascal: string;
  /** The single-record suffix — `create<single>()` on the service. */
  single: string;
}

/** Input-form signals per entity: which data shape each field (pair) has.
 *  `range`  — two date fields that form a stay/period → AvailabilityRangePicker
 *  `choice` — a lookup with few options → ChoiceGroup pills instead of a select
 *  `record` — an applookup → EntitySelectStep with search, never a raw id field
 *  `stock`  — a quantity that has a stock/capacity counterpart → show it, warn on overshoot */
export type Shape =
  | { kind: 'range'; from: string; to: string }
  | { kind: 'choice'; field: string; count: number }
  | { kind: 'record'; field: string; targetEntity?: EntityKey }
  | { kind: 'stock'; field: string };

export const ENTITIES: Record<EntityKey, EntityInfo> = {
  "besitzer": {
    "key": "besitzer",
    "appId": "6a855dc207a2aad7b8fd68e4",
    "label": "Besitzer",
    "pascal": "Besitzer",
    "single": "BesitzerEntry"
  },
  "hundekartei": {
    "key": "hundekartei",
    "appId": "6a855dc86f78df9f0a5b088f",
    "label": "Hundekartei",
    "pascal": "Hundekartei",
    "single": "HundekarteiEntry"
  },
  "belegung_buchungen": {
    "key": "belegung_buchungen",
    "appId": "6a855dc8c30124745adce5fb",
    "label": "Belegung & Buchungen",
    "pascal": "BelegungBuchungen",
    "single": "BelegungBuchungenEntry"
  },
  "buchungsanfragen": {
    "key": "buchungsanfragen",
    "appId": "6a855dc9097cb5a18022e8f4",
    "label": "Buchungsanfragen",
    "pascal": "Buchungsanfragen",
    "single": "BuchungsanfragenEntry"
  },
  "pfoten_portraet": {
    "key": "pfoten_portraet",
    "appId": "6a855dca7440e0b47169f01a",
    "label": "Pfoten-Porträt",
    "pascal": "PfotenPortraet",
    "single": "PfotenPortraetEntry"
  },
  "website_inhalte": {
    "key": "website_inhalte",
    "appId": "6a855dca5210d3f2527a8810",
    "label": "Website-Inhalte",
    "pascal": "WebsiteInhalte",
    "single": "WebsiteInhalteEntry"
  }
};

export const FIELD_RULES: Record<EntityKey, Record<string, FieldRule>> = {
  "besitzer": {
    "vorname": {
      "key": "vorname",
      "fulltype": "string/text",
      "kind": "text",
      "required": true,
      "label": "Vorname",
      "writable": true,
      "maxLength": 4000,
      "autoComplete": "given-name"
    },
    "nachname": {
      "key": "nachname",
      "fulltype": "string/text",
      "kind": "text",
      "required": true,
      "label": "Nachname",
      "writable": true,
      "maxLength": 4000,
      "autoComplete": "family-name"
    },
    "telefon": {
      "key": "telefon",
      "fulltype": "string/tel",
      "kind": "tel",
      "required": false,
      "label": "Telefonnummer",
      "writable": true,
      "autoComplete": "tel"
    },
    "email": {
      "key": "email",
      "fulltype": "string/email",
      "kind": "email",
      "required": false,
      "label": "E-Mail-Adresse",
      "writable": true,
      "autoComplete": "email"
    },
    "strasse": {
      "key": "strasse",
      "fulltype": "string/text",
      "kind": "text",
      "required": false,
      "label": "Straße",
      "writable": true,
      "maxLength": 4000,
      "autoComplete": "address-line1"
    },
    "hausnummer": {
      "key": "hausnummer",
      "fulltype": "string/text",
      "kind": "text",
      "required": false,
      "label": "Hausnummer",
      "writable": true,
      "maxLength": 4000
    },
    "plz": {
      "key": "plz",
      "fulltype": "string/text",
      "kind": "text",
      "required": false,
      "label": "Postleitzahl",
      "writable": true,
      "maxLength": 4000,
      "autoComplete": "postal-code"
    },
    "ort": {
      "key": "ort",
      "fulltype": "string/text",
      "kind": "text",
      "required": false,
      "label": "Ort",
      "writable": true,
      "maxLength": 4000,
      "autoComplete": "address-level2"
    },
    "notizen": {
      "key": "notizen",
      "fulltype": "string/textarea",
      "kind": "textarea",
      "required": false,
      "label": "Notizen",
      "writable": true
    }
  },
  "hundekartei": {
    "foto": {
      "key": "foto",
      "fulltype": "file",
      "kind": "file",
      "required": false,
      "label": "Foto des Hundes",
      "writable": false
    },
    "besitzer": {
      "key": "besitzer",
      "fulltype": "applookup/select",
      "kind": "record",
      "required": true,
      "label": "Besitzer",
      "writable": true,
      "targetAppId": "6a855dc207a2aad7b8fd68e4",
      "targetEntity": "besitzer"
    },
    "impfstatus": {
      "key": "impfstatus",
      "fulltype": "lookup/select",
      "kind": "lookup",
      "required": false,
      "label": "Impfstatus",
      "writable": true,
      "options": [
        "vollstaendig",
        "teilweise",
        "nicht_geimpft",
        "unbekannt"
      ]
    },
    "gesundheitshinweise": {
      "key": "gesundheitshinweise",
      "fulltype": "string/textarea",
      "kind": "textarea",
      "required": false,
      "label": "Gesundheitshinweise & Besonderheiten",
      "writable": true
    },
    "fuetterungshinweise": {
      "key": "fuetterungshinweise",
      "fulltype": "string/textarea",
      "kind": "textarea",
      "required": false,
      "label": "Fütterungshinweise",
      "writable": true
    },
    "name": {
      "key": "name",
      "fulltype": "string/text",
      "kind": "text",
      "required": true,
      "label": "Name des Hundes",
      "writable": true,
      "maxLength": 4000,
      "autoComplete": "name"
    },
    "rasse": {
      "key": "rasse",
      "fulltype": "string/text",
      "kind": "text",
      "required": false,
      "label": "Rasse",
      "writable": true,
      "maxLength": 4000
    },
    "geburtsdatum": {
      "key": "geburtsdatum",
      "fulltype": "date/date",
      "kind": "date",
      "required": false,
      "label": "Geburtsdatum",
      "writable": true,
      "autoComplete": "bday"
    },
    "geschlecht": {
      "key": "geschlecht",
      "fulltype": "lookup/radio",
      "kind": "lookup",
      "required": false,
      "label": "Geschlecht",
      "writable": true,
      "options": [
        "maennlich",
        "weiblich",
        "unbekannt"
      ]
    },
    "gewicht_kg": {
      "key": "gewicht_kg",
      "fulltype": "number",
      "kind": "number",
      "required": false,
      "label": "Gewicht (kg)",
      "writable": true
    }
  },
  "belegung_buchungen": {
    "hund": {
      "key": "hund",
      "fulltype": "applookup/select",
      "kind": "record",
      "required": true,
      "label": "Hund",
      "writable": true,
      "targetAppId": "6a855dc86f78df9f0a5b088f",
      "targetEntity": "hundekartei"
    },
    "besitzer": {
      "key": "besitzer",
      "fulltype": "applookup/select",
      "kind": "record",
      "required": false,
      "label": "Besitzer",
      "writable": true,
      "targetAppId": "6a855dc207a2aad7b8fd68e4",
      "targetEntity": "besitzer"
    },
    "anreisedatum": {
      "key": "anreisedatum",
      "fulltype": "date/date",
      "kind": "date",
      "required": true,
      "label": "Anreisedatum",
      "writable": true
    },
    "abreisedatum": {
      "key": "abreisedatum",
      "fulltype": "date/date",
      "kind": "date",
      "required": true,
      "label": "Abreisedatum",
      "writable": true
    },
    "platznummer": {
      "key": "platznummer",
      "fulltype": "lookup/select",
      "kind": "lookup",
      "required": true,
      "label": "Platznummer",
      "writable": true,
      "options": [
        "platz_1",
        "platz_2",
        "platz_3",
        "platz_4",
        "platz_5",
        "platz_6",
        "platz_7",
        "platz_8",
        "platz_9",
        "platz_10",
        "platz_11",
        "platz_12"
      ]
    },
    "status": {
      "key": "status",
      "fulltype": "lookup/select",
      "kind": "lookup",
      "required": true,
      "label": "Status",
      "writable": true,
      "options": [
        "aktiv",
        "abgeschlossen",
        "storniert"
      ]
    },
    "preis_euro": {
      "key": "preis_euro",
      "fulltype": "number",
      "kind": "number",
      "required": false,
      "label": "Preis (€)",
      "writable": true,
      "format": "currency"
    },
    "notizen": {
      "key": "notizen",
      "fulltype": "string/textarea",
      "kind": "textarea",
      "required": false,
      "label": "Notizen zur Buchung",
      "writable": true
    }
  },
  "buchungsanfragen": {
    "interessent_vorname": {
      "key": "interessent_vorname",
      "fulltype": "string/text",
      "kind": "text",
      "required": true,
      "label": "Vorname",
      "writable": true,
      "maxLength": 4000,
      "autoComplete": "given-name"
    },
    "interessent_nachname": {
      "key": "interessent_nachname",
      "fulltype": "string/text",
      "kind": "text",
      "required": true,
      "label": "Nachname",
      "writable": true,
      "maxLength": 4000,
      "autoComplete": "family-name"
    },
    "interessent_email": {
      "key": "interessent_email",
      "fulltype": "string/email",
      "kind": "email",
      "required": true,
      "label": "E-Mail-Adresse",
      "writable": true,
      "autoComplete": "email"
    },
    "interessent_telefon": {
      "key": "interessent_telefon",
      "fulltype": "string/tel",
      "kind": "tel",
      "required": false,
      "label": "Telefonnummer",
      "writable": true,
      "autoComplete": "tel"
    },
    "hund_name": {
      "key": "hund_name",
      "fulltype": "string/text",
      "kind": "text",
      "required": true,
      "label": "Name des Hundes",
      "writable": true,
      "maxLength": 4000
    },
    "hund_rasse": {
      "key": "hund_rasse",
      "fulltype": "string/text",
      "kind": "text",
      "required": false,
      "label": "Rasse des Hundes",
      "writable": true,
      "maxLength": 4000
    },
    "hund_groesse": {
      "key": "hund_groesse",
      "fulltype": "lookup/radio",
      "kind": "lookup",
      "required": false,
      "label": "Größe des Hundes",
      "writable": true,
      "options": [
        "klein",
        "mittel",
        "gross"
      ]
    },
    "wunsch_anreise": {
      "key": "wunsch_anreise",
      "fulltype": "date/date",
      "kind": "date",
      "required": true,
      "label": "Gewünschtes Anreisedatum",
      "writable": true
    },
    "wunsch_abreise": {
      "key": "wunsch_abreise",
      "fulltype": "date/date",
      "kind": "date",
      "required": true,
      "label": "Gewünschtes Abreisedatum",
      "writable": true
    },
    "nachricht": {
      "key": "nachricht",
      "fulltype": "string/textarea",
      "kind": "textarea",
      "required": false,
      "label": "Nachricht / Besondere Hinweise",
      "writable": true
    },
    "anfrage_status": {
      "key": "anfrage_status",
      "fulltype": "lookup/select",
      "kind": "lookup",
      "required": false,
      "label": "Status der Anfrage",
      "writable": true,
      "options": [
        "neu",
        "bestaetigt",
        "abgelehnt"
      ]
    }
  },
  "pfoten_portraet": {
    "hund": {
      "key": "hund",
      "fulltype": "applookup/select",
      "kind": "record",
      "required": true,
      "label": "Hund",
      "writable": true,
      "targetAppId": "6a855dc86f78df9f0a5b088f",
      "targetEntity": "hundekartei"
    },
    "besitzer": {
      "key": "besitzer",
      "fulltype": "applookup/select",
      "kind": "record",
      "required": false,
      "label": "Besitzer",
      "writable": true,
      "targetAppId": "6a855dc207a2aad7b8fd68e4",
      "targetEntity": "besitzer"
    },
    "titel": {
      "key": "titel",
      "fulltype": "string/text",
      "kind": "text",
      "required": true,
      "label": "Titel des Porträts",
      "writable": true,
      "maxLength": 4000
    },
    "widmung": {
      "key": "widmung",
      "fulltype": "string/textarea",
      "kind": "textarea",
      "required": false,
      "label": "Persönliche Widmung",
      "writable": true
    },
    "charakterbeschreibung": {
      "key": "charakterbeschreibung",
      "fulltype": "string/textarea",
      "kind": "textarea",
      "required": false,
      "label": "Charakterbeschreibung",
      "writable": true
    },
    "lieblingsaktivitaet": {
      "key": "lieblingsaktivitaet",
      "fulltype": "string/text",
      "kind": "text",
      "required": false,
      "label": "Lieblingsaktivität",
      "writable": true,
      "maxLength": 4000
    },
    "besondere_momente": {
      "key": "besondere_momente",
      "fulltype": "string/textarea",
      "kind": "textarea",
      "required": false,
      "label": "Besondere Momente beim Aufenthalt",
      "writable": true
    },
    "portraet_foto": {
      "key": "portraet_foto",
      "fulltype": "file",
      "kind": "file",
      "required": false,
      "label": "Foto für das Porträt",
      "writable": false
    },
    "erstellungsdatum": {
      "key": "erstellungsdatum",
      "fulltype": "date/date",
      "kind": "date",
      "required": false,
      "label": "Erstellungsdatum",
      "writable": true
    }
  },
  "website_inhalte": {
    "unternehmensname": {
      "key": "unternehmensname",
      "fulltype": "string/text",
      "kind": "text",
      "required": true,
      "label": "Name der Hundepension",
      "writable": true,
      "maxLength": 4000
    },
    "slogan": {
      "key": "slogan",
      "fulltype": "string/text",
      "kind": "text",
      "required": false,
      "label": "Slogan",
      "writable": true,
      "maxLength": 4000
    },
    "beschreibung": {
      "key": "beschreibung",
      "fulltype": "string/textarea",
      "kind": "textarea",
      "required": false,
      "label": "Beschreibung des Angebots",
      "writable": true
    },
    "anzahl_plaetze": {
      "key": "anzahl_plaetze",
      "fulltype": "number",
      "kind": "number",
      "required": false,
      "label": "Anzahl der Plätze",
      "writable": true
    },
    "leistungen": {
      "key": "leistungen",
      "fulltype": "string/textarea",
      "kind": "textarea",
      "required": false,
      "label": "Leistungen & Besonderheiten",
      "writable": true
    },
    "oeffnungszeiten": {
      "key": "oeffnungszeiten",
      "fulltype": "string/textarea",
      "kind": "textarea",
      "required": false,
      "label": "Öffnungszeiten",
      "writable": true
    },
    "telefon": {
      "key": "telefon",
      "fulltype": "string/tel",
      "kind": "tel",
      "required": false,
      "label": "Telefonnummer",
      "writable": true,
      "autoComplete": "tel"
    },
    "email": {
      "key": "email",
      "fulltype": "string/email",
      "kind": "email",
      "required": false,
      "label": "E-Mail-Adresse",
      "writable": true,
      "autoComplete": "email"
    },
    "website_url": {
      "key": "website_url",
      "fulltype": "string/url",
      "kind": "url",
      "required": false,
      "label": "Website-Adresse",
      "writable": true,
      "autoComplete": "url"
    },
    "strasse": {
      "key": "strasse",
      "fulltype": "string/text",
      "kind": "text",
      "required": false,
      "label": "Straße",
      "writable": true,
      "maxLength": 4000,
      "autoComplete": "address-line1"
    },
    "hausnummer": {
      "key": "hausnummer",
      "fulltype": "string/text",
      "kind": "text",
      "required": false,
      "label": "Hausnummer",
      "writable": true,
      "maxLength": 4000
    },
    "plz": {
      "key": "plz",
      "fulltype": "string/text",
      "kind": "text",
      "required": false,
      "label": "Postleitzahl",
      "writable": true,
      "maxLength": 4000,
      "autoComplete": "postal-code"
    },
    "ort": {
      "key": "ort",
      "fulltype": "string/text",
      "kind": "text",
      "required": false,
      "label": "Ort",
      "writable": true,
      "maxLength": 4000,
      "autoComplete": "address-level2"
    },
    "standort": {
      "key": "standort",
      "fulltype": "geo",
      "kind": "geo",
      "required": false,
      "label": "Standort auf der Karte",
      "writable": true
    },
    "galerie": {
      "key": "galerie",
      "fulltype": "file",
      "kind": "file",
      "required": false,
      "label": "Fotos für die Galerie",
      "writable": false
    },
    "instagram": {
      "key": "instagram",
      "fulltype": "string/url",
      "kind": "url",
      "required": false,
      "label": "Instagram-Profil",
      "writable": true,
      "autoComplete": "url"
    },
    "facebook": {
      "key": "facebook",
      "fulltype": "string/url",
      "kind": "url",
      "required": false,
      "label": "Facebook-Seite",
      "writable": true,
      "autoComplete": "url"
    }
  }
};

export const SHAPES: Record<EntityKey, Shape[]> = {
  "besitzer": [],
  "hundekartei": [
    {
      "kind": "choice",
      "field": "impfstatus",
      "count": 4
    },
    {
      "kind": "choice",
      "field": "geschlecht",
      "count": 3
    },
    {
      "kind": "record",
      "field": "besitzer",
      "targetEntity": "besitzer"
    }
  ],
  "belegung_buchungen": [
    {
      "kind": "choice",
      "field": "status",
      "count": 3
    },
    {
      "kind": "record",
      "field": "hund",
      "targetEntity": "hundekartei"
    },
    {
      "kind": "record",
      "field": "besitzer",
      "targetEntity": "besitzer"
    }
  ],
  "buchungsanfragen": [
    {
      "kind": "range",
      "from": "wunsch_anreise",
      "to": "wunsch_abreise"
    },
    {
      "kind": "choice",
      "field": "hund_groesse",
      "count": 3
    },
    {
      "kind": "choice",
      "field": "anfrage_status",
      "count": 3
    }
  ],
  "pfoten_portraet": [
    {
      "kind": "record",
      "field": "hund",
      "targetEntity": "hundekartei"
    },
    {
      "kind": "record",
      "field": "besitzer",
      "targetEntity": "besitzer"
    }
  ],
  "website_inhalte": []
};

/** The fields a record of this entity is recognised by (a person: first and
 *  last name; else its title-like text field) — the same choice the dashboard's
 *  enrichment makes for `<key>Name`. `useRecordSearch` resolves an applookup to
 *  this name (`ctx.ref('gast')` in `toItem`). */
export const DISPLAY_FIELDS: Record<EntityKey, string[]> = {
  "besitzer": [
    "vorname",
    "nachname"
  ],
  "hundekartei": [
    "name"
  ],
  "belegung_buchungen": [
    "notizen"
  ],
  "buchungsanfragen": [
    "interessent_vorname"
  ],
  "pfoten_portraet": [
    "titel"
  ],
  "website_inhalte": [
    "unternehmensname"
  ]
};

/** The display name of a record: its display fields joined, else the first
 *  non-empty text value, else ''. */
/** A display-field value as text: strings as they are, a lookup `{ key, label }`
 *  (either door hydrates lookups to objects) by its label — an entity whose
 *  only title-like field is a lookup/select otherwise had no name at all. */
function displayPart(v: unknown): string {
  if (typeof v === 'string') return v.trim();
  if (v && typeof v === 'object' && 'label' in v) {
    const l = (v as { label?: unknown }).label;
    return l === null || l === undefined ? '' : String(l).trim();
  }
  return '';
}

export function displayNameOf(entity: EntityKey, fields: Record<string, unknown>): string {
  const parts = (DISPLAY_FIELDS[entity] ?? [])
    .map(k => displayPart(fields[k]))
    .filter(v => v !== '');
  if (parts.length > 0) return parts.join(' ');
  for (const [k, rule] of Object.entries(FIELD_RULES[entity] ?? {})) {
    if (rule.kind !== 'text' && rule.kind !== 'email') continue;
    const v = fields[k];
    if (typeof v === 'string' && v.trim() !== '') return v.trim();
  }
  return '';
}

export function ruleOf(entity: EntityKey, key: string): FieldRule | undefined {
  return FIELD_RULES[entity]?.[key];
}

/** The field label as the user sees it — the owner's policy label first (a
 *  public page's "Felder anpassen"), runtime bundle second, generated label last. */
export function labelOf(entity: EntityKey, key: string): string {
  const own = policyLabel(entity, key);
  if (own) return own;
  const fromBundle = fieldLabel(entity, key);
  if (fromBundle !== key) return fromBundle;
  return ruleOf(entity, key)?.label ?? key;
}

export function entityLabel(entity: EntityKey): string {
  const fromBundle = appLabel(entity);
  if (fromBundle !== entity) return fromBundle;
  return ENTITIES[entity]?.label ?? entity;
}

/** Lookup options with runtime labels — the only legitimate source of `{key,label}` pairs. */
export function optionsOf(entity: EntityKey, key: string): Array<{ key: string; label: string }> {
  const generated = (LOOKUP_OPTIONS as Record<string, Record<string, Array<{ key: string; label: string }>>>)[entity]?.[key];
  if (generated && generated.length) return generated.map(o => ({ key: o.key, label: o.label }));
  const keys = ruleOf(entity, key)?.options ?? [];
  return keys.map(k => ({ key: k, label: lookupLabel(entity, key, k) ?? k }));
}

export function isEmptyValue(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === 'object' && 'from' in (v as object) && 'to' in (v as object)) {
    const r = v as { from: unknown; to: unknown };
    return isEmptyValue(r.from) && isEmptyValue(r.to);
  }
  return false;
}
