// services/timesheets.service.ts
import mongoose from "mongoose";
import { Timesheet } from "../models/timesheet.model";
import { AppError, NotFoundError } from "../utils/errors";
import { Trainer } from "../models/trainer.model";
import { Participant } from "../models/participant.model"; // ✅ add this
import { createPdfBuffer } from "../utils/pdf";
import { Parser } from "json2csv";
import { createCsvBuffer, TimesheetCsvPayload } from "../utils/csv";

const isObjectId = (id: string) => mongoose.isValidObjectId(id);

type ListArgs = {
  viewer: { id: string; role: "TRAINER" | "ADMIN" };
  status?: string;
  weekStart?: string;
  trainerId?: string; // may be Trainer._id OR User._id (admin only)
  page: number;
  pageSize: number;
};

export const listTimesheets = async ({
  viewer,
  status,
  weekStart,
  trainerId,
  page,
  pageSize,
}: ListArgs) => {
  const q: any = {};
  if (status) q.status = status;
  if (weekStart) q.weekStart = new Date(weekStart);

  // TRAINER: restrict to own trainer document
  if (viewer.role === "TRAINER") {
    const trainer = await Trainer.findOne({ userId: viewer.id }).select("_id");
    if (!trainer) throw new NotFoundError("User not found");
    q.trainerId = trainer._id;
  }

  // ADMIN: optional filter by trainerId (accepts Trainer._id OR User._id)
  if (viewer.role === "ADMIN" && trainerId && isObjectId(trainerId)) {
    // Try direct Trainer._id first
    let trainerDoc = await Trainer.findById(trainerId).select("_id");
    if (!trainerDoc) {
      // Fallback: treat as User._id
      trainerDoc = await Trainer.findOne({ userId: trainerId }).select("_id");
      if (!trainerDoc) throw new NotFoundError("Trainer not found");
    }
    q.trainerId = trainerDoc._id;
  }

  const [items, total] = await Promise.all([
    Timesheet.find(q)
      .sort({ weekStart: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .select(
        "trainerId items weekStart weekEnd status totals createdAt updatedAt"
      )
      .populate({
        path: "trainerId",
        select: "fullName phone userId",
        populate: { path: "userId", select: "email", model: "User" },
      })
      .lean(),
    Timesheet.countDocuments(q),
  ]);

  // ✅ Collect all participant *user ids* from items
  const participantUserIds = Array.from(
    new Set(
      items.flatMap((ts) =>
        (ts.items ?? [])
          .map((it: any) => it.participantId)
          .filter((id: any) => id && isObjectId(String(id)))
          .map((id: any) => String(id))
      )
    )
  );

  // ✅ Fetch Participant docs by userId in one round-trip
  const participants = await Participant.find({
    userId: { $in: participantUserIds },
  })
    .select("_id userId fullName email phone status")
    .lean();

  // Build quick lookup by userId
  const participantByUserId = new Map(
    participants.map((p) => [String(p.userId), p])
  );

  // ✅ Enrich each timesheet item with participant details (alongside, no shape break)
  const data = items.map((ts: any) => {
    const trainer = ts.trainerId || {};
    const user = trainer.userId || {};

    const enrichedItems = (ts.items ?? []).map((it: any) => {
      const p = participantByUserId.get(String(it.participantId));
      return {
        ...it,
        // keep participantId as-is (this is the User._id)
        participant: p
          ? {
              // expose both ids for convenience
              userId: String(p.userId),
              participantDocId: String(p._id),
              fullName: p.fullName,
              email: p.email ?? "",
              phone: p.phone ?? "",
              status: p.status ?? "",
            }
          : undefined,
      };
    });

    return {
      ...ts,
      items: enrichedItems,
      // Existing admin helper block stays intact
      adminView: {
        trainerId: trainer._id,
        trainerName: trainer.fullName ?? "(No name)",
        trainerPhone: trainer.phone ?? "",
        trainerEmail: user.email ?? "",
        itemsCount: enrichedItems.length,
        amounts: {
          hours: ts.totals?.hours ?? 0,
          km: ts.totals?.km ?? 0,
          labourCents: ts.totals?.amountCents ?? 0,
          mileageCents: ts.totals?.mileageCents ?? 0,
          totalCents: ts.totals?.totalCents ?? 0,
        },
      },
    };
  });

  return { data, pagination: { page, pageSize, total } };
};

export const getTimesheetById = async ({ id, viewer }: any) => {
  if (!isObjectId(id)) throw new AppError("Invalid timesheet id", 400);
  const ts = await Timesheet.findById(id)
    .populate("trainerId", "id userId")
    .lean();
  if (!ts) throw new NotFoundError("Timesheet");
  // if (!canView(viewer, ts)) throw new AppError("Forbidden", 403);
  return ts;
};

export const submitTimesheet = async ({ id, trainerUserId }: any) => {
  if (!isObjectId(id)) throw new AppError("Invalid id", 400);
  const ts = await Timesheet.findById(id).populate("trainerId", "userId");
  if (!ts) throw new NotFoundError("Timesheet");
  // if (!canSubmit(trainerUserId, ts)) throw new AppError("Forbidden", 403);
  // if (ts.status !== "DRAFT")
  //   throw new AppError("Only DRAFT can be submitted", 409);
  ts.status = "SUBMITTED";
  await ts.save();
  return ts.toObject();
};

export const approveTimesheet = async ({ id, adminUserId }: any) => {
  if (!isObjectId(id)) throw new AppError("Invalid id", 400);
  // (optional) verify adminUserId belongs to an Admin model
  const ts = await Timesheet.findById(id);
  if (!ts) throw new NotFoundError("Timesheet");
  if (!["SUBMITTED", "REOPENED"].includes(ts.status))
    throw new AppError("Only SUBMITTED/REOPENED can be approved", 409);
  ts.status = "APPROVED";
  await ts.save();
  return ts.toObject();
};

export const reopenTimesheet = async ({ id, adminUserId, reason }: any) => {
  if (!isObjectId(id)) throw new AppError("Invalid id", 400);
  const ts = await Timesheet.findById(id);
  if (!ts) throw new NotFoundError("Timesheet");
  if (!["SUBMITTED", "APPROVED"].includes(ts.status))
    throw new AppError("Only SUBMITTED/APPROVED can be reopened", 409);
  ts.status = "REOPENED";
  // (optional) push an audit note
  (ts as any).audit = [
    ...((ts as any).audit ?? []),
    { by: adminUserId, at: new Date(), reason },
  ];
  await ts.save();
  return ts.toObject();
};

type ExportArgs = {
  id: string;
  viewer: { id: string; role: "TRAINER" | "ADMIN" };
  format: "csv" | "pdf";
};

const toISODate = (d: Date | string | number | null | undefined) => {
  if (!d) return "";
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? "" : dt.toISOString().slice(0, 10);
};

const centsToMoney = (c: number | null | undefined) => {
  const n = typeof c === "number" ? c : 0;
  return (n / 100).toFixed(2);
};

// helper

export const exportTimesheet = async ({ id, viewer, format }: ExportArgs) => {
  const ts = await getTimesheetById({ id, viewer });

  // --- ENRICH TRAINER (handles unpopulated trainerId) ---
  let trainer: any = {};
  let trainerEmail = "";

  const t = await Trainer.findById(ts.trainerId)
    .select("fullName phone userId")
    .populate({ path: "userId", select: "email", model: "User" })
    .lean();
  trainer = t || {};
  trainerEmail = (t as any)?.userId?.email ?? "";

  // --- ENRICH PARTICIPANTS (items[].participant) ---
  const itemsRaw: any[] = Array.isArray((ts as any).items)
    ? (ts as any).items
    : [];
  const participantUserIds = Array.from(
    new Set(
      itemsRaw
        .map((i) => i?.participantId)
        .filter((id) => id && isObjectId(id))
        .map((id) => String(id))
    )
  );

  let participantByUserId = new Map<string, any>();
  if (participantUserIds.length) {
    const participants = await Participant.find({
      userId: { $in: participantUserIds },
    })
      .select("_id userId fullName email phone status")
      .lean();
    participantByUserId = new Map(
      participants.map((p) => [
        String(p.userId),
        {
          name: p.fullName ?? "",
          email: p.email ?? "",
          phone: p.phone ?? "",
          status: p.status ?? "",
          participantDocId: String(p._id),
          userId: String(p.userId),
        },
      ])
    );
  }

  // items with participant block (for CSV/PDF)
  const items = itemsRaw.map((i) => ({
    ...i,
    participant: participantByUserId.get(String(i.participantId)),
  }));

  console.log("items", items);

  if (format === "csv") {
    const payload: TimesheetCsvPayload = {
      title: `Timesheet ${ts._id}`,
      meta: {
        timesheetId: String(ts._id),
        status: ts.status ?? "",
        trainerName: trainer?.fullName ?? "",
        trainerEmail: trainerEmail ?? "",
        trainerPhone: trainer?.phone ?? "",
      },
      period: `${new Date(ts.weekStart).toDateString()} → ${new Date(
        ts.weekEnd
      ).toDateString()}`,
      totals: {
        hours: ts.totals?.hours ?? 0,
        km: ts.totals?.km ?? 0,
        amountCents: ts.totals?.amountCents ?? 0,
        mileageCents: ts.totals?.mileageCents ?? 0,
        totalCents: ts.totals?.totalCents ?? 0,
      },
      items: items.map((i: any) => ({
        dateISO: i.date ? new Date(i.date).toISOString().slice(0, 10) : "",
        service: i.service ?? "",
        hours: typeof i.hours === "number" ? i.hours : 0,
        km: typeof i.km === "number" ? i.km : 0,
        amountCents: typeof i.amountCents === "number" ? i.amountCents : 0,
        mileageCents: typeof i.mileageCents === "number" ? i.mileageCents : 0,
        totalCents: typeof i.totalCents === "number" ? i.totalCents : 0,
        amount: undefined, // or preformat if you prefer
        mileage: undefined,
        total: undefined,
        participant: i.participant
          ? {
              name: i.participant.name ?? "",
              email: i.participant.email ?? "",
              phone: i.participant.phone ?? "",
              status: i.participant.status ?? "",
            }
          : undefined,
        notes: i.notes ?? "",
      })),
    };

    const csvBuf = createCsvBuffer(payload, {
      delimiter: ",",
      eol: "\r\n",
      withBOM: true,
      includeSummary: true,
      moneyPrefix: "$",
      // itemColumns: ["Date","Service","Hours","KM","Total"], // ← Example: customize columns
    });

    const nameDate =
      (ts.weekStart && new Date(ts.weekStart).toISOString().slice(0, 10)) ||
      new Date().toISOString().slice(0, 10);

    return {
      filename: `timesheet_${ts._id}_${nameDate}.csv`,
      mime: "text/csv; charset=utf-8",
      buffer: csvBuf,
    };
  }
  // ----- PDF -----
  // Keep items/totals in cents so your PDF util can format; pass meta for headers.
  const pdfPayload = {
    title: `Timesheet ${ts._id}`,
    meta: {
      timesheetId: String(ts._id),
      status: ts.status ?? "",
      trainerName: trainer?.fullName ?? "",
      trainerEmail: trainerEmail ?? "",
      trainerPhone: trainer?.phone ?? "",
    },
    period: `${new Date(ts.weekStart).toDateString()} → ${new Date(
      ts.weekEnd
    ).toDateString()}`,
    totals: {
      hours: ts.totals?.hours ?? 0,
      km: ts.totals?.km ?? 0,
      amountCents: ts.totals?.amountCents ?? 0,
      mileageCents: ts.totals?.mileageCents ?? 0,
      totalCents: ts.totals?.totalCents ?? 0,
    },
    // Provide a rendering-friendly items array (keep raw cents; also include formatted helpers)
    items: items.map((i: any) => ({
      dateISO: toISODate(i.date),
      service: i.service ?? "",
      hours: typeof i.hours === "number" ? i.hours : 0,
      km: typeof i.km === "number" ? i.km : 0,

      amountCents: typeof i.amountCents === "number" ? i.amountCents : 0,
      mileageCents: typeof i.mileageCents === "number" ? i.mileageCents : 0,
      totalCents: typeof i.totalCents === "number" ? i.totalCents : 0,

      amount: centsToMoney(i.amountCents),
      mileage: centsToMoney(i.mileageCents),
      total: centsToMoney(i.totalCents),

      participant: i.participant
        ? {
            name: i.participant.name ?? "",
            email: i.participant.email ?? "",
            phone: i.participant.phone ?? "",
            status: i.participant.status ?? "",
          }
        : undefined,
      notes: i.notes ?? "",
    })),
  };

  const pdf = await createPdfBuffer(pdfPayload);

  const nameDate = toISODate(ts.weekStart) || toISODate(new Date());
  return {
    filename: `timesheet_${ts._id}_${nameDate}.pdf`,
    mime: "application/pdf",
    buffer: pdf,
  };
};
