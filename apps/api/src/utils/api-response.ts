import { ApiErrorResponse, ApiSuccessResponse } from "@dockmanage/types";
import { Response } from "express";

export const sendSuccess = <T>(res: Response, data: T, statusCode = 200) => {
  const payload: ApiSuccessResponse<T> = {
    success: true,
    data,
  };

  return res.status(statusCode).json(payload);
};

export const sendError = (res: Response, error: string, statusCode = 400) => {
  const payload: ApiErrorResponse = {
    success: false,
    error,
  };

  return res.status(statusCode).json(payload);
};
