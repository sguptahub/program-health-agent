import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

type RagStatus = "Green" | "Amber" | "Red" | "Unknown";
type Rag = "Green" | "Amber" | "Red";
type Sentiment = "Positive" | "Neutral" | "Negative" | "Unknown";
type Confidence = "High" | "Medium" | "Low";
type DeltaDirection = "improved" | "degraded" | "stable" | "new";
type Severity = "Critical" | "High" | "Medium";

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

interface WorkstreamHealth {
  workstream_name: string;
  rag: Rag;
  confidence: Confidence;
  reasoning: string;
  evidence_signals: string[];
}

interface ExecutionRisk {
  rank: 1 | 2 | 3;
  title: string;
  severity: Severity;
  affected_workstreams: string[];
  evidence_summary: string;
  mitigation: string;
  low_confidence_inferred: boolean;
}

interface ExecSummary {
  bullet_1_overall_health: string;
  bullet_2_critical_risk: string;
  bullet_3_forward_action: string;
}

interface AgendaItem {
  order: number;
  title: string;
  time_minutes: number;
  rationale: string;
  suggested_owner: string;
}

interface AgentError {
  agent: string;
  message: string;
}

interface AnalysisResult {
  run_id: string;
  workstream_health: WorkstreamHealth[] | null;
  top_risks: ExecutionRisk[] | null;
  exec_summary: ExecSummary | null;
  agenda: AgendaItem[] | null;
  total_agenda_minutes: number;
  provider_used: string;
  errors: AgentError[];
}

const ragBadge: Record<Rag, string> = {
  Green: "bg-emerald-600 text-white",
  Amber: "bg-amber-500 text-white",
  Red: "bg-red-600 text-white",
};

const confidencePill: Record<Confidence, string> = {
  High: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Medium: "bg-amber-100 text-amber-700 border-amber-200",
  Low: "bg-red-100 text-red-700 border-red-200",
};

const severityPill: Record<Severity, string> = {
  Critical: "bg-red-100 text-red-700 border-red-200",
  High: "bg-amber-100 text-amber-700 border-amber-200",
  Medium: "bg-slate-100 text-slate-700 border-slate-200",
};

const directionStyle: Record<
  DeltaDirection,
  { color: string; arrow: string; label: string }
> = {
  improved: { color: "text-emerald-600", arrow: "↑", label: "improved" },
  degraded: { color: "text-red-600", arrow: "↓", label: "degraded" },
  stable: { color: "text-slate-500", arrow: "", label: "stable" },
  new: { color: "text-blue-600", arrow: "", label: "new" },
};

const STORAGE_INGEST = "programHealth.ingestResponse";
const STORAGE_ANALYSIS = "programHealth.analysis";

function parseStored<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

const formatTimestamp = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
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

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rounded-xl bg-white p-6"
      style={{
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow)",
      }}
    >
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

function MissingSection({ message }: { message: string }) {
  return (
    <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
      {message}
    </p>
  );
}

