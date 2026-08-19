import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: ['hund', 'besitzer', { row: ['anreisedatum', 'abreisedatum'], cols: '1fr 1fr' }, 'platznummer', 'status', 'preis_euro', 'notizen'],
  defaults: {
    status: { kind: 'lookup', key: 'aktiv', label: 'Aktiv' },
  },
  computed: {
    '_belegung_dauer_nächte': { kind: 'dateDiff', from: 'anreisedatum', to: 'abreisedatum', unit: 'days' },
  },
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {};
