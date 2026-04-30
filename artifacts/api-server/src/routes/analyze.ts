import { Router, type IRouter, type Request, type Response } from "express";
import express from "express";
import { runAnalysis } from "../lib/orchestrator";
import { getDelta, getLastEntry } from "../lib/memory/memoryService";
import type { SignalBundle } from "../lib/types";

const router: IRouter = Router();

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

router.post(
  "/analyze",
  express.json({ limit: "5mb" }),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const body = req.body as Record<string, unknown> | undefined;
      const bundle = body?.signal_bundle;
      if (!isSignalBundle(bundle)) {
        res.status(400).json({
          error: "Request body must include a valid signal_bundle object",
        });
        return;
      }

      const priorEntry = getLastEntry();
      const deltas = getDelta(bundle, priorEntry);

      const result = await runAnalysis(bundle, deltas);
      res.json(result);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to run analysis";
      res.status(500).json({ error: message });
    }
  },
);

export default router;
