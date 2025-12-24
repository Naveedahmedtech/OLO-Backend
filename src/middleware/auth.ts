import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AppError } from "../utils/errors";

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key";

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    role: "PARTICIPANT" | "TRAINER" | "ADMIN";
  };
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  let token: string | null = null;

  console.log("✅✅✅✅ COOKIES", req.cookies)

  // 🔹 Get token from Authorization header: "Bearer <token>"
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  }

  // 🔹 Or from cookie if you set cookie in login controller
  if (!token && req.cookies?.carelink_access_token) {
    token = req.cookies.carelink_access_token;
  }

  if (!token && req.cookies?.token) {
    token = req.cookies.token;
  }

  if (!token) {
    throw new AppError("Not authorized, no token provided", 401);
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; role: string };
    req.user = { userId: decoded.userId, role: decoded.role as any };
    next();
  } catch (err) {
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
