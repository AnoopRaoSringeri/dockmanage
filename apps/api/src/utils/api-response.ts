import { ApiErrorResponse, ApiSuccessResponse } from "@dockmanage/types";
import { Response } from "express";

export class ApiError extends Error {
  public statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

export const sendSuccess = <T>(res: Response, data: T, statusCode = 200) => {
  const payload: ApiSuccessResponse<T> = {
    success: true,
    data,
  };

  return res.status(statusCode).json(payload);
};

export const sendError = (
  res: Response,
  error: string | Error | ApiError,
  statusCode?: number,
) => {
  const message = error instanceof Error ? error.message : String(error);
  const status = typeof statusCode === "number" ? statusCode : error instanceof ApiError ? error.statusCode : 400;

  const payload: ApiErrorResponse = {
    success: false,
    error: message || "Unknown error occurred",
  };

  return res.status(status).json(payload);
};
