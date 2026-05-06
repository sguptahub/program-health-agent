import type { VercelRequest, VercelResponse } from "@vercel/node";
import busboy from "busboy";
import { runIngest } from "../artifacts/api-server/src/lib/runIngest";
import { runAnalysis } from "../artifacts/api-server/src/lib/orchestrator";
import {
  getDelta,
  getLastEntry,
} from "../artifacts/api-server/src/lib/memory/memoryService";
import type {
  SignalBundle,
  UploadedDocx,
} from "../artifacts/api-server/src/lib/types";

export const config = {
  api: {
    bodyParser: false,
  },
};

interface ParsedFile {
  fieldname: string;
  filename: string;
  mimetype: string;
  buffer: Buffer;
}

function parseMultipart(req: VercelRequest): Promise<ParsedFile[]> {
  return new Promise((resolve, reject) => {
    const headers = req.headers;
    let bb: ReturnType<typeof busboy>;
    try {
      bb = busboy({ headers });
    } catch (err) {
      reject(err);
      return;
    }

    const files: ParsedFile[] = [];

    bb.on("file", (fieldname: string, fileStream: NodeJS.ReadableStream & { on: (event: string, listener: (...args: unknown[]) => void) => unknown }, info: { filename?: string; mimeType?: string }) => {
      const chunks: Buffer[] = [];
      fileStream.on("data", (chunk: unknown) => {
        chunks.push(chunk as Buffer);
      });
      fileStream.on("end", () => {
        files.push({
          fieldname,
          filename: info.filename ?? "",
          mimetype: info.mimeType ?? "application/octet-stream",
          buffer: Buffer.concat(chunks),
        });
      });
      fileStream.on("error", (err: unknown) => reject(err));
    });

    bb.on("close", () => resolve(files));
    bb.on("error", (err: Error) => reject(err));

    req.pipe(bb);
  });
}

function readJsonBody(req: VercelRequest): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      try {
        const body = Buffer.concat(chunks).toString("utf8");
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", (err: Error) => reject(err));
  });
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const isSignalBundle = (v: unknown): v is SignalBundle => {
  if (!isObj(v)) return false;
  return (
    typeof v.run_id === "string" &&
    typeof v.timestamp === "string" &&
    Array.isArray(v.workstreams) &&
    isObj(v.artifact_flags) &&
    typeof v.confidence === "string"
  );
};

const getExtension = (filename: string): string => {
  const idx = filename.lastIndexOf(".");
  return idx === -1 ? "" : filename.slice(idx).toLowerCase();
};

function normalizePath(url: string | undefined): string {
  const path = (url ?? "").split("?")[0] ?? "";
  return path.replace(/\/+$/, "") || "/";
}

function logError(label: string, err: unknown): void {
  if (err instanceof Error) {
    console.error(`[${label}] ${err.message}`);
    if (err.stack) console.error(err.stack);
  } else {
    console.error(`[${label}]`, err);
  }
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  const path = normalizePath(req.url);
  console.log(`[api] ${req.method} ${path}`);

  if (
    req.method === "GET" &&
    (path === "/api/health" || path === "/api/healthz" || path === "/api")
  ) {
    res.status(200).json({ status: "ok", phase: 4 });
    return;
  }

  if (req.method === "GET" && path === "/api/memory") {
    const entry = getLastEntry();
    if (!entry) {
      res.status(200).json({ entry: null });
      return;
    }
    res.status(200).json(entry);
    return;
  }

  if (req.method === "POST" && path === "/api/ingest") {
    try {
      console.log("[ingest] parsing multipart");
      const files = await parseMultipart(req);
      console.log(`[ingest] received ${files.length} file(s):`, files.map((f) => `${f.filename} (${f.buffer.length} bytes)`).join(", "));

      if (files.length === 0) {
        res.status(400).json({ error: "Please select at least one file" });
        return;
      }

      const xlsxFiles = files.filter(
        (f) => getExtension(f.filename) === ".xlsx",
      );
      const docxFiles = files.filter(
        (f) => getExtension(f.filename) === ".docx",
      );

      if (xlsxFiles.length > 1) {
        res.status(400).json({ error: "Please upload only one Excel status file" });
        return;
      }

      if (xlsxFiles.length === 0 && docxFiles.length === 0) {
        res.status(400).json({ error: "Only .xlsx and .docx files are supported" });
        return;
      }

      const excelFile = xlsxFiles[0]
        ? { buffer: xlsxFiles[0].buffer, filename: xlsxFiles[0].filename }
        : null;

      const docxPayload: UploadedDocx[] = docxFiles.map((f) => ({
        buffer: f.buffer,
        filename: f.filename,
      }));

      console.log("[ingest] running runIngest");
      const response = await runIngest({ excelFile, docxFiles: docxPayload });
      console.log("[ingest] success, workstreams:", (response.signal_bundle as { workstreams?: unknown[] }).workstreams?.length ?? 0);

      res.status(200).json(response);
    } catch (err) {
      logError("ingest", err);
      const message = err instanceof Error ? err.message : "Failed to process files";
      res.status(500).json({ error: message });
    }
    return;
  }

  if (req.method === "POST" && path === "/api/analyze") {
    try {
      console.log("[analyze] reading body");
      const body = await readJsonBody(req);
      const bundle = isObj(body) ? body.signal_bundle : undefined;
      if (!isSignalBundle(bundle)) {
        res.status(400).json({
          error: "Request body must include a valid signal_bundle object",
        });
        return;
      }
      console.log("[analyze] running analysis, workstreams:", bundle.workstreams.length);
      const priorEntry = getLastEntry();
      const deltas = getDelta(bundle, priorEntry);
      const result = await runAnalysis(bundle, deltas);
      console.log("[analyze] done, errors:", (result as { errors?: unknown[] }).errors?.length ?? 0);
      res.status(200).json(result);
    } catch (err) {
      logError("analyze", err);
      const message = err instanceof Error ? err.message : "Failed to run analysis";
      res.status(500).json({ error: message });
    }
    return;
  }

  res.status(404).json({ error: "Not found", path });
}
