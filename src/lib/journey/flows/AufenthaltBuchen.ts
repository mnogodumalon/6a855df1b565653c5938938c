/**
 * useAufenthaltBuchenFlow — the plumbing of the flow « Aufenthalt buchen », generated from the plan.
 *
 * Writes `belegung_buchungen`: asks `besitzer`, `hund`, `anreisedatum`, `abreisedatum`, `platznummer`, `preis_euro`, `notizen`; sets `status` itself.
 * The hook OWNS: the form(s) with exactly these fields and the plan's required
 * ingredients, one record search per picked field (columns and filter from
 * the plan), and the submit plan with its fixed and derived values. A page
 * that only calls `flow.submit.run()` cannot write a field the plan does not
 * know — there is no way to spell it.
 *
 * YOU decide what a person notices, through the options:
 *   steps     which wizard step asks which field (default: one step per pick,
 *             then one for the typed fields, then "Prüfen" = step 4)
 *   items     how a search hit is displayed per pick (title, subtitle, status …)
 *   initial   prefills for typed fields
 *   messages  the sentence for an empty required field, per field
 *
 *   const flow = useAufenthaltBuchenFlow({
 *     steps: { besitzer: 1, hund: 2, anreisedatum: 3, abreisedatum: 3, platznummer: 3, preis_euro: 3, notizen: 3 },
 *     items: { besitzer: r => ({ id: r.id, title: fieldText(r, 'vorname') }) },
 *   });
 *   <IntentWizardShell forms={flow.forms} draftKey={flow.draftKey} …>
 *     <EntitySelectStep {...flow.picks.besitzer.select} {...flow.pick('besitzer')} />
 *     <EntitySelectStep {...flow.picks.hund.select} {...flow.pick('hund')} />
 *     <Bound form={flow.forms.belegung_buchungen} name="anreisedatum" />
 *     <Bound form={flow.forms.belegung_buchungen} name="abreisedatum" />
 *     <Bound form={flow.forms.belegung_buchungen} name="platznummer" />
 *     <Bound form={flow.forms.belegung_buchungen} name="preis_euro" />
 *     <Bound form={flow.forms.belegung_buchungen} name="notizen" />
 *     <StepNav onNext={() => flow.validateStep(n)} />
 *     {!flow.submit.done && <SummaryStep forms={flow.formList} submit={flow.submit} />}
 *     {flow.submit.result && <SuccessStep result={flow.submit.result} forms={flow.formList} submit={flow.submit} />}
 *   </IntentWizardShell>
 */
import {
  useStepForm, useJourneySubmit, useRecordSearch,
  fieldText, fieldLookup, fieldLookups, fieldNumber, fieldDate, fieldRef,
  todayIso, nowIso, isEmptyValue, policyFixedValue, withPickPolicy, usePolicyVersion,
  type StepForm, type JourneyRecord, type RefContext, type SelectItemLike, type FormValues, type PlanStep, type SummaryItem,} from '@/lib/journey';
import { servicePort } from '@/services/journeyPort';
import { pickHint, whereSentence, type PickWhere } from '@/lib/journey/policy';
import { labelOf, optionsOf, type EntityKey } from '@/lib/journey/rules';
export type AufenthaltBuchenFieldKey = 'abreisedatum' | 'anreisedatum' | 'besitzer' | 'hund' | 'notizen' | 'platznummer' | 'preis_euro';

export interface AufenthaltBuchenForms {
  belegung_buchungen: StepForm<'belegung_buchungen'>;
}

// Alias so the option generics stay readable.
type Key = AufenthaltBuchenFieldKey;

export interface AufenthaltBuchenFlowOptions {
  /** field → wizard step that asks it; drives „Ändern“ links and answer chips. */
  steps?: Partial<Record<Key, number>>;
  initial?: Partial<Record<Key, unknown>>;
  messages?: Partial<Record<Key, string>>;
  /** How a search hit reads — the card's title/subtitle/status per pick. */
  items?: {
    besitzer?: (record: JourneyRecord, ctx: RefContext) => SelectItemLike;
    hund?: (record: JourneyRecord, ctx: RefContext) => SelectItemLike;
  };
}

const DEFAULT_STEPS: Record<string, number> = {"abreisedatum": 3, "anreisedatum": 3, "besitzer": 1, "hund": 2, "notizen": 3, "platznummer": 3, "preis_euro": 3};
export const AUFENTHALTBUCHEN_REVIEW_STEP = 4;

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

