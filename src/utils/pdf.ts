import PDFDocument from "pdfkit";

/**
 * Create a professional-looking Timesheet PDF.
 *
 * Expected payload (flexible, null-safe):
 * {
 *   title: string,
 *   meta?: { timesheetId?: string, status?: string, trainerName?: string, trainerEmail?: string, trainerPhone?: string },
 *   period: string, // e.g. "Mon Jan 01 2025 → Sun Jan 07 2025"
 *   totals: { hours?: number, km?: number, amountCents?: number, mileageCents?: number, totalCents?: number },
 *   items: Array<{
 *     dateISO?: string,            // preferred (YYYY-MM-DD)
 *     date?: string|Date|number,   // fallback
 *     service?: string,
 *     hours?: number,
 *     km?: number,
 *     amountCents?: number,
 *     mileageCents?: number,
 *     totalCents?: number,
 *     amount?: string,   // optional preformatted "123.45"
 *     mileage?: string,  // optional preformatted
 *     total?: string,    // optional preformatted
 *     participant?: { name?: string, email?: string, phone?: string, status?: string },
 *     notes?: string,
 *   }>
 * }
 */
export const createPdfBuffer = (data: any): Promise<Buffer> =>
  new Promise((resolve) => {
    // ---- Helpers -----------------------------------------------------------
    const fmtMoney = (cents?: number | null, fallback?: string) => {
      if (typeof fallback === "string" && fallback !== "") return `$${fallback}`;
      const n = typeof cents === "number" ? cents : 0;
      return `$${(n / 100).toFixed(2)}`;
    };
    const fmtNum = (n?: number | null, digits = 2) =>
      typeof n === "number" ? n.toFixed(digits) : (0).toFixed(digits);
    const toISO = (d: any) => {
      if (!d) return "";
      const x = new Date(d);
      return isNaN(x.getTime()) ? "" : x.toISOString().slice(0, 10);
    };
    const safe = <T>(v: T | null | undefined, def: T): T => (v ?? def);

    // prefer dateISO if present (from enriched payload), fall back to legacy "date"
    const rowDate = (i: any) => i.dateISO || toISO(i.date);

    // ---- Layout constants --------------------------------------------------
    const PAGE = { width: 612, height: 792 };     // US Letter points (8.5x11)
    const MARGIN = 40;
    const CONTENT_W = PAGE.width - MARGIN * 2;

    // Table column widths (sum <= CONTENT_W)
    // [Date, Service, Participant, Hours, KM, Amount, Mileage, Total]
    const COLS = [
      { key: "date", label: "Date", width: 70, align: "left" as const },
      { key: "service", label: "Service", width: 150, align: "left" as const },
      { key: "participant", label: "Participant", width: 140, align: "left" as const },
      { key: "hours", label: "Hours", width: 55, align: "right" as const },
      { key: "km", label: "KM", width: 45, align: "right" as const },
      // --- price-related columns commented out ---
      // { key: "amount", label: "Amount", width: 70, align: "right" as const },
      // { key: "mileage", label: "Mileage", width: 70, align: "right" as const },
      // { key: "total", label: "Total", width: 70, align: "right" as const },
    ];

    const HEADER_FONT = 16;
    const SUBHEADER_FONT = 11;
    const BODY_FONT = 10;
    const ROW_H = 20;
    const HEADER_ROW_H = 22;

    // Stripe fill for table
    const ROW_FILL_LIGHT = "#F7F7F7";
    const BORDER = "#CCCCCC";

    // ---- Document ----------------------------------------------------------
    const doc = new PDFDocument({
      margin: MARGIN,
      size: [PAGE.width, PAGE.height],
      bufferPages: true,
      autoFirstPage: true,
    });

    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    // ---- Header ------------------------------------------------------------
    const drawHeader = () => {
      doc.fontSize(HEADER_FONT).font("Helvetica-Bold").text(safe(data.title, "Timesheet"), {
        align: "left",
      });
      doc.moveDown(0.5);

      doc
        .fontSize(SUBHEADER_FONT)
        .font("Helvetica")
        .fillColor("#333333")
        .text(`Period: ${safe(data.period, "")}`);

      // Meta block (if provided)
      const meta = safe<any>(data.meta, {});
      const leftMeta = [
        ["Timesheet ID", meta.timesheetId],
        ["Status", meta.status],
      ];
      const rightMeta = [
        ["Trainer", meta.trainerName],
        ["Email", meta.trainerEmail],
        ["Phone", meta.trainerPhone],
      ];

      const yStart = doc.y + 6;
      const colW = CONTENT_W / 2 - 6;

      const drawKV = (x: number, y: number, pairs: Array<[string, any]>) => {
        doc.fontSize(BODY_FONT).font("Helvetica");
        let yy = y;
        pairs.forEach(([k, v]) => {
          if (!v) return;
          doc
            .fillColor("#555555")
            .text(`${k}:`, x, yy, { width: 90 });
          doc
            .fillColor("#000000")
            .text(String(v), x + 95, yy, { width: colW - 95 });
          yy += 14;
        });
        return yy;
      };

      const leftYEnd = drawKV(doc.x, yStart, leftMeta) || yStart;
      const rightYEnd = drawKV(doc.x + colW + 12, yStart, rightMeta) || yStart;
      const yEnd = Math.max(leftYEnd, rightYEnd);

      // Divider
      doc
        .moveTo(MARGIN, yEnd + 8)
        .lineTo(PAGE.width - MARGIN, yEnd + 8)
        .lineWidth(0.5)
        .strokeColor(BORDER)
        .stroke();

      doc.moveDown(1);
    };

    // ---- Totals summary ----------------------------------------------------
    const drawTotals = () => {
      const t = safe<any>(data.totals, {});
      const hours = fmtNum(t.hours, 2);
      const km = safe<number>(t.km, 0);
      // const labour = fmtMoney(t.amountCents);
      // const mileage = fmtMoney(t.mileageCents);
      // const total = fmtMoney(t.totalCents);

      const boxW = CONTENT_W;
      const boxH = 56;
      const x = MARGIN;
      const y = doc.y + 6;

      // Box background
      doc
        .roundedRect(x, y, boxW, boxH, 6)
        .fillOpacity(0.05)
        .fill("#000000")
        .fillOpacity(1);

      // Labels
      const pad = 12;
      const cellW = boxW / 2; // adjusted from 5 cells to 2

      const cell = (idx: number, label: string, value: string) => {
        const cx = x + idx * cellW;
        doc
          .font("Helvetica")
          .fontSize(9)
          .fillColor("#666666")
          .text(label.toUpperCase(), cx + pad, y + 8, { width: cellW - pad * 2 });
        doc
          .font("Helvetica-Bold")
          .fontSize(12)
          .fillColor("#000000")
          .text(value, cx + pad, y + 24, { width: cellW - pad * 2 });
      };

      cell(0, "Hours", hours);
      cell(1, "KM", String(km));
      // cell(2, "Labour", labour);
      // cell(3, "Mileage", mileage);
      // cell(4, "Total", total);

      // Border
      doc
        .roundedRect(x, y, boxW, boxH, 6)
        .lineWidth(0.6)
        .strokeColor(BORDER)
        .stroke();

      doc.y = y + boxH + 12;
    };

    // ---- Table: header row -------------------------------------------------
    const drawTableHeader = () => {
      const y = doc.y;
      let x = MARGIN;

      // Header background
      doc
        .rect(MARGIN, y, CONTENT_W, HEADER_ROW_H)
        .fill("#EFEFEF")
        .fillColor("#000000");

      // Column titles
      COLS.forEach((c) => {
        const opts =
          c.align === "right"
            ? { width: c.width, align: "right" as const }
            : { width: c.width, align: "left" as const };
        doc
          .font("Helvetica-Bold")
          .fontSize(BODY_FONT)
          .fillColor("#000000")
          .text(c.label, x + 6, y + 6, { ...opts });
        x += c.width;
      });

      // Bottom border
      doc
        .moveTo(MARGIN, y + HEADER_ROW_H)
        .lineTo(MARGIN + CONTENT_W, y + HEADER_ROW_H)
        .lineWidth(0.5)
        .strokeColor(BORDER)
        .stroke();

      doc.y = y + HEADER_ROW_H;
    };

    // ---- Table: one row ----------------------------------------------------
    const drawRow = (rowIndex: number, i: any) => {
      const startY = doc.y;

      // Compute cell values
      const values = {
        date: rowDate(i),
        service: safe(i.service, ""),
        participant: i.participant?.name || "",
        hours: typeof i.hours === "number" ? i.hours.toFixed(2) : "0.00",
        km: typeof i.km === "number" ? String(i.km) : "0",
        // amount: fmtMoney(i.amountCents, i.amount),
        // mileage: fmtMoney(i.mileageCents, i.mileage),
        // total: fmtMoney(i.totalCents, i.total),
      };

      // Row background (striped)
      const rowH = ROW_H; // fixed height for tidy layout
      if (rowIndex % 2 === 1) {
        doc
          .rect(MARGIN, startY, CONTENT_W, rowH)
          .fill(ROW_FILL_LIGHT)
          .fillColor("#000000");
      }

      // Text cells
      let x = MARGIN;
      COLS.forEach((c) => {
        const text = (values as any)[c.key] ?? "";
        const opts =
          c.align === "right"
            ? { width: c.width - 8, align: "right" as const }
            : { width: c.width - 8, align: "left" as const };
        doc
          .font("Helvetica")
          .fontSize(BODY_FONT)
          .fillColor("#111111")
          .text(text, x + 6, startY + 4, { ...opts, ellipsis: true });
        x += c.width;
      });

      // Row separator
      doc
        .moveTo(MARGIN, startY + rowH)
        .lineTo(MARGIN + CONTENT_W, startY + rowH)
        .lineWidth(0.3)
        .strokeColor(BORDER)
        .stroke();

      doc.y = startY + rowH;
    };

    // ---- Pagination guard --------------------------------------------------
    const ensureSpace = (needed: number) => {
      const bottom = PAGE.height - MARGIN - 40; // leave room for footer
      if (doc.y + needed > bottom) {
        addFooter(); // number previous page before adding a new one
        doc.addPage();
        drawHeader();
        drawTotals();
        drawTableHeader();
      }
    };

    // ---- Footer with page numbers -----------------------------------------
    const addFooter = () => {
      const range = doc.bufferedPageRange(); // we will renumber later
      const pageNumber = range.start + range.count; // current page number (1-based)
      const footerY = PAGE.height - MARGIN + 10;

      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor("#666666")
        .text(`Page ${pageNumber}`, MARGIN, footerY, {
          width: CONTENT_W,
          align: "center",
        });
    };

    // ---- Compose -----------------------------------------------------------
    drawHeader();
    drawTotals();
    drawTableHeader();

    const items: any[] = Array.isArray(data.items) ? data.items : [];
    if (items.length === 0) {
      ensureSpace(ROW_H);
      drawRow(0, {}); // a single empty row so the table doesn't look broken
    } else {
      items.forEach((it, idx) => {
        ensureSpace(ROW_H);
        drawRow(idx, it);
      });
    }

    addFooter();

    // Renumber buffered pages with "Page X of Y"
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      const footerY = PAGE.height - MARGIN + 10;
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor("#666666")
        .text(`Page ${i + 1} of ${range.count}`, MARGIN, footerY, {
          width: CONTENT_W,
          align: "center",
        });
    }

    doc.end();
  });
