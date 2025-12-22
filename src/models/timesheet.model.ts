// models/timesheet.model.ts
import mongoose, { Schema, Document } from "mongoose";

export interface ITimesheetItem {
  shiftId: mongoose.Types.ObjectId;
  participantId: mongoose.Types.ObjectId;
  date: Date;
  service: string;
  hours: number;          // billable minutes / 60
  km?: number;            // mileage entered by trainer
  amountCents: number;    // labour
  mileageCents?: number;  // travel
  totalCents: number;     // labour + travel
}

export interface ITimesheet extends Document {
  trainerId: mongoose.Types.ObjectId;
  weekStart: Date;        // Monday 00:00 UTC
  weekEnd: Date;          // Sunday 23:59:59.999 UTC
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "PAID" | "REOPENED";
  items: ITimesheetItem[];
  totals: {
    hours: number;
    km: number;
    amountCents: number;
    mileageCents: number;
    totalCents: number;
  };
}

const TimesheetItemSchema = new Schema<ITimesheetItem>(
  {
    shiftId: { type: Schema.Types.ObjectId, ref: "Shift", required: true },
    participantId: { type: Schema.Types.ObjectId, ref: "Participant", required: true },
    date: { type: Date, required: true },
    service: { type: String, required: true },
    hours: { type: Number, required: true },
    km: { type: Number, default: 0 },
    amountCents: { type: Number, required: true },
    mileageCents: { type: Number, default: 0 },
    totalCents: { type: Number, required: true },
  },
  { _id: false }
);

const TimesheetSchema = new Schema<ITimesheet>(
  {
    trainerId: { type: Schema.Types.ObjectId, ref: "Trainer", required: true },
    weekStart: { type: Date, required: true },
    weekEnd: { type: Date, required: true },
    status: { type: String, enum: ["DRAFT","SUBMITTED","APPROVED","PAID","REOPENED"], default: "DRAFT" },
    items: { type: [TimesheetItemSchema], default: [] },
    totals: {
      hours: { type: Number, default: 0 },
      km: { type: Number, default: 0 },
      amountCents: { type: Number, default: 0 },
      mileageCents: { type: Number, default: 0 },
      totalCents: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

TimesheetSchema.index({ trainerId: 1, weekStart: 1 }, { unique: true });

export const Timesheet = mongoose.model<ITimesheet>("Timesheet", TimesheetSchema);
