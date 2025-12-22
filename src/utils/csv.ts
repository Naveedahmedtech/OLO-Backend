// utils/csv.ts
export type TimesheetCsvPayload = {
  title?: string; // not used in CSV by default, but available if you want a top heading
  meta?: {
    timesheetId?: string;
    status?: string;
    trainerName?: string;
    trainerEmail?: string;
    trainerPhone?: string;
  };
  period?: string;
  totals?: {
    hours?: number;
    km?: number;
    amountCents?: number;
    mileageCents?: number;
    totalCents?: number;
  };
  items: Array<{
    dateISO?: string;           // preferred YYYY-MM-DD
    date?: string | number | Date;
    service?: string;
    hours?: number;
    km?: number;
    amountCents?: number;
    mileageCents?: number;
    totalCents?: number;
    amount?: string;            // optional preformatted "123.45"
    mileage?: string;
    total?: string;
    participant?: { name?: string; email?: string; phone?: string; status?: string };
    notes?: string;
  }>;
};

export type CsvOptions = {
  delimiter?: "," | ";" | "\t";   // default: ","
  eol?: "\r\n" | "\n";            // default: "\r\n" (Excel friendly)
  withBOM?: boolean;              // default: true
  includeSummary?: boolean;       // default: true
  moneyPrefix?: string;           // default: "$"
  // Control which columns appear in the items table:
  itemColumns?: Array<
    | "Date"
    | "Service"
    | "ParticipantName"
    | "ParticipantEmail"
    | "ParticipantPhone"
    | "ParticipantStatus"
    | "Hours"
    | "KM"
    | "Amount"
    | "Mileage"
    | "Total"
    | "Notes"
  >;
};

const toISODate = (d: unknown): string => {
  if (!d) return "";
  const dt = new Date(d as any);
  return isNaN(dt.getTime()) ? "" : dt.toISOString().slice(0, 10);
};

const centsToMoney = (c: number | null | undefined, prefix = "$") => {
  const n = typeof c === "number" ? c : 0;
  return `${prefix}${(n / 100).toFixed(2)}`;
};

const fmtHours = (n: number | null | undefined) =>
  typeof n === "number" ? n.toFixed(2) : "0.00";

const csvEscape = (val: unknown, delimiter: string): string => {
  // Convert value to string, escape quotes, and wrap in quotes if needed
  const s = val === null || val === undefined ? "" : String(val);
  const needsQuote = s.includes('"') || s.includes("\n") || s.includes("\r") || s.includes(delimiter);
  const escaped = s.replace(/"/g, '""');
  return needsQuote ? `"${escaped}"` : escaped;
};

export const createCsvBuffer = (data: TimesheetCsvPayload, opts: CsvOptions = {}): Buffer => {
  const delimiter = opts.delimiter ?? ",";
  const eol = opts.eol ?? "\r\n";
  const withBOM = opts.withBOM ?? true;
  const includeSummary = opts.includeSummary ?? true;
  const moneyPrefix = opts.moneyPrefix ?? "$";

  const items = Array.isArray(data.items) ? data.items : [];

  // --- Summary block (top) ---
  const lines: string[] = [];
  if (includeSummary) {
    lines.push("Summary");
    const meta = data.meta || {};
    const totals = data.totals || {};

    const summaryRows: Array<[string, string | number]> = [
      ["TimesheetId", meta.timesheetId ?? ""],
      ["Period", data.period ?? ""],
      ["Status", meta.status ?? ""],
      ["TrainerName", meta.trainerName ?? ""],
      ["TrainerEmail", meta.trainerEmail ?? ""],
      ["TrainerPhone", meta.trainerPhone ?? ""],
      ["Total Hours", fmtHours(totals.hours)],
      ["Total KM", totals.km ?? 0],
      // --- price-related summary fields commented out ---
      // ["Labour", centsToMoney(totals.amountCents, moneyPrefix)],
      // ["Mileage", centsToMoney(totals.mileageCents, moneyPrefix)],
      // ["Grand Total", centsToMoney(totals.totalCents, moneyPrefix)],
    ];

    summaryRows.forEach(([k, v]) => {
      lines.push(
        `${csvEscape(k, delimiter)}${delimiter}${csvEscape(v, delimiter)}`
      );
    });

    lines.push(""); // blank line
    lines.push("Items");
  }

  // --- Items table ---
  const cols =
    opts.itemColumns ??
    [
      "Date",
      "Service",
      "ParticipantName",
      "ParticipantEmail",
      "ParticipantPhone",
      // "ParticipantStatus", // optional; keep commented out like before
      "Hours",
      "KM",
      // --- price-related columns commented out ---
      // "Amount",
      // "Mileage",
      // "Total",
      "Notes",
    ];

  // Header
  lines.push(cols.map((c) => csvEscape(c, delimiter)).join(delimiter));

  // Rows
  items.forEach((i) => {
    const rowMap: Record<string, string | number> = {
      Date: i.dateISO || toISODate(i.date),
      Service: i.service ?? "",
      ParticipantName: i.participant?.name ?? "",
      ParticipantEmail: i.participant?.email ?? "",
      ParticipantPhone: i.participant?.phone ?? "",
      ParticipantStatus: i.participant?.status ?? "",
      Hours: fmtHours(i.hours),
      KM: typeof i.km === "number" ? i.km : 0,
      // Amount: i.amount ?? (typeof i.amountCents === "number" ? (i.amountCents / 100).toFixed(2) : "0.00"),
      // Mileage: i.mileage ?? (typeof i.mileageCents === "number" ? (i.mileageCents / 100).toFixed(2) : "0.00"),
      // Total: i.total ?? (typeof i.totalCents === "number" ? (i.totalCents / 100).toFixed(2) : "0.00"),
      Notes: i.notes ?? "",
    };

    const line = cols.map((c) => csvEscape(rowMap[c] ?? "", delimiter)).join(delimiter);
    lines.push(line);
  });

  // Ensure at least one empty row when there are no items (so Excel shows headers)
  if (items.length === 0) {
    const blank = cols.map(() => "").join(delimiter);
    lines.push(blank);
  }

  const csvString = lines.join(eol);
  const withBomPrefix = withBOM ? "\uFEFF" : "";
  return Buffer.from(withBomPrefix + csvString, "utf8");
};
