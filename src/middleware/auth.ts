import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AppError } from "../utils/errors";

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key";
const DEBUG_AUTH = process.env.DEBUG_AUTH === "1";

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    role: "PARTICIPANT" | "TRAINER" | "ADMIN";
  };
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  let token: string | null = null;

  if (DEBUG_AUTH) {
    const cookieKeys = Object.keys(req.cookies || {});
    const origin = req.headers.origin || "n/a";
    const hasCookieHeader = Boolean(req.headers.cookie);
    const hasAuthHeader = Boolean(req.headers.authorization);
    const cookieKeyList = cookieKeys.length ? cookieKeys.join(",") : "none";
    console.log(
      `[auth] ${req.method} ${req.originalUrl} origin=${origin} hasCookieHeader=${hasCookieHeader} hasAuthHeader=${hasAuthHeader} cookieKeys=${cookieKeyList}`
    );
  }

  let headerToken: string | null = null;
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    const rawHeaderToken = req.headers.authorization.split(" ")[1];
    if (rawHeaderToken && rawHeaderToken !== "undefined" && rawHeaderToken !== "null") {
      headerToken = rawHeaderToken;
    }
  }

  const cookieToken = req.cookies?.carelink_access_token || req.cookies?.token || null;
  token = headerToken || cookieToken;

  if (DEBUG_AUTH) {
    const tokenSource = headerToken ? "header" : cookieToken ? "cookie" : "none";
    console.log(`[auth] tokenSource=${tokenSource}`);
  }

  if (!token) {
    throw new AppError("Not authorized, no token provided", 401);
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; role: string };
    req.user = { userId: decoded.userId, role: decoded.role as any };
    next();
  } catch (err) {
    if (headerToken && cookieToken && cookieToken !== headerToken) {
      try {
        const decoded = jwt.verify(cookieToken, JWT_SECRET) as { userId: string; role: string };
        req.user = { userId: decoded.userId, role: decoded.role as any };
        return next();
      } catch (cookieErr) {
        // fall through to 401
      }
    }
    throw new AppError("Not authorized, invalid token", 401);
  }
};

// Optional role-based authorization
export const authorize =
  (...roles: Array<"PARTICIPANT" | "TRAINER" | "ADMIN">) =>
  (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new AppError("Not authorized", 401);
    }
    if (!roles.includes(req.user.role)) {
      throw new AppError("Forbidden: insufficient permissions", 403);
    }
    next();
  };


