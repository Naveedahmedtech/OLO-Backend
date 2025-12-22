import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/errors";

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  // You can add winston/pino logger here
  console.error(`[ERROR] ${err.message}`, err);

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: err.errors || null,
    });
  }

  return res.status(500).json({
    success: false,
    message: "Internal Server Error",
  });
}
