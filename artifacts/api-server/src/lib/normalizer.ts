import { v4 as uuidv4 } from "uuid";
import type {
  Confidence,
  SignalBundle,
  TranscriptSignal,
  WorkstreamSignal,
} from "./types";

const computeConfidence = (
  excelProvided: boolean,
  transcriptCount: number,
): Confidence => {
  if (excelProvided && transcriptCount > 0) return "High";
  if (excelProvided) return "Medium";
  return "Low";
};

export function normalize(input: {
  excelSignals: WorkstreamSignal[] | null;
  transcriptMap: Map<string, TranscriptSignal> | null;
  transcriptFilenames: string[];
}): SignalBundle {
  const { excelSignals, transcriptMap, transcriptFilenames } = input;

  const excelProvided = excelSignals !== null;
  const transcriptCount = transcriptFilenames.length;

  const byName = new Map<string, WorkstreamSignal>();

  if (excelSignals) {
    for (const signal of excelSignals) {
      byName.set(signal.workstream_name, { ...signal });
    }
  }

  if (transcriptMap) {
    for (const [name, signal] of transcriptMap.entries()) {
      const existing = byName.get(name);
      if (existing) {
        existing.transcript_mentions = signal.mentions;
        existing.transcript_sentiment = signal.sentiment;
        existing.transcript_sources = signal.sources;
      } else if (signal.mentions.length > 0) {
        byName.set(name, {
          workstream_name: name,
          rag_status: "Unknown",
          blockers: [],
          milestones_at_risk: [],
          transcript_mentions: signal.mentions,
          transcript_sentiment: signal.sentiment,
          transcript_sources: signal.sources,
        });
      }
    }
  }

  return {
    run_id: uuidv4(),
    timestamp: new Date().toISOString(),
    workstreams: Array.from(byName.values()),
    artifact_flags: {
      excel_provided: excelProvided,
      transcript_count: transcriptCount,
      transcript_filenames: transcriptFilenames,
    },
    confidence: computeConfidence(excelProvided, transcriptCount),
  };
}
