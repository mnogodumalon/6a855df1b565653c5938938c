import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [
    'hund',
    'besitzer',
    { row: ['anreisedatum', 'abreisedatum'] },
    'platznummer',
    'status',
    'preis_euro',
    'notizen',
  ],
  defaults: {
    'anreisedatum': { kind: 'today' },
    'abreisedatum': { kind: 'todayOffset', days: 3 },
    'status': { kind: 'lookup', key: 'aktiv', label: 'Aktiv' },
  },
  computed: {
    '_belegung_dauer_nächte': { kind: 'dateDiff', from: 'anreisedatum', to: 'abreisedatum', unit: 'days' },
  },
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {};
