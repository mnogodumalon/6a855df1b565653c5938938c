import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [
    { row: ['interessent_vorname', 'interessent_nachname'] },
    'interessent_email',
    'interessent_telefon',
    'hund_name',
    'hund_rasse',
    'hund_groesse',
    { row: ['wunsch_anreise', 'wunsch_abreise'] },
    'anfrage_status',
    'nachricht',
  ],
  defaults: {
    'anfrage_status': { kind: 'lookup', key: 'neu', label: 'Neu' },
  },
  computed: {
    '_anfrage_dauer_nächte': { kind: 'dateDiff', from: 'wunsch_anreise', to: 'wunsch_abreise', unit: 'days' },
  },
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {};
