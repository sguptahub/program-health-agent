import { processFiles, type ProcessFilesInput } from "./processFiles";
import {
  getDelta,
  getLastEntry,
  saveEntry,
  type MemoryDelta,
} from "./memory/memoryService";
import type { SignalBundle } from "./types";

export interface IngestResponse {
  signal_bundle: SignalBundle;
  prior_context: {
    last_run_timestamp: string | null;
    deltas: MemoryDelta[];
  };
}

export async function runIngest(
  input: ProcessFilesInput,
): Promise<IngestResponse> {
  const bundle = await processFiles(input);

  const priorEntry = getLastEntry();
  const deltas = getDelta(bundle, priorEntry);

  saveEntry({
    run_id: bundle.run_id,
    timestamp: bundle.timestamp,
    signal_bundle: bundle,
    health_ratings: {},
    artifact_flags: {
      excel_provided: bundle.artifact_flags.excel_provided,
      transcript_count: bundle.artifact_flags.transcript_count,
    },
  });

  return {
    signal_bundle: bundle,
    prior_context: {
      last_run_timestamp: priorEntry ? priorEntry.timestamp : null,
      deltas,
    },
  };
}
