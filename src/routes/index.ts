import { Router } from "express";
import trainerRoutes from "./trainer.routes";
import participantRoutes from "./participant.route";
import authRoutes from "./auth.route";
import shiftsRoutes from "./shiftRequest.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/trainer", trainerRoutes);
router.use("/participant", participantRoutes);
router.use("/shifts", shiftsRoutes);

export default router;