function Report() {
  const [ingest, setIngest] = useState<IngestResponse | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setIngest(parseStored<IngestResponse>(localStorage.getItem(STORAGE_INGEST)));
    setAnalysis(
      parseStored<AnalysisResult>(localStorage.getItem(STORAGE_ANALYSIS)),
    );
    setHydrated(true);
  }, []);

  if (!hydrated) return null;

  if (!ingest && !analysis) {
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

  const bundle = ingest?.signal_bundle ?? null;
  const priorContext = ingest?.prior_context ?? null;
  const flags = bundle?.artifact_flags;

  const excelLine = flags
    ? flags.excel_provided
      ? "Excel status file"
      : "No Excel file"
    : null;

  const errorByAgent = new Map<string, string>();
  if (analysis) {
    for (const e of analysis.errors) errorByAgent.set(e.agent, e.message);
  }

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
            {flags && (
              <p className="mt-2 text-sm text-slate-500">
                Sources: {excelLine} + {flags.transcript_count} transcript
                file{flags.transcript_count === 1 ? "" : "s"}
              </p>
            )}
            {flags && flags.transcript_filenames.length > 0 && (
              <ul className="mt-1 text-xs text-slate-500">
                {flags.transcript_filenames.map((name) => (
                  <li key={name}>• {name}</li>
                ))}
              </ul>
            )}
            {analysis && (
              <p className="mt-2 text-xs text-slate-500">
                Analyzed with: OpenAI GPT-4o
              </p>
            )}
          </div>
          {bundle && (
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${confidencePill[bundle.confidence]}`}
            >
              Confidence: {bundle.confidence}
            </span>
          )}
        </div>

        {priorContext && (
          <div className="mt-8">
            <SectionCard title="Previous Run Context">
              {priorContext.last_run_timestamp === null ? (
                <p className="mt-3 text-sm text-slate-500">
                  First run — no prior context available
                </p>
              ) : (
                <>
                  <p className="mt-2 text-sm text-slate-500">
                    Last run: {formatTimestamp(priorContext.last_run_timestamp)}
                  </p>
                  {priorContext.deltas.length === 0 ? (
                    <p className="mt-3 text-sm text-slate-500">
                      No workstream comparisons available.
                    </p>
                  ) : (
                    <ul className="mt-3 space-y-2">
                      {priorContext.deltas.map((d) => (
                        <DeltaRow key={d.workstream} delta={d} />
                      ))}
                    </ul>
                  )}
                </>
              )}
            </SectionCard>
          </div>
        )}

        <div className="mt-6">
          <SectionCard title="Workstream Health">
            {analysis?.workstream_health && analysis.workstream_health.length > 0 ? (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-2 font-medium">Workstream</th>
                      <th className="px-3 py-2 font-medium">RAG</th>
                      <th className="px-3 py-2 font-medium">Confidence</th>
                      <th className="px-3 py-2 font-medium">Reasoning</th>
                      <th className="px-3 py-2 font-medium">Evidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.workstream_health.map((w) => (
                      <tr
                        key={w.workstream_name}
                        className="border-b border-slate-100 last:border-0 align-top"
                      >
                        <td className="px-3 py-3 font-medium text-slate-900">
                          {w.workstream_name}
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${ragBadge[w.rag]}`}
                          >
                            {w.rag}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${confidencePill[w.confidence]}`}
                          >
                            {w.confidence}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-slate-700">
                          {w.reasoning}
                        </td>
                        <td className="px-3 py-3 text-slate-500">
                          {w.evidence_signals.length === 0 ? (
                            "—"
                          ) : (
                            <ul className="list-disc space-y-1 pl-4">
                              {w.evidence_signals.map((sig, i) => (
                                <li key={i}>{sig}</li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <MissingSection
                message={
                  errorByAgent.get("WorkstreamHealthAgent") ??
                  "Workstream health analysis is unavailable."
                }
              />
            )}
          </SectionCard>
        </div>

        <div className="mt-6">
          <SectionCard title="Top Execution Risks">
            {analysis?.top_risks && analysis.top_risks.length > 0 ? (
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                {analysis.top_risks.map((risk) => (
                  <div
                    key={risk.rank}
                    className="rounded-lg border border-slate-200 p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                        {risk.rank}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${severityPill[risk.severity]}`}
                      >
                        {risk.severity}
                      </span>
                    </div>
                    <h3 className="mt-2 text-sm font-semibold text-slate-900">
                      {risk.title}
                    </h3>
                    {risk.affected_workstreams.length > 0 && (
                      <p className="mt-1 text-xs text-slate-500">
                        Affects: {risk.affected_workstreams.join(", ")}
                      </p>
                    )}
                    <p className="mt-3 text-sm text-slate-700">
                      <span className="font-semibold text-slate-900">
                        Evidence:{" "}
                      </span>
                      {risk.evidence_summary}
                    </p>
                    <p className="mt-2 text-sm text-slate-700">
                      <span className="font-semibold text-slate-900">
                        Mitigation:{" "}
                      </span>
                      {risk.mitigation}
                    </p>
                    {risk.low_confidence_inferred && (
                      <p className="mt-2 text-xs italic text-amber-700">
                        Low-confidence (inferred from limited evidence)
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <MissingSection
                message={
                  errorByAgent.get("RiskDetectionAgent") ??
                  "Risk analysis is unavailable."
                }
              />
            )}
          </SectionCard>
        </div>

        <div className="mt-6">
          <SectionCard title="Executive Summary">
            {analysis?.exec_summary ? (
              <div className="mt-4 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    1. Program Health
                  </p>
                  <p className="mt-1 text-sm text-slate-800">
                    {analysis.exec_summary.bullet_1_overall_health}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    2. Critical Risk
                  </p>
                  <p className="mt-1 text-sm text-slate-800">
                    {analysis.exec_summary.bullet_2_critical_risk}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    3. Recommended Action
                  </p>
                  <p className="mt-1 text-sm text-slate-800">
                    {analysis.exec_summary.bullet_3_forward_action}
                  </p>
                </div>
              </div>
            ) : (
              <MissingSection
                message={
                  errorByAgent.get("ExecutiveSynthesisAgent") ??
                  "Executive summary is unavailable."
                }
              />
            )}
          </SectionCard>
        </div>

        <div className="mt-6">
          <SectionCard title="Recommended Agenda">
            {analysis?.agenda && analysis.agenda.length > 0 ? (
              <>
                <ol className="mt-4 space-y-3">
                  {analysis.agenda.map((item) => (
                    <li
                      key={item.order}
                      className="rounded-lg border border-slate-200 p-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-semibold text-slate-900">
                          {item.order}. {item.title}
                        </h3>
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                          {item.time_minutes} min
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-slate-700">
                        {item.rationale}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Owner: {item.suggested_owner}
                      </p>
                    </li>
                  ))}
                </ol>
                <p className="mt-3 text-right text-xs font-semibold text-slate-600">
                  Total: {analysis.total_agenda_minutes} / 60 minutes
                </p>
              </>
            ) : (
              <MissingSection
                message={
                  errorByAgent.get("AgendaRecommendationAgent") ??
                  "Agenda is unavailable."
                }
              />
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

export default Report;
