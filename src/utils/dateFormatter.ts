/**
 * Date and Timestamp Formatting utilities for Arabic meeting scoreboard
 */

export interface FormattedTimestamp {
  relative: string;
  dateStr: string;
  timeStr: string;
  fullDate: string;
  iso: string;
}

export function formatArabicTimestamp(isoOrDate: string | Date | undefined): FormattedTimestamp {
  if (!isoOrDate) {
    return {
      relative: "غير محدد",
      dateStr: "تاريخ غير محدد",
      timeStr: "--:--",
      fullDate: "تاريخ غير محدد",
      iso: "",
    };
  }

  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (isNaN(d.getTime())) {
    return {
      relative: "تاريخ غير صالح",
      dateStr: String(isoOrDate),
      timeStr: "--:--",
      fullDate: String(isoOrDate),
      iso: String(isoOrDate),
    };
  }

  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  let relative = "";
  if (diffSec < 45) {
    relative = "الآن (منذ لحظات)";
  } else if (diffSec < 90) {
    relative = "منذ دقيقة واحدة";
  } else if (diffMin < 60) {
    relative = `منذ ${diffMin} ${diffMin === 2 ? "دقيقتين" : diffMin <= 10 ? "دقائق" : "دقيقة"}`;
  } else if (diffHours < 24) {
    relative = `منذ ${diffHours} ${diffHours === 1 ? "ساعة" : diffHours === 2 ? "ساعتين" : diffHours <= 10 ? "ساعات" : "ساعة"}`;
  } else if (diffDays === 1) {
    relative = "أمس";
  } else if (diffDays === 2) {
    relative = "أول أمس";
  } else if (diffDays < 7) {
    relative = `منذ ${diffDays} أيام`;
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    relative = `منذ ${weeks} ${weeks === 1 ? "أسبوع" : weeks === 2 ? "أسبوعين" : "أسابيع"}`;
  } else {
    relative = d.toLocaleDateString("ar-EG", { month: "short", day: "numeric", year: "numeric" });
  }

  const dateStr = d.toLocaleDateString("ar-EG", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const timeStr = d.toLocaleTimeString("ar-EG", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  const shortDate = d.toLocaleDateString("ar-EG", {
    month: "short",
    day: "numeric",
  });

  const fullDate = `${dateStr} • ${timeStr}`;

  return {
    relative,
    dateStr,
    timeStr,
    fullDate,
    iso: d.toISOString(),
  };
}
