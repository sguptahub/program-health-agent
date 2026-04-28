import { Link } from "react-router-dom";

const sections = [
  {
    title: "Workstream Health",
    placeholder: "RAG ratings and reasoning per workstream will appear here.",
  },
  {
    title: "Top Execution Risks",
    placeholder: "The top three risks and their mitigations will appear here.",
  },
  {
    title: "Executive Summary",
    placeholder:
      "Three stakeholder-ready summary bullets will appear here.",
  },
  {
    title: "Recommended Agenda",
    placeholder: "A recommended agenda for the next sync will appear here.",
  },
];

function Report() {
  return (
    <div className="min-h-screen px-6 py-12">
      <div className="mx-auto w-full max-w-4xl">
        <Link
          to="/"
          className="text-sm font-medium text-blue-600 hover:underline"
        >
          ← Upload files
        </Link>

        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">
          Program Health Report
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          A static preview of the report layout. Live data will be wired up in
          later phases.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {sections.map((section) => (
            <section
              key={section.title}
              className="rounded-xl bg-white p-6"
              style={{
                border: "1px solid var(--border)",
                boxShadow: "var(--shadow)",
              }}
            >
              <h2 className="text-base font-semibold text-slate-900">
                {section.title}
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                {section.placeholder}
              </p>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Report;
