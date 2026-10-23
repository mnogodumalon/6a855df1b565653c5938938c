/**
 * useAnfrageBearbeitenFlow — the plumbing of the flow « Buchungsanfrage bearbeiten », generated from the plan.
 *
 * Writes `besitzer` (only when the person fills it): asks `vorname`, `nachname`, `email`, `telefon`.
Writes `hundekartei` (only when the person fills it): asks `name`, `rasse`, `besitzer`; links `besitzer` ← the created `besitzer`.
Writes `belegung_buchungen` (only when the person fills it): asks `hund`, `besitzer`, `anreisedatum`, `abreisedatum`, `platznummer`; sets `status` itself; links `hund` ← the created `hundekartei`, `besitzer` ← the created `besitzer`.
Changes `buchungsanfragen`: the record to change is picked (`flow.pick('buchungsanfragen')`), the form is prefilled with its values; asks `anfrage_status`.
 * The hook OWNS: the form(s) with exactly these fields and the plan's required
 * ingredients, one record search per picked field (columns and filter from
 * the plan), and the submit plan with its fixed and derived values. A page
 * that only calls `flow.submit.run()` cannot write a field the plan does not
 * know — there is no way to spell it.
 *
 * YOU decide what a person notices, through the options:
 *   steps     which wizard step asks which field (default: one step per pick,
 *             then one for the typed fields, then "Prüfen" = step 6)
 *   items     how a search hit is displayed per pick (title, subtitle, status …)
 *   initial   prefills for typed fields
 *   messages  the sentence for an empty required field, per field
 *
 *   const flow = useAnfrageBearbeitenFlow({
 *     steps: { buchungsanfragen: 1, besitzer: 4, hund: 3, vorname: 5, nachname: 5, email: 5, telefon: 5, name: 5, rasse: 5, anreisedatum: 5, abreisedatum: 5, platznummer: 5, anfrage_status: 5 },
 *     items: { besitzer: r => ({ id: r.id, title: fieldText(r, 'vorname') }) },
 *   });
 *   <IntentWizardShell forms={flow.forms} draftKey={flow.draftKey} …>
 *     <EntitySelectStep {...flow.picks.besitzer.select} {...flow.pick('besitzer')} />
 *     <EntitySelectStep {...flow.picks.hund.select} {...flow.pick('hund')} />
 *     <EntitySelectStep {...flow.picks.belegung_buchungen_besitzer.select} {...flow.pick('besitzer')} />
 *     // the record this flow changes: <EntitySelectStep {...flow.picks.buchungsanfragen.select} {...flow.pick('buchungsanfragen')} />
 *     <Bound form={flow.forms.besitzer} name="vorname" />
 *     <Bound form={flow.forms.besitzer} name="nachname" />
 *     <Bound form={flow.forms.besitzer} name="email" />
 *     <Bound form={flow.forms.besitzer} name="telefon" />
 *     <Bound form={flow.forms.hundekartei} name="name" />
 *     <Bound form={flow.forms.hundekartei} name="rasse" />
 *     <Bound form={flow.forms.belegung_buchungen} name="anreisedatum" />
 *     <Bound form={flow.forms.belegung_buchungen} name="abreisedatum" />
 *     <Bound form={flow.forms.belegung_buchungen} name="platznummer" />
 *     <Bound form={flow.forms.buchungsanfragen} name="anfrage_status" />
 *     <StepNav onNext={() => flow.validateStep(n)} />
 *     {!flow.submit.done && <SummaryStep forms={flow.formList} submit={flow.submit} />}
 *     {flow.submit.result && <SuccessStep result={flow.submit.result} forms={flow.formList} submit={flow.submit} />}
 *   </IntentWizardShell>
 */
import { useEffect, useState } from 'react';
import {
  useStepForm, useJourneySubmit, useRecordSearch,
  fieldText, fieldLookup, fieldLookups, fieldNumber, fieldDate, fieldRef,
  todayIso, nowIso, isEmptyValue, policyFixedValue, withPickPolicy, usePolicyVersion,
  type StepForm, type JourneyRecord, type RefContext, type SelectItemLike, type FormValues, type PlanStep, type SummaryItem,} from '@/lib/journey';
