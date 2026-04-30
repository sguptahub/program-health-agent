import { BaseAgent } from "./baseAgent";
import { EXECUTIVE_SYNTHESIS_PROMPT } from "../../prompts";
import type { ExecSummary, ExecutionRisk, WorkstreamHealth } from "../types";
import { validateExecSummary } from "../validators";

export class ExecutiveSynthesisAgent extends BaseAgent {
  constructor() {
    super(EXECUTIVE_SYNTHESIS_PROMPT, "ExecutiveSynthesisAgent");
  }

  async analyze(
    health: WorkstreamHealth[],
    risks: ExecutionRisk[],
  ): Promise<ExecSummary> {
    const userMessage = JSON.stringify(
      {
        instructions:
          "Produce exactly 3 stakeholder-ready bullets. Avoid technical jargon. Never claim overall green health if any workstream is Red.",
        workstream_health: health,
        top_risks: risks,
      },
      null,
      2,
    );

    const raw = await this.call(userMessage);
    const parsed = this.parseJson<unknown>(raw);
    return validateExecSummary(parsed);
  }
}
