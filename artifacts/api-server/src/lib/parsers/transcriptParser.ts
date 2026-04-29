import mammoth from "mammoth";
import type { Sentiment, TranscriptSignal, UploadedDocx } from "../types";

const NEGATIVE_KEYWORDS = [
  "blocked",
  "blocker",
  "delayed",
  "risk",
  "issue",
  "concern",
  "escalate",
  "missed",
  "behind",
  "problem",
  "stuck",
];

const POSITIVE_KEYWORDS = [
  "completed",
  "delivered",
  "on track",
  "green",
  "ahead",
  "resolved",
  "done",
  "successful",
];

const splitIntoSentences = (text: string): string[] =>
  text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

const classifySentiment = (mentions: string[]): Sentiment => {
  if (mentions.length === 0) return "Unknown";
  const joined = mentions.join(" ").toLowerCase();
  const hasNegative = NEGATIVE_KEYWORDS.some((kw) => joined.includes(kw));
  if (hasNegative) return "Negative";
  const hasPositive = POSITIVE_KEYWORDS.some((kw) => joined.includes(kw));
  if (hasPositive) return "Positive";
  return "Neutral";
};

export async function parseTranscripts(
  files: UploadedDocx[],
  workstreamNames: string[],
): Promise<Map<string, TranscriptSignal>> {
  const result = new Map<string, TranscriptSignal>();

  if (files.length === 0 || workstreamNames.length === 0) {
    for (const name of workstreamNames) {
      result.set(name, { mentions: [], sentiment: "Unknown", sources: [] });
    }
    return result;
  }

  const extracted: { filename: string; sentences: string[] }[] = [];
  for (const file of files) {
    const { value } = await mammoth.extractRawText({ buffer: file.buffer });
    extracted.push({
      filename: file.filename,
      sentences: splitIntoSentences(value),
    });
  }

  for (const name of workstreamNames) {
    const lowerName = name.toLowerCase();
    const mentions: string[] = [];
    const sources = new Set<string>();

    for (const { filename, sentences } of extracted) {
      for (const sentence of sentences) {
        if (sentence.toLowerCase().includes(lowerName)) {
          mentions.push(sentence);
          sources.add(filename);
        }
      }
    }

    result.set(name, {
      mentions,
      sentiment: classifySentiment(mentions),
      sources: Array.from(sources),
    });
  }

  return result;
}
