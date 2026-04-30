import { BaseAgent } from "./baseAgent";
import { WORKSTREAM_HEALTH_PROMPT } from "../../prompts";
import type {
  SignalBundle,
  WorkstreamHealth,
} from "../types";
import type { MemoryDelta } from "../memory/memoryService";
import { validateWorkstreamHealth } from "../validators";

export class WorkstreamHealthAgent extends BaseAgent {
  constructor() {
    super(WORKSTREAM_HEALTH_PROMPT, "WorkstreamHealthAgent");
  }

  async analyze(
    bundle: SignalBundle,
    deltas: MemoryDelta[],
  ): Promise<WorkstreamHealth[]> {
    const userMessage = JSON.stringify(
      {
        instructions:
          "Assess every workstream below. Cite specific signals as evidence. Lower confidence to Low when only one artifact type was provided.",
        artifact_flags: bundle.artifact_flags,
        bundle_confidence: bundle.confidence,
        workstreams: bundle.workstreams,
        prior_run_deltas: deltas,
      },
      null,
      2,
    );

    const raw = await this.call(userMessage);
    const parsed = this.parseJson<unknown>(raw);
    return validateWorkstreamHealth(parsed, bundle);
  }
}
