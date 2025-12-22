import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  email: string;
  password: string;
  role: "PARTICIPANT" | "TRAINER" | "ADMIN";
  status: "PENDING" | "ACTIVE" | "BLOCKED" | "DELETED";
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true },
    password: { type: String, default: "" },
    role: { type: String, enum: ["PARTICIPANT", "TRAINER", "ADMIN"], required: true },
    status: { type: String, enum: ["PENDING", "ACTIVE", "BLOCKED", "DELETED"], default: "PENDING" },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>("User", UserSchema);