import { servicePort } from '@/services/journeyPort';
import { pickHint, whereSentence, type PickWhere } from '@/lib/journey/policy';
import { labelOf, optionsOf, type EntityKey } from '@/lib/journey/rules';
import { entityLabel } from '@/lib/journey/rules';
export type AnfrageBearbeitenFieldKey = 'abreisedatum' | 'anfrage_status' | 'anreisedatum' | 'besitzer' | 'buchungsanfragen' | 'email' | 'hund' | 'nachname' | 'name' | 'platznummer' | 'rasse' | 'telefon' | 'vorname';

export interface AnfrageBearbeitenForms {
  besitzer: StepForm<'besitzer'>;
  hundekartei: StepForm<'hundekartei'>;
  belegung_buchungen: StepForm<'belegung_buchungen'>;
  buchungsanfragen: StepForm<'buchungsanfragen'>;
}

// Alias so the option generics stay readable.
type Key = AnfrageBearbeitenFieldKey;

export interface AnfrageBearbeitenFlowOptions {
  /** field → wizard step that asks it; drives „Ändern“ links and answer chips. */
  steps?: Partial<Record<Key, number>>;
  initial?: Partial<Record<Key, unknown>>;
  messages?: Partial<Record<Key, string>>;
  /** How a search hit reads — the card's title/subtitle/status per pick. */
  items?: {
    besitzer?: (record: JourneyRecord, ctx: RefContext) => SelectItemLike;
    hund?: (record: JourneyRecord, ctx: RefContext) => SelectItemLike;
    belegung_buchungen_besitzer?: (record: JourneyRecord, ctx: RefContext) => SelectItemLike;
    buchungsanfragen?: (record: JourneyRecord, ctx: RefContext) => SelectItemLike;
  };
}

const DEFAULT_STEPS: Record<string, number> = {"abreisedatum": 5, "anfrage_status": 5, "anreisedatum": 5, "besitzer": 4, "buchungsanfragen": 1, "email": 5, "hund": 3, "nachname": 5, "name": 5, "platznummer": 5, "rasse": 5, "telefon": 5, "vorname": 5};
export const ANFRAGEBEARBEITEN_REVIEW_STEP = 6;

