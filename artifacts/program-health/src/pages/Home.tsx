import { useRef, useState, type ChangeEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

const apiBase = import.meta.env.BASE_URL.replace(/\/$/, "");

type StepStatus = "pending" | "running" | "done" | "failed";

interface Step {
  key: string;
  label: string;
  status: StepStatus;
}

const INITIAL_STEPS: Step[] = [
  { key: "ingest", label: "Parsing uploaded files...", status: "pending" },
  {
    key: "workstream",
    label: "Assessing workstream health...",
    status: "pending",
  },
  { key: "risks", label: "Detecting execution risks...", status: "pending" },
  {
    key: "summary",
    label: "Synthesizing executive summary...",
    status: "pending",
  },
  { key: "agenda", label: "Building recommended agenda...", status: "pending" },
];

function Spinner() {
  return (
    <span
      className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"
      aria-hidden
    />
  );
}

function CheckIcon() {
  return (
    <span className="inline-flex h-3 w-3 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-bold leading-none text-white">
      ✓
    </span>
  );
}

function FailIcon() {
  return (
    <span className="inline-flex h-3 w-3 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold leading-none text-white">
      !
    </span>
  );
}

function PendingIcon() {
  return (
    <span
      className="inline-block h-3 w-3 rounded-full border border-slate-300 bg-white"
      aria-hidden
    />
  );
}

function StepRow({ step }: { step: Step }) {
  let icon;
  if (step.status === "running") icon = <Spinner />;
  else if (step.status === "done") icon = <CheckIcon />;
  else if (step.status === "failed") icon = <FailIcon />;
  else icon = <PendingIcon />;

  let textColor = "text-slate-400";
  if (step.status === "running") textColor = "text-slate-900";
  else if (step.status === "done") textColor = "text-slate-700";
  else if (step.status === "failed") textColor = "text-red-600";

  return (
    <li className="flex items-center gap-3 text-sm">
      <span className="flex h-4 w-4 items-center justify-center">{icon}</span>
      <span className={textColor}>{step.label}</span>
    </li>
  );
}

function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [steps, setSteps] = useState<Step[]>(INITIAL_STEPS);

  const setStepStatus = (key: string, status: StepStatus) => {
    setSteps((prev) =>
      prev.map((s) => (s.key === key ? { ...s, status } : s)),
    );
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const selected = event.target.files;
    if (!selected) {
      setFiles([]);
      return;
    }
    const list = Array.from(selected);
    setFiles(list);

    const xlsxCount = list.filter((f) =>
      f.name.toLowerCase().endsWith(".xlsx"),
    ).length;
    if (xlsxCount > 1) {
      setError("Please upload only one Excel status file");
    }
  };

  const handleBrowseClick = () => {
    inputRef.current?.click();
  };

  const resetSteps = () => setSteps(INITIAL_STEPS);

  const handleAnalyze = async () => {
    setError(null);
    resetSteps();

    if (files.length === 0) {
      setError("Please select at least one file");
      return;
    }

    const xlsxCount = files.filter((f) =>
      f.name.toLowerCase().endsWith(".xlsx"),
    ).length;

    if (xlsxCount > 1) {
      setError("Please upload only one Excel status file");
      return;
    }

    const formData = new FormData();
    for (const file of files) {
      formData.append("files", file, file.name);
    }

    setIsSubmitting(true);
    try {
      setStepStatus("ingest", "running");
      const ingestResp = await fetch(`${apiBase}/api/ingest`, {
        method: "POST",
        body: formData,
      });

      if (!ingestResp.ok) {
        let message = `Request failed with status ${ingestResp.status}`;
        try {
          const data = (await ingestResp.json()) as { error?: string };
          if (data?.error) message = data.error;
        } catch {
          // fall through
        }
        setStepStatus("ingest", "failed");
        setError(message);
        return;
      }

      const ingestData = await ingestResp.json();
      setStepStatus("ingest", "done");
      localStorage.setItem(
        "programHealth.ingestResponse",
        JSON.stringify(ingestData),
      );

      setStepStatus("workstream", "running");
      const analyzeResp = await fetch(`${apiBase}/api/analyze`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ signal_bundle: ingestData.signal_bundle }),
      });

      if (!analyzeResp.ok) {
        let message = `Analysis failed with status ${analyzeResp.status}`;
        try {
          const data = (await analyzeResp.json()) as { error?: string };
          if (data?.error) message = data.error;
        } catch {
          // fall through
        }
        setStepStatus("workstream", "failed");
        setError(message);
        return;
      }

      const analysis = await analyzeResp.json();

      const errorAgents: string[] =
        Array.isArray(analysis?.errors)
          ? analysis.errors.map((e: { agent: string }) => e.agent)
          : [];

      const stepFor = (
        key: "workstream" | "risks" | "summary" | "agenda",
        agentName: string,
        section: unknown,
      ) => {
        if (errorAgents.includes(agentName)) {
          setStepStatus(key, "failed");
        } else if (section !== null && section !== undefined) {
          setStepStatus(key, "done");
        } else {
          setStepStatus(key, "failed");
        }
      };

      stepFor("workstream", "WorkstreamHealthAgent", analysis.workstream_health);
      stepFor("risks", "RiskDetectionAgent", analysis.top_risks);
      stepFor("summary", "ExecutiveSynthesisAgent", analysis.exec_summary);
      stepFor("agenda", "AgendaRecommendationAgent", analysis.agenda);

      localStorage.setItem(
        "programHealth.analysis",
        JSON.stringify(analysis),
      );

      navigate("/report");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to upload files";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12">
      <div
        className="w-full max-w-xl rounded-xl bg-white p-8 sm:p-10"
        style={{
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow)",
        }}
      >
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Program Health Intelligence Agent
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Upload your program status file and meeting transcripts to generate
          AI-powered health insights
        </p>

        <div className="mt-8">
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.docx"
            multiple
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={handleBrowseClick}
            disabled={isSubmitting}
            className="w-full rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm font-medium text-slate-600 transition hover:border-slate-400 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Click to select .xlsx and .docx files
          </button>

          {files.length > 0 && (
            <ul className="mt-4 space-y-1 text-sm text-slate-700">
              {files.map((file) => (
                <li
                  key={`${file.name}-${file.lastModified}`}
                  className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2"
                >
                  <span className="truncate">{file.name}</span>
                  <span className="ml-3 shrink-0 text-xs text-slate-500">
                    {(file.size / 1024).toFixed(1)} KB
                  </span>
                </li>
              ))}
            </ul>
          )}

          {error && (
            <div
              role="alert"
              className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          {isSubmitting && (
            <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Analysis pipeline
              </p>
              <ul className="mt-2 space-y-2">
                {steps.map((step) => (
                  <StepRow key={step.key} step={step} />
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={isSubmitting || files.length === 0}
            className="inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 sm:w-auto"
          >
            {isSubmitting
              ? `Analyzing ${files.length} file${files.length === 1 ? "" : "s"}...`
              : "Analyze"}
          </button>

          <Link
            to="/report"
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            View last report →
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Home;
