import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

type RagStatus = "Green" | "Amber" | "Red" | "Unknown";
type Sentiment = "Positive" | "Neutral" | "Negative" | "Unknown";
type Confidence = "High" | "Medium" | "Low";

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

function parseBundle(raw: string | null): SignalBundle | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SignalBundle;
  } catch {
    return null;
  }
}

function Report() {
  const [bundle, setBundle] = useState<SignalBundle | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setBundle(parseBundle(localStorage.getItem("programHealth.signalBundle")));
    setHydrated(true);
  }, []);

  if (!hydrated) {
    return null;
  }

  if (!bundle) {
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

  const {
    workstreams,
    artifact_flags,
    confidence,
  } = bundle;

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
