import { Router } from "express";
import * as AuthController from "../controllers/auth.controller";
import { catchAsync } from "../utils/catchAsync";
import { upload } from "../middleware/upload";
import { authenticate } from "../middleware/auth";

const router = Router();

router.post(
  "/set-password",
  catchAsync(AuthController.setPassword)
);

router.post(
  "/login",
  catchAsync(AuthController.login)
);

router.get("/me", authenticate, AuthController.getMe);
router.post("/logout", authenticate, AuthController.logout);

export default router;
