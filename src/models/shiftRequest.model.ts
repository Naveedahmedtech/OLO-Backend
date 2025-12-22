import mongoose, { Schema, Document } from "mongoose";

/**
 * ShiftRequest
 * Represents a participant’s request for a shift before it becomes an actual Shift.
 * After admin approval and trainer clock-in, it can transition into an IN_PROGRESS or COMPLETED state.
 */
export type ShiftRequestStatus =
  | "PENDING_ADMIN"  // newly submitted by participant
  | "APPROVED"       // admin approved → ready to start
  | "DECLINED"       // admin declined
  | "CANCELLED"      // participant/admin cancelled
  | "IN_PROGRESS"    // trainer clocked in
  | "COMPLETED";     // trainer/cron clocked out

export interface IShiftRequest extends Document {
  participantId: mongoose.Types.ObjectId; // ✅ user _id from Users collection
  requestedBy: mongoose.Types.ObjectId;   // userId of participant or guardian
  service: string;                        // program/service
  start: Date;
  end: Date;
  notes?: string;

  preferredTrainerIds?: mongoose.Types.ObjectId[];
  status: ShiftRequestStatus;

  assignedTrainerId?: mongoose.Types.ObjectId | null; // linked Trainer
  linkedShiftId?: mongoose.Types.ObjectId | null;     // created after approval
  adminComment?: string | null;

  createdAt: Date;
  updatedAt: Date;
}

const ShiftRequestSchema = new Schema<IShiftRequest>(
  {
    participantId: {
      type: Schema.Types.ObjectId,
      ref: "User",               // ✅ directly references User table
      required: true,
      index: true,
    },
    requestedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    service: { type: String, required: true, index: true },
    start: { type: Date, required: true, index: true },
    end: { type: Date, required: true },
    notes: { type: String, trim: true },

    preferredTrainerIds: [{ type: Schema.Types.ObjectId, ref: "Trainer" }],

    status: {
      type: String,
      enum: [
        "PENDING_ADMIN",
        "APPROVED",
        "DECLINED",
        "CANCELLED",
        "IN_PROGRESS",
        "COMPLETED",
      ],
      default: "PENDING_ADMIN",
      index: true,
    },

    assignedTrainerId: {
      type: Schema.Types.ObjectId,
      ref: "Trainer",
      default: null,
    },

    linkedShiftId: {
      type: Schema.Types.ObjectId,
      ref: "Shift",
      default: null,
    },

    adminComment: { type: String, trim: true, default: null },
  },
  { timestamps: true }
);

/**
 * Indexes
 */
ShiftRequestSchema.index({ participantId: 1, start: 1, end: 1 });
ShiftRequestSchema.index({ status: 1, start: 1 });
ShiftRequestSchema.index({ assignedTrainerId: 1, status: 1 });
ShiftRequestSchema.index({ linkedShiftId: 1 });

/**
 * Virtuals for cleaner API responses
 */
ShiftRequestSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
});

/**
 * Export model (safe reload for dev hot-modules)
 */
export const ShiftRequest =
  mongoose.models.ShiftRequest ||
  mongoose.model<IShiftRequest>("ShiftRequest", ShiftRequestSchema);
