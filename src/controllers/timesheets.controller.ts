// controllers/timesheets.controller.ts
import { Request, Response } from "express";
import * as TimesheetSvc from "../services/timesheets.service";
import { AppError } from "../utils/errors";

export const listTimesheets = async (req: any, res: Response) => {
  const { status, weekStart, trainerId, page = "1", pageSize = "20" } = req.query;
  const viewer = { id: req.user.userId, role: req.user.role };
  const result = await TimesheetSvc.listTimesheets({
    viewer,
    status: status as string | undefined,
    weekStart: weekStart as string | undefined,
    trainerId: trainerId as string | undefined,
    page: parseInt(page as string, 10),
    pageSize: parseInt(pageSize as string, 10),
  });
  res.json({ success: true, ...result });
};

export const getTimesheetById = async (req: any, res: Response) => {
  const { id } = req.params;
  const viewer = { id: req.user.userId, role: req.user.role };
  const ts = await TimesheetSvc.getTimesheetById({ id, viewer });
  res.json({ success: true, data: ts });
};

export const submitTimesheet = async (req: any, res: Response) => {
  const { id } = req.params;
  const ts = await TimesheetSvc.submitTimesheet({ id, trainerUserId: req.user.userId });
  res.json({ success: true, message: "Timesheet submitted", data: ts });
};

export const approveTimesheet = async (req: any, res: Response) => {
  const { id } = req.params;
  const ts = await TimesheetSvc.approveTimesheet({ id, adminUserId: req.user.userId });
  res.json({ success: true, message: "Timesheet approved", data: ts });
};

export const reopenTimesheet = async (req: any, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body ?? {};
  const ts = await TimesheetSvc.reopenTimesheet({ id, adminUserId: req.user.userId, reason });
  res.json({ success: true, message: "Timesheet reopened", data: ts });
};

export const exportTimesheet = async (req: any, res: Response) => {
  const { id } = req.params;
  const { format = "csv" } = req.query;
  const viewer = { id: req.user.userId, role: req.user.role };
  if (!["csv", "pdf"].includes(String(format))) throw new AppError("Unsupported format", 400);

  const { filename, mime, buffer } = await TimesheetSvc.exportTimesheet({ id, viewer, format });
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Type", mime);
  res.send(buffer);
};
