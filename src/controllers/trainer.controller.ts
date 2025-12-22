import path from "path";
import { Response } from "express";
import {
  trainerStep1Schema,
  trainerStep2Schema,
  trainerStep3Schema,
  trainerStep4Schema,
  trainerStep5Schema, // 🔹 import
} from "../validators/trainer.validators";
import * as TrainerService from "../services/trainer.service";
import { ValidationError, AppError } from "../utils/errors";
import { success } from "../utils/response";

// config
const MAX_SIZE_MB = 10;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "application/pdf"];

import { z } from "zod";

export const upsertTrainer = async (req: any, res: Response) => {
  // ✅ Validate uploaded docs if present
  if (req.files && Object.keys(req.files).length > 0) {
    req.body.documents = {};

    for (const [key, files] of Object.entries(req.files)) {
      const file = (files as Express.Multer.File[])[0];

      if (!ACCEPTED_TYPES.includes(file.mimetype)) {
        throw new AppError(
          `Invalid file type for ${key}. Only JPG, PNG, PDF allowed.`,
          400
        );
      }

      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        throw new AppError(
          `File too large for ${key}. Max ${MAX_SIZE_MB} MB allowed.`,
          400
        );
      }

      req.body.documents[key] = {
        filePath: `/uploads/documents/${file.filename}`,
        originalName: file.originalname,
        expiry: req.body[`${key}Expiry`] || null,
      };
    }
  }

  // 🔹 Parse JSON fields if they come as strings from FormData
  try {
    if (req.body.availability && typeof req.body.availability === "string") {
      req.body.availability = JSON.parse(req.body.availability);
    }
    if (req.body.travelAreas && typeof req.body.travelAreas === "string") {
      req.body.travelAreas = JSON.parse(req.body.travelAreas);
    }
    if (req.body.specialisations && typeof req.body.specialisations === "string") {
      req.body.specialisations = JSON.parse(req.body.specialisations);
    }
    if (req.body.agreement && typeof req.body.agreement === "string") {
      req.body.agreement = JSON.parse(req.body.agreement);
    }
  } catch {
    throw new AppError("Invalid JSON format in payload", 400);
  }

  const isSignupCompleted =
    typeof req.body.signup === "string" &&
    req.body.signup.toLowerCase() === "completed";

  // ✅ If signup is completed, skip step-number requirement and step schema
  let payload: any;

  if (isSignupCompleted) {
    // Keep it simple & safe: only allow the editable fields you expect from the profile page.
    // (No need to change your existing step schemas.)
    const patch = {
      fullName: req.body.fullName,
      address: req.body.address,
      travelAreas: req.body.travelAreas,
      specialisations: req.body.specialisations,
      availability: req.body.availability,
      documents: req.body.documents, // allow doc uploads from profile
      signup: "completed",
    };

    // Optional tiny validation without touching your step schemas:
    // (all optional; you can remove this if you truly want zero extra validation)
    const Slot = z.object({ start: z.string().min(1), end: z.string().min(1) });
    const PatchSchema = z.object({
      fullName: z.string().trim().min(1).optional(),
      address: z.string().trim().optional(),
      travelAreas: z.array(z.string().trim().min(1)).optional(),
      specialisations: z.array(z.string().trim().min(1)).optional(),
      availability: z.record(z.string(), z.array(Slot)).optional(),
      documents: z.record(z.any()).optional(),
      signup: z.literal("completed"),
    });

    const parsed = PatchSchema.safeParse(patch);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten());
    }

    payload = parsed.data;

    // Ensure we never write/advance step in this mode
    delete payload.step;
  } else {
    // 🔁 Normal wizard flow (keep your existing schemas exactly as-is)
    const step = Number(req.body.step);
    if (isNaN(step)) throw new AppError("Invalid step", 400);

    const schemaMap: Record<number, any> = {
      1: trainerStep1Schema,
      2: trainerStep2Schema,
      3: trainerStep3Schema,
      4: trainerStep4Schema,
      5: trainerStep5Schema,
    };

    const schema = schemaMap[step];
    if (!schema) throw new AppError("Invalid step", 400);

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten());
    }
    payload = parsed.data;
  }

  const result = await TrainerService.upsertTrainerProfile(
    req.user?.userId || req.body?.userId || null,
    payload,
    // Optional: pass a flag so service avoids bumping onboardingStep in "completed" mode
    // { ignoreStep: isSignupCompleted }
  );

  return success(
    res,
    result,
    isSignupCompleted ? "Trainer profile updated" : "Trainer onboarding updated"
  );
};


export const getTrainer = async (req: any, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  const trainer = await TrainerService.getTrainerByUserId(userId);
  return success(res, trainer, "Trainer profile fetched successfully");
};

export const getAllTrainers = async (
  req: Request,
  res: Response
) => {
  const { page, limit, q, email, status } = req.query;

  const result = await TrainerService.getAllTrainers({
    page: page ? parseInt(page, 10) : 1,
    limit: limit ? parseInt(limit, 10) : 10,
    q,
    email,
    status,
  });

  return success(res, result, "Trainers fetched successfully");
};



export const updateTrainerStatus = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;

  const user = await TrainerService.updateTrainerStatus(id, status);

  return success(res, user, "Trainer status updated successfully");
};
