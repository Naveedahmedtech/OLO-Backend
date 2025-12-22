// src/routes/shiftRequest.routes.ts
import { Router } from "express";
import * as Ctrl from "../controllers/shiftRequest.controller";
import { catchAsync } from "../utils/catchAsync";
import { authenticate } from "../middleware/auth";

// ✅ add this import
import * as TimesheetCtrl from "../controllers/timesheets.controller";

const router = Router();

/**
 * Participant: Create new shift request
 * POST /api/shifts/request
 */
router.post("/request", authenticate, catchAsync(Ctrl.createShiftRequest));

/**
 * Admin: List all shift requests (filter/search/sort)
 * GET /api/shifts/admin/list
 * Query: ?page=&limit=&status=&q=&dateFrom=&dateTo=&sort=
 */
router.get("/admin/list", authenticate, catchAsync(Ctrl.adminList));

/**
 * Admin: Approve + assign shift to trainer
 * POST /api/shifts/admin/approve
 * Body: { requestId, trainerId }
 */
router.post("/admin/approve", authenticate, catchAsync(Ctrl.approveAndAssign));

/**
 * Admin: Decline a shift request
 * POST /api/shifts/admin/decline
 * Body: { requestId, reason? }
 */
router.post("/admin/decline", authenticate, catchAsync(Ctrl.decline));

// new
router.get("/participant/mine", authenticate, catchAsync(Ctrl.listParticipantMine));
router.get("/trainer/mine", authenticate, catchAsync(Ctrl.listTrainerMine));
router.get("/mine", authenticate, catchAsync(Ctrl.listMine));

router.post("/trainer/clock-in", authenticate, catchAsync(Ctrl.clockInShiftAsTrainer));
router.post("/trainer/clock-out", authenticate, catchAsync(Ctrl.clockOutShiftAsTrainerController));

router.get("/past", authenticate, catchAsync(Ctrl.listPastShiftsWithTimesheets));
router.get("/dashboard", authenticate, catchAsync(Ctrl.trainerDashboardSummary));
router.get("/admin/dashboard", authenticate, catchAsync(Ctrl.adminDashboardSummary));


/* ------------------------------------------------------------------ */
/*                             TIMESHEETS                              */
/* Base path here: /api/shifts/timesheets[...] (since mounted under /api/shifts)
   If you prefer /api/timesheets, move these to a separate router file. */
/* ------------------------------------------------------------------ */

// List timesheets (trainer sees own; admin can filter by trainerId)
router.get(
  "/timesheets",
  authenticate,
  catchAsync(TimesheetCtrl.listTimesheets)
);

// Get a single timesheet (trainer own / admin any)
router.get(
  "/timesheets/:id",
  authenticate,
  catchAsync(TimesheetCtrl.getTimesheetById)
);

// Trainer submits their timesheet (status: DRAFT -> SUBMITTED)
router.post(
  "/timesheets/:id/submit",
  authenticate,
  catchAsync(TimesheetCtrl.submitTimesheet)
);

// Admin approves (status: SUBMITTED/REOPENED -> APPROVED)
router.post(
  "/timesheets/:id/approve",
  authenticate,
  catchAsync(TimesheetCtrl.approveTimesheet)
);

// Admin reopens (status: SUBMITTED/APPROVED -> REOPENED)
router.post(
  "/timesheets/:id/reopen",
  authenticate,
  catchAsync(TimesheetCtrl.reopenTimesheet)
);

// Export CSV/PDF (trainer own / admin any) -> ?format=csv|pdf
router.get(
  "/timesheets/:id/export",
  authenticate,
  catchAsync(TimesheetCtrl.exportTimesheet)
);

export default router;
