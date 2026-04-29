import { Router, type IRouter } from "express";
import healthRouter from "./health";
import ingestRouter from "./ingest";

const router: IRouter = Router();

router.use(healthRouter);
router.use(ingestRouter);

export default router;
