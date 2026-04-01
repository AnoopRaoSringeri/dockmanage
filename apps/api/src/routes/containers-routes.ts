import { Router } from "express";
import { z } from "zod";
import {
  listContainers,
  restartContainer,
  startContainer,
  stopContainer,
  fetchContainerLogs,
} from "../services/containers-service.js";
import { sendError, sendSuccess } from "../utils/api-response.js";

const paramsSchema = z.object({
  id: z.string().min(1, "Container id is required"),
});

export const containersRouter = Router();

containersRouter.get("/", async (_req, res, next) => {
  try {
    const containers = await listContainers();
    return sendSuccess(res, containers);
  } catch (error) {
    return next(error);
  }
});

containersRouter.post("/:id/start", async (req, res, next) => {
  try {
    const parsed = paramsSchema.safeParse(req.params);
    if (!parsed.success) {
      return sendError(res, parsed.error.issues[0]?.message ?? "Invalid id", 400);
    }

    await startContainer(parsed.data.id);
    return sendSuccess(res, { message: "Container started" });
  } catch (error) {
    return next(error);
  }
});

containersRouter.post("/:id/stop", async (req, res, next) => {
  try {
    const parsed = paramsSchema.safeParse(req.params);
    if (!parsed.success) {
      return sendError(res, parsed.error.issues[0]?.message ?? "Invalid id", 400);
    }

    await stopContainer(parsed.data.id);
    return sendSuccess(res, { message: "Container stopped" });
  } catch (error) {
    return next(error);
  }
});

containersRouter.post("/:id/restart", async (req, res, next) => {
  try {
    const parsed = paramsSchema.safeParse(req.params);
    if (!parsed.success) {
      return sendError(res, parsed.error.issues[0]?.message ?? "Invalid id", 400);
    }

    await restartContainer(parsed.data.id);
    return sendSuccess(res, { message: "Container restarted" });
  } catch (error) {
    return next(error);
  }
});

containersRouter.get("/:id/logs", async (req, res, next) => {
  try {
    const parsed = paramsSchema.safeParse(req.params);
    if (!parsed.success) {
      return sendError(res, parsed.error.issues[0]?.message ?? "Invalid id", 400);
    }

    const logs = await fetchContainerLogs(parsed.data.id);
    return sendSuccess(res, logs);
  } catch (error) {
    return next(error);
  }
});
