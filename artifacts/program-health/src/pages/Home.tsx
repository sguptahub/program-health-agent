import { useRef, useState, type ChangeEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

const apiBase = import.meta.env.BASE_URL.replace(/\/$/, "");

function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handleAnalyze = async () => {
    setError(null);

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
      const response = await fetch(`${apiBase}/api/ingest`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        let message = `Request failed with status ${response.status}`;
        try {
          const data = (await response.json()) as { error?: string };
          if (data?.error) message = data.error;
        } catch {
          // fall through to default message
        }
        setError(message);
        return;
      }

      const bundle = await response.json();
      localStorage.setItem("programHealth.signalBundle", JSON.stringify(bundle));
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
            View sample report →
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Home;
