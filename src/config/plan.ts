// The orchestrator's plan, as far as the running app needs it
// (docs/orchestrator/SPEC.md). Generated — do not edit; regenerated on every
// build and update from the stored plan. Without a plan every map is empty.
//
//   SYSTEM_ASSIGNED entity → fields a tool fills when a record is CREATED — the
//                   value does not exist before; dialogs hide these on create and
//                   the form-polish sets no default on them. A scheduled or
//                   update-triggered tool owns its field but is NOT in here.
//   PLAN_SENTENCES  slug → the plan in the owner's words (flows' field page)
//
// The runtime write guard (FLOW_WRITES/OWNERSHIP, planGuard.ts) left on
// 23.09.2026: a flow page composes against its generated hook, whose submit
// plan IS the Schreibliste — there is no way to spell a write outside it.

import { INTENTS } from '@/config/intents';

export const SYSTEM_ASSIGNED: Record<string, string[]> = {};

export const PLAN_SENTENCES: Record<string, string[]> = {
  "aufenthalt-buchen": [
    "Legt an: belegung_buchungen",
    "Automatisch: besitzer (übernommen aus hundekartei.besitzer), status (fester Wert „aktiv“)"
  ],
  "anfrage-bestaetigen": [
    "Legt an: belegung_buchungen, besitzer, hundekartei",
    "Ändert: buchungsanfragen",
    "Automatisch: vorname (übernommen aus buchungsanfragen.interessent_vorname), nachname (übernommen aus buchungsanfragen.interessent_nachname), email (übernommen aus buchungsanfragen.interessent_email), telefon (übernommen aus buchungsanfragen.interessent_telefon), name (übernommen aus buchungsanfragen.hund_name), rasse (übernommen aus buchungsanfragen.hund_rasse), anreisedatum (übernommen aus buchungsanfragen.wunsch_anreise), abreisedatum (übernommen aus buchungsanfragen.wunsch_abreise), status (fester Wert „aktiv“), anfrage_status (fester Wert „bestaetigt“)"
  ],
  "anfrage-ablehnen": [
    "Ändert: buchungsanfragen",
    "Automatisch: anfrage_status (fester Wert „abgelehnt“)"
  ],
  "portraet-erstellen": [
    "Legt an: pfoten_portraet",
    "Automatisch: besitzer (übernommen aus hundekartei.besitzer), erstellungsdatum (heutiges Datum, automatisch)"
  ],
  "buchung-abschliessen": [
    "Ändert: belegung_buchungen"
  ]
};

export const PLAN_SUMMARY = "PfotenPension Manager verwaltet die Besitzer und ihre Hunde, plant die Aufenthalte auf den zwölf Plätzen und hält für jeden Gast ein Pfoten-Porträt mit Foto und kleinen Geschichten fest. Interessenten sehen auf der Website freie Zeiträume und stellen Reservierungsanfragen. Jeden Montag kommt ein Wochenbericht per E-Mail.";

/** slug → the lists a flow writes (the plan's Schreibliste). The nav leaves a
 *  flow out for a user who may not write one of them (lib/permissions.ts). */
export const FLOW_ENTITIES: Record<string, string[]> = {
  "aufenthalt-buchen": [
    "belegung_buchungen"
  ],
  "anfrage-bestaetigen": [
    "belegung_buchungen",
    "besitzer",
    "buchungsanfragen",
    "hundekartei"
  ],
  "anfrage-ablehnen": [
    "buchungsanfragen"
  ],
  "portraet-erstellen": [
    "pfoten_portraet"
  ],
  "buchung-abschliessen": [
    "belegung_buchungen"
  ]
};

/** A field an UPDATE flow writes, and the value it fixes (if it does). */
export interface FlowOwner { slug: string; value?: string }

/** entity → field → the update flows that change it. Such a change is the
 *  flow's job — it records who and when (a review, a decision) — so the
 *  dashboard never writes these fields itself; it opens the flow
 *  (check-dashboard gate 25). */
export const FLOW_OWNED: Record<string, Record<string, FlowOwner[]>> = {
  "buchungsanfragen": {
    "anfrage_status": [
      {
        "slug": "anfrage-bestaetigen",
        "value": "bestaetigt"
      },
      {
        "slug": "anfrage-ablehnen",
        "value": "abgelehnt"
      }
    ]
  },
  "belegung_buchungen": {
    "status": [
      {
        "slug": "buchung-abschliessen"
      }
    ]
  }
};

/** The link that opens the flow owning `entity.field` with `recordId` already
 *  picked — `toValue` chooses between flows that fix different values (the
 *  approve flow vs the execute flow). null when no LIVE flow owns it (not
 *  built yet, or removed): the caller then offers no shortcut. */
export function flowLinkFor(entity: string, field: string, recordId: string, toValue?: string): string | null {
  const owners = (FLOW_OWNED[entity]?.[field] ?? []).filter(o => INTENTS.some(i => i.path === `/intents/${o.slug}`));
  const owner = (toValue !== undefined ? owners.find(o => o.value === toValue) : undefined)
    ?? owners.find(o => o.value === undefined)
    ?? owners[0];
  return owner ? `#/intents/${owner.slug}?record=${encodeURIComponent(recordId)}` : null;
}

/** flowLinkFor as a click handler — `action: go ? { label, onClick: go } : undefined`. */
export function flowActionFor(entity: string, field: string, recordId: string, toValue?: string): (() => void) | null {
  const href = flowLinkFor(entity, field, recordId, toValue);
  return href ? () => { window.location.hash = href.slice(1); } : null;
}
