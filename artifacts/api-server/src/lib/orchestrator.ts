import { WorkstreamHealthAgent } from "./agents/workstreamHealthAgent";
import { RiskDetectionAgent } from "./agents/riskDetectionAgent";
import { ExecutiveSynthesisAgent } from "./agents/executiveSynthesisAgent";
import { AgendaRecommendationAgent } from "./agents/agendaRecommendationAgent";
import { PROVIDER_USED } from "./openaiClient";
import {
  getLastEntry,
  saveEntry,
  type MemoryDelta,
} from "./memory/memoryService";
import type {
  AgentError,
  AnalysisResult,
  ExecSummary,
  ExecutionRisk,
  Rag,
  SignalBundle,
  WorkstreamHealth,
} from "./types";

export async function runAnalysis(
  bundle: SignalBundle,
  deltas: MemoryDelta[],
): Promise<AnalysisResult> {
  const errors: AgentError[] = [];

  let health: WorkstreamHealth[] | null = null;
  try {
    health = await new WorkstreamHealthAgent().analyze(bundle, deltas);
  } catch (err) {
    errors.push({
      agent: "WorkstreamHealthAgent",
      message: err instanceof Error ? err.message : String(err),
    });
  }

  let risks: ExecutionRisk[] | null = null;
  if (health) {
    try {
      risks = await new RiskDetectionAgent().analyze(health, bundle, deltas);
    } catch (err) {
      errors.push({
        agent: "RiskDetectionAgent",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  let execSummary: ExecSummary | null = null;
  if (health && risks) {
    try {
      execSummary = await new ExecutiveSynthesisAgent().analyze(health, risks);
    } catch (err) {
      errors.push({
        agent: "ExecutiveSynthesisAgent",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  let agendaItems: AnalysisResult["agenda"] = null;
  let totalAgendaMinutes = 0;
  if (health && risks && execSummary) {
    try {
      const result = await new AgendaRecommendationAgent().analyze(
        health,
        risks,
        execSummary,
      );
      agendaItems = result.items;
      totalAgendaMinutes = result.total;
    } catch (err) {
      errors.push({
        agent: "AgendaRecommendationAgent",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (health) {
    const ratings: Record<string, Rag> = {};
    for (const w of health) {
      ratings[w.workstream_name] = w.rag;
    }
    const lastEntry = getLastEntry();
    if (lastEntry && lastEntry.run_id === bundle.run_id) {
      saveEntry({
        ...lastEntry,
        health_ratings: ratings,
      });
    }
  }

  return {
    run_id: bundle.run_id,
    workstream_health: health,
    top_risks: risks,
    exec_summary: execSummary,
    agenda: agendaItems,
    total_agenda_minutes: totalAgendaMinutes,
    provider_used: PROVIDER_USED,
    errors,
  };
}
