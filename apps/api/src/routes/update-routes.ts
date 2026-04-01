import { Router } from "express";
import { sendError, sendSuccess } from "../utils/api-response.js";
import { getLatestRelease, updateDockManage } from "../services/update-service.js";

export const updateRouter = Router();

updateRouter.get("/check", async (_req, res, next) => {
  try {
    const status = await getLatestRelease();
    return sendSuccess(res, status);
  } catch (error) {
    return next(error);
  }
});

updateRouter.post("/perform", async (_req, res, next) => {
  try {
    const result = await updateDockManage();
    return sendSuccess(res, result);
  } catch (error) {
    return next(error);
  }
});
