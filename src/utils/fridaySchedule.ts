/**
 * Friday Schedule Generator & Utilities
 * Automatically manages all Friday youth meeting sessions across the entire season.
 */

import type { EventSession } from "../types";

export interface FridayMeetingInfo {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  formattedArabicDate: string;
  shortLabel: string;
  weekNumber: number;
  isToday: boolean;
  isCurrentWeek: boolean;
  isPast: boolean;
  isUpcoming: boolean;
  defaultEvent: EventSession;
}

/**
 * Generates all Friday dates for a given year (defaults to 2026)
 */
export function generateSeasonFridays(year = 2026): FridayMeetingInfo[] {
  const fridays: FridayMeetingInfo[] = [];
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  // Find start of current week's Friday
  const currentWeekFriday = getFridayOfWeek(now);
  const currentWeekFridayStr = currentWeekFriday.toISOString().slice(0, 10);

  // Iterate from Jan 1st to Dec 31st
  const d = new Date(year, 0, 1);
  let weekCounter = 1;

  while (d.getFullYear() === year) {
    if (d.getDay() === 5) {
      // 5 = Friday
      const dateStr = d.toISOString().slice(0, 10);
      const isToday = dateStr === todayStr;
      const isCurrentWeek = dateStr === currentWeekFridayStr;
      const isPast = dateStr < todayStr;
      const isUpcoming = dateStr > todayStr;

      const formattedArabicDate = d.toLocaleDateString("ar-EG", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });

      const shortLabel = d.toLocaleDateString("ar-EG", {
        day: "numeric",
        month: "short",
      });

      const title = `لقاء الجمعة الروحي والدراسي (${formattedArabicDate})`;

      const defaultEvent: EventSession = {
        id: `evt-friday-${dateStr}`,
        title,
        date: dateStr,
        description: `اللقاء الأسبوعي لشباب جامعة - صلاة وتسبيح ودراسة الكلمة المقدسة ومسابقات المجموعات لـ ${formattedArabicDate}`,
        qrCode: `EVT-FRIDAY-${dateStr.replace(/-/g, "")}`,
        attendancePoints: 30,
        punctualityBonusPoints: 15,
        startTime: "18:00",
        isActive: true,
        createdAt: new Date().toISOString(),
        createdBy: "النظام التلقائي لاجتماع الشباب",
      };

      fridays.push({
        id: `evt-friday-${dateStr}`,
        date: dateStr,
        title,
        formattedArabicDate,
        shortLabel,
        weekNumber: weekCounter++,
        isToday,
        isCurrentWeek,
        isPast,
        isUpcoming,
        defaultEvent,
      });
    }
    d.setDate(d.getDate() + 1);
  }

  return fridays;
}

/**
 * Returns the Date object of the Friday in the same week as the given date
 */
export function getFridayOfWeek(date: Date = new Date()): Date {
  const result = new Date(date);
  const day = result.getDay();
  // 5 is Friday
  const diff = 5 - day;
  result.setDate(result.getDate() + diff);
  return result;
}

/**
 * Returns the nearest Friday (today if Friday, else upcoming Friday)
 */
export function getCurrentOrNearestFridayDate(): string {
  const now = new Date();
  const day = now.getDay(); // 0: Sun, 1: Mon, 2: Tue, 3: Wed, 4: Thu, 5: Fri, 6: Sat
  const result = new Date(now);
  if (day === 5) {
    return result.toISOString().slice(0, 10);
  }
  if (day < 5) {
    // Sun to Thu: Friday of this week
    result.setDate(result.getDate() + (5 - day));
  } else {
    // Saturday (6): Friday of next week (+6 days)
    result.setDate(result.getDate() + 6);
  }
  return result.toISOString().slice(0, 10);
}
