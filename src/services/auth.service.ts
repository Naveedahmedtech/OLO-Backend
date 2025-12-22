import bcrypt from "bcryptjs";
import { AppError, AuthError, NotFoundError } from "../utils/errors";
import { User } from "../models/user.model";
import jwt from "jsonwebtoken";
import { IParticipant, Participant } from "../models/participant.model";
import { ITrainer, Trainer } from "../models/trainer.model";



export const setPasswordForUser = async (email: string, password: string) => {

  const user = await User.findOne({ email });
  if (!user) throw new NotFoundError("User");

  // Hash password
  const salt = await bcrypt.genSalt(10);
  user.password = await bcrypt.hash(password, salt);

  // Activate account if still pending
  if (user.status === "PENDING") {
    user.status = "ACTIVE";
  }

  await user.save();

  return {
    id: user._id,
    email: user.email,
    role: user.role,
    status: user.status,
  };
};




const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key";
const JWT_EXPIRES_IN = "7d"; // adjust as needed

export const loginUser = async (email: string, password: string) => {
  const user = await User.findOne({ email });
  if (!user) throw new NotFoundError("User", "Invalid email or password!");

  if (!user.password) {
    throw new AppError("Your account is under verification process, you'll be notify soon by admin", 400);
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new AuthError("Invalid email or password!");
  }

  switch (user.status) {
    case "ACTIVE":
      // allow login
      break;
    case "PENDING":
      throw new AppError("Account is pending activation. Please complete setup.", 403);
    case "BLOCKED":
      throw new AppError("Account has been blocked. Contact support.", 403);
    case "DELETED":
      throw new AppError("Account has been deleted.", 403);
    default:
      throw new AppError("Account status invalid. Contact support.", 403);
  }

  const token = jwt.sign(
    { userId: user._id, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  return {
    token,
    user: {
      id: user._id,
      email: user.email,
      role: user.role,
      status: user.status,
    },
  };
};




export const getUserById = async (userId: string) => {
  const user = await User.findById(userId).select(
    "_id email role status createdAt updatedAt"
  );

  if (!user) throw new NotFoundError("User");

  let name: string | null = null;
  let trainer: (ITrainer & { _id: any }) | null = null;
  let participant: (IParticipant & { _id: any }) | null = null;

  // Role-specific fetch (full details)
  if (user.role === "TRAINER") {
    trainer = await Trainer.findOne({ userId: user._id }).lean(); // full doc
    if (trainer) {
      name = trainer.fullName || user.email || null;
    } else {
      name = user.email || null;
    }
  } else if (user.role === "PARTICIPANT") {
    participant = await Participant.findOne({ userId: user._id }).lean(); // full doc
    if (participant) {
      name = participant.fullName || user.email || null;
    } else {
      name = user.email || null;
    }
  } else {
    // other roles (admin, etc.) keep existing behavior: only user + name=fallback
    name = user.email || null;
  }

  return {
    ...user.toObject(), // preserves existing shape
    name,
    // new optional role-specific payloads (non-breaking additions)
    trainer: user.role === "TRAINER" ? trainer : undefined,
    participant: user.role === "PARTICIPANT" ? participant : undefined,
  };
};
