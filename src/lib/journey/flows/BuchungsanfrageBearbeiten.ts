/**
 * useBuchungsanfrageBearbeitenFlow — the plumbing of the flow « Buchungsanfrage bearbeiten », generated from the plan.
 *
 * Changes `buchungsanfragen`: the record to change is picked (`flow.pick('buchungsanfragen')`), the form is prefilled with its values; asks `anfrage_status`.
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
 *   const flow = useBuchungsanfrageBearbeitenFlow({
 *     steps: { buchungsanfragen: 1, anfrage_status: 2 },
 *     items: { buchungsanfragen: r => ({ id: r.id, title: fieldText(r, 'interessent_vorname') }) },
 *   });
 *   <IntentWizardShell forms={flow.forms} draftKey={flow.draftKey} …>
 *     // the record this flow changes: <EntitySelectStep {...flow.picks.buchungsanfragen.select} {...flow.pick('buchungsanfragen')} />
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
  type StepForm, type JourneyRecord, type RefContext, type SelectItemLike, type FormValues, type PlanStep,} from '@/lib/journey';
import { servicePort } from '@/services/journeyPort';
import { pickHint, whereSentence, type PickWhere } from '@/lib/journey/policy';
import { labelOf, optionsOf, type EntityKey } from '@/lib/journey/rules';
import { entityLabel } from '@/lib/journey/rules';
export type BuchungsanfrageBearbeitenFieldKey = 'anfrage_status' | 'buchungsanfragen';

export interface BuchungsanfrageBearbeitenForms {
  buchungsanfragen: StepForm<'buchungsanfragen'>;
}

// Alias so the option generics stay readable.
type Key = BuchungsanfrageBearbeitenFieldKey;

export interface BuchungsanfrageBearbeitenFlowOptions {
  /** field → wizard step that asks it; drives „Ändern“ links and answer chips. */
  steps?: Partial<Record<Key, number>>;
  initial?: Partial<Record<Key, unknown>>;
  messages?: Partial<Record<Key, string>>;
  /** How a search hit reads — the card's title/subtitle/status per pick. */
  items?: {
    buchungsanfragen?: (record: JourneyRecord, ctx: RefContext) => SelectItemLike;
  };
}

const DEFAULT_STEPS: Record<string, number> = {"anfrage_status": 2, "buchungsanfragen": 1};
export const BUCHUNGSANFRAGEBEARBEITEN_REVIEW_STEP = 3;

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

export function useBuchungsanfrageBearbeitenFlow(options: BuchungsanfrageBearbeitenFlowOptions = {}) {
  const steps = { ...DEFAULT_STEPS, ...(options.steps ?? {}) } as Record<string, number>;
  const [buchungsanfragenTargetId, setBuchungsanfragenTargetId] = useState<string | null>(null);
  const buchungsanfragen = useStepForm('buchungsanfragen', {
    fields: ["anfrage_status"],
    steps: only(steps, ["anfrage_status"]) as Record<string, number>,
    initial: only(options.initial as FormValues | undefined, ["anfrage_status"]),
    messages: only(options.messages as Record<string, string> | undefined, ["anfrage_status"]),
  });
  const forms: BuchungsanfrageBearbeitenForms = { buchungsanfragen };
  const formList: StepForm[] = [buchungsanfragen];

  // The owner's rules after the build (intent-policies.json): a fixed value
  // for a field this flow sets itself, a narrower or wider pick — read at
  // render time, so a change works on the running application.
  usePolicyVersion();
  const searches = {
    buchungsanfragen: useRecordSearch(servicePort, 'buchungsanfragen', withPickPolicy('buchungsanfragen', {
      searchFields: ["interessent_vorname", "interessent_nachname", "hund_name", "nachricht"] as never,
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
    `#/verwaltung/anwendung?line=intent:buchungsanfrage-bearbeiten:read:${entity}`);
  const picks = {
    buchungsanfragen: { ...searches.buchungsanfragen, select: { ...searches.buchungsanfragen.select, create: false as boolean, hint: hintFor('buchungsanfragen', 'buchungsanfragen', {"conditions": [{"field": "anfrage_status", "op": "eq", "value": "neu"}], "mode": "all"} as PickWhere | null) } },
  };

  const plan: PlanStep[] = [
    {
      key: 'buchungsanfragen', entity: 'buchungsanfragen', form: buchungsanfragen, primary: true,
      updates: () => buchungsanfragenTargetId ?? undefined,
      // the review names the record this step changes; "Ändern" leads back to its pick
      target: () => buchungsanfragenTargetId
        ? { key: 'target:buchungsanfragen', label: entityLabel('buchungsanfragen'), value: picks.buchungsanfragen.labelOf(buchungsanfragenTargetId) ?? buchungsanfragenTargetId, step: steps.buchungsanfragen }
        : undefined,    },
  ];

  const submit = useJourneySubmit(servicePort, plan, { draftKey: 'buchungsanfrage-bearbeiten' });

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
  // Opened for one record — `#/intents/buchungsanfrage-bearbeiten?record=<id>`, the dashboard's
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
  const pick = (field: BuchungsanfrageBearbeitenFieldKey) => {
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
  const pickMany = (field: BuchungsanfrageBearbeitenFieldKey) => {
    const owner = formList.find(f => f.keys.includes(field)) ?? formList[0];
    const search = (picks as Record<string, { labelOf(id: string): string | undefined }>)[field];
    return owner.records(field, id => search?.labelOf(id));
  };
  /** Validate every field the wizard asks in step `n` — for StepNav.onNext. */
  const validateStep = (n: number): boolean =>
    formList.every(f => f.validate(f.keys.filter(k => steps[k] === n)))    && Object.entries(targets).every(([k, t]) => steps[k] !== n || !!t.selectedId);
  const reset = () => { submit.reset(); formList.forEach(f => f.reset()); setBuchungsanfragenTargetId(null); };

  return {
    slug: 'buchungsanfrage-bearbeiten' as const,
    draftKey: 'buchungsanfrage-bearbeiten' as const,
    entity: 'buchungsanfragen' as const,
    form: buchungsanfragen,
    forms, formList, picks, submit, steps, targets,    reviewStep: BUCHUNGSANFRAGEBEARBEITEN_REVIEW_STEP,
    pick, pickMany, validateStep, reset,
    // the door the hook reads through — for what it does not own: availability
    // (useOccupancy(flow.port, …)), a count (useRecordCount(flow.port, …)). A page
    // importing servicePort next to the hook fails gate 3 (fewo 05.10.2026: the
    // gate taught useOccupancy(servicePort, …) and forbade servicePort at once)
    port: servicePort,
  };
}

export type BuchungsanfrageBearbeitenFlow = ReturnType<typeof useBuchungsanfrageBearbeitenFlow>;
