import { Router } from "express";
import * as ParticipantController from "../controllers/participant.controller";
import { catchAsync } from "../utils/catchAsync";
import { upload } from "../middleware/upload";

const router = Router();

router.post(
  "/onboarding",
  catchAsync(ParticipantController.upsertParticipant)
);

router.get(
  "/",
  catchAsync(ParticipantController.getAllParticipantsController)
);

export default router;
