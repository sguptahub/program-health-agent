import { BaseAgent } from "./baseAgent";
import { AGENDA_RECOMMENDATION_PROMPT } from "../../prompts";
import type {
  AgendaItem,
  ExecSummary,
  ExecutionRisk,
  WorkstreamHealth,
} from "../types";
import { validateAgenda } from "../validators";

export class AgendaRecommendationAgent extends BaseAgent {
  constructor() {
    super(AGENDA_RECOMMENDATION_PROMPT, "AgendaRecommendationAgent");
  }

  async analyze(
    health: WorkstreamHealth[],
    risks: ExecutionRisk[],
    summary: ExecSummary,
  ): Promise<{ items: AgendaItem[]; total: number }> {
    const userMessage = JSON.stringify(
      {
        instructions:
          "Build an agenda for the next program sync. Prioritize Red, then Amber, then Green workstreams. Total time must not exceed 60 minutes.",
        workstream_health: health,
        top_risks: risks,
        exec_summary: summary,
      },
      null,
      2,
    );

    const raw = await this.call(userMessage);
    let parsed = this.parseJson<unknown>(raw);

    try {
      return validateAgenda(parsed);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const isOverBudget = message.includes("exceeds 60");
      if (!isOverBudget) throw err;

      const corrected = await this.callWithCorrection(
        userMessage,
        "Total agenda time exceeds 60 minutes. Please reduce time allocations and resubmit.",
      );
      parsed = this.parseJson<unknown>(corrected);
      return validateAgenda(parsed);
    }
  }
}
