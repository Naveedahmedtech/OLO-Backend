import { User } from "../models/user.model";
import { Participant } from "../models/participant.model";
import { NotFoundError } from "../utils/errors";
import fs from "fs";
import path from "path";

// helper to save signature PNG
const saveSignature = (userId: string, dataUrl: string) => {
  const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
  const buffer = Buffer.from(base64Data, "base64");

  const fileName = `${userId}-signature-${Date.now()}.png`;
  const dirPath = path.join(__dirname, "../../uploads/signatures");
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  const filePath = path.join(dirPath, fileName);

  fs.writeFileSync(filePath, buffer);

  // return relative path for client
  return `/uploads/signatures/${fileName}`;
};

// Create or update participant profile
export const upsertParticipantProfile = async (
  userId: string | null,
  data: any
) => {
  if (!userId) {
    // If no userId, try to find by email
    if (!data.email) {
      throw new Error("Email is required for onboarding without userId");
    }

    const existingUser = await User.findOne({ email: data.email });

    if (!existingUser) {
      // Step 1 — create new user + participant
      const user = await User.create({
        email: data.email,
        password: "", // will be set at Step 3: Create Login
        role: "PARTICIPANT",
        status: "PENDING",
      });

      const participant = await Participant.create({
        userId: user._id,
        fullName: data.fullName,
        ndisNumber: data.ndisNumber,
        dob: data.dob,
        address: data.address,
        email: data.email,
        phone: data.phone,
        guardianName: data.guardianName,
        guardianPhone: data.guardianPhone,
        guardianEmail: data.guardianEmail,
        interests: data.interests || [],
        availability: data.availability || {},
        planManagerName: data.planManagerName,
        planManagerEmail: data.planManagerEmail,
        fundingType: data.fundingType,
        isMinor: data.isMinor || false,
        status: "PENDING",
      });

      return { user, participant };
    }

    // Step 2+ — update existing participant by email
    const participant = await Participant.findOne({ email: data.email });
    if (!participant) throw new NotFoundError("Participant");

    // handle signature
    if (data.agreement?.signature?.dataUrl) {
      const url = saveSignature(participant.userId.toString(), data.agreement.signature.dataUrl);
      data.agreement.signature = {
        url,
        date: data.agreement.signature.date,
      };
    }

    Object.assign(participant, data);
    await participant.save();

    const user = await User.findById(participant.userId).select(
      "id email role status"
    );

    return { user, participant };
  }

  // Step 2+ — update existing participant by userId
  const participant = await Participant.findOne({ userId });
  if (!participant) throw new NotFoundError("Participant");

  // handle signature
  if (data.agreement?.signature?.dataUrl) {
    const url = saveSignature(participant.userId.toString(), data.agreement.signature.dataUrl);
    data.agreement.signature = {
      url,
      date: data.agreement.signature.date,
    };
  }

  Object.assign(participant, data);
  await participant.save();

  const user = await User.findById(participant.userId).select(
    "id email role status"
  );

  return { user, participant };
};



// Get participant by userId
export const getParticipantByUserId = async (userId: string) => {
  const participant = await Participant.findOne({ userId }).populate(
    "userId",
    "id email role status"
  );

  if (!participant) {
    throw new NotFoundError("Participant");
  }

  return participant;
};


type QueryParams = {
  page?: number;
  limit?: number;
  q?: string;
  email?: string;
  status?: string; // applies to User.status (same as your trainers fn)
};

export const getAllParticipants = async (params: QueryParams) => {
  const { page = 1, limit = 10, q, email, status } = params;

  // Filter on the User document (role + optional status/email)
  const match: any = { role: "PARTICIPANT" };
  if (status) match.status = status;
  if (email) match.email = { $regex: email, $options: "i" };

  // Text search across User + Participant fields
  if (q) {
    match.$or = [
      { email: { $regex: q, $options: "i" } },                 // User.email
      { "participant.fullName": { $regex: q, $options: "i" } },
      { "participant.phone": { $regex: q, $options: "i" } },
      { "participant.address": { $regex: q, $options: "i" } },
      { "participant.ndisNumber": { $regex: q, $options: "i" } },
      { "participant.guardianName": { $regex: q, $options: "i" } },
      { "participant.guardianEmail": { $regex: q, $options: "i" } },
      { "participant.fundingType": { $regex: q, $options: "i" } },
      { "participant.interests": { $regex: q, $options: "i" } },
    ];
  }

  const skip = (page - 1) * limit;

  const pipeline: any[] = [
    { $match: match },
    {
      $lookup: {
        from: "participants",          // <-- model Participant => collection "participants"
        localField: "_id",
        foreignField: "userId",
        as: "participant",
      },
    },
    { $unwind: { path: "$participant", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 1,
        email: 1,
        role: 1,
        status: 1,                     // User.status
        createdAt: 1,
        participant: 1,                // include full participant object
      },
    },
    { $sort: { createdAt: -1 } },
    { $skip: skip },
    { $limit: limit },
  ];

  const [data, totalCount] = await Promise.all([
    User.aggregate(pipeline),
    User.countDocuments({ role: "PARTICIPANT", ...(status ? { status } : {}) }),
  ]);

  return {
    data,
    pagination: {
      page,
      limit,
      total: totalCount,
      totalPages: Math.ceil(totalCount / limit),
    },
  };
};
