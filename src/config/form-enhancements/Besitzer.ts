import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [{ row: ['vorname', 'nachname'], cols: '1fr 1fr' }, 'email', 'strasse', 'hausnummer', { row: ['plz', 'ort'], cols: '1fr 2fr' }, 'notizen'],
  defaults: {},
  computed: {},
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, { lookupKey: string }[]> = {};
