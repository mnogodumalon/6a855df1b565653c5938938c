/**
 * usePortraetErstellenFlow — the plumbing of the flow « Pfoten-Porträt erstellen », generated from the plan.
 *
 * Writes `pfoten_portraet`: asks `hund`, `titel`, `widmung`, `charakterbeschreibung`, `lieblingsaktivitaet`, `besondere_momente`, `portraet_foto`; sets `erstellungsdatum` itself.
 * The hook OWNS: the form(s) with exactly these fields and the plan's required
 * ingredients, one record search per picked field (columns and filter from
 * the plan), and the submit plan with its fixed and derived values. A page
 * that only calls `flow.submit.run()` cannot write a field the plan does not
 * know — there is no way to spell it.
 *
 * YOU decide what a person notices, through the options:
 *   steps     which wizard step asks which field (default: one step per pick,
 *             then one for the typed fields, then "Prüfen" = step 3)
 *   items     how a search hit is displayed per pick (title, subtitle, status …)
 *   initial   prefills for typed fields
 *   messages  the sentence for an empty required field, per field
 *
 *   const flow = usePortraetErstellenFlow({
 *     steps: { hund: 1, titel: 2, widmung: 2, charakterbeschreibung: 2, lieblingsaktivitaet: 2, besondere_momente: 2, portraet_foto: 2 },
 *     items: { hund: r => ({ id: r.id, title: fieldText(r, 'name') }) },
 *   });
 *   <IntentWizardShell forms={flow.forms} draftKey={flow.draftKey} …>
 *     <EntitySelectStep {...flow.picks.hund.select} {...flow.pick('hund')} />
 *     <Bound form={flow.forms.pfoten_portraet} name="titel" />
 *     <Bound form={flow.forms.pfoten_portraet} name="widmung" />
 *     <Bound form={flow.forms.pfoten_portraet} name="charakterbeschreibung" />
 *     <Bound form={flow.forms.pfoten_portraet} name="lieblingsaktivitaet" />
 *     <Bound form={flow.forms.pfoten_portraet} name="besondere_momente" />
 *     <Bound form={flow.forms.pfoten_portraet} name="portraet_foto" />
 *     <StepNav onNext={() => flow.validateStep(n)} />
 *     {!flow.submit.done && <SummaryStep forms={flow.formList} submit={flow.submit} />}
 *     {flow.submit.result && <SuccessStep result={flow.submit.result} forms={flow.formList} submit={flow.submit} />}
 *   </IntentWizardShell>
 */
import {
  useStepForm, useJourneySubmit, useRecordSearch,
  fieldText, fieldLookup, fieldLookups, fieldNumber, fieldDate, fieldRef,
  todayIso, nowIso, isEmptyValue, policyFixedValue, withPickPolicy, usePolicyVersion,
  type StepForm, type JourneyRecord, type RefContext, type SelectItemLike, type FormValues, type PlanStep,} from '@/lib/journey';
import { servicePort } from '@/services/journeyPort';
import { pickHint, whereSentence, type PickWhere } from '@/lib/journey/policy';
import { labelOf, optionsOf, type EntityKey } from '@/lib/journey/rules';
export type PortraetErstellenFieldKey = 'besondere_momente' | 'charakterbeschreibung' | 'hund' | 'lieblingsaktivitaet' | 'portraet_foto' | 'titel' | 'widmung';

export interface PortraetErstellenForms {
  pfoten_portraet: StepForm<'pfoten_portraet'>;
}

// Alias so the option generics stay readable.
type Key = PortraetErstellenFieldKey;

export interface PortraetErstellenFlowOptions {
  /** field → wizard step that asks it; drives „Ändern“ links and answer chips. */
  steps?: Partial<Record<Key, number>>;
  initial?: Partial<Record<Key, unknown>>;
  messages?: Partial<Record<Key, string>>;
  /** How a search hit reads — the card's title/subtitle/status per pick. */
  items?: {
    hund?: (record: JourneyRecord, ctx: RefContext) => SelectItemLike;
  };
}

const DEFAULT_STEPS: Record<string, number> = {"besondere_momente": 2, "charakterbeschreibung": 2, "hund": 1, "lieblingsaktivitaet": 2, "portraet_foto": 2, "titel": 2, "widmung": 2};
export const PORTRAETERSTELLEN_REVIEW_STEP = 3;

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

