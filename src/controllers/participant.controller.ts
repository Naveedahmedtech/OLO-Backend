import { Response } from "express";
import * as ParticipantService from "../services/participant.service";
import { AppError, ValidationError } from "../utils/errors";
import { success } from "../utils/response";

// NOTE: Add Zod/Yup validators for step-specific payloads later
// For now, just accept body and trust frontend schema

export const upsertParticipant = async (req: any, res: Response) => {

  // 🔹 Ensure step is numeric if included
  let step = Number(req.body.step || 1);
  if (isNaN(step)) step = 1;


  // TODO: add schema validation like trainer.validators.ts
  // const schema = participantStepSchemas[step];
  // const parsed = schema.safeParse(req.body);
  // if (!parsed.success) throw new ValidationError(parsed.error.flatten());

  const result = await ParticipantService.upsertParticipantProfile(
    req.user?.userId || req.body?.userId || null,
    req.body // replace with parsed.data once schema is ready
  );

  return success(res, result, "Participant onboarding updated");
};

export const getParticipant = async (req: any, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  const participant = await ParticipantService.getParticipantByUserId(userId);
  return success(res, participant, "Participant profile fetched successfully");
};



export const getAllParticipantsController = async (
  req: Request,
  res: Response
) => {
  const { page, limit, q, email, status } = req.query;

  const result = await ParticipantService.getAllParticipants({
    page: page ? parseInt(page, 10) : 1,
    limit: limit ? parseInt(limit, 10) : 10,
    q,
    email,
    status,
  });

  return success(res, result, "Trainers fetched successfully");
};
