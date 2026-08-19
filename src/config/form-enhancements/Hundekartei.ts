import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [
    'name',
    'besitzer',
    'impfstatus',
    'geschlecht',
    'rasse',
    'geburtsdatum',
    'gewicht_kg',
    'gesundheitshinweise',
    'fuetterungshinweise',
  ],
  defaults: {
    'impfstatus': { kind: 'lookup', key: 'unbekannt', label: 'Unbekannt' },
  },
  computed: {},
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {};
