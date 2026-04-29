import { Router, type IRouter } from "express";
import { getLastEntry } from "../lib/memory/memoryService";

const router: IRouter = Router();

router.get("/memory", (_req, res) => {
  const entry = getLastEntry();
  if (!entry) {
    res.json({ entry: null });
    return;
  }
  res.json(entry);
});

export default router;
