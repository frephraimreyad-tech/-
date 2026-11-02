/**
 * Excel (.xlsx) Exporter for Youth Meeting Attendance & Absence
 * Generates formatted multi-sheet Excel files with Arabic support & RTL alignment.
 */

import * as XLSX from "xlsx";
import type { AttendanceRecord, CustomMember, CustomTeam, EventSession, MeetingConfig } from "../types";
import { formatArabicTimestamp } from "./dateFormatter";

interface ExportAttendanceParams {
  event: EventSession;
  members: CustomMember[];
  teams: CustomTeam[];
  attendance: AttendanceRecord[];
  meetingConfig: MeetingConfig;
}

export function exportAttendanceToExcel({
  event,
  members,
  teams,
  attendance,
  meetingConfig,
}: ExportAttendanceParams): boolean {
  try {
    const wb = XLSX.utils.book_new();

    // Map of teamId to Team
    const teamMap = new Map<string, CustomTeam>();
    teams.forEach((t) => teamMap.set(t.id, t));

    // Map of memberId to AttendanceRecord
    const attendanceMap = new Map<string, AttendanceRecord>();
    attendance.forEach((a) => attendanceMap.set(a.memberId, a));

    // ==========================================
    // Sheet 1: كشف الحضور والغياب (Main Attendance)
    // ==========================================
    const sheet1Rows: Array<Record<string, any>> = members.map((member, idx) => {
      const attRecord = attendanceMap.get(member.id);
      const isPresent = !!attRecord;
      const team = teamMap.get(member.teamId);

      let statusText = "غائب ❌";
      let punctualText = "--";
      let pointsAwarded = 0;
      let scanTime = "--";
      let scannedBy = "--";

      if (isPresent && attRecord) {
        statusText = "حاضر ✅";
        punctualText = attRecord.isPunctual ? "في الموعد ⏰" : "متأخر ⏳";
        pointsAwarded = attRecord.pointsAwarded || 0;
        if (attRecord.scannedAt) {
          const parsed = formatArabicTimestamp(attRecord.scannedAt);
          scanTime = parsed.timeStr;
        }
        scannedBy = attRecord.scannedByUserName || "النظام";
      }

      // Friendly Role Name
      let roleLabel = "مخدوم";
      if (member.role === "admin") roleLabel = "مدير النظام ⚙️";
      else if (member.role === "priest") roleLabel = "أب كاهن ✝️";
      else if (member.role === "servant") roleLabel = "خادم ✝️";
      else if (member.role === "leader") roleLabel = "قائد مجموعة 👑";

      return {
        "م": idx + 1,
        "كود العضو": member.accessCode || "--",
        "اسم العضو": member.name,
        "الفريق / المجموعة": team ? `${team.icon || ""} ${team.name}` : "غير محدد",
        "الصفة / الدور": roleLabel,
        "حالة الحضور": statusText,
        "الالتزام بالموعد": punctualText,
        "النقاط المكتسبة (XP)": pointsAwarded,
        "وقت التسجيل": scanTime,
        "مسؤول التسجيل": scannedBy,
        "رقم الهاتف": member.phone || "--",
        "ملاحظات الافتقاد": member.notes || "",
      };
    });

    const ws1 = XLSX.utils.json_to_sheet(sheet1Rows);

    // Auto-fit column widths
    ws1["!cols"] = [
      { wch: 6 },  // م
      { wch: 12 }, // كود العضو
      { wch: 26 }, // اسم العضو
      { wch: 22 }, // الفريق
      { wch: 16 }, // الصفة
      { wch: 14 }, // حالة الحضور
      { wch: 16 }, // الالتزام
      { wch: 20 }, // النقاط
      { wch: 14 }, // وقت التسجيل
      { wch: 18 }, // مسؤول التسجيل
      { wch: 16 }, // رقم الهاتف
      { wch: 30 }, // ملاحظات
    ];

    // Right-To-Left view flag
    ws1["!views"] = [{ RTL: true }];
    XLSX.utils.book_append_sheet(wb, ws1, "كشف الحضور والغياب");

    // ==========================================
    // Sheet 2: إحصائيات الفرق (Teams Summary)
    // ==========================================
    const sheet2Rows = teams.map((team, idx) => {
      const teamMembers = members.filter((m) => m.teamId === team.id);
      const teamPresent = teamMembers.filter((m) => attendanceMap.has(m.id));
      const teamMakhdoumeen = teamMembers.filter((m) => m.role === "member" || !m.role);
      const teamMakhdoumeenPresent = teamMakhdoumeen.filter((m) => attendanceMap.has(m.id));

      const totalCount = teamMembers.length;
      const presentCount = teamPresent.length;
      const absentCount = totalCount - presentCount;
      const attRate = totalCount > 0 ? `${Math.round((presentCount / totalCount) * 100)}%` : "0%";

      const sessionPoints = teamPresent.reduce((acc, m) => {
        const r = attendanceMap.get(m.id);
        return acc + (r?.pointsAwarded || 0);
      }, 0);

      return {
        "الترتيب": idx + 1,
        "الفريق": `${team.icon || ""} ${team.name}`,
        "قائد الفريق": team.leaderName || "--",
        "إجمالي الأعضاء": totalCount,
        "عدد الحاضرين": presentCount,
        "عدد الغائبين": absentCount,
        "نسبة الحضور": attRate,
        "حضور المخدومين": `${teamMakhdoumeenPresent.length} من ${teamMakhdoumeen.length}`,
        "نقاط حضور اللقاء": sessionPoints,
        "إجمالي نقاط الفريق التراكمية": team.points || 0,
      };
    });

    const ws2 = XLSX.utils.json_to_sheet(sheet2Rows);
    ws2["!cols"] = [
      { wch: 8 },  // الترتيب
      { wch: 24 }, // الفريق
      { wch: 20 }, // القائد
      { wch: 14 }, // إجمالي الأعضاء
      { wch: 14 }, // الحاضرين
      { wch: 14 }, // الغائبين
      { wch: 14 }, // نسبة الحضور
      { wch: 18 }, // حضور المخدومين
      { wch: 18 }, // نقاط اللقاء
      { wch: 22 }, // التراكمي
    ];
    ws2["!views"] = [{ RTL: true }];
    XLSX.utils.book_append_sheet(wb, ws2, "إحصائيات الفرق");

    // ==========================================
    // Sheet 3: بيانات اللقاء العامة (Meeting Overview)
    // ==========================================
    const totalMembers = members.length;
    const totalPresent = attendance.length;
    const totalAbsent = totalMembers - totalPresent;
    const overallRate = totalMembers > 0 ? `${Math.round((totalPresent / totalMembers) * 100)}%` : "0%";

    const servants = members.filter((m) => m.role === "servant" || m.role === "admin" || m.role === "priest" || m.role === "leader");
    const servantsPresent = servants.filter((m) => attendanceMap.has(m.id)).length;
    const makhdoumeen = members.filter((m) => m.role === "member" || !m.role);
    const makhdoumeenPresent = makhdoumeen.filter((m) => attendanceMap.has(m.id)).length;

    const sheet3Rows = [
      { "البيان": "اسم الاجتماع", "القيمة": meetingConfig.meetingName },
      { "البيان": "اسم الكنيسة", "القيمة": meetingConfig.churchName },
      { "البيان": "الموسم", "القيمة": meetingConfig.seasonName },
      { "البيان": "عنوان اللقاء", "القيمة": event.title },
      { "البيان": "تاريخ اللقاء", "القيمة": event.date },
      { "البيان": "إجمالي المخدومين والخدام المسجلين", "القيمة": totalMembers },
      { "البيان": "إجمالي الحاضرين", "القيمة": totalPresent },
      { "البيان": "إجمالي الغائبين", "القيمة": totalAbsent },
      { "البيان": "نسبة الحضور الإجمالية", "القيمة": overallRate },
      { "البيان": "حضور الخدام", "القيمة": `${servantsPresent} من ${servants.length}` },
      { "البيان": "حضور المخدومين", "القيمة": `${makhdoumeenPresent} من ${makhdoumeen.length}` },
      { "البيان": "نقاط الحضور الأساسية", "القيمة": event.attendancePoints || 30 },
      { "البيان": "بونص الحضور المبكر", "القيمة": event.punctualityBonusPoints || 15 },
      { "البيان": "تاريخ تصدير الملف", "القيمة": new Date().toLocaleString("ar-EG") },
    ];

    const ws3 = XLSX.utils.json_to_sheet(sheet3Rows);
    ws3["!cols"] = [{ wch: 30 }, { wch: 45 }];
    ws3["!views"] = [{ RTL: true }];
    XLSX.utils.book_append_sheet(wb, ws3, "ملخص الاجتماع");

    // Clean filename
    const safeDate = event.date || new Date().toISOString().slice(0, 10);
    const fileName = `كشف_حضور_وغياب_اجتماع_الشباب_${safeDate}.xlsx`;

    // Download file
    XLSX.writeFile(wb, fileName);
    return true;
  } catch (err) {
    console.error("Failed to export Excel file:", err);
    return false;
  }
}