function fromPick<T>(pick: { recordOf(id: string): JourneyRecord | undefined }, form: StepForm, field: string, read: (r: JourneyRecord) => T): T | undefined {
  const id = form.get(field);
  const rec = typeof id === 'string' && id ? pick.recordOf(id) : undefined;
  return rec ? read(rec) : undefined;
}
function isoDaysFromToday(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// Returns T, not Partial<T>: a Record's index signature is already "maybe
// absent", and Partial<Record<string, string>> does not assign to the
// Record<string, string> useStepForm wants (tsc, live 23.09.2026 — eight
// errors, one per hook, caught only in the sandbox build).
function only<T extends Record<string, unknown>>(obj: T | undefined, keys: string[]): T | undefined {
  if (!obj) return undefined;
  const out: Record<string, unknown> = {};
  for (const k of keys) if (k in obj) out[k] = obj[k];
  return out as T;
}

function hasValues(form: StepForm): boolean {
  return form.keys.some(k => !isEmptyValue(form.values[k]));
}

export function useAnfrageBearbeitenFlow(options: AnfrageBearbeitenFlowOptions = {}) {
  const steps = { ...DEFAULT_STEPS, ...(options.steps ?? {}) } as Record<string, number>;
  const [buchungsanfragenTargetId, setBuchungsanfragenTargetId] = useState<string | null>(null);
  const besitzer = useStepForm('besitzer', {
    fields: ["vorname", "nachname", "email", "telefon"],
    steps: only(steps, ["vorname", "nachname", "email", "telefon"]) as Record<string, number>,
    initial: only(options.initial as FormValues | undefined, ["vorname", "nachname", "email", "telefon"]),
    messages: only(options.messages as Record<string, string> | undefined, ["vorname", "nachname", "email", "telefon"]),
  });
  const hundekartei = useStepForm('hundekartei', {
    fields: ["name", "rasse", "besitzer"],
    steps: only(steps, ["name", "rasse", "besitzer"]) as Record<string, number>,
    initial: only(options.initial as FormValues | undefined, ["name", "rasse", "besitzer"]),
    messages: only(options.messages as Record<string, string> | undefined, ["name", "rasse", "besitzer"]),
  });
  const belegung_buchungen = useStepForm('belegung_buchungen', {
    fields: ["hund", "besitzer", "anreisedatum", "abreisedatum", "platznummer"],
    steps: only(steps, ["hund", "besitzer", "anreisedatum", "abreisedatum", "platznummer"]) as Record<string, number>,
    initial: only(options.initial as FormValues | undefined, ["hund", "besitzer", "anreisedatum", "abreisedatum", "platznummer"]),
    messages: only(options.messages as Record<string, string> | undefined, ["hund", "besitzer", "anreisedatum", "abreisedatum", "platznummer"]),
  });
  const buchungsanfragen = useStepForm('buchungsanfragen', {
    fields: ["anfrage_status"],
    steps: only(steps, ["anfrage_status"]) as Record<string, number>,
    initial: only(options.initial as FormValues | undefined, ["anfrage_status"]),
    messages: only(options.messages as Record<string, string> | undefined, ["anfrage_status"]),
  });
  const forms: AnfrageBearbeitenForms = { besitzer, hundekartei, belegung_buchungen, buchungsanfragen };
  const formList: StepForm[] = [besitzer, hundekartei, belegung_buchungen, buchungsanfragen];

  // The owner's rules after the build (intent-policies.json): a fixed value
  // for a field this flow sets itself, a narrower or wider pick — read at
  // render time, so a change works on the running application.
  usePolicyVersion();
  const searches = {
    besitzer: useRecordSearch(servicePort, 'besitzer', withPickPolicy('besitzer', {
      searchFields: ["vorname", "nachname"] as never,
      toItem: options.items?.besitzer as never,
    })),
    hund: useRecordSearch(servicePort, 'hundekartei', withPickPolicy('hund', {
      searchFields: ["name"] as never,
      toItem: options.items?.hund as never,
    })),
    belegung_buchungen_besitzer: useRecordSearch(servicePort, 'besitzer', withPickPolicy('belegung_buchungen_besitzer', {
      searchFields: ["vorname", "nachname"] as never,
      toItem: options.items?.belegung_buchungen_besitzer as never,
    })),
    buchungsanfragen: useRecordSearch(servicePort, 'buchungsanfragen', withPickPolicy('buchungsanfragen', {
      searchFields: ["interessent_vorname", "interessent_nachname", "hund_name"] as never,
      filter: "r.v_anfrage_status == 'neu'",
      where: (r: JourneyRecord) => (fieldLookup(r, "anfrage_status")?.key ?? null) === "neu",
      toItem: options.items?.buchungsanfragen as never,
    })),
  };
  // Whether a pick offers „Neu anlegen“ is the plan's call: off for the record
  // this flow changes, for multi picks, for a catalogue entity and for an
  // entity with its own flow. The page spreads `.select` and writes no `create=`.
  // what the person sees under the search field: the rule that narrows the
  // pick (the owner's, else the plan's) — and the link that changes it
  const hintFor = (key: string, entity: EntityKey, planned: PickWhere | null) => pickHint(key, planned,
    w => whereSentence(w, f => labelOf(entity, f), (f, v) => optionsOf(entity, f).find(o => o.key === String(v))?.label ?? String(v)),
    `#/verwaltung/anwendung?line=intent:anfrage-bearbeiten:read:${entity}`);
  // a fixed value the flow sets itself, as a review row with the link that changes it
  const setting = (entity: EntityKey, field: string, value: unknown): SummaryItem => ({
    key: `setting:${entity}.${field}`, label: labelOf(entity, field),
    value: optionsOf(entity, field).find(o => o.key === String(value))?.label ?? String(value ?? ''),
    href: `#/verwaltung/anwendung?line=intent:anfrage-bearbeiten:write:${entity}.${field}`,
  });
  const picks = {
    besitzer: { ...searches.besitzer, select: { ...searches.besitzer.select, create: false as boolean, hint: hintFor('besitzer', 'besitzer', null as PickWhere | null) } },
    hund: { ...searches.hund, select: { ...searches.hund.select, create: false as boolean, hint: hintFor('hund', 'hundekartei', null as PickWhere | null) } },
    belegung_buchungen_besitzer: { ...searches.belegung_buchungen_besitzer, select: { ...searches.belegung_buchungen_besitzer.select, create: false as boolean, hint: hintFor('belegung_buchungen_besitzer', 'besitzer', null as PickWhere | null) } },
    buchungsanfragen: { ...searches.buchungsanfragen, select: { ...searches.buchungsanfragen.select, create: false as boolean, hint: hintFor('buchungsanfragen', 'buchungsanfragen', {"conditions": [{"field": "anfrage_status", "op": "eq", "value": "neu"}], "mode": "all"} as PickWhere | null) } },
  };

  const besitzerFilled = hasValues(besitzer);
  const hundekarteiFilled = hasValues(hundekartei);
  const belegung_buchungenFilled = hasValues(belegung_buchungen);
  const plan: PlanStep[] = [
    ...(besitzerFilled ? [{
      key: 'besitzer', entity: 'besitzer', form: besitzer,    } as PlanStep] : []),
    ...(hundekarteiFilled ? [{
      key: 'hundekartei', entity: 'hundekartei', form: hundekartei,      needs: [besitzerFilled ? 'besitzer' : null].filter((x): x is string => !!x),
      link: { ...(besitzerFilled ? { besitzer: 'besitzer' } : {}) },
    } as PlanStep] : []),
    ...(belegung_buchungenFilled ? [{
      key: 'belegung_buchungen', entity: 'belegung_buchungen', form: belegung_buchungen,      needs: [besitzerFilled ? 'besitzer' : null, hundekarteiFilled ? 'hundekartei' : null].filter((x): x is string => !!x),
      link: { ...(hundekarteiFilled ? { hund: 'hundekartei' } : {}), ...(besitzerFilled ? { besitzer: 'besitzer' } : {}) },

      values: (): FormValues => ({
        status: policyFixedValue('belegung_buchungen', 'status') ?? "aktiv",
      }),

      // the review shows what this step sets itself — changeable on „Deine Anwendung“, not here
      settings: () => [setting('belegung_buchungen', 'status', policyFixedValue('belegung_buchungen', 'status') ?? "aktiv")],
    } as PlanStep] : []),
    {
      key: 'buchungsanfragen', entity: 'buchungsanfragen', form: buchungsanfragen, primary: true,
      updates: () => buchungsanfragenTargetId ?? undefined,
      // the review names the record this step changes; "Ändern" leads back to its pick
      target: () => buchungsanfragenTargetId
        ? { key: 'target:buchungsanfragen', label: entityLabel('buchungsanfragen'), value: picks.buchungsanfragen.labelOf(buchungsanfragenTargetId) ?? buchungsanfragenTargetId, step: steps.buchungsanfragen }
        : undefined,
      // the planner's assumptions that first act here — shown once with „Passt“ / „ändern“
      notices: () => [{"assumed": "im Ablauf mit Platzwahl", "id": "anfrage-zu-buchung", "question": "Soll eine best\u00e4tigte Anfrage automatisch eine Buchung erzeugen?"}],
    },
  ];

  const submit = useJourneySubmit(servicePort, plan, { draftKey: 'anfrage-bearbeiten' });

  /** The record(s) this flow CHANGES: picked through {...flow.picks.<entity>.select} {...flow.pick('<entity>')};
   *  picking prefills the form with the record's current values, and the plan step updates that record. */
  const targets = {
    buchungsanfragen: {
      selectedId: buchungsanfragenTargetId,
      onSelect: (id: string) => {
        setBuchungsanfragenTargetId(id);
        const rec = picks.buchungsanfragen.recordOf(id);
        if (rec) buchungsanfragen.reset({ anfrage_status: fieldLookup(rec, "anfrage_status")?.key, });
      },
      get record(): JourneyRecord | undefined { return buchungsanfragenTargetId ? picks.buchungsanfragen.recordOf(buchungsanfragenTargetId) : undefined; },
    },
  };
  // Opened for one record — `#/intents/anfrage-bearbeiten?record=<id>`, the dashboard's
  // flowActionFor(): that record is the one to change. Loaded, taken into the
  // pick and selected — when this flow may change it at all (the pick's rule).
  const [linkedId] = useState(() => new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('record'));
  useEffect(() => {
    if (!linkedId) return;
    let on = true;
    void servicePort.get('buchungsanfragen', linkedId).then(rec => {
      if (!on || !rec || !((r: JourneyRecord) => (fieldLookup(r, "anfrage_status")?.key ?? null) === "neu")(rec)) return;
      picks.buchungsanfragen.adopt(rec);
      targets.buchungsanfragen.onSelect(rec.id);
    }).catch(() => undefined);
    return () => { on = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per link
  }, [linkedId]);
  /** Props for a single-record pick step: {...flow.picks.x.select} {...flow.pick('x')} */
  const pick = (field: AnfrageBearbeitenFieldKey) => {
    if (field in targets) {
      const t = targets[field as keyof typeof targets];
      return { selectedId: t.selectedId, onSelect: t.onSelect };
    }
    const owner = formList.find(f => f.keys.includes(field)) ?? formList[0];
    const search = (picks as Record<string, { labelOf(id: string): string | undefined }>)[field];
    return {
      selectedId: (typeof owner.get(field) === 'string' ? (owner.get(field) as string) : null) || null,
      // `field as never` collapsed the conditional SetArgs<E, never> to never and
      // no argument was assignable any more (tsc, live 23.09.2026); widen `set`
      // itself instead — the label stays a required third argument.
      onSelect: (id: string) => (owner.set as (k: string, v: unknown, l?: string) => void)(field, id, search?.labelOf(id)),
    };
  };
  /** Props for a multi-record pick step: {...flow.picks.x.select} {...flow.pickMany('x')} */
  const pickMany = (field: AnfrageBearbeitenFieldKey) => {
    const owner = formList.find(f => f.keys.includes(field)) ?? formList[0];
    const search = (picks as Record<string, { labelOf(id: string): string | undefined }>)[field];
    return owner.records(field, id => search?.labelOf(id));
  };
  /** Validate every field the wizard asks in step `n` — for StepNav.onNext. */
  const validateStep = (n: number): boolean =>
    formList.every(f => f.validate(f.keys.filter(k => steps[k] === n)))    && Object.entries(targets).every(([k, t]) => steps[k] !== n || !!t.selectedId);
  const reset = () => { submit.reset(); formList.forEach(f => f.reset()); setBuchungsanfragenTargetId(null); };

  return {
    slug: 'anfrage-bearbeiten' as const,
    draftKey: 'anfrage-bearbeiten' as const,
    entity: 'buchungsanfragen' as const,
    form: buchungsanfragen,
    forms, formList, picks, submit, steps, targets,    reviewStep: ANFRAGEBEARBEITEN_REVIEW_STEP,
    pick, pickMany, validateStep, reset,
    // the door the hook reads through — for what it does not own: availability
    // (useOccupancy(flow.port, …)), a count (useRecordCount(flow.port, …)). A page
    // importing servicePort next to the hook fails gate 3 (fewo 05.10.2026: the
    // gate taught useOccupancy(servicePort, …) and forbade servicePort at once)
    port: servicePort,
  };
}

export type AnfrageBearbeitenFlow = ReturnType<typeof useAnfrageBearbeitenFlow>;
