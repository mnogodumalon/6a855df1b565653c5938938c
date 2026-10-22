// Auto-generated. Per-entity form-enhancements config for "Website-Inhalte".
// Written by the backend form polish (app/services/form_polish.py) from the
// generator's manifest; scripts/parse-formulas.mjs expands the formula strings.
// Schema: see ./types.ts.

import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: ["unternehmensname", "slogan", "anzahl_plaetze", {"row": ["strasse", "hausnummer"], "cols": "2fr 1fr"}, {"row": ["plz", "ort"], "cols": "1fr 2fr"}, {"row": ["telefon", "email"], "cols": "1fr 1fr"}, "website_url", {"row": ["instagram", "facebook"], "cols": "1fr 1fr"}, "beschreibung", "leistungen", "oeffnungszeiten"],
  defaults: {},
  computed: {},
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {};
