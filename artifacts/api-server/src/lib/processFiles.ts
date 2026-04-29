import { parseExcel } from "./parsers/excelParser";
import { parseTranscripts } from "./parsers/transcriptParser";
import { normalize } from "./normalizer";
import type {
  SignalBundle,
  TranscriptSignal,
  UploadedDocx,
  WorkstreamSignal,
} from "./types";

export interface ProcessFilesInput {
  excelFile: { buffer: Buffer; filename: string } | null;
  docxFiles: UploadedDocx[];
}

export async function processFiles(
  input: ProcessFilesInput,
): Promise<SignalBundle> {
  const { excelFile, docxFiles } = input;

  let excelSignals: WorkstreamSignal[] | null = null;
  if (excelFile) {
    excelSignals = parseExcel(excelFile.buffer);
  }

  const workstreamNames = excelSignals
    ? excelSignals.map((s) => s.workstream_name)
    : [];

  let transcriptMap: Map<string, TranscriptSignal> | null = null;
  if (docxFiles.length > 0) {
    transcriptMap = await parseTranscripts(docxFiles, workstreamNames);
  }

  return normalize({
    excelSignals,
    transcriptMap,
    transcriptFilenames: docxFiles.map((f) => f.filename),
  });
}
