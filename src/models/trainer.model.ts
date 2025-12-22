import mongoose, { Schema, Document } from "mongoose";

export interface ITrainer extends Document {
  userId: mongoose.Types.ObjectId;
  fullName?: string;
  phone?: string;
  address?: string;
  availability?: Record<string, string[]>;
  travelAreas: string[];
  specialisations: string[];
  documents?: Record<string, any>;
  agreement?: {
    version: string;
    effectiveDate: Date;
    tos: boolean;
    privacy: boolean;
    consent: boolean;
    signature: {
      dataUrl: string | null;
      date: Date;
    };
    pdfUrl?: string;
  };
  onboardingStep: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

const TrainerSchema = new Schema<ITrainer>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    fullName: String,
    phone: String,
    address: String,
    availability: Object,
    travelAreas: [String],
    specialisations: [String],
    documents: Object,
    agreement: {
      version: String,
      effectiveDate: Date,
      tos: { type: Boolean, default: false },
      privacy: { type: Boolean, default: false },
      consent: { type: Boolean, default: false },
      signature: {
        dataUrl: String,
        date: Date,
      },
      pdfUrl: String,
    },
    onboardingStep: { type: Number, default: 0 },
    status: { type: String, default: "pending" },
  },
  { timestamps: true }
);

export const Trainer = mongoose.model<ITrainer>("Trainer", TrainerSchema);
