import { ZodObject, ZodRawShape } from "zod";
import { Request, Response, NextFunction } from "express";
import { ValidationError } from "../utils/errors";

export const validate =
  (schema: ZodObject<ZodRawShape>) =>
  (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body);

    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten());
    }

    req.body = parsed.data; 
    next();
  };
