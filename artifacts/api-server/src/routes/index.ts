import { Router, type IRouter } from "express";
import healthRouter from "./health";
import ingestRouter from "./ingest";
import memoryRouter from "./memory";
import analyzeRouter from "./analyze";

const router: IRouter = Router();

router.use(healthRouter);
router.use(ingestRouter);
router.use(memoryRouter);
router.use(analyzeRouter);

export default router;
