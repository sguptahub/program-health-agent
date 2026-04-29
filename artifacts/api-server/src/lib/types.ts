export type RagStatus = "Green" | "Amber" | "Red" | "Unknown";
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
