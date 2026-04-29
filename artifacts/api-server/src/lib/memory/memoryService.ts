import type { RagStatus, SignalBundle } from "../types";

type Rag = "Green" | "Amber" | "Red";

export interface MemoryEntry {
  run_id: string;
  timestamp: string;
  signal_bundle: SignalBundle;
  health_ratings: Record<string, Rag>;
  artifact_flags: {
    excel_provided: boolean;
    transcript_count: number;
  };
}

export interface MemoryDelta {
  workstream: string;
  previous_rag?: Rag;
  current_rag?: Rag;
  direction: "improved" | "degraded" | "stable" | "new";
}

const RAG_RANK: Record<Rag, number> = {
  Red: 0,
  Amber: 1,
  Green: 2,
};

const isRag = (status: RagStatus | undefined): status is Rag =>
  status === "Green" || status === "Amber" || status === "Red";

let lastEntry: MemoryEntry | null = null;

export function getLastEntry(): MemoryEntry | null {
  return lastEntry;
}

export function saveEntry(entry: MemoryEntry): void {
  lastEntry = entry;
}

export function resetMemory(): void {
  lastEntry = null;
}

const ragForWorkstream = (
  bundle: SignalBundle,
  name: string,
): Rag | undefined => {
  const ws = bundle.workstreams.find((w) => w.workstream_name === name);
  if (!ws) return undefined;
  return isRag(ws.rag_status) ? ws.rag_status : undefined;
};

export function getDelta(
  currentBundle: SignalBundle,
  priorEntry: MemoryEntry | null,
): MemoryDelta[] {
  const deltas: MemoryDelta[] = [];

  for (const ws of currentBundle.workstreams) {
    const name = ws.workstream_name;
    const current = isRag(ws.rag_status) ? ws.rag_status : undefined;

    if (!priorEntry) {
      deltas.push({
        workstream: name,
        current_rag: current,
        direction: "new",
      });
      continue;
    }

    const previous = ragForWorkstream(priorEntry.signal_bundle, name);

    if (previous === undefined) {
      deltas.push({
        workstream: name,
        current_rag: current,
        direction: "new",
      });
      continue;
    }

    if (current === undefined) {
      deltas.push({
        workstream: name,
        previous_rag: previous,
        current_rag: current,
        direction: "stable",
      });
      continue;
    }

    const prevRank = RAG_RANK[previous];
    const currRank = RAG_RANK[current];

    let direction: MemoryDelta["direction"];
    if (currRank > prevRank) direction = "improved";
    else if (currRank < prevRank) direction = "degraded";
    else direction = "stable";

    deltas.push({
      workstream: name,
      previous_rag: previous,
      current_rag: current,
      direction,
    });
  }

  return deltas;
}
