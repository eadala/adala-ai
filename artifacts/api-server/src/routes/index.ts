import { Router, type IRouter } from "express";
import healthRouter from "./health";
import casesRouter from "./cases";
import documentsRouter from "./documents";
import aiTasksRouter from "./aiTasks";
import usersRouter from "./users";
import messagesRouter from "./messages";
import billingRouter from "./billing";
import dashboardRouter from "./dashboard";
import aiChatRouter from "./aiChat";
import rbacRouter from "./rbac";
import opponentSimulatorRouter from "./opponentSimulator";

const router: IRouter = Router();

router.use(healthRouter);
router.use(casesRouter);
router.use(documentsRouter);
router.use(aiTasksRouter);
router.use(usersRouter);
router.use(messagesRouter);
router.use(billingRouter);
router.use(dashboardRouter);
router.use(aiChatRouter);
router.use(rbacRouter);
router.use(opponentSimulatorRouter);

export default router;
