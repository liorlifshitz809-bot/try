import { Router, type IRouter } from "express";
import healthRouter from "./health";
import roomsRouter from "./rooms";
import sessionsRouter from "./sessions";
import authRouter from "./auth";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(roomsRouter);
router.use(sessionsRouter);
router.use(authRouter);
router.use(dashboardRouter);

export default router;