export function usePortraetErstellenFlow(options: PortraetErstellenFlowOptions = {}) {
  const steps = { ...DEFAULT_STEPS, ...(options.steps ?? {}) } as Record<string, number>;
  const pfoten_portraet = useStepForm('pfoten_portraet', {
    fields: ["hund", "titel", "widmung", "charakterbeschreibung", "lieblingsaktivitaet", "besondere_momente", "portraet_foto"],
    steps: only(steps, ["hund", "titel", "widmung", "charakterbeschreibung", "lieblingsaktivitaet", "besondere_momente", "portraet_foto"]) as Record<string, number>,
    initial: only(options.initial as FormValues | undefined, ["hund", "titel", "widmung", "charakterbeschreibung", "lieblingsaktivitaet", "besondere_momente", "portraet_foto"]),
    messages: only(options.messages as Record<string, string> | undefined, ["hund", "titel", "widmung", "charakterbeschreibung", "lieblingsaktivitaet", "besondere_momente", "portraet_foto"]),
  });
  const forms: PortraetErstellenForms = { pfoten_portraet };
  const formList: StepForm[] = [pfoten_portraet];

  // The owner's rules after the build (intent-policies.json): a fixed value
  // for a field this flow sets itself, a narrower or wider pick — read at
  // render time, so a change works on the running application.
  usePolicyVersion();
  const searches = {
    hund: useRecordSearch(servicePort, 'hundekartei', withPickPolicy('hund', {
      searchFields: ["name"] as never,
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
    `#/verwaltung/anwendung?line=intent:portraet-erstellen:read:${entity}`);
  const picks = {
    hund: { ...searches.hund, select: { ...searches.hund.select, create: false as boolean, hint: hintFor('hund', 'hundekartei', null as PickWhere | null) } },
  };

  const plan: PlanStep[] = [
    {
      key: 'pfoten_portraet', entity: 'pfoten_portraet', form: pfoten_portraet, primary: true,
      values: (): FormValues => ({
        erstellungsdatum: policyFixedValue('pfoten_portraet', 'erstellungsdatum') ?? todayIso(),
      }),

      // the planner's assumptions that first act here — shown once with „Passt“ / „ändern“
      notices: () => [{"assumed": "nur als Datensatz gespeichert", "id": "portraet-pdf-vorlage", "question": "Soll das Portr\u00e4t als PDF f\u00fcr Besitzer entstehen?"}],
    },
  ];

  const submit = useJourneySubmit(servicePort, plan, { draftKey: 'portraet-erstellen' });

  /** Props for a single-record pick step: {...flow.picks.x.select} {...flow.pick('x')} */
  const pick = (field: PortraetErstellenFieldKey) => {
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
  const pickMany = (field: PortraetErstellenFieldKey) => {
    const owner = formList.find(f => f.keys.includes(field)) ?? formList[0];
    const search = (picks as Record<string, { labelOf(id: string): string | undefined }>)[field];
    return owner.records(field, id => search?.labelOf(id));
  };
  /** Validate every field the wizard asks in step `n` — for StepNav.onNext. */
  const validateStep = (n: number): boolean =>
    formList.every(f => f.validate(f.keys.filter(k => steps[k] === n)));
  const reset = () => { submit.reset(); formList.forEach(f => f.reset()); };

  return {
    slug: 'portraet-erstellen' as const,
    draftKey: 'portraet-erstellen' as const,
    entity: 'pfoten_portraet' as const,
    form: pfoten_portraet,
    forms, formList, picks, submit, steps,    reviewStep: PORTRAETERSTELLEN_REVIEW_STEP,
    pick, pickMany, validateStep, reset,
    // the door the hook reads through — for what it does not own: availability
    // (useOccupancy(flow.port, …)), a count (useRecordCount(flow.port, …)). A page
    // importing servicePort next to the hook fails gate 3 (fewo 05.10.2026: the
    // gate taught useOccupancy(servicePort, …) and forbade servicePort at once)
    port: servicePort,
  };
}

export type PortraetErstellenFlow = ReturnType<typeof usePortraetErstellenFlow>;
