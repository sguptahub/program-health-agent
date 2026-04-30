import { BaseAgent } from "./baseAgent";
import { RISK_DETECTION_PROMPT } from "../../prompts";
import type { ExecutionRisk, SignalBundle, WorkstreamHealth } from "../types";
import type { MemoryDelta } from "../memory/memoryService";
import { validateTopRisks } from "../validators";

export class RiskDetectionAgent extends BaseAgent {
  constructor() {
    super(RISK_DETECTION_PROMPT, "RiskDetectionAgent");
  }

  async analyze(
    health: WorkstreamHealth[],
    bundle: SignalBundle,
    deltas: MemoryDelta[],
  ): Promise<ExecutionRisk[]> {
    const userMessage = JSON.stringify(
      {
        instructions:
          "Identify exactly the top 3 execution risks. Each risk must cite at least one concrete signal. Set low_confidence_inferred when only one artifact type was provided.",
        workstream_health: health,
        artifact_flags: bundle.artifact_flags,
        raw_blockers: bundle.workstreams.map((w) => ({
          workstream: w.workstream_name,
          blockers: w.blockers,
          milestones_at_risk: w.milestones_at_risk,
        })),
        prior_run_deltas: deltas,
      },
      null,
      2,
    );

    const raw = await this.call(userMessage);
    let parsed = this.parseJson<unknown>(raw);

    try {
      return validateTopRisks(parsed);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const isCountError = message.includes("exactly 3");
      if (!isCountError) throw err;

      const corrected = await this.callWithCorrection(
        userMessage,
        `Your previous response failed validation: ${message}. Your response must contain exactly 3 risks. Please fix and return exactly 3.`,
      );
      parsed = this.parseJson<unknown>(corrected);
      return validateTopRisks(parsed);
    }
  }
}
