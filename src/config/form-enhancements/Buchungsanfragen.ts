import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [{ row: ['interessent_vorname', 'interessent_nachname'], cols: '1fr 1fr' }, 'interessent_email', 'interessent_telefon', 'hund_name', 'hund_rasse', 'hund_groesse', { row: ['wunsch_anreise', 'wunsch_abreise'], cols: '1fr 1fr' }, 'nachricht', 'anfrage_status'],
  defaults: {
    anfrage_status: { kind: 'lookup', key: 'neu', label: 'Neu' },
  },
  computed: {
    '_anfrage_dauer_nächte': { kind: 'dateDiff', from: 'wunsch_anreise', to: 'wunsch_abreise', unit: 'days' },
  },
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {};
