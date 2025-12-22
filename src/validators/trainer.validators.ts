import { z } from "zod";

/**
 * Step 1: Identity
 */
export const trainerStep1Schema = z
  .object({
    step: z.union([z.literal(1), z.literal("1")]).transform(Number),
    fullName: z.string().min(2, "Full name is required"),
    email: z.string().email("Invalid email address"),
    phone: z
      .string()
      .regex(/^0\d{9}$/, "Must be a valid AU mobile (e.g. 04XXXXXXXX)"),
    address: z.string().optional(),
  })
  .passthrough();

/**
 * Step 2: Availability + Travel
 */
const timeRangeSchema = z.object({
  start: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format"),
  end: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format"),
});

export const trainerStep2Schema = z
  .object({
    step: z.union([z.literal(2), z.literal("2")]).transform(Number),

    availability: z
      .record(z.string(), z.array(timeRangeSchema))
      .refine((v) => Object.values(v).some((slots) => slots.length > 0), {
        message: "At least one availability slot required",
      }),
    travelAreas: z.array(z.string()).min(1, "At least one area required"),
  })
  .passthrough();

/**
 * Step 3: Specialisations
 */
export const trainerStep3Schema = z
  .object({
    step: z.union([z.literal(3), z.literal("3")]).transform(Number),
    specialisations: z.array(z.string()).min(1, "Pick at least one"),
  })
  .passthrough();

/**
 * Step 4: Documents
 */
export const trainerStep4Schema = z
  .object({
    step: z.union([z.literal(4), z.literal("4")]).transform(Number),
  })
  .passthrough();

/**
 * Step 5: Employment Agreement
 */
export const trainerStep5Schema = z.object({
  step: z.union([z.literal(5), z.literal("5")]).transform(Number),
  agreement: z.object({
    version: z.string().optional(),
    effectiveDate: z.coerce.date().optional(),
    tos: z.boolean(),
    privacy: z.boolean(),
    consent: z.boolean(),
    signature: z.object({
      dataUrl: z.string().optional(), // allow missing if service rewrites
      url: z.string().optional(), // allow persisted file path
      date: z.coerce.date(),
    }),
    pdfUrl: z.string().optional(),
  }),
}).passthrough();

/**
 * Union of all steps
 */
export const trainerOnboardingSchema = z.discriminatedUnion("step", [
  trainerStep1Schema,
  trainerStep2Schema,
  trainerStep3Schema,
  trainerStep4Schema,
  trainerStep5Schema, // 🔹 added
]);

// Types
export type TrainerStep1Input = z.infer<typeof trainerStep1Schema>;
export type TrainerStep2Input = z.infer<typeof trainerStep2Schema>;
export type TrainerStep3Input = z.infer<typeof trainerStep3Schema>;
export type TrainerStep4Input = z.infer<typeof trainerStep4Schema>;
export type TrainerStep5Input = z.infer<typeof trainerStep5Schema>;
export type TrainerOnboardingInput = z.infer<typeof trainerOnboardingSchema>;
