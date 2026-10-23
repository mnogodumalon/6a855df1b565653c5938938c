// Auto-generated. Per-entity form-enhancements config for "Hundekartei".
// Written by the backend form polish (app/services/form_polish.py) from the
// generator's manifest; scripts/parse-formulas.mjs expands the formula strings.
// Schema: see ./types.ts.

import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: ["name", "besitzer", {"row": ["rasse", "geschlecht"], "cols": "2fr 1fr"}, {"row": ["geburtsdatum", "gewicht_kg"], "cols": "1fr 1fr"}, "impfstatus", "gesundheitshinweise", "fuetterungshinweise"],
  defaults: {
    'impfstatus': { kind: 'lookup', key: 'unbekannt', label: 'Unbekannt' },
    'geschlecht': { kind: 'lookup', key: 'unbekannt', label: 'Unbekannt' },
  },
  computed: {},
  numberFields: {
    'gewicht_kg': { max: 150 },
  },
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {};
