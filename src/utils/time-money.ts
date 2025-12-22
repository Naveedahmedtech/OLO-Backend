// utils/time-money.ts
export const startOfWeekUTC = (d: Date) => {
  const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  // Monday as start
  const day = dt.getUTCDay() || 7;             // Sun=0 → 7
  if (day > 1) dt.setUTCDate(dt.getUTCDate() - (day - 1));
  return dt; // 00:00:00 Monday UTC
};

export const endOfWeekUTC = (weekStart: Date) => {
  const end = new Date(weekStart);
  end.setUTCDate(end.getUTCDate() + 6);
  end.setUTCHours(23, 59, 59, 999);
  return end;
};

// 15-minute rounding & min 1h (tweak as needed)
export const billableMinutes = (rawMinutes: number) => {
  const rounded = Math.round(rawMinutes / 15) * 15; // .5 up/down to nearest 15
  return Math.max(60, rounded); // min 60 mins
};
