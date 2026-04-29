import { Router, type IRouter } from "express";
import healthRouter from "./health";
import ingestRouter from "./ingest";
import memoryRouter from "./memory";

const router: IRouter = Router();

router.use(healthRouter);
router.use(ingestRouter);
router.use(memoryRouter);

export default router;
