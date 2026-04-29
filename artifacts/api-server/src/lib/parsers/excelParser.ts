import * as XLSX from "xlsx";
import type { RagStatus, WorkstreamSignal } from "../types";

const WORKSTREAM_KEYS = ["workstream", "workstream name", "name"];
const STATUS_KEYS = ["status", "rag", "rag status", "health"];
const PERCENT_KEYS = [
  "% complete",
  "percent complete",
  "percent",
  "progress",
  "complete",
];
const BLOCKERS_KEYS = ["blockers", "blocker", "issues"];
const MILESTONES_KEYS = [
  "milestones at risk",
  "milestones",
  "at risk milestones",
  "risk milestones",
];

const normalizeKey = (key: string): string => key.trim().toLowerCase();

const findValue = (
  row: Record<string, unknown>,
  keys: string[],
): unknown | undefined => {
  const normalized = new Map<string, unknown>();
  for (const [k, v] of Object.entries(row)) {
    normalized.set(normalizeKey(k), v);
  }
  for (const candidate of keys) {
    const value = normalized.get(candidate);
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return undefined;
};

const parseStatus = (raw: unknown): RagStatus => {
  if (raw === undefined || raw === null) return "Unknown";
  const text = String(raw).trim().toLowerCase();
  if (text.startsWith("green")) return "Green";
  if (text.startsWith("amber") || text.startsWith("yellow")) return "Amber";
  if (text.startsWith("red")) return "Red";
  return "Unknown";
};

const parsePercent = (raw: unknown): number | undefined => {
  if (raw === undefined || raw === null || raw === "") return undefined;
  if (typeof raw === "number") {
    if (raw > 0 && raw <= 1) return Math.round(raw * 100);
    return Math.round(raw);
  }
  const text = String(raw).replace("%", "").trim();
  const parsed = Number(text);
  if (Number.isFinite(parsed)) return Math.round(parsed);
  return undefined;
};

const parseList = (raw: unknown): string[] => {
  if (raw === undefined || raw === null) return [];
  const text = String(raw).trim();
  if (!text) return [];
  return text
    .split(/\r?\n|;|\u2022|\|/)
    .map((part) => part.replace(/^[-*\s]+/, "").trim())
    .filter((part) => part.length > 0);
};

export function parseExcel(buffer: Buffer): WorkstreamSignal[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];

  const sheet = workbook.Sheets[firstSheetName];
  if (!sheet) return [];

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });

  const signals: WorkstreamSignal[] = [];

  for (const row of rows) {
    const workstreamRaw = findValue(row, WORKSTREAM_KEYS);
    const name = workstreamRaw ? String(workstreamRaw).trim() : "";
    if (!name) continue;

    signals.push({
      workstream_name: name,
      rag_status: parseStatus(findValue(row, STATUS_KEYS)),
      percent_complete: parsePercent(findValue(row, PERCENT_KEYS)),
      blockers: parseList(findValue(row, BLOCKERS_KEYS)),
      milestones_at_risk: parseList(findValue(row, MILESTONES_KEYS)),
      transcript_mentions: [],
      transcript_sentiment: "Unknown",
      transcript_sources: [],
    });
  }

  return signals;
}
