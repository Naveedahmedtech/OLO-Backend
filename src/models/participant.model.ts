import mongoose, { Schema, Document } from "mongoose";

export interface IParticipant extends Document {
  userId: mongoose.Types.ObjectId;

  // Step 1: Registration fields
  fullName: string;
  ndisNumber: string;
  dob: Date;
  address: string;
  email: string;
  phone: string;
  guardianName?: string;
  guardianPhone?: string;
  guardianEmail?: string;
  interests: string[];
  availability: Record<string, string[]>; // e.g., { Mon: ["9am–12pm"] }
  planManagerName?: string;
  planManagerEmail?: string;
  fundingType: "plan" | "self" | "ndia";
  isMinor: boolean;

  // Step 2: Agreement fields
  agreement: {
    version: string;
    effectiveDate: Date;
    acknowledged: {
      tos: boolean;
      privacy: boolean;
      consent: boolean;
    };
    signature: {
      dataUrl: string; // base64 png/svg of signature
      date: Date;
    };
    pdfUrl?: string; // signed PDF file storage path
  };

  status: "PENDING" | "ACTIVE" | "BLOCKED" | "DELETED";
  createdAt: Date;
  updatedAt: Date;
}

const ParticipantSchema = new Schema<IParticipant>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },

    fullName: { type: String, required: true },
    ndisNumber: { type: String, required: true },
    dob: { type: Date, required: true },
    address: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    guardianName: String,
    guardianPhone: String,
    guardianEmail: String,
    interests: [String],
    availability: { type: Object, default: {} },
    planManagerName: String,
    planManagerEmail: String,
    fundingType: { type: String, enum: ["plan", "self", "ndia"], required: true },
    isMinor: { type: Boolean, default: false },

    agreement: {
      version: String,
      effectiveDate: Date,
      acknowledged: {
        tos: { type: Boolean, default: false },
        privacy: { type: Boolean, default: false },
        consent: { type: Boolean, default: false },
      },
      signature: {
        dataUrl: String,
        date: Date,
      },
      pdfUrl: String,
    },

    status: {
      type: String,
      enum: ["PENDING", "ACTIVE", "BLOCKED", "DELETED"],
      default: "PENDING",
    },
  },
  { timestamps: true }
);

export const Participant = mongoose.model<IParticipant>("Participant", ParticipantSchema);
