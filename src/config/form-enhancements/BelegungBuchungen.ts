// Auto-generated. Per-entity form-enhancements config for "Belegung & Buchungen".
// Written by the backend form polish (app/services/form_polish.py) from the
// generator's manifest; scripts/parse-formulas.mjs expands the formula strings.
// Schema: see ./types.ts.

import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [{"row": ["hund", "besitzer"], "cols": "1fr 1fr"}, {"row": ["anreisedatum", "abreisedatum"], "cols": "1fr 1fr"}, {"row": ["platznummer", "status"], "cols": "1fr 1fr"}, "preis_euro", "notizen"],
  defaults: {
    'anreisedatum': { kind: 'today' },
    'abreisedatum': { kind: 'todayOffset', days: 3 },
    'status': { kind: 'lookup', key: 'aktiv', label: 'Aktiv' },
  },
  computed: {
    '_buchung_dauer_tage': { kind: 'dateDiff', from: 'anreisedatum', to: 'abreisedatum', unit: 'days' },
  },
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {};
