// src/controllers/shiftRequest.controller.ts
import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { success } from "../utils/response";
import * as ShiftRequestService from "../services/shiftRequest.service";
import { AppError } from "../utils/errors";

/**
 * POST /api/shift-requests
 * Participant creates a new shift request
 * Body: { participantId, service, start, end, notes?, preferredTrainerIds?[] }
 */
export const createShiftRequest = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new AppError("Unauthorized", 401);
  }

  console.log("req.user.userId", req.user.userId);

  const created = await ShiftRequestService.createShiftRequest(
    {
      participantId: req.user.userId, // same as user making request
      requestedBy: req.user.userId,
      service: req.body.service, // string code from front-end selection
      start: req.body.start,
      end: req.body.end,
      notes: req.body.notes,
      preferredTrainerIds: req.body.preferredTrainerIds,
    },
    req.user.role
  );

  return success(res, created, "Shift request submitted");
};

/**
 * GET /api/admin/shift-requests
 * Admin list view for pending/approved/declined shift requests
 * Query: ?page=&limit=&status=&q=&dateFrom=&dateTo=&sort=
 */
export const adminList = async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== "ADMIN") {
    throw new AppError("Forbidden", 403);
  }

  const { page, limit, status, q, dateFrom, dateTo, sort } = req.query;

  const result = await ShiftRequestService.listForAdmin({
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
    status: Array.isArray(status)
      ? (status as string[] as any)
      : status
      ? [status as string as any]
      : undefined,
    q: q as string | undefined,
    dateFrom: dateFrom as string | undefined,
    dateTo: dateTo as string | undefined,
    sort: (sort as any) || "createdAt:desc",
  });

  return success(res, result, "Shift requests fetched");
};

/**
 * POST /api/admin/shift-requests/approve
 * Body: { requestId, trainerId }
 */
export const approveAndAssign = async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== "ADMIN") {
    throw new AppError("Forbidden", 403);
  }

  const { requestId, trainerId } = req.body;
  const adminUserId = req.user.userId;

  const updated = await ShiftRequestService.approveAndAssign({
    requestId,
    trainerId,
    adminUserId,
  });

  return success(res, updated, "Shift request approved and assigned");
};

/**
 * POST /api/admin/shift-requests/decline
 * Body: { requestId, reason? }
 */
export const decline = async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== "ADMIN") {
    throw new AppError("Forbidden", 403);
  }

  const { requestId, reason } = req.body;
  const adminUserId = req.user.userId;

  const updated = await ShiftRequestService.decline(requestId, adminUserId, reason);

  return success(res, updated, "Shift request declined");
};


// NEW: GET /api/shift-requests/participant/mine
// List shift requests for the logged-in participant (by userId)
export const listParticipantMine = async (req: AuthRequest, res: Response) => {
  if (!req.user) throw new AppError("Unauthorized", 401);

  const { page, limit, status, dateFrom, dateTo, sort, onlyUpcoming, onlyPast } = req.query;

  const result = await ShiftRequestService.listForParticipant(req.user.userId, {
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
    status: Array.isArray(status)
      ? (status as any)
      : status
      ? [status as any]
      : undefined,
    dateFrom: dateFrom as string | undefined,
    dateTo: dateTo as string | undefined,
    sort: (sort as any) || "createdAt:desc",
    onlyUpcoming: onlyUpcoming === "true",
    onlyPast: onlyPast === "true",
  });

  return success(res, result, "Participant shift requests");
};

// NEW: GET /api/shift-requests/trainer/mine
// List shift requests assigned to the logged-in trainer (resolve Trainer by userId)
export const listTrainerMine = async (req: AuthRequest, res: Response) => {
  if (!req.user) throw new AppError("Unauthorized", 401);

  const { page, limit, status, dateFrom, dateTo, sort, onlyUpcoming, onlyPast } = req.query;

  const result = await ShiftRequestService.listForTrainer(req.user.userId, {
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
    status: Array.isArray(status)
      ? (status as any)
      : status
      ? [status as any]
      : undefined,
    dateFrom: dateFrom as string | undefined,
    dateTo: dateTo as string | undefined,
    sort: (sort as any) || "createdAt:desc",
    onlyUpcoming: onlyUpcoming === "true",
    onlyPast: onlyPast === "true",
  });

  return success(res, result, "Trainer shift requests");
};

