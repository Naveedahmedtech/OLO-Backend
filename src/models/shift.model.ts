import mongoose, { Schema, Document, Types } from "mongoose";

/**
 * A Shift represents the *actual work session*
 * that occurs after a ShiftRequest is approved and assigned.
 */
export interface IShift extends Document {
  shiftRequestId: Types.ObjectId; // link to ShiftRequest
  participantId: Types.ObjectId;  // User _id of participant
  trainerId: Types.ObjectId;      // Trainer _id (from Trainer collection)
  service: string;

  scheduledStart: Date;           // from ShiftRequest.start
  scheduledEnd: Date;             // from ShiftRequest.end
  scheduledDurationMinutes: number;

  actualClockIn: Date;            // when trainer clocked in
  plannedClockOut: Date;          // actualClockIn + scheduledDuration
  actualClockOut?: Date | null;   // trainer or cron completion

  status: "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

  // Optional trainer report (submitted at clock-out)
  report?: {
    activities?: string;
    progress?: string;
    incidents?: string;
    km?: number;
  };

  createdAt: Date;
  updatedAt: Date;
}

const ShiftSchema = new Schema<IShift>(
  {
    shiftRequestId: {
      type: Schema.Types.ObjectId,
      ref: "ShiftRequest",
      required: true,
      index: true,
    },
    participantId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    trainerId: {
      type: Schema.Types.ObjectId,
      ref: "Trainer",
      required: true,
      index: true,
    },
    service: { type: String, required: true },

    scheduledStart: { type: Date, required: true },
    scheduledEnd: { type: Date, required: true },
    scheduledDurationMinutes: { type: Number, required: true },

    actualClockIn: { type: Date, required: true },
    plannedClockOut: { type: Date, required: true },
    actualClockOut: { type: Date, default: null },

    status: {
      type: String,
      enum: ["IN_PROGRESS", "COMPLETED", "CANCELLED"],
      default: "IN_PROGRESS",
      index: true,
    },

    report: {
      activities: { type: String, trim: true },
      progress: { type: String, trim: true },
      incidents: { type: String, trim: true },
      km: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

/** Useful compound indexes for cron + analytics */
ShiftSchema.index({ status: 1, plannedClockOut: 1 });
ShiftSchema.index({ trainerId: 1, status: 1 });
ShiftSchema.index({ participantId: 1, status: 1 });

export const Shift = mongoose.model<IShift>("Shift", ShiftSchema);
