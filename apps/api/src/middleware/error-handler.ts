import { NextFunction, Request, Response } from "express";
import { sendError } from "../utils/api-response.js";

export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  console.error(err);

  if (err instanceof Error) {
    return sendError(res, err.message, 500);
  }

  return sendError(res, "Unexpected server error", 500);
};
