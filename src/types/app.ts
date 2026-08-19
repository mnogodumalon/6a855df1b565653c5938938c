import { lookupLabel } from '@/i18n';

// AUTOMATICALLY GENERATED TYPES - DO NOT EDIT

export type LookupValue = { key: string; label: string };
export type GeoLocation = { lat: number; long: number; info?: string };

export type AttachmentType = 'file' | 'note' | 'url' | 'json';
export interface Attachment {
  id: string;
  type: AttachmentType;
  label: string | null;
  value: string | null;
  active: boolean;
  createdat?: string | null;
  updatedat?: string | null;
}

export interface AttachmentInput {
  type: AttachmentType;
  label?: string;
  value: string;
  active?: boolean;
}

export interface Besitzer {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    vorname?: string;
    nachname?: string;
    telefon?: string;
    email?: string;
    strasse?: string;
    hausnummer?: string;
    plz?: string;
    ort?: string;
    notizen?: string;
  };
}

export interface Hundekartei {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    foto?: string;
    besitzer?: string; // applookup -> URL zu 'Besitzer' Record
    impfstatus?: LookupValue;
    gesundheitshinweise?: string;
    fuetterungshinweise?: string;
    name?: string;
    rasse?: string;
    geburtsdatum?: string; // Format: YYYY-MM-DD oder ISO String
    geschlecht?: LookupValue;
    gewicht_kg?: number;
  };
}

export interface BelegungBuchungen {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    hund?: string; // applookup -> URL zu 'Hundekartei' Record
    besitzer?: string; // applookup -> URL zu 'Besitzer' Record
    anreisedatum?: string; // Format: YYYY-MM-DD oder ISO String
    abreisedatum?: string; // Format: YYYY-MM-DD oder ISO String
    platznummer?: LookupValue;
    status?: LookupValue;
    preis_euro?: number;
    notizen?: string;
  };
}

export interface Buchungsanfragen {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    interessent_vorname?: string;
    interessent_nachname?: string;
    interessent_email?: string;
    interessent_telefon?: string;
    hund_name?: string;
    hund_rasse?: string;
    hund_groesse?: LookupValue;
    wunsch_anreise?: string; // Format: YYYY-MM-DD oder ISO String
    wunsch_abreise?: string; // Format: YYYY-MM-DD oder ISO String
    nachricht?: string;
    anfrage_status?: LookupValue;
  };
}

export interface PfotenPortraet {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    hund?: string; // applookup -> URL zu 'Hundekartei' Record
    besitzer?: string; // applookup -> URL zu 'Besitzer' Record
    titel?: string;
    widmung?: string;
    charakterbeschreibung?: string;
    lieblingsaktivitaet?: string;
    besondere_momente?: string;
    portraet_foto?: string;
    erstellungsdatum?: string; // Format: YYYY-MM-DD oder ISO String
  };
}

export interface WebsiteInhalte {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    unternehmensname?: string;
    slogan?: string;
    beschreibung?: string;
    anzahl_plaetze?: number;
    leistungen?: string;
    oeffnungszeiten?: string;
    telefon?: string;
    email?: string;
    website_url?: string;
    strasse?: string;
    hausnummer?: string;
    plz?: string;
    ort?: string;
    standort?: GeoLocation; // { lat, long, info }
    galerie?: string;
    instagram?: string;
    facebook?: string;
  };
}

export const APP_IDS = {
  BESITZER: '6a855dc207a2aad7b8fd68e4',
  HUNDEKARTEI: '6a855dc86f78df9f0a5b088f',
  BELEGUNG_BUCHUNGEN: '6a855dc8c30124745adce5fb',
  BUCHUNGSANFRAGEN: '6a855dc9097cb5a18022e8f4',
  PFOTEN_PORTRAET: '6a855dca7440e0b47169f01a',
  WEBSITE_INHALTE: '6a855dca5210d3f2527a8810',
} as const;


