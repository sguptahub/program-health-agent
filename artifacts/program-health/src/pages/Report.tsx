import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

type RagStatus = "Green" | "Amber" | "Red" | "Unknown";
type Rag = "Green" | "Amber" | "Red";
type Sentiment = "Positive" | "Neutral" | "Negative" | "Unknown";
type Confidence = "High" | "Medium" | "Low";
type DeltaDirection = "improved" | "degraded" | "stable" | "new";

interface WorkstreamSignal {
  workstream_name: string;
  rag_status: RagStatus;
  blockers: string[];
  milestones_at_risk: string[];
  percent_complete?: number;
  transcript_mentions: string[];
  transcript_sentiment: Sentiment;
  transcript_sources: string[];
}

interface SignalBundle {
  run_id: string;
  timestamp: string;
  workstreams: WorkstreamSignal[];
  artifact_flags: {
    excel_provided: boolean;
    transcript_count: number;
    transcript_filenames: string[];
  };
  confidence: Confidence;
}

interface MemoryDelta {
  workstream: string;
  previous_rag?: Rag;
  current_rag?: Rag;
  direction: DeltaDirection;
}

interface IngestResponse {
  signal_bundle: SignalBundle;
  prior_context: {
    last_run_timestamp: string | null;
    deltas: MemoryDelta[];
  };
}

const ragColor: Record<RagStatus, string> = {
  Green: "text-emerald-600",
  Amber: "text-amber-600",
  Red: "text-red-600",
  Unknown: "text-slate-500",
};

const confidenceColor: Record<Confidence, string> = {
  High: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Medium: "bg-amber-100 text-amber-700 border-amber-200",
  Low: "bg-red-100 text-red-700 border-red-200",
};

const placeholderCards = [
  {
    title: "Top Execution Risks",
    placeholder: "The top three risks and their mitigations will appear here.",
  },
  {
    title: "Executive Summary",
    placeholder: "Three stakeholder-ready summary bullets will appear here.",
  },
  {
    title: "Recommended Agenda",
    placeholder: "A recommended agenda for the next sync will appear here.",
  },
];

const STORAGE_KEY = "programHealth.ingestResponse";
const LEGACY_BUNDLE_KEY = "programHealth.signalBundle";

function parseStored(raw: string | null): IngestResponse | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<IngestResponse> & SignalBundle;
    if (
      "signal_bundle" in parsed &&
      parsed.signal_bundle &&
      Array.isArray(parsed.signal_bundle.workstreams)
    ) {
      return parsed as IngestResponse;
    }
    if ("workstreams" in parsed && Array.isArray(parsed.workstreams)) {
      return {
        signal_bundle: parsed as SignalBundle,
        prior_context: { last_run_timestamp: null, deltas: [] },
      };
    }
    return null;
  } catch {
    return null;
  }
}

const formatTimestamp = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
};

const directionStyle: Record<
  DeltaDirection,
  { color: string; arrow: string; label: string }
> = {
  improved: {
    color: "text-emerald-600",
    arrow: "↑",
    label: "improved",
  },
  degraded: {
    color: "text-red-600",
    arrow: "↓",
    label: "degraded",
  },
  stable: {
    color: "text-slate-500",
    arrow: "",
    label: "stable",
  },
  new: {
    color: "text-blue-600",
    arrow: "",
    label: "new",
  },
};

function DeltaRow({ delta }: { delta: MemoryDelta }) {
  const style = directionStyle[delta.direction];

  if (delta.direction === "new") {
    return (
      <li className="flex items-center gap-2 text-sm">
        <span className="font-medium text-slate-900">{delta.workstream}</span>
        <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
          NEW
        </span>
        {delta.current_rag && (
          <span className="text-xs text-slate-500">{delta.current_rag}</span>
        )}
      </li>
    );
  }

  if (delta.direction === "stable") {
    return (
      <li className="flex items-center gap-2 text-sm">
        <span className="font-medium text-slate-900">{delta.workstream}:</span>
        <span className={style.color}>stable</span>
        {delta.current_rag && (
          <span className="text-xs text-slate-500">({delta.current_rag})</span>
        )}
      </li>
    );
  }

  return (
    <li className="flex items-center gap-2 text-sm">
      <span className="font-medium text-slate-900">{delta.workstream}:</span>
      <span className="text-slate-700">
        {delta.previous_rag ?? "—"} → {delta.current_rag ?? "—"}
      </span>
      <span className={`font-semibold ${style.color}`}>
        {style.arrow} {style.label}
      </span>
    </li>
  );
}

