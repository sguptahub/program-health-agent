import { Router, type IRouter } from "express";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  res.json({ status: "ok", phase: 1 });
});

router.get("/health", (_req, res) => {
  res.json({ status: "ok", phase: 1 });
});

export default router;
