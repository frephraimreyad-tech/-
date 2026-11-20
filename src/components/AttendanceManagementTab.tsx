import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  CheckCircle,
  XCircle,
  Clock,
  Users,
  Shield,
  Search,
  Filter,
  Share2,
  Copy,
  Calendar,
  Sparkles,
  Phone,
  MessageCircle,
  FileText,
  Printer,
  ChevronDown,
  RotateCcw,
  Zap,
  Check,
  Send,
  AlertCircle,
  UserCheck,
  UserX,
  Bell,
  CheckCheck,
  Download,
} from "lucide-react";
import type { CustomMember, CustomTeam, EventSession, AttendanceRecord, RoleType } from "../types";
import { meetingStore } from "../utils/meetingStore";
import { authStore, type SystemUser } from "../utils/authStore";
import { sounds } from "../utils/soundEffects";
import { formatArabicTimestamp } from "../utils/dateFormatter";
import { exportAttendanceToExcel, exportVisitationHistoryToExcel } from "../utils/excelExporter";
import { generateSeasonFridays, type FridayMeetingInfo } from "../utils/fridaySchedule";

interface AttendanceManagementTabProps {
  isLight: boolean;
  onOpenQRScanner?: () => void;
}

export const AttendanceManagementTab: React.FC<AttendanceManagementTabProps> = ({
  isLight,
  onOpenQRScanner,
}) => {
  const [data, setData] = useState(meetingStore.getData());
  const [currentUser] = useState<SystemUser>(authStore.getCurrentUser());

  // Listen to store updates
  useEffect(() => {
    const unsub = meetingStore.subscribe(() => {
      setData({ ...meetingStore.getData() });
    });
    return unsub;
  }, []);

  // Events & Sessions selection
  const events = data.events || [];
  const defaultEvent = useMemo(() => {
    return meetingStore.ensureFridayMeetingEvent();
  }, [events]);

  const [selectedEventId, setSelectedEventId] = useState<string>(defaultEvent?.id || events[0]?.id || "");
  const selectedEvent = useMemo(() => {
    return events.find((e) => e.id === selectedEventId) || defaultEvent || events[0];
  }, [events, selectedEventId, defaultEvent]);

  // Filters
  const [roleFilter, setRoleFilter] = useState<"all" | "servants" | "members" | "leaders">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "present" | "absent">("all");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSubTab, setActiveSubTab] = useState<"attendance" | "visitation" | "reminder">("attendance");

  // Modals & Feedback
  const [showFridayMessageModal, setShowFridayMessageModal] = useState(false);
  const [copiedSuccess, setCopiedSuccess] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);
  const [isProcessingId, setIsProcessingId] = useState<string | null>(null);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);

  const showToast = (text: string, type: "success" | "error" | "info" = "success") => {
    setFeedback({ text, type });
    setTimeout(() => setFeedback(null), 3500);
  };

  // All Fridays of 2026 Season automatically generated
  const seasonFridays = useMemo(() => generateSeasonFridays(2026), []);

  const handleExportToExcel = () => {
    sounds.playTap();
    if (!selectedEvent) {
      showToast("يرجى اختيار لقاء أو جمعة لتصدير الكشف", "error");
      return;
    }
    const success = exportAttendanceToExcel({
      event: selectedEvent,
      members: data.members,
      teams: data.teams,
      attendance: eventAttendance,
      meetingConfig: data.config,
    });
    if (success) {
      sounds.playVictory();
      showToast(`تم تصدير كشف الحضور والغياب بصيغة إكسيل (Excel .xlsx) بنجاح! 📊`, "success");
    } else {
      sounds.playClose();
      showToast("حدث خطأ أثناء تصدير ملف الإكسيل", "error");
    }
  };

  const handleSelectFridayDate = (dateStr: string) => {
    sounds.playTap();
    const evt = meetingStore.ensureFridayMeetingEvent(dateStr);
    setSelectedEventId(evt.id);
  };

  // Check if today or selected session is a Friday
  const isFriday = useMemo(() => {
    const today = new Date().getDay();
    return today === 5; // 5 is Friday in JS (0: Sun, 1: Mon... 5: Fri)
  }, []);

  // Attendance Records for current selected event
  const eventAttendance = useMemo(() => {
    if (!selectedEvent) return [];
    return data.attendance?.filter((a) => a.eventId === selectedEvent.id) || [];
  }, [data.attendance, selectedEvent]);

  // Attendance lookup Map: memberId -> AttendanceRecord
  const attendanceMap = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    eventAttendance.forEach((a) => {
      map.set(a.memberId, a);
    });
    return map;
  }, [eventAttendance]);

  // Separate members into Servants vs Makhdoumeen
  const servantsList = useMemo(() => {
    return data.members.filter(
      (m) => m.role === "servant" || m.role === "admin" || m.role === "priest" || m.role === "leader"
    );
  }, [data.members]);

  const makhdoumeenList = useMemo(() => {
    return data.members.filter((m) => m.role === "member" || !m.role);
  }, [data.members]);

  // Filtered members for table
  const filteredMembers = useMemo(() => {
    return data.members.filter((m) => {
      // Role filter
      if (roleFilter === "servants") {
        if (m.role !== "servant" && m.role !== "admin" && m.role !== "priest") return false;
      } else if (roleFilter === "leaders") {
        if (m.role !== "leader") return false;
      } else if (roleFilter === "members") {
        if (m.role !== "member" && m.role) return false;
      }

      // Team filter
      if (teamFilter !== "all" && m.teamId !== teamFilter) return false;

      // Status filter
      const isPresent = attendanceMap.has(m.id);
      if (statusFilter === "present" && !isPresent) return false;
      if (statusFilter === "absent" && isPresent) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const inName = m.name.toLowerCase().includes(q);
        const inPhone = (m.phone || "").includes(q);
        const team = data.teams.find((t) => t.id === m.teamId);
        const inTeam = team?.name.toLowerCase().includes(q);
        if (!inName && !inPhone && !inTeam) return false;
      }

      return true;
    });
  }, [data.members, data.teams, roleFilter, teamFilter, statusFilter, searchQuery, attendanceMap]);

  // Stats
  const totalMembersCount = data.members.length;
  const presentCount = eventAttendance.length;
  const absentCount = Math.max(0, totalMembersCount - presentCount);
  const attendancePercentage = totalMembersCount > 0 ? Math.round((presentCount / totalMembersCount) * 100) : 0;

  const presentServantsCount = servantsList.filter((m) => attendanceMap.has(m.id)).length;
  const presentMakhdoumeenCount = makhdoumeenList.filter((m) => attendanceMap.has(m.id)).length;

  // Single Member Attendance Toggle
  const handleToggleAttendance = async (member: CustomMember) => {
    if (!selectedEvent) return;
    const isCurrentlyPresent = attendanceMap.has(member.id);
    const newPresentState = !isCurrentlyPresent;

    setIsProcessingId(member.id);
    sounds.playTap();

    try {
      const res = await meetingStore.setMemberAttendance({
        eventId: selectedEvent.id,
        memberId: member.id,
        isPresent: newPresentState,
        isPunctual: true,
        executor: currentUser,
      });

      if (res.success) {
        if (newPresentState) {
          sounds.playVictory();
          showToast(`تم تسجيل حضور "${member.name}" بنجاح! (+${res.record?.pointsAwarded || 30} XP) ✅`);
        } else {
          showToast(`تم إلغاء حضور "${member.name}" وتسجيله غائباً ❌`, "info");
        }
      } else {
        sounds.playClose();
        showToast(res.error || "فشل في تحديث الحضور", "error");
      }
    } catch {
      sounds.playClose();
      showToast("حدث خطأ أثناء الاتصال بقاعدة البيانات", "error");
    } finally {
      setIsProcessingId(null);
    }
  };

  // Mark all currently filtered as Present
  const handleMarkAllFilteredPresent = async () => {
    if (!selectedEvent || filteredMembers.length === 0) return;
    setIsBatchProcessing(true);
    sounds.playTap();

    const absentMemberIds = filteredMembers
      .filter((m) => !attendanceMap.has(m.id))
      .map((m) => m.id);

    if (absentMemberIds.length === 0) {
      showToast("كافة الأعضاء المحددين مسجلون حاضرين بالفعل!", "info");
      setIsBatchProcessing(false);
      return;
    }

    try {
      const res = await meetingStore.batchSetAttendance({
        eventId: selectedEvent.id,
        memberIds: absentMemberIds,
        isPresent: true,
        executor: currentUser,
      });

      sounds.playVictory();
      showToast(`تم تسجيل حضور جماعي لـ (${res.count}) عضو بنجاح! 🎉`);
    } catch {
      showToast("فشل في التسجيل الجماعي", "error");
    } finally {
      setIsBatchProcessing(false);
    }
  };

  // Compile the Complete Friday WhatsApp & Telegram Message
  const fridayReportMessage = useMemo(() => {
    const eventTitle = selectedEvent?.title || "اجتماع شباب الجمعة";
    const eventDate = selectedEvent?.date || new Date().toISOString().slice(0, 10);
    const meetingName = data.config.meetingName || "اجتماع الشباب ٢٠٢٦";
    const churchName = data.config.churchName || "كنيسة رئيس الملائكة ميخائيل";

    const presentServants = servantsList.filter((m) => attendanceMap.has(m.id));
    const absentServants = servantsList.filter((m) => !attendanceMap.has(m.id));

    const presentMakhdoumeen = makhdoumeenList.filter((m) => attendanceMap.has(m.id));
    const absentMakhdoumeen = makhdoumeenList.filter((m) => !attendanceMap.has(m.id));

    let msg = `✝️ *تقرير الحضور والغياب الأسبوعي - ${meetingName}* ✝️\n`;
    msg += `🏛️ *${churchName}*\n`;
    msg += `📅 *يوم الجمعة:* ${eventDate} | *اللقاء:* ${eventTitle}\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `📊 *ملخص إحصائيات الحضور:*\n`;
    msg += `• إجمالي الحاضرين: *${presentCount}* من أصل *${totalMembersCount}* (نسبة ${attendancePercentage}%)\n`;
    msg += `• حضور الخدام والمسؤولين: *${presentServants.length}* من *${servantsList.length}*\n`;
    msg += `• حضور المخدومين والشباب: *${presentMakhdoumeen.length}* من *${makhdoumeenList.length}*\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n`;

    // Servants Section
    msg += `👑 *كشف حضور وغياب الخدام:* \n`;
    if (presentServants.length > 0) {
      msg += `✅ *الخدام الحاضرون (${presentServants.length}):*\n`;
      presentServants.forEach((s, idx) => {
        const team = data.teams.find((t) => t.id === s.teamId);
        msg += `   ${idx + 1}. ${s.name} (${s.roleLabel || "خادم"}${team ? ` - ${team.name}` : ""})\n`;
      });
    }

    if (absentServants.length > 0) {
      msg += `\n❌ *الخدام الغائبون للمتابعة والاطمئنان (${absentServants.length}):*\n`;
      absentServants.forEach((s, idx) => {
        msg += `   • ${s.name} ${s.phone ? `📞 ${s.phone}` : ""}\n`;
      });
    }

    msg += `━━━━━━━━━━━━━━━━━━━━\n`;

    // Makhdoumeen Section
    msg += `👥 *كشف حضور وغياب المخدومين:* \n`;
    msg += `✅ عدد المخدومين الحاضرين: *${presentMakhdoumeen.length}* مشارك\n`;

    if (absentMakhdoumeen.length > 0) {
      msg += `\n📞 *قائمة الغائبين للافتقاد والمكالمات الأسبوعية (${absentMakhdoumeen.length}):*\n`;
      absentMakhdoumeen.forEach((m, idx) => {
        const team = data.teams.find((t) => t.id === m.teamId);
        msg += `   ${idx + 1}. ${m.name}${team ? ` [${team.name}]` : ""}${m.phone ? ` 📱 ${m.phone}` : ""}\n`;
      });
    } else {
      msg += `✨ نشكر ربنا، نسبة حضور المخدومين كاملة 100% اليوم! 🎉\n`;
    }

    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `صلّوا لأجل خدمة وافتقاد كل نفس 🙏✨\n`;
    msg += `_تم استخراج التقرير آلياً عبر لوحة تحكم اجتماع الشباب_`;

    return msg;
  }, [
    selectedEvent,
    data.config,
    data.teams,
    servantsList,
    makhdoumeenList,
    attendanceMap,
    presentCount,
    totalMembersCount,
    attendancePercentage,
  ]);

  const handleCopyFridayMessage = () => {
    sounds.playTap();
    navigator.clipboard.writeText(fridayReportMessage);
    setCopiedSuccess(true);
    sounds.playVictory();
    showToast("تم نسخ رسالة تقرير الجمعة بنجاح إلى الحافظة! 📋", "success");
    setTimeout(() => setCopiedSuccess(false), 3000);
  };

  const handleSendWhatsApp = () => {
    sounds.playTap();
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(fridayReportMessage)}`;
    window.open(url, "_blank");
  };

  const handleSendTelegram = () => {
    sounds.playTap();
    const url = `https://t.me/share/url?url=&text=${encodeURIComponent(fridayReportMessage)}`;
    window.open(url, "_blank");
  };

  return (
    <div className="space-y-6 animate-fadeIn font-arabic" dir="rtl">
      {/* Toast Feedback */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl border-2 flex items-center gap-3 shadow-xl transition-all animate-bounce ${
            feedback.type === "success"
              ? "bg-emerald-950/90 border-emerald-500/60 text-emerald-200"
              : feedback.type === "error"
              ? "bg-rose-950/90 border-rose-500/60 text-rose-200"
              : "bg-sky-950/90 border-sky-500/60 text-sky-200"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0" />
          ) : feedback.type === "error" ? (
            <AlertCircle className="h-5 w-5 text-rose-400 shrink-0" />
          ) : (
            <Sparkles className="h-5 w-5 text-sky-400 shrink-0" />
          )}
          <span className="text-xs sm:text-sm font-bold">{feedback.text}</span>
        </div>
      )}

      {/* Friday Banner Notification */}
      {isFriday && (
        <div className="p-4 rounded-3xl bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-amber-500/20 border-2 border-amber-500/50 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-3">
            <span className="h-10 w-10 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black text-xl shadow-md shrink-0 animate-pulse">
              🔔
            </span>
            <div>
              <h3 className="text-sm sm:text-base font-black text-amber-300">
                اليوم يوم الجمعة المبارك! موعد اجتماع الشباب الأسبوعي ✝️
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                يمكنك الآن تسجيل كشف الحضور للخدام والمخدومين وإرسال تقرير المتابعة لأبونا والخادم المسؤول.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowFridayMessageModal(true)}
            className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs sm:text-sm shadow-md active:scale-95 transition-all cursor-pointer flex items-center gap-2 shrink-0 border border-amber-400/40"
          >
            <Send className="h-4 w-4" />
            <span>توليد وإرسال رسالة الجمعة 📲</span>
          </button>
        </div>
      )}

      {/* Top Controls: Session Selector & Friday Report Trigger */}
      <div className={`p-5 sm:p-6 rounded-3xl border-2 shadow-xl space-y-4 ${
        isLight
          ? "bg-white border-slate-300 text-slate-900"
          : "bg-[#0B132B]/85 border-slate-800 text-slate-100 backdrop-blur-md"
      }`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="p-2 rounded-xl bg-teal-500/20 text-teal-400">
                <CheckCheck className="h-5 w-5" />
              </span>
              <h2 className="text-base sm:text-lg font-black text-white">
                كشف الحضور والغياب الأسبوعي (للخدام والمخدومين)
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-xs font-bold border border-emerald-500/30">
                {presentCount} حاضر / {totalMembersCount} إجمالي
              </span>
            </div>
            <p className={`text-xs ${isLight ? "text-slate-600" : "text-slate-400"}`}>
              تسجيل حضور فوري بنقرة واحدة، ومتابعة افتقاد الغائبين، وتوليد تقرير رسالة الواتساب الأسبوعية كل يوم جمعة
            </p>
          </div>

          {/* Action Buttons: Excel Export, Friday Report & QR Scanner */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Excel Export Button */}
            <button
              type="button"
              onClick={handleExportToExcel}
              className="px-3.5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-black text-xs sm:text-sm shadow-md shadow-emerald-600/25 active:scale-95 transition-all cursor-pointer flex items-center gap-2 border-2 border-emerald-400/50"
              title="تصدير كشف الحضور والغياب بصيغة إكسيل (Excel .xlsx)"
            >
              <Download className="h-4 w-4" />
              <span>تصدير إكسيل 📊 (Excel)</span>
            </button>

            {onOpenQRScanner && (
              <button
                type="button"
                onClick={onOpenQRScanner}
                className="px-3.5 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-teal-300 border border-slate-700 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs active:scale-95"
              >
                <Zap className="h-4 w-4 text-teal-400" />
                <span>مسح كود الحضور QR 📱</span>
              </button>
            )}

            <button
              type="button"
              onClick={async () => {
                sounds.playTap();
                const res = await meetingStore.deduplicateSameDayAttendance(currentUser);
                if (res.success) {
                  sounds.playVictory();
                  if (res.removedAttendanceCount === 0 && res.removedTransactionsCount === 0) {
                    showToast("سجلات الحضور والمعاملات نظيفة تماماً ولا يوجد أي حضور مكرر في نفس اليوم ✅");
                  } else {
                    showToast(
                      `تم حذف ${res.removedAttendanceCount} سجل حضور مكرر و ${res.removedTransactionsCount} معاملة مكررة وتصحيح أرصدة ${res.adjustedMembersCount} عضو (-${res.totalPointsRemoved} XP) بنجاح! 🧹`
                    );
                  }
                } else {
                  sounds.playClose();
                  showToast(res.error || "فشل في تنظيف الحضور المكرر", "error");
                }
              }}
              className="px-3.5 py-2.5 rounded-2xl bg-rose-600/90 hover:bg-rose-500 text-white font-black text-xs sm:text-sm shadow-md active:scale-95 transition-all cursor-pointer flex items-center gap-2 border border-rose-400/40"
              title="حذف أي تسجيل حضور مكرر لنفس الشخص في نفس اليوم وتصحيح النقاط تلقائياً"
            >
              <Sparkles className="h-4 w-4" />
              <span>تنظيف الحضور المكرر 🧹</span>
            </button>

            <button
              type="button"
              onClick={async () => {
                sounds.playTap();
                const res = await meetingStore.recalculateTeamsByAttendanceOnly(currentUser);
                if (res.success) {
                  sounds.playVictory();
                  showToast("تم تصفية وإلغاء البونص الفردي القديم وإعادة حساب وترتيب الفرق بناءً على نظام النسبة المئوية للحضور الجديد بنجاح! 🏆");
                } else {
                  sounds.playClose();
                  showToast(res.error || "فشل في إعادة الحساب", "error");
                }
              }}
              className="px-3.5 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs sm:text-sm shadow-md active:scale-95 transition-all cursor-pointer flex items-center gap-2 border border-amber-600/40"
              title="تصفية البونص الفردي القديم وإعادة حساب نقاط الفرق وترتيبها بناءً على نسبة الحضور حصرياً"
            >
              <RotateCcw className="h-4 w-4" />
              <span>تحديث وحساب السكور الجديد 🔄</span>
            </button>

            <button
              type="button"
              onClick={() => {
                sounds.playTap();
                setShowFridayMessageModal(true);
              }}
              className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-xs sm:text-sm shadow-lg shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer flex items-center gap-2 border border-emerald-400/40"
            >
              <Send className="h-4 w-4" />
              <span>رسالة تقرير يوم الجمعة 📩</span>
            </button>
          </div>
        </div>

      {/* Absentee Follow-up Notification Widget */}
      {absentCount > 0 && (
        <div className={`p-5 sm:p-6 rounded-3xl border-2 shadow-xl space-y-4 ${
          isLight
            ? "bg-rose-50/90 border-rose-300 text-slate-900"
            : "bg-rose-950/30 border-rose-500/40 text-rose-100 backdrop-blur-md"
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black flex items-center gap-2">
                  <span>قائمة الغائبين وافتقاد الأعضاء</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-mono text-xs font-bold border border-rose-500/30">
                    {absentCount} غائب
                  </span>
                </h3>
                <p className={`text-xs mt-0.5 ${isLight ? "text-slate-600" : "text-rose-300/80"}`}>
                  تم إبراز أسماء الغائبين تلقائياً لهذا الاجتماع. يمكنك نسخ رسالة الافتقاد الجماعي وإرسالها عبر الواتساب فوراً.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                sounds.playTap();
                const absentMembers = data.members.filter((m) => !attendanceMap.has(m.id));
                const absentText = absentMembers.map((m, idx) => `${idx + 1}. ${m.name} (${data.teams.find(t => t.id === m.teamId)?.name || "فريق"})`).join("\n");
                const msg = `✝️ *رسالة افتقاد وتواصل أسبوعي - اجتماع الشباب* ✝️\nكنيسة: ${data.config.churchName}\nاللقاء: ${selectedEvent?.title || "لقاء الجمعة"}\n\nأحبائنا الغائبين نبارك خدمتكم ونسأل عنكم بروح المحبة، وننتظر حضوركم ولقاءكم معنا في الاجتماع القادم:\n\n${absentText}\n\nربنا يبارك حياتكم ويعوض تعب محبتكم! 🙏`;
                navigator.clipboard.writeText(msg);
                showToast("تم نسخ رسالة الافتقاد الجماعي للغائبين بنجاح! 📱");
              }}
              className="px-4 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs sm:text-sm shadow-md transition-all cursor-pointer flex items-center gap-2 shrink-0 border border-rose-400/40"
            >
              <Copy className="h-4 w-4" />
              <span>نسخ رسالة الافتقاد الجماعي للغائبين 📱</span>
            </button>
          </div>
        </div>
      )}

        {/* Session / Meeting Picker Dropdown with Automated Fridays */}
        <div className="pt-2 flex flex-col sm:flex-row sm:items-center gap-3 border-t border-slate-800/80">
          <label className={`text-xs font-bold shrink-0 flex items-center gap-1.5 ${
            isLight ? "text-slate-700" : "text-slate-300"
          }`}>
            <Calendar className="h-4 w-4 text-teal-400" />
            <span>اختر لقاء الجمعة / الفعالية:</span>
          </label>
          <div className="relative flex-1">
            <select
              value={selectedEvent?.id || selectedEventId}
              onChange={(e) => {
                const val = e.target.value;
                if (val.startsWith("evt-friday-")) {
                  const dateStr = val.replace("evt-friday-", "");
                  handleSelectFridayDate(dateStr);
                } else {
                  setSelectedEventId(val);
                }
              }}
              className={`w-full h-11 pr-4 pl-10 rounded-2xl border-2 text-xs sm:text-sm font-bold focus:outline-none transition-colors cursor-pointer ${
                isLight
                  ? "bg-slate-50 border-slate-300 text-slate-900 focus:border-teal-500"
                  : "bg-slate-950 border-slate-700 text-white focus:border-teal-400"
              }`}
            >
              <optgroup label="🗓️ لقاءات الجمعة للموسم (مدرجة تلقائياً)">
                {seasonFridays.map((f) => {
                  const badge = f.isToday
                    ? "⭐ (اليوم)"
                    : f.isCurrentWeek
                    ? "⭐ (هذا الأسبوع)"
                    : f.isPast
                    ? "(سابقة)"
                    : "(قادمة)";
                  return (
                    <option key={f.id} value={f.id}>
                      {f.formattedArabicDate} {badge}
                    </option>
                  );
                })}
              </optgroup>

              {events.filter((e) => !e.id.startsWith("evt-friday-")).length > 0 && (
                <optgroup label="🏆 فعاليات وأنشطة خاصة">
                  {events
                    .filter((e) => !e.id.startsWith("evt-friday-"))
                    .map((evt) => (
                      <option key={evt.id} value={evt.id}>
                        {evt.title} ({evt.date}) - [+ {evt.attendancePoints} XP]
                      </option>
                    ))}
                </optgroup>
              )}
            </select>
          </div>

          {/* Quick jump to current week Friday button */}
          <button
            type="button"
            onClick={() => {
              const currentOrNearest = seasonFridays.find((f) => f.isToday || f.isCurrentWeek) || seasonFridays[0];
              if (currentOrNearest) {
                handleSelectFridayDate(currentOrNearest.date);
                showToast(`تم الانتقال إلى لقاء «${currentOrNearest.formattedArabicDate}» ⭐`, "info");
              }
            }}
            className={`px-3 py-2 rounded-xl text-xs font-black border-2 transition-all cursor-pointer active:scale-95 shrink-0 ${
              isLight
                ? "bg-teal-50 hover:bg-teal-100 text-teal-900 border-teal-300"
                : "bg-teal-950/60 hover:bg-teal-900 text-teal-300 border-teal-500/40"
            }`}
            title="الانتقال إلى جمعة هذا الأسبوع"
          >
            <span>جمعة هذا الأسبوع ⭐</span>
          </button>
        </div>
      </div>

      {/* Stats Cards (4 Metrics) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Attendance */}
        <div className={`p-4 rounded-3xl border-2 space-y-1 transition-all ${
          isLight
            ? "bg-white border-slate-300 shadow-sm text-slate-900"
            : "border-slate-800 bg-[#0B132B]/80 text-slate-100"
        }`}>
          <div className="flex items-center justify-between text-xs font-bold text-slate-400">
            <span>نسبة الحضور العامة</span>
            <CheckCircle className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-emerald-400">
            {attendancePercentage}%
          </div>
          <div className="text-[11px] font-bold text-slate-400">
            {presentCount} حاضر من أصل {totalMembersCount}
          </div>
        </div>

        {/* Servants Attendance */}
        <div className={`p-4 rounded-3xl border-2 space-y-1 transition-all ${
          isLight
            ? "bg-white border-slate-300 shadow-sm text-slate-900"
            : "border-slate-800 bg-[#0B132B]/80 text-slate-100"
        }`}>
          <div className="flex items-center justify-between text-xs font-bold text-slate-400">
            <span>حضور الخدام</span>
            <Shield className="h-4 w-4 text-purple-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-purple-400">
            {presentServantsCount} / {servantsList.length}
          </div>
          <div className="text-[11px] font-bold text-slate-400">
            {servantsList.length > 0 ? `${Math.round((presentServantsCount / servantsList.length) * 100)}% التزام` : "-"}
          </div>
        </div>

        {/* Makhdoumeen Attendance */}
        <div className={`p-4 rounded-3xl border-2 space-y-1 transition-all ${
          isLight
            ? "bg-white border-slate-300 shadow-sm text-slate-900"
            : "border-slate-800 bg-[#0B132B]/80 text-slate-100"
        }`}>
          <div className="flex items-center justify-between text-xs font-bold text-slate-400">
            <span>حضور المخدومين</span>
            <Users className="h-4 w-4 text-teal-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-teal-400">
            {presentMakhdoumeenCount} / {makhdoumeenList.length}
          </div>
          <div className="text-[11px] font-bold text-slate-400">
            {makhdoumeenList.length > 0 ? `${Math.round((presentMakhdoumeenCount / makhdoumeenList.length) * 100)}% مشاركة` : "-"}
          </div>
        </div>

        {/* Absent Count for Visitation */}
        <div className={`p-4 rounded-3xl border-2 space-y-1 transition-all ${
          isLight
            ? "bg-white border-slate-300 shadow-sm text-slate-900"
            : "border-slate-800 bg-[#0B132B]/80 text-slate-100"
        }`}>
          <div className="flex items-center justify-between text-xs font-bold text-slate-400">
            <span>للافتقاد والمتابعة</span>
            <Phone className="h-4 w-4 text-rose-500" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-rose-400">
            {absentCount} غائب
          </div>
          <div className="text-[11px] font-bold text-slate-400">
            مدرجون في رسالة الجمعة
          </div>
        </div>
      </div>

      {/* Sub-Tabs Navigation */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        <button
          type="button"
          onClick={() => { sounds.playTap(); setActiveSubTab("attendance"); }}
          className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center gap-2 border-2 ${
            activeSubTab === "attendance"
              ? "bg-teal-500 text-slate-950 border-teal-400 shadow-lg shadow-teal-500/20"
              : isLight
              ? "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
              : "bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800"
          }`}
        >
          <CheckCheck className="h-4 w-4" />
          <span>كشف الحضور والغياب الأسبوعي 📋</span>
        </button>

        <button
          type="button"
          onClick={() => { sounds.playTap(); setActiveSubTab("visitation"); }}
          className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center gap-2 border-2 ${
            activeSubTab === "visitation"
              ? "bg-rose-500 text-slate-950 border-rose-400 shadow-lg shadow-rose-500/20"
              : isLight
              ? "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
              : "bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800"
          }`}
        >
          <Phone className="h-4 w-4" />
          <span>متابعة وافتقاد الغائبين (Visitation) 📞</span>
        </button>

        <button
          type="button"
          onClick={() => { sounds.playTap(); setActiveSubTab("reminder"); }}
          className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center gap-2 border-2 ${
            activeSubTab === "reminder"
              ? "bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/20"
              : isLight
              ? "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
              : "bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800"
          }`}
        >
          <Bell className="h-4 w-4" />
          <span>تذكير الاجتماع القادم (Broadcast) 📲</span>
        </button>
      </div>

      {/* SUB-TAB 1: ATTENDANCE */}
      {activeSubTab === "attendance" && (
        <>
          {/* Filter Toolbar & Search */}
          <div className={`p-4 rounded-3xl border-2 space-y-3 ${
            isLight ? "bg-white border-slate-300 shadow-sm" : "bg-[#0B132B]/80 border-slate-800"
          }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Role Filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            <button
              type="button"
              onClick={() => setRoleFilter("all")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap border ${
                roleFilter === "all"
                  ? "bg-teal-500 text-slate-950 border-teal-400 font-black shadow-xs"
                  : isLight
                  ? "bg-slate-100 text-slate-700 border-slate-300"
                  : "bg-slate-900 text-slate-300 border-slate-800"
              }`}
            >
              الجميع ({data.members.length})
            </button>

            <button
              type="button"
              onClick={() => setRoleFilter("servants")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap border flex items-center gap-1 ${
                roleFilter === "servants"
                  ? "bg-purple-600 text-white border-purple-500 font-black shadow-xs"
                  : isLight
                  ? "bg-slate-100 text-slate-700 border-slate-300"
                  : "bg-slate-900 text-slate-300 border-slate-800"
              }`}
            >
              <span>الخدام ✝️</span>
              <span className="opacity-80">({servantsList.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setRoleFilter("members")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap border flex items-center gap-1 ${
                roleFilter === "members"
                  ? "bg-emerald-600 text-white border-emerald-500 font-black shadow-xs"
                  : isLight
                  ? "bg-slate-100 text-slate-700 border-slate-300"
                  : "bg-slate-900 text-slate-300 border-slate-800"
              }`}
            >
              <span>المخدومين 👥</span>
              <span className="opacity-80">({makhdoumeenList.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setRoleFilter("leaders")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap border flex items-center gap-1 ${
                roleFilter === "leaders"
                  ? "bg-amber-500 text-slate-950 border-amber-400 font-black shadow-xs"
                  : isLight
                  ? "bg-slate-100 text-slate-700 border-slate-300"
                  : "bg-slate-900 text-slate-300 border-slate-800"
              }`}
            >
              <span>القادة 👑</span>
            </button>
          </div>

          {/* Status Filter (حاضر / غائب) */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all ${
                statusFilter === "all"
                  ? "bg-slate-800 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              حالة الحضور: الكل
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("present")}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                statusFilter === "present"
                  ? "bg-emerald-500 text-slate-950 font-black"
                  : "text-emerald-400 hover:bg-emerald-950/40"
              }`}
            >
              <CheckCircle className="h-3.5 w-3.5" />
              <span>الحاضرون فقط ({presentCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("absent")}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                statusFilter === "absent"
                  ? "bg-rose-500 text-white font-black"
                  : "text-rose-400 hover:bg-rose-950/40"
              }`}
            >
              <XCircle className="h-3.5 w-3.5" />
              <span>الغائبون ({absentCount})</span>
            </button>
          </div>
        </div>

        {/* Search & Team Filter & Bulk Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 border-t border-slate-800/60">
          <div className="relative">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث بالاسم أو رقم الهاتف..."
              className={`w-full h-10 pr-10 pl-3 rounded-xl border text-xs focus:outline-none ${
                isLight
                  ? "bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-500 focus:border-teal-500"
                  : "bg-slate-950 border-slate-700 text-white placeholder:text-slate-500 focus:border-teal-400"
              }`}
            />
          </div>

          <div>
            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className={`w-full h-10 px-3 rounded-xl border text-xs font-bold focus:outline-none cursor-pointer ${
                isLight
                  ? "bg-slate-50 border-slate-300 text-slate-900"
                  : "bg-slate-950 border-slate-700 text-white"
              }`}
            >
              <option value="all">كافة الفرق الـ 10 🏆</option>
              {data.teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.icon} {t.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleMarkAllFilteredPresent}
              disabled={isBatchProcessing || filteredMembers.length === 0}
              className="flex-1 h-10 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 text-white font-black text-xs transition-all cursor-pointer flex items-center justify-center gap-1 shadow-xs active:scale-95 disabled:opacity-50"
            >
              <UserCheck className="h-4 w-4" />
              <span>تسجيل حضور الظاهرين ({filteredMembers.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Members Attendance List Table */}
      <div className={`rounded-3xl border-2 overflow-hidden shadow-xl ${
        isLight ? "bg-white border-slate-300" : "bg-[#0B132B]/85 border-slate-800"
      }`}>
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-teal-400" />
            <h3 className="text-sm font-black text-white">
              قائمة الأسماء المسجلة ({filteredMembers.length})
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            انقر على حالة العضو للتبديل بين (حاضر ✅ / غائب ❌) فوراً
          </span>
        </div>

        {filteredMembers.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            لا توجد أسماء مطابقة لمعايير البحث الحالية.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80 max-h-[600px] overflow-y-auto no-scrollbar">
            {filteredMembers.map((member) => {
              const team = data.teams.find((t) => t.id === member.teamId);
              const attRecord = attendanceMap.get(member.id);
              const isPresent = !!attRecord;
              const isProcessing = isProcessingId === member.id;
              const isLeader = member.role === "leader";
              const isServant = member.role === "servant" || member.role === "admin" || member.role === "priest";

              return (
                <div
                  key={member.id}
                  className={`p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                    isPresent
                      ? isLight
                        ? "bg-emerald-50/50 hover:bg-emerald-50"
                        : "bg-emerald-950/20 hover:bg-emerald-950/30"
                      : isLight
                      ? "hover:bg-slate-50"
                      : "hover:bg-slate-900/60"
                  }`}
                >
                  {/* Left: Avatar & Info */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative shrink-0">
                      <div className={`h-11 w-11 rounded-full border-2 overflow-hidden flex items-center justify-center font-black ${
                        isLeader
                          ? "border-amber-400 bg-amber-500/20 text-amber-300"
                          : isServant
                          ? "border-purple-400 bg-purple-500/20 text-purple-300"
                          : "border-slate-700 bg-slate-800 text-slate-300"
                      }`}>
                        {member.avatarUrl ? (
                          <img src={member.avatarUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span>{member.name.charAt(0)}</span>
                        )}
                      </div>
                      {/* Punctual or Attended Badge */}
                      {isPresent && (
                        <div className="absolute -bottom-1 -left-1 bg-emerald-500 text-slate-950 rounded-full p-0.5 border border-slate-950 shadow-sm">
                          <Check className="h-2.5 w-2.5 stroke-[3]" />
                        </div>
                      )}
                    </div>

                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-black text-xs sm:text-sm truncate ${
                          isLight ? "text-slate-950" : "text-white"
                        }`}>
                          {member.name}
                        </span>
                        <span className={`px-2 py-0.2 rounded-md text-[10px] font-bold border ${
                          isLeader
                            ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                            : isServant
                            ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                            : "bg-teal-500/20 text-teal-300 border-teal-500/40"
                        }`}>
                          {member.roleLabel || (isLeader ? "قائد" : isServant ? "خادم" : "مخدوم")}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-slate-400 flex-wrap">
                        {team && (
                          <span className="flex items-center gap-1 font-bold" style={{ color: team.color }}>
                            <span>{team.icon}</span>
                            <span>{team.name}</span>
                          </span>
                        )}
                        {member.phone && (
                          <>
                            <span>•</span>
                            <a
                              href={`https://wa.me/20${member.phone.replace(/^0+/, "")}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-emerald-400 hover:underline flex items-center gap-1 font-mono text-[10px]"
                              title="مراسلة سريعة عبر واتساب"
                            >
                              <Phone className="h-2.5 w-2.5" />
                              <span>{member.phone}</span>
                            </a>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Attendance Status & Toggle Button */}
                  <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                    {/* Timestamp if present */}
                    {isPresent && attRecord && (
                      <div className="text-left font-mono text-[10px] text-emerald-400/90 hidden sm:block">
                        <div className="font-bold">
                          {new Date(attRecord.scannedAt).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
                        </div>
                        <div className="text-[9px] opacity-75">
                          +{attRecord.pointsAwarded} XP
                        </div>
                      </div>
                    )}

                    {/* Toggle Button */}
                    <button
                      type="button"
                      onClick={() => handleToggleAttendance(member)}
                      disabled={isProcessing}
                      className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 disabled:opacity-50 ${
                        isPresent
                          ? "bg-emerald-500/20 hover:bg-rose-500/20 text-emerald-300 hover:text-rose-300 border border-emerald-500/40 hover:border-rose-500/40"
                          : isLight
                          ? "bg-slate-100 hover:bg-emerald-500 hover:text-slate-950 text-slate-700 border border-slate-300"
                          : "bg-slate-900 hover:bg-emerald-500 hover:text-slate-950 text-slate-300 border border-slate-800"
                      }`}
                    >
                      {isPresent ? (
                        <>
                          <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                          <span>حاضر ✅ (انقر للإلغاء)</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-3.5 w-3.5 text-rose-400" />
                          <span>غائب ❌ (انقر للتحضير)</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
        </>
      )}

      {/* SUB-TAB 2: VISITATION MANAGEMENT */}
      {activeSubTab === "visitation" && (
        <div className={`p-6 rounded-3xl border-2 space-y-6 ${
          isLight ? "bg-white border-slate-300 text-slate-900" : "bg-[#0B132B]/90 border-slate-800 text-slate-100"
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-base sm:text-lg font-black text-rose-400 flex items-center gap-2">
                <Phone className="h-5 w-5" />
                <span>إدارة واستهداف الغائبين وافتقادهم الأسبوعي</span>
              </h3>
              <p className="text-xs text-slate-400">
                إرسال رسائل افتقاد مباشرة عبر واتساب للغائبين وتسجيل تاريخ الافتقاد تلقائياً في سجل الأرشيف
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                sounds.playTap();
                const history = meetingStore.getVisitationHistory();
                const success = exportVisitationHistoryToExcel({ visitationHistory: history });
                if (success) {
                  sounds.playVictory();
                  showToast("تم تصدير سجل الافتقاد والزيارات بصيغة إكسيل بنجاح! 📊");
                } else {
                  showToast("تعذر تصدير سجل الافتقاد", "error");
                }
              }}
              className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-black shadow-md flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <Download className="h-4 w-4" />
              <span>تصدير سجل الافتقاد إكسيل 📊</span>
            </button>
          </div>

          {/* Absentees List for Current Meeting */}
          <div className="space-y-3">
            <h4 className="text-sm font-black text-white flex items-center gap-2">
              <span>الغائبون عن لقاء ({selectedEvent?.title || "الاجتماع الحالي"}):</span>
              <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-xs font-mono font-bold">
                {absentCount} غائب
              </span>
            </h4>

            {absentCount === 0 ? (
              <div className="p-8 rounded-2xl bg-emerald-950/40 border-2 border-emerald-500/30 text-center space-y-2">
                <span className="text-3xl">🎉</span>
                <h5 className="font-bold text-emerald-300 text-sm">ممتاز! نسبة حضور كاملة 100%</h5>
                <p className="text-xs text-slate-400">لا يوجد غائبون في هذا اللقاء للافتقاد.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {makhdoumeenList.filter((m) => !attendanceMap.has(m.id)).map((member) => {
                  const team = data.teams.find((t) => t.id === member.teamId);
                  return (
                    <div key={member.id} className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center font-bold text-sm text-rose-400 border border-slate-700 shrink-0">
                          {member.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <h5 className="text-sm font-black text-white truncate">{member.name}</h5>
                          <p className="text-[11px] text-slate-400 truncate">
                            {team ? team.name : "الفريق"} {member.phone ? `| 📞 ${member.phone}` : ""}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={async () => {
                          sounds.playTap();
                          await meetingStore.recordVisitation({
                            memberId: member.id,
                            servant: currentUser,
                            notes: `رسالة افتقاد واطمئنان أسبوعية`,
                          });
                          const msg = `✝️ ازيك يا ${member.name}، وحشتنا في اجتماع الشباب النهاردة في ${data.config.churchName}! صلينا لأجلك ونلتقي الجمعة القادمة بمحبة المسيح 🙏✨`;
                          const url = member.phone
                            ? `https://api.whatsapp.com/send?phone=${member.phone}&text=${encodeURIComponent(msg)}`
                            : `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
                          window.open(url, "_blank");
                          showToast(`تم تسجيل الافتقاد وإرسال رسالة الواتساب لـ (${member.name}) بنجاح! 📞`);
                        }}
                        className="w-full sm:w-auto min-h-[44px] sm:min-h-[38px] px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-sm flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shrink-0"
                      >
                        <MessageCircle className="h-4 w-4" />
                        <span>رسالة افتقاد واتساب 💬</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Visitation Archive Log (Mobile Cards + Desktop Table) */}
          <div className="space-y-3 pt-4 border-t border-slate-800">
            <h4 className="text-sm font-black text-white">سجل الافتقادات والزيارات المسجلة (Visitation History):</h4>
            {meetingStore.getVisitationHistory().length === 0 ? (
              <p className="text-xs text-slate-400">لا توجد سجلات زيارات أو افتقاد مسجلة حتى الآن.</p>
            ) : (
              <>
                {/* Mobile Stacked Cards (md:hidden) */}
                <div className="md:hidden space-y-2.5">
                  {meetingStore.getVisitationHistory().map((item) => {
                    const parsed = formatArabicTimestamp(item.visitedAt);
                    return (
                      <div
                        key={`mob-visit-${item.id}`}
                        className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-black text-white truncate">{item.memberName}</span>
                          <span className="px-2 py-0.5 rounded-lg bg-slate-800 border border-slate-700 text-[11px] font-bold text-slate-300 shrink-0">
                            {item.teamName}
                          </span>
                        </div>
                        {item.notes && (
                          <p className="text-xs text-slate-300 leading-relaxed">{item.notes}</p>
                        )}
                        <div className="flex items-center justify-between gap-2 text-[11px] pt-1.5 border-t border-slate-800/70">
                          <span className="text-amber-300 font-bold">الخادم: {item.servantName}</span>
                          <span className="font-mono text-teal-300">{parsed.dateStr} - {parsed.timeStr}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop Table (hidden md:block) */}
                <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-800">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-900 text-slate-400 font-bold border-b border-slate-800">
                      <tr>
                        <th className="p-3">المخدوم</th>
                        <th className="p-3">الفريق</th>
                        <th className="p-3">تاريخ ووقت الافتقاد</th>
                        <th className="p-3">الخادم المسؤول</th>
                        <th className="p-3">ملاحظات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 bg-slate-950/60">
                      {meetingStore.getVisitationHistory().map((item) => {
                        const parsed = formatArabicTimestamp(item.visitedAt);
                        return (
                          <tr key={item.id} className="hover:bg-slate-900/50">
                            <td className="p-3 font-bold text-white">{item.memberName}</td>
                            <td className="p-3 text-slate-300">{item.teamName}</td>
                            <td className="p-3 font-mono text-teal-300">{parsed.dateStr} - {parsed.timeStr}</td>
                            <td className="p-3 text-amber-300">{item.servantName}</td>
                            <td className="p-3 text-slate-300">{item.notes || "--"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 3: BROADCAST REMINDER */}
      {activeSubTab === "reminder" && (
        <div className={`p-6 rounded-3xl border-2 space-y-6 ${
          isLight ? "bg-white border-slate-300 text-slate-900" : "bg-[#0B132B]/90 border-slate-800 text-slate-100"
        }`}>
          <div className="space-y-1">
            <h3 className="text-base sm:text-lg font-black text-amber-400 flex items-center gap-2">
              <Bell className="h-5 w-5" />
              <span>تذكير بالاجتماع القادم (Broadcast Reminder) 📲</span>
            </h3>
            <p className="text-xs text-slate-400">
              إرسال رسالة تذكير موحدة لجميع أعضاء أسرة الشباب قبل موعد لقاء الجمعة عبر واتساب أو تليجرام
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <label className="text-xs font-bold text-amber-300 block">نص رسالة التذكير الرسمية:</label>
            <textarea
              readOnly
              rows={6}
              value={`✝️ *تذكير باجتماع شباب جامعة المبارك - ${data.config.churchName}* ✝️\n\nأحبائي شباب وفتيات الأسرة المباركة،\nنتشرف بحضوركم لقاء الجمعة الروحي والدراسي القادم في تمام الساعة 6:30 مساءً بالكنيسة.\n\n✨ *موضوع اللقاء:* دراسة في إنجيل يوحنا والتسبيح والمسابقات الروحية الكبرى بين الفرق.\n\nلا تنسوا إحضار الكتاب المقدس وإعداد الكارنيه الخاص بكم لتسجيل الحضور السريع بالـ QR كود! ننتظركم بشوق 🙏❤️`}
              className="w-full p-3 rounded-xl bg-slate-950 border border-slate-700 text-xs font-medium text-slate-200 focus:outline-none"
            />
            <div className="flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  sounds.playTap();
                  const msg = `✝️ تذكير باجتماع شباب جامعة المبارك - ${data.config.churchName} ✝️\nنتشرف بحضوركم لقاء الجمعة الروحي والدراسي القادم في تمام الساعة 6:30 مساءً بالكنيسة. ننتظركم بشوق 🙏❤️`;
                  navigator.clipboard.writeText(msg);
                  sounds.playVictory();
                  showToast("تم نسخ رسالة التذكير إلى الحافظة بنجاح! 📋");
                }}
                className="px-4 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-black shadow-md flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <Copy className="h-4 w-4" />
                <span>نسخ نص التذكير 📋</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  sounds.playTap();
                  const msg = `✝️ تذكير باجتماع شباب جامعة المبارك - ${data.config.churchName} ✝️\nنتشرف بحضوركم لقاء الجمعة الروحي والدراسي القادم في تمام الساعة 6:30 مساءً بالكنيسة. ننتظركم بشوق 🙏❤️`;
                  window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, "_blank");
                }}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-md flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <Send className="h-4 w-4" />
                <span>إرسال عبر واتساب للجميع 💬</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* FRIDAY REPORT MESSAGE MODAL (رسالة تقرير يوم الجمعة الأسبوعية) */}
      {/* ========================================================= */}
      <AnimatePresence>
        {showFridayMessageModal && (
          <div className="fixed inset-0 z-[280] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-2xl max-h-[90vh] rounded-3xl border-2 border-emerald-500/50 bg-[#0B132B] text-slate-100 p-5 sm:p-7 space-y-4 shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 flex items-center justify-center font-black">
                    <Send className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">
                      رسالة تقرير يوم الجمعة الأسبوعية 📲
                    </h3>
                    <p className="text-xs text-slate-400">
                      تقرير جاهز ومُنسّق للإرسال الفوري عبر الواتساب أو التليجرام لجروب الخدام وأبونا
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowFridayMessageModal(false)}
                  className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>

              {/* Message Preview Box */}
              <div className="flex-1 overflow-y-auto p-4 rounded-2xl bg-slate-950 border border-slate-800 font-mono text-xs leading-relaxed whitespace-pre-wrap selection:bg-emerald-500/30 text-slate-200 no-scrollbar">
                {fridayReportMessage}
              </div>

              {/* Action Buttons for Sharing */}
              <div className="pt-2 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  {/* WhatsApp Direct Share */}
                  <button
                    type="button"
                    onClick={handleSendWhatsApp}
                    className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/30 active:scale-95"
                  >
                    <MessageCircle className="h-4 w-4" />
                    <span>إرسال عبر WhatsApp 📲</span>
                  </button>

                  {/* Telegram Direct Share */}
                  <button
                    type="button"
                    onClick={handleSendTelegram}
                    className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-black text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-sky-600/30 active:scale-95"
                  >
                    <Send className="h-4 w-4" />
                    <span>إرسال عبر Telegram ✈️</span>
                  </button>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  {/* Copy to Clipboard */}
                  <button
                    type="button"
                    onClick={handleCopyFridayMessage}
                    className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20 active:scale-95"
                  >
                    {copiedSuccess ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    <span>{copiedSuccess ? "تم النسخ بنجاح! ✅" : "نسخ الرسالة 📋"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowFridayMessageModal(false)}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-bold"
                  >
                    إغلاق
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