export const LOOKUP_OPTIONS: Record<string, Record<string, {key: string, label: string}[]>> = {
  'hundekartei': {
    impfstatus: [{ key: "vollstaendig", get label() { return lookupLabel('hundekartei', 'impfstatus', "vollstaendig") ?? "Vollständig geimpft"; } }, { key: "teilweise", get label() { return lookupLabel('hundekartei', 'impfstatus', "teilweise") ?? "Teilweise geimpft"; } }, { key: "nicht_geimpft", get label() { return lookupLabel('hundekartei', 'impfstatus', "nicht_geimpft") ?? "Nicht geimpft"; } }, { key: "unbekannt", get label() { return lookupLabel('hundekartei', 'impfstatus', "unbekannt") ?? "Unbekannt"; } }],
    geschlecht: [{ key: "maennlich", get label() { return lookupLabel('hundekartei', 'geschlecht', "maennlich") ?? "Männlich"; } }, { key: "weiblich", get label() { return lookupLabel('hundekartei', 'geschlecht', "weiblich") ?? "Weiblich"; } }, { key: "unbekannt", get label() { return lookupLabel('hundekartei', 'geschlecht', "unbekannt") ?? "Unbekannt"; } }],
  },
  'belegung_buchungen': {
    platznummer: [{ key: "platz_1", get label() { return lookupLabel('belegung_buchungen', 'platznummer', "platz_1") ?? "Platz 1"; } }, { key: "platz_2", get label() { return lookupLabel('belegung_buchungen', 'platznummer', "platz_2") ?? "Platz 2"; } }, { key: "platz_3", get label() { return lookupLabel('belegung_buchungen', 'platznummer', "platz_3") ?? "Platz 3"; } }, { key: "platz_4", get label() { return lookupLabel('belegung_buchungen', 'platznummer', "platz_4") ?? "Platz 4"; } }, { key: "platz_5", get label() { return lookupLabel('belegung_buchungen', 'platznummer', "platz_5") ?? "Platz 5"; } }, { key: "platz_6", get label() { return lookupLabel('belegung_buchungen', 'platznummer', "platz_6") ?? "Platz 6"; } }, { key: "platz_7", get label() { return lookupLabel('belegung_buchungen', 'platznummer', "platz_7") ?? "Platz 7"; } }, { key: "platz_8", get label() { return lookupLabel('belegung_buchungen', 'platznummer', "platz_8") ?? "Platz 8"; } }, { key: "platz_9", get label() { return lookupLabel('belegung_buchungen', 'platznummer', "platz_9") ?? "Platz 9"; } }, { key: "platz_10", get label() { return lookupLabel('belegung_buchungen', 'platznummer', "platz_10") ?? "Platz 10"; } }, { key: "platz_11", get label() { return lookupLabel('belegung_buchungen', 'platznummer', "platz_11") ?? "Platz 11"; } }, { key: "platz_12", get label() { return lookupLabel('belegung_buchungen', 'platznummer', "platz_12") ?? "Platz 12"; } }],
    status: [{ key: "aktiv", get label() { return lookupLabel('belegung_buchungen', 'status', "aktiv") ?? "Aktiv"; } }, { key: "abgeschlossen", get label() { return lookupLabel('belegung_buchungen', 'status', "abgeschlossen") ?? "Abgeschlossen"; } }, { key: "storniert", get label() { return lookupLabel('belegung_buchungen', 'status', "storniert") ?? "Storniert"; } }],
  },
  'buchungsanfragen': {
    hund_groesse: [{ key: "klein", get label() { return lookupLabel('buchungsanfragen', 'hund_groesse', "klein") ?? "Klein (bis 10 kg)"; } }, { key: "mittel", get label() { return lookupLabel('buchungsanfragen', 'hund_groesse', "mittel") ?? "Mittel (10–25 kg)"; } }, { key: "gross", get label() { return lookupLabel('buchungsanfragen', 'hund_groesse', "gross") ?? "Groß (über 25 kg)"; } }],
    anfrage_status: [{ key: "neu", get label() { return lookupLabel('buchungsanfragen', 'anfrage_status', "neu") ?? "Neu"; } }, { key: "bestaetigt", get label() { return lookupLabel('buchungsanfragen', 'anfrage_status', "bestaetigt") ?? "Bestätigt"; } }, { key: "abgelehnt", get label() { return lookupLabel('buchungsanfragen', 'anfrage_status', "abgelehnt") ?? "Abgelehnt"; } }],
  },
};

// Optimistic LookupValue writes: never re-type a label — resolve the schema
// option instead (its label is a locale-aware getter; falls back to the key).
// WRONG: status: { key: 'offen', label: 'Offen' }   (frozen in one language)
// RIGHT: status: lookupOption('<appKey>', 'status', 'offen')
export function lookupOption(app: string, field: string, key: string): LookupValue {
  return LOOKUP_OPTIONS[app]?.[field]?.find(o => o.key === key) ?? { key, label: key };
}

