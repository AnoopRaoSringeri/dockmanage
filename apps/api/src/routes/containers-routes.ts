import { Router } from "express";
import { z } from "zod";
import {
  listContainers,
  pruneStoppedContainers,
  pruneUnusedImages,
  restartContainer,
  startContainer,
  stopContainer,
  fetchContainerLogs,
  streamContainerLogs,
} from "../services/containers-service.js";
import { sendError, sendSuccess } from "../utils/api-response.js";

const paramsSchema = z.object({
  id: z.string().min(1, "Container id is required"),
});

export const containersRouter = Router();

containersRouter.post("/prune-images", async (_req, res, next) => {
  try {
    const result = await pruneUnusedImages();
    return sendSuccess(res, result);
  } catch (error) {
    return next(error);
  }
});

containersRouter.post("/prune-containers", async (_req, res, next) => {
  try {
    const result = await pruneStoppedContainers();
    return sendSuccess(res, result);
  } catch (error) {
    return next(error);
  }
});

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

    const streamMode = req.query.stream === "true";
    if (!streamMode) {
      const logs = await fetchContainerLogs(parsed.data.id);
      return sendSuccess(res, logs);
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();
    res.write(`:\n\n`);

    let finished = false;
    const sendEvent = (text: string) => {
      const payload = text.replace(/\r?\n/g, "\ndata: ");
      res.write(`data: ${payload}\n\n`);
    };

    const keepAlive = setInterval(() => {
      if (finished) {
        return;
      }
      res.write(`:\n\n`);
    }, 15000);

    const cleanup = () => {
      if (finished) {
        return;
      }
      finished = true;
      clearInterval(keepAlive);
      res.end();
    };

    req.on("close", cleanup);

    const stop = await streamContainerLogs(
      parsed.data.id,
      sendEvent,
      (error: unknown) => {
        if (!finished) {
          res.write(`event: error\ndata: ${JSON.stringify(String(error))}\n\n`);
        }
        cleanup();
      },
      cleanup,
      100,
    );

    req.on("close", stop);
  } catch (error) {
    return next(error);
  }
});
