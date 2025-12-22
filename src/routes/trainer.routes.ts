import { Router } from "express";
import * as TrainerController from "../controllers/trainer.controller";
import { catchAsync } from "../utils/catchAsync";
import { upload } from "../middleware/upload";

const router = Router();

router.post(
  "/onboarding",
  upload.fields([
    { name: "ndisCheck", maxCount: 1 },
    { name: "wwcc", maxCount: 1 },
    { name: "licence", maxCount: 1 },
    { name: "firstAid", maxCount: 1 },
    { name: "cpr", maxCount: 1 },
    { name: "qualification", maxCount: 1 },
  ]),
  catchAsync(TrainerController.upsertTrainer)
);
router.get("/me", catchAsync(TrainerController.getTrainer));
router.get("/", catchAsync(TrainerController.getAllTrainers));
router.patch("/:id/status", catchAsync(TrainerController.updateTrainerStatus));

export default router;
