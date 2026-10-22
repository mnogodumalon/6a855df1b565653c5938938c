// Auto-generated. Per-entity form-enhancements config for "Buchungsanfragen".
// Written by the backend form polish (app/services/form_polish.py) from the
// generator's manifest; scripts/parse-formulas.mjs expands the formula strings.
// Schema: see ./types.ts.

import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [{"row": ["interessent_vorname", "interessent_nachname"]}, "interessent_email", "interessent_telefon", "hund_name", "hund_rasse", "hund_groesse", {"row": ["wunsch_anreise", "wunsch_abreise"]}, "anfrage_status", "nachricht"],
  defaults: {
    'wunsch_anreise': { kind: 'today' },
    'wunsch_abreise': { kind: 'todayOffset', days: 3 },
  },
  computed: {
    '_anfrage_dauer_tage': { kind: 'dateDiff', from: 'wunsch_anreise', to: 'wunsch_abreise', unit: 'days' },
  },
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {};