export const FIELD_TYPES: Record<string, Record<string, string>> = {
  'besitzer': {
    'vorname': 'string/text',
    'nachname': 'string/text',
    'telefon': 'string/tel',
    'email': 'string/email',
    'strasse': 'string/text',
    'hausnummer': 'string/text',
    'plz': 'string/text',
    'ort': 'string/text',
    'notizen': 'string/textarea',
  },
  'hundekartei': {
    'foto': 'file',
    'besitzer': 'applookup/select',
    'impfstatus': 'lookup/select',
    'gesundheitshinweise': 'string/textarea',
    'fuetterungshinweise': 'string/textarea',
    'name': 'string/text',
    'rasse': 'string/text',
    'geburtsdatum': 'date/date',
    'geschlecht': 'lookup/radio',
    'gewicht_kg': 'number',
  },
  'belegung_buchungen': {
    'hund': 'applookup/select',
    'besitzer': 'applookup/select',
    'anreisedatum': 'date/date',
    'abreisedatum': 'date/date',
    'platznummer': 'lookup/select',
    'status': 'lookup/select',
    'preis_euro': 'number',
    'notizen': 'string/textarea',
  },
  'buchungsanfragen': {
    'interessent_vorname': 'string/text',
    'interessent_nachname': 'string/text',
    'interessent_email': 'string/email',
    'interessent_telefon': 'string/tel',
    'hund_name': 'string/text',
    'hund_rasse': 'string/text',
    'hund_groesse': 'lookup/radio',
    'wunsch_anreise': 'date/date',
    'wunsch_abreise': 'date/date',
    'nachricht': 'string/textarea',
    'anfrage_status': 'lookup/select',
  },
  'pfoten_portraet': {
    'hund': 'applookup/select',
    'besitzer': 'applookup/select',
    'titel': 'string/text',
    'widmung': 'string/textarea',
    'charakterbeschreibung': 'string/textarea',
    'lieblingsaktivitaet': 'string/text',
    'besondere_momente': 'string/textarea',
    'portraet_foto': 'file',
    'erstellungsdatum': 'date/date',
  },
  'website_inhalte': {
    'unternehmensname': 'string/text',
    'slogan': 'string/text',
    'beschreibung': 'string/textarea',
    'anzahl_plaetze': 'number',
    'leistungen': 'string/textarea',
    'oeffnungszeiten': 'string/textarea',
    'telefon': 'string/tel',
    'email': 'string/email',
    'website_url': 'string/url',
    'strasse': 'string/text',
    'hausnummer': 'string/text',
    'plz': 'string/text',
    'ort': 'string/text',
    'standort': 'geo',
    'galerie': 'file',
    'instagram': 'string/url',
    'facebook': 'string/url',
  },
};

export const HUB_TOPOLOGY: Record<string, { field: string; entity: string }[]> = {
  'besitzer': [
    { field: 'besitzer', entity: 'hundekartei' },
    { field: 'besitzer', entity: 'belegung_buchungen' },
    { field: 'besitzer', entity: 'pfoten_portraet' },
  ],
};

// Aliases for the pre-0.0.279 app keys (see 4c).
LOOKUP_OPTIONS['belegung_&_buchungen'] = LOOKUP_OPTIONS['belegung_buchungen'];
FIELD_TYPES['belegung_&_buchungen'] = FIELD_TYPES['belegung_buchungen'];

type StripLookup<T> = {
  [K in keyof T]: T[K] extends LookupValue | undefined ? string | LookupValue | undefined
    : T[K] extends LookupValue[] | undefined ? string[] | LookupValue[] | undefined
    : T[K];
};

// Helper Types for creating new records (lookup fields as plain strings for API)
export type CreateBesitzer = StripLookup<Besitzer['fields']>;
export type CreateHundekartei = StripLookup<Hundekartei['fields']>;
export type CreateBelegungBuchungen = StripLookup<BelegungBuchungen['fields']>;
export type CreateBuchungsanfragen = StripLookup<Buchungsanfragen['fields']>;
export type CreatePfotenPortraet = StripLookup<PfotenPortraet['fields']>;
export type CreateWebsiteInhalte = StripLookup<WebsiteInhalte['fields']>;