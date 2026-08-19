import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: ['unternehmensname', 'slogan', 'beschreibung', 'anzahl_plaetze', 'leistungen', 'oeffnungszeiten', 'telefon', 'email', 'website_url', { row: ['strasse', 'hausnummer'], cols: '2fr 1fr' }, { row: ['plz', 'ort'], cols: '1fr 2fr' }, 'instagram', 'facebook'],
  defaults: {},
  computed: {},
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, { lookupKey: string }[]> = {};
