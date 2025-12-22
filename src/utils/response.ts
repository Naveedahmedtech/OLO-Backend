import { Response } from "express";

export function success(res: Response, data?: any, message = "OK", status = 200) {
  return res.status(status).json({
    success: true,
    message,
    data,
  });
}

export function fail(res: Response, message = "Bad Request", errors?: any, status = 400) {
  return res.status(status).json({
    success: false,
    message,
    errors,
  });
}
