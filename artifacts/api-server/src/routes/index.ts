import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import usersRouter from "./users.js";
import messagesRouter from "./messages.js";
import reportsRouter from "./reports.js";
import reviewQueueRouter from "./review-queue.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/users", usersRouter);
router.use("/messages", messagesRouter);
router.use("/messages", reportsRouter);
router.use("/review-queue", reviewQueueRouter);

export default router;
