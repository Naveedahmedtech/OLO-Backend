import { Request, Response } from "express";
import * as AuthService from "../services/auth.service";
import { success } from "../utils/response";
import { AppError, AuthError } from "../utils/errors";
import { AuthRequest } from "../middleware/auth";

export const setPassword = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new AppError("email and password are required", 400);
  }

  const result = await AuthService.setPasswordForUser(email, password);

  return success(res, result, "Password set successfully, login created");
};



export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new AppError("Email and password are required", 400);
  }

  const result = await AuthService.loginUser(email, password);

  // Cross-site auth cookie
  const cookieDomain = ".onrender.com"
  res.cookie("carelink_access_token", result.token, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
    ...(cookieDomain ? { domain: cookieDomain } : {}),
  });

  return success(res, result, "Login successful");
};


export const getMe = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new AuthError("Invalid token or missing token");
  }

  const user = await AuthService.getUserById(req.user.userId);
  return success(res, user, "User profile fetched successfully");
};


export const logout = async (req: Request, res: Response) => {

  // Clear auth cookie
  const cookieDomain = ".onrender.com"
  res.clearCookie("carelink_access_token", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
    ...(cookieDomain ? { domain: cookieDomain } : {}),
  });

  return success(res, {}, "Logged out successfully");
};