export function useAufenthaltBuchenFlow(options: AufenthaltBuchenFlowOptions = {}) {
  const steps = { ...DEFAULT_STEPS, ...(options.steps ?? {}) } as Record<string, number>;
  const belegung_buchungen = useStepForm('belegung_buchungen', {
    fields: ["besitzer", "hund", "anreisedatum", "abreisedatum", "platznummer", "preis_euro", "notizen"],
    steps: only(steps, ["besitzer", "hund", "anreisedatum", "abreisedatum", "platznummer", "preis_euro", "notizen"]) as Record<string, number>,
    initial: only(options.initial as FormValues | undefined, ["besitzer", "hund", "anreisedatum", "abreisedatum", "platznummer", "preis_euro", "notizen"]),
    messages: only(options.messages as Record<string, string> | undefined, ["besitzer", "hund", "anreisedatum", "abreisedatum", "platznummer", "preis_euro", "notizen"]),
  });
  const forms: AufenthaltBuchenForms = { belegung_buchungen };
  const formList: StepForm[] = [belegung_buchungen];

  // The owner's rules after the build (intent-policies.json): a fixed value
  // for a field this flow sets itself, a narrower or wider pick — read at
  // render time, so a change works on the running application.
  usePolicyVersion();
  const searches = {
    besitzer: useRecordSearch(servicePort, 'besitzer', withPickPolicy('besitzer', {
      searchFields: ["vorname", "nachname", "telefon"] as never,
      toItem: options.items?.besitzer as never,
    })),
    hund: useRecordSearch(servicePort, 'hundekartei', withPickPolicy('hund', {
      searchFields: ["name", "rasse"] as never,
      toItem: options.items?.hund as never,
    })),
  };
  // Whether a pick offers „Neu anlegen“ is the plan's call: off for the record
  // this flow changes, for multi picks, for a catalogue entity and for an
  // entity with its own flow. The page spreads `.select` and writes no `create=`.
  // what the person sees under the search field: the rule that narrows the
  // pick (the owner's, else the plan's) — and the link that changes it
  const hintFor = (key: string, entity: EntityKey, planned: PickWhere | null) => pickHint(key, planned,
    w => whereSentence(w, f => labelOf(entity, f), (f, v) => optionsOf(entity, f).find(o => o.key === String(v))?.label ?? String(v)),
    `#/verwaltung/anwendung?line=intent:aufenthalt-buchen:read:${entity}`);
  // a fixed value the flow sets itself, as a review row with the link that changes it
  const setting = (entity: EntityKey, field: string, value: unknown): SummaryItem => ({
    key: `setting:${entity}.${field}`, label: labelOf(entity, field),
    value: optionsOf(entity, field).find(o => o.key === String(value))?.label ?? String(value ?? ''),
    href: `#/verwaltung/anwendung?line=intent:aufenthalt-buchen:write:${entity}.${field}`,
  });
  const picks = {
    besitzer: { ...searches.besitzer, select: { ...searches.besitzer.select, create: false as boolean, hint: hintFor('besitzer', 'besitzer', null as PickWhere | null) } },
    hund: { ...searches.hund, select: { ...searches.hund.select, create: false as boolean, hint: hintFor('hund', 'hundekartei', null as PickWhere | null) } },
  };

  const plan: PlanStep[] = [
    {
      key: 'belegung_buchungen', entity: 'belegung_buchungen', form: belegung_buchungen, primary: true,
      values: (): FormValues => ({
        status: policyFixedValue('belegung_buchungen', 'status') ?? "aktiv",
      }),

      // the review shows what this step sets itself — changeable on „Deine Anwendung“, not here
      settings: () => [setting('belegung_buchungen', 'status', policyFixedValue('belegung_buchungen', 'status') ?? "aktiv")],
    },
  ];

  const submit = useJourneySubmit(servicePort, plan, { draftKey: 'aufenthalt-buchen' });

  /** Props for a single-record pick step: {...flow.picks.x.select} {...flow.pick('x')} */
  const pick = (field: AufenthaltBuchenFieldKey) => {
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
  const pickMany = (field: AufenthaltBuchenFieldKey) => {
    const owner = formList.find(f => f.keys.includes(field)) ?? formList[0];
    const search = (picks as Record<string, { labelOf(id: string): string | undefined }>)[field];
    return owner.records(field, id => search?.labelOf(id));
  };
  /** Validate every field the wizard asks in step `n` — for StepNav.onNext. */
  const validateStep = (n: number): boolean =>
    formList.every(f => f.validate(f.keys.filter(k => steps[k] === n)));
  const reset = () => { submit.reset(); formList.forEach(f => f.reset()); };

  return {
    slug: 'aufenthalt-buchen' as const,
    draftKey: 'aufenthalt-buchen' as const,
    entity: 'belegung_buchungen' as const,
    form: belegung_buchungen,
    forms, formList, picks, submit, steps,    reviewStep: AUFENTHALTBUCHEN_REVIEW_STEP,
    pick, pickMany, validateStep, reset,
    // the door the hook reads through — for what it does not own: availability
    // (useOccupancy(flow.port, …)), a count (useRecordCount(flow.port, …)). A page
    // importing servicePort next to the hook fails gate 3 (fewo 05.10.2026: the
    // gate taught useOccupancy(servicePort, …) and forbade servicePort at once)
    port: servicePort,
  };
}

export type AufenthaltBuchenFlow = ReturnType<typeof useAufenthaltBuchenFlow>;
