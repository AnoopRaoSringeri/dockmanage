import { NextFunction, Request, Response } from "express";
import { ApiError, sendError } from "../utils/api-response.js";

export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  console.error(err);

  if (err instanceof ApiError) {
    return sendError(res, err);
  }

  if (err instanceof Error) {
    return sendError(res, err.message || "Unexpected server error", 500);
  }

  if (typeof err === "string") {
    return sendError(res, err, 500);
  }

  if (typeof err === "object" && err !== null && "message" in err && typeof (err as any).message === "string") {
    return sendError(res, (err as any).message, 500);
  }

  return sendError(res, "Unexpected server error", 500);
};
