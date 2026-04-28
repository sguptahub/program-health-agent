import { useRef, useState, type ChangeEvent } from "react";
import { Link } from "react-router-dom";

function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files;
    if (!selected) {
      setFiles([]);
      return;
    }
    setFiles(Array.from(selected));
  };

  const handleBrowseClick = () => {
    inputRef.current?.click();
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
            className="w-full rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm font-medium text-slate-600 transition hover:border-slate-400 hover:bg-slate-100"
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
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            disabled
            title="Coming in Phase 2"
            aria-label="Analyze (coming in Phase 2)"
            className="inline-flex w-full cursor-not-allowed items-center justify-center rounded-lg bg-slate-300 px-5 py-2.5 text-sm font-medium text-white sm:w-auto"
          >
            Analyze
            <span className="ml-2 rounded bg-white/30 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
              Coming in Phase 2
            </span>
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