function Report() {
  const [data, setData] = useState<IngestResponse | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) raw = localStorage.getItem(LEGACY_BUNDLE_KEY);
    setData(parseStored(raw));
    setHydrated(true);
  }, []);

  if (!hydrated) {
    return null;
  }

  if (!data) {
    return (
      <div className="min-h-screen px-6 py-12">
        <div className="mx-auto w-full max-w-xl text-center">
          <h1 className="text-2xl font-semibold text-slate-900">
            No report data found
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Please upload files first.
          </p>
          <Link
            to="/"
            className="mt-6 inline-block text-sm font-medium text-blue-600 hover:underline"
          >
            ← Upload files
          </Link>
        </div>
      </div>
    );
  }

  const { signal_bundle: bundle, prior_context } = data;
  const { workstreams, artifact_flags, confidence } = bundle;

  const excelLine = artifact_flags.excel_provided
    ? "Excel status file"
    : "No Excel file";

  return (
    <div className="min-h-screen px-6 py-12">
      <div className="mx-auto w-full max-w-5xl">
        <Link
          to="/"
          className="text-sm font-medium text-blue-600 hover:underline"
        >
          ← Upload files
        </Link>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Program Health Report
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Sources: {excelLine} + {artifact_flags.transcript_count} transcript
              file{artifact_flags.transcript_count === 1 ? "" : "s"}
            </p>
            {artifact_flags.transcript_filenames.length > 0 && (
              <ul className="mt-1 text-xs text-slate-500">
                {artifact_flags.transcript_filenames.map((name) => (
                  <li key={name}>• {name}</li>
                ))}
              </ul>
            )}
          </div>
          <span
            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${confidenceColor[confidence]}`}
          >
            Confidence: {confidence}
          </span>
        </div>

        <section
          className="mt-8 rounded-xl bg-white p-6"
          style={{
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow)",
          }}
        >
          <h2 className="text-base font-semibold text-slate-900">
            Previous Run Context
          </h2>
          {prior_context.last_run_timestamp === null ? (
            <p className="mt-3 text-sm text-slate-500">
              First run — no prior context available
            </p>
          ) : (
            <>
              <p className="mt-2 text-sm text-slate-500">
                Last run: {formatTimestamp(prior_context.last_run_timestamp)}
              </p>
              {prior_context.deltas.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">
                  No workstream comparisons available.
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {prior_context.deltas.map((delta) => (
                    <DeltaRow
                      key={delta.workstream}
                      delta={delta}
                    />
                  ))}
                </ul>
              )}
            </>
          )}
        </section>

        <section
          className="mt-6 rounded-xl bg-white p-6"
          style={{
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow)",
          }}
        >
          <h2 className="text-base font-semibold text-slate-900">
            Workstream Health
          </h2>

          {workstreams.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">
              No workstream data was extracted.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2 font-medium">Workstream</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">% Complete</th>
                    <th className="px-3 py-2 font-medium">Blockers</th>
                    <th className="px-3 py-2 font-medium">Sentiment</th>
                    <th className="px-3 py-2 font-medium">Sources</th>
                  </tr>
                </thead>
                <tbody>
                  {workstreams.map((ws) => (
                    <tr
                      key={ws.workstream_name}
                      className="border-b border-slate-100 last:border-0 align-top"
                    >
                      <td className="px-3 py-3 font-medium text-slate-900">
                        {ws.workstream_name}
                      </td>
                      <td
                        className={`px-3 py-3 font-semibold ${ragColor[ws.rag_status]}`}
                      >
                        {ws.rag_status}
                      </td>
                      <td className="px-3 py-3 text-slate-700">
                        {ws.percent_complete !== undefined
                          ? `${ws.percent_complete}%`
                          : "—"}
                      </td>
                      <td className="px-3 py-3 text-slate-700">
                        {ws.blockers.length === 0
                          ? "—"
                          : ws.blockers.join("; ")}
                      </td>
                      <td className="px-3 py-3 text-slate-700">
                        {ws.transcript_sentiment}
                      </td>
                      <td className="px-3 py-3 text-slate-500">
                        {ws.transcript_sources.length === 0
                          ? "—"
                          : ws.transcript_sources.join(", ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {placeholderCards.map((card) => (
            <section
              key={card.title}
              className="rounded-xl bg-white p-6"
              style={{
                border: "1px solid var(--border)",
                boxShadow: "var(--shadow)",
              }}
            >
              <h2 className="text-base font-semibold text-slate-900">
                {card.title}
              </h2>
              <p className="mt-2 text-sm text-slate-500">{card.placeholder}</p>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Report;