// NEW: GET /api/shift-requests/mine
// Smart router: participant → listForParticipant, trainer → listForTrainer
export const listMine = async (req: AuthRequest, res: Response) => {
  if (!req.user) throw new AppError("Unauthorized", 401);

  const { page, limit, status, dateFrom, dateTo, sort, onlyUpcoming, onlyPast } = req.query;

  const result = await ShiftRequestService.listMine(
    req.user.userId,
    req.user.role as any,
    {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      status: Array.isArray(status)
        ? (status as any)
        : status
        ? [status as any]
        : undefined,
      dateFrom: dateFrom as string | undefined,
      dateTo: dateTo as string | undefined,
      sort: (sort as any) || "createdAt:desc",
      onlyUpcoming: onlyUpcoming === "true",
      onlyPast: onlyPast === "true",
    }
  );

  return success(res, result, "My shift requests");
};


export const clockInShiftAsTrainer = async (req: AuthRequest, res: Response) => {
  if (!req.user) throw new AppError("Unauthorized", 401);
  if (req.user.role !== "TRAINER") throw new AppError("Forbidden", 403);

  const { requestId } = req.body;

  const shift = await ShiftRequestService.clockInShiftAsTrainer({
    trainerUserId: req.user.userId,
    shiftRequestId: requestId,
  });

  return success(res, shift, "Shift clock-in started");
};



export const clockOutShiftAsTrainerController = async (req: AuthRequest, res: Response) => {
  if (!req.user) throw new AppError("Unauthorized", 401);
  if (req.user.role !== "TRAINER") throw new AppError("Forbidden", 403);

  const { requestId, report } = req.body;
  const { activities, progress, incidents, km } = (report || {}) as {
    activities?: string; progress?: string; incidents?: string; km?: any;
  };

  const result = await ShiftRequestService.clockOutShiftAsTrainer({
    trainerUserId: req.user.userId,
    shiftRequestId: requestId,
    report: { activities, progress, incidents, km },
  });

  return success(res, result, "Shift clocked out");
};


/**
 * GET /api/shift-requests/past
 * Role-aware list of PAST (COMPLETED) shifts including:
 * - shift details
 * - participant & trainer (with trainer email)
 * - matching timesheet item + timesheet meta
 *
 * Trainer/Participant -> returns only their own past shifts.
 * Admin -> can filter by trainerId/participantId (accepts Trainer._id/User._id and Participant._id/User._id).
 *
 * Query: ?page=&pageSize=&dateFrom=&dateTo=&trainerId=&participantId=
 */
export const listPastShiftsWithTimesheets = async (req: AuthRequest, res: Response) => {
  if (!req.user) throw new AppError("Unauthorized", 401);

  const {
    page = "1",
    pageSize = "20",
    dateFrom,
    dateTo,
    trainerId,
    participantId,
  } = req.query;

  const result = await ShiftRequestService.listPastShiftsWithTimesheets({
    viewer: { id: req.user.userId, role: req.user.role as any }, // "TRAINER" | "PARTICIPANT" | "ADMIN"
    page: parseInt(String(page), 10),
    pageSize: parseInt(String(pageSize), 10),
    dateFrom: (dateFrom as string) || undefined,
    dateTo: (dateTo as string) || undefined,
    trainerId: (trainerId as string) || undefined,
    participantId: (participantId as string) || undefined,
  });

  return success(res, result, "Past shifts with timesheets fetched");
};


/**
 * GET /api/dashboard/trainer/summary
 * Returns: { totalShifts, totalUpcoming, nextShift, generatedAt }
 *
 * - TRAINER: summary for the logged-in trainer (by userId)
 * - ADMIN: must provide ?trainerId= (accepts Trainer._id or User._id)
 */
export const trainerDashboardSummary = async (req: AuthRequest, res: Response) => {
  if (!req.user) throw new AppError("Unauthorized", 401);

  const role = req.user.role;
  const { trainerId } = req.query;

  if (role !== "TRAINER" && role !== "ADMIN") {
    throw new AppError("Forbidden", 403);
  }

  const summary = await ShiftRequestService.getTrainerShiftSummary({
    viewer: { id: req.user.userId, role: role as any },
    trainerId: trainerId ? String(trainerId) : undefined,
  });

  return success(res, summary, "Trainer dashboard summary");
};


export const adminDashboardSummary = async (req: AuthRequest, res: Response) => {
  if (!req.user) throw new AppError("Unauthorized", 401);
  if (req.user.role !== "ADMIN") throw new AppError("Forbidden", 403);

  const { dateFrom, dateTo } = req.query;

  const data = await ShiftRequestService.getAdminDashboardSummary({
    dateFrom: dateFrom as string | undefined,
    dateTo: dateTo as string | undefined,
  });

  return success(res, data, "Admin dashboard summary");
};
