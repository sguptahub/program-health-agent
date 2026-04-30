import type {
  AgendaItem,
  ExecSummary,
  ExecutionRisk,
  SignalBundle,
  WorkstreamHealth,
} from "./types";

const RAG_VALUES = ["Green", "Amber", "Red"] as const;
const CONFIDENCE_VALUES = ["High", "Medium", "Low"] as const;
const SEVERITY_VALUES = ["Critical", "High", "Medium"] as const;

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const asStringArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

const asNonEmptyString = (v: unknown, label: string): string => {
  if (typeof v !== "string" || v.trim() === "") {
    throw new Error(`Field "${label}" must be a non-empty string`);
  }
  return v.trim();
};

const ensureOneOf = <T extends string>(
  v: unknown,
  values: readonly T[],
  label: string,
): T => {
  if (typeof v === "string" && (values as readonly string[]).includes(v)) {
    return v as T;
  }
  throw new Error(
    `Field "${label}" must be one of ${values.join(", ")}; got ${String(v)}`,
  );
};

const findArrayField = (
  data: unknown,
  preferredKeys: string[],
): unknown[] | null => {
  if (Array.isArray(data)) return data;
  if (!isObj(data)) return null;
  for (const key of preferredKeys) {
    const value = data[key];
    if (Array.isArray(value)) return value;
  }
  for (const value of Object.values(data)) {
    if (Array.isArray(value)) return value;
  }
  return null;
};

export function validateWorkstreamHealth(
  data: unknown,
  bundle: SignalBundle,
): WorkstreamHealth[] {
  const arr = findArrayField(data, ["workstream_health", "workstreams"]);
  if (!arr) {
    throw new Error("Workstream health response is not an array");
  }

  const expectedNames = new Set(
    bundle.workstreams.map((w) => w.workstream_name),
  );

  const result: WorkstreamHealth[] = [];
  for (const raw of arr) {
    if (!isObj(raw)) {
      throw new Error("Workstream health entry is not an object");
    }
    const name = asNonEmptyString(raw.workstream_name, "workstream_name");
    if (expectedNames.size > 0 && !expectedNames.has(name)) {
      throw new Error(
        `Workstream "${name}" not present in input bundle; agent must not invent names`,
      );
    }
    result.push({
      workstream_name: name,
      rag: ensureOneOf(raw.rag, RAG_VALUES, "rag"),
      confidence: ensureOneOf(raw.confidence, CONFIDENCE_VALUES, "confidence"),
      reasoning: asNonEmptyString(raw.reasoning, "reasoning"),
      evidence_signals: asStringArray(raw.evidence_signals),
    });
  }

  if (expectedNames.size > 0) {
    const returnedNames = new Set(result.map((r) => r.workstream_name));
    for (const name of expectedNames) {
      if (!returnedNames.has(name)) {
        throw new Error(
          `Workstream "${name}" missing from agent output; every workstream must be assessed`,
        );
      }
    }
  }

  return result;
}

export function validateTopRisks(data: unknown): ExecutionRisk[] {
  const arr = findArrayField(data, ["top_risks", "risks"]);
  if (!arr) {
    throw new Error("Top risks response is not an array");
  }
  if (arr.length !== 3) {
    throw new Error(
      `Top risks must contain exactly 3 items; got ${arr.length}`,
    );
  }

  const result: ExecutionRisk[] = [];
  for (const raw of arr) {
    if (!isObj(raw)) {
      throw new Error("Risk entry is not an object");
    }
    const rank = raw.rank;
    if (rank !== 1 && rank !== 2 && rank !== 3) {
      throw new Error(`Risk rank must be 1, 2, or 3; got ${String(rank)}`);
    }
    result.push({
      rank,
      title: asNonEmptyString(raw.title, "title"),
      severity: ensureOneOf(raw.severity, SEVERITY_VALUES, "severity"),
      affected_workstreams: asStringArray(raw.affected_workstreams),
      evidence_summary: asNonEmptyString(
        raw.evidence_summary,
        "evidence_summary",
      ),
      mitigation: asNonEmptyString(raw.mitigation, "mitigation"),
      low_confidence_inferred: Boolean(raw.low_confidence_inferred),
    });
  }
  return result;
}

export function validateExecSummary(data: unknown): ExecSummary {
  if (!isObj(data)) {
    throw new Error("Executive summary response is not an object");
  }
  const inner = isObj(data.exec_summary) ? data.exec_summary : data;
  return {
    bullet_1_overall_health: asNonEmptyString(
      inner.bullet_1_overall_health,
      "bullet_1_overall_health",
    ),
    bullet_2_critical_risk: asNonEmptyString(
      inner.bullet_2_critical_risk,
      "bullet_2_critical_risk",
    ),
    bullet_3_forward_action: asNonEmptyString(
      inner.bullet_3_forward_action,
      "bullet_3_forward_action",
    ),
  };
}

export function validateAgenda(data: unknown): {
  items: AgendaItem[];
  total: number;
} {
  const arr = findArrayField(data, ["agenda", "agenda_items", "items"]);
  if (!arr) {
    throw new Error("Agenda response is not an array");
  }

  const items: AgendaItem[] = [];
  let total = 0;
  for (const raw of arr) {
    if (!isObj(raw)) {
      throw new Error("Agenda item is not an object");
    }
    const orderRaw = raw.order;
    const timeRaw = raw.time_minutes;
    const order =
      typeof orderRaw === "number" && Number.isFinite(orderRaw) ? orderRaw : NaN;
    const time =
      typeof timeRaw === "number" && Number.isFinite(timeRaw) ? timeRaw : NaN;
    if (!Number.isFinite(order)) {
      throw new Error("Agenda item order must be a number");
    }
    if (!Number.isFinite(time) || time <= 0) {
      throw new Error("Agenda item time_minutes must be a positive number");
    }
    items.push({
      order,
      title: asNonEmptyString(raw.title, "title"),
      time_minutes: time,
      rationale: asNonEmptyString(raw.rationale, "rationale"),
      suggested_owner: asNonEmptyString(raw.suggested_owner, "suggested_owner"),
    });
    total += time;
  }

  if (total > 60) {
    throw new Error(
      `Total agenda time exceeds 60 minutes; got ${total}`,
    );
  }

  return { items, total };
}
