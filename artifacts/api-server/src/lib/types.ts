export type RagStatus = "Green" | "Amber" | "Red" | "Unknown";
export type Rag = "Green" | "Amber" | "Red";
export type Sentiment = "Positive" | "Neutral" | "Negative" | "Unknown";
export type Confidence = "High" | "Medium" | "Low";

export interface WorkstreamSignal {
  workstream_name: string;
  rag_status: RagStatus;
  blockers: string[];
  milestones_at_risk: string[];
  percent_complete?: number;
  transcript_mentions: string[];
  transcript_sentiment: Sentiment;
  transcript_sources: string[];
}

export interface ArtifactFlags {
  excel_provided: boolean;
  transcript_count: number;
  transcript_filenames: string[];
}

export interface SignalBundle {
  run_id: string;
  timestamp: string;
  workstreams: WorkstreamSignal[];
  artifact_flags: ArtifactFlags;
  confidence: Confidence;
}

export interface TranscriptSignal {
  mentions: string[];
  sentiment: Sentiment;
  sources: string[];
}

export interface UploadedDocx {
  buffer: Buffer;
  filename: string;
}

export interface WorkstreamHealth {
  workstream_name: string;
  rag: Rag;
  confidence: Confidence;
  reasoning: string;
  evidence_signals: string[];
}

export interface ExecutionRisk {
  rank: 1 | 2 | 3;
  title: string;
  severity: "Critical" | "High" | "Medium";
  affected_workstreams: string[];
  evidence_summary: string;
  mitigation: string;
  low_confidence_inferred: boolean;
}

export interface ExecSummary {
  bullet_1_overall_health: string;
  bullet_2_critical_risk: string;
  bullet_3_forward_action: string;
}

export interface AgendaItem {
  order: number;
  title: string;
  time_minutes: number;
  rationale: string;
  suggested_owner: string;
}

export interface AgentError {
  agent: string;
  message: string;
}

export interface AnalysisResult {
  run_id: string;
  workstream_health: WorkstreamHealth[] | null;
  top_risks: ExecutionRisk[] | null;
  exec_summary: ExecSummary | null;
  agenda: AgendaItem[] | null;
  total_agenda_minutes: number;
  provider_used: string;
  errors: AgentError[];
}
