import { Router } from "express";
import { readConfigQuerySchema, saveConfigBodySchema } from "../schemas/config-files-schemas.js";
import { listConfigFiles, readConfigFile, saveConfigFile, deleteConfigFile } from "../services/config-files-service.js";
import { sendError, sendSuccess } from "../utils/api-response.js";
import { restartService } from "../services/containers-service.js";

export const configFilesRouter = Router();

configFilesRouter.get("/", async (_req, res, next) => {
  try {
    const files = await listConfigFiles();
    return sendSuccess(res, files);
  } catch (error) {
    return next(error);
  }
});

configFilesRouter.get("/content", async (req, res, next) => {
  try {
    const parsed = readConfigQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return sendError(res, parsed.error.issues[0]?.message ?? "Invalid request", 400);
    }

    const content = await readConfigFile(parsed.data.path);
    return sendSuccess(res, content);
  } catch (error) {
    return next(error);
  }
});

configFilesRouter.post("/content", async (req, res, next) => {
  try {
    const parsed = saveConfigBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, parsed.error.issues[0]?.message ?? "Invalid request", 400);
    }

    const saved = await saveConfigFile(parsed.data.path, parsed.data.content);
    await restartService(parsed.data.path);
    return sendSuccess(res, saved);
  } catch (error) {
    return next(error);
  }
});

configFilesRouter.delete("/content", async (req, res, next) => {
  try {
    const parsed = readConfigQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return sendError(res, parsed.error.issues[0]?.message ?? "Invalid request", 400);
    }

    await deleteConfigFile(parsed.data.path);
    return sendSuccess(res, { message: "Config deleted" });
  } catch (error) {
    return next(error);
  }
});
