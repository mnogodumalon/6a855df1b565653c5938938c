import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: ['hund', 'besitzer', 'titel', 'charakterbeschreibung', 'lieblingsaktivitaet', 'widmung', 'besondere_momente', 'erstellungsdatum'],
  defaults: {
    erstellungsdatum: { kind: 'today' },
  },
  computed: {},
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, { lookupKey: string }[]> = {};
