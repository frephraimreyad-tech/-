import React, { useState, useEffect, useMemo } from "react";
import {
  Shield,
  Zap,
  Users,
  Plus,
  Edit2,
  Trash2,
  Lock,
  Unlock,
  KeyRound,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Sparkles,
  Trophy,
  Search,
  Filter,
  RefreshCw,
  Clock,
  Eye,
  EyeOff,
  Settings,
  ChevronRight,
  TrendingUp,
  Award,
  Hash,
  X,
  Camera,
  Download,
  Share2,
  Sun,
  Moon,
} from "lucide-react";
import type { CustomTeam, ProcessedMeetingTeam, ScoreTransaction } from "../types";
import { meetingStore } from "../utils/meetingStore";
import { authStore, SUPER_ADMIN_USER, type SystemUser } from "../utils/authStore";
import { sounds } from "../utils/soundEffects";
import { useTheme } from "../utils/themeStore";
import { QRScannerModal } from "./QRScannerModal";
import { UserSwitcherModal } from "./UserSwitcherModal";
import { AdminPanel } from "./AdminPanel";
import { googleSheets } from "../utils/googleSheets";
import { PDFReportModal } from "./PDFReportModal";

interface AdminDashboardProps {
  onBackToScoreboard: () => void;
  initialPanelTab?: "quick_score" | "reasons" | "teams" | "members" | "events" | "permissions" | "log" | "settings";
}

// Preset Colors for Teams
const TEAM_PRESET_COLORS = [
  { name: "أزرق ملكي", val: "#3B82F6" },
  { name: "ذهبي كهرماني", val: "#F59E0B" },
  { name: "أخضر زمردي", val: "#10B981" },
  { name: "أرجواني إمبراطوري", val: "#8B5CF6" },
  { name: "قرمزي ياقوتي", val: "#EF4444" },
  { name: "سماوي فيروزي", val: "#06B6D4" },
  { name: "وردي نيون", val: "#EC4899" },
  { name: "برتقالي بركاني", val: "#F97316" },
  { name: "نيلي ليلي", val: "#6366F1" },
  { name: "أخضر ليموني", val: "#84CC16" },
];

// Preset Emojis / Emblems for Teams
const TEAM_PRESET_ICONS = [
  "🦅", "🦁", "⚔️", "🏆", "⚓", "🕊️", "⚡", "🔥", "🛡️", "⛵", "🌟", "👑", "✝️", "🎯", "💎", "🏹"
];

// Local Storage keys for simple security
const ADMIN_PIN_KEY = "admin_dashboard_simple_pin_v1";
const ADMIN_UNLOCKED_SESSION_KEY = "admin_dashboard_unlocked_session_v1";

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBackToScoreboard, initialPanelTab }) => {
  const { preference: themePreference, isDaytime, setPreference: setThemePreference } = useTheme();
  // Store Data & User State
  const [data, setData] = useState(meetingStore.getData());
  const [currentUser, setCurrentUser] = useState<SystemUser>(authStore.getCurrentUser());

  // Simple Security System State
  const [savedPin, setSavedPin] = useState<string>(() => {
    return localStorage.getItem(ADMIN_PIN_KEY) || "9999";
  });
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
    // If current logged user is admin, priest, leader, or servant, unlock automatically
    const r = authStore.getCurrentUser().role;
    if (r === "admin" || r === "priest" || r === "leader" || r === "servant") return true;
    return sessionStorage.getItem(ADMIN_UNLOCKED_SESSION_KEY) === "true";
  });
  const [enteredPin, setEnteredPin] = useState<string>("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [showChangePinModal, setShowChangePinModal] = useState<boolean>(false);
  const [newPinValue, setNewPinValue] = useState<string>("");
  const [showPdfReportModal, setShowPdfReportModal] = useState<boolean>(false);

  // Navigation Tabs in Admin Dashboard
  const [activeTab, setActiveTab] = useState<"teams" | "quick_points" | "security" | "history">("teams");

  // Filter / Search for Teams
  const [teamSearch, setTeamSearch] = useState<string>("");

  // Team Modals
  const [showAddTeamModal, setShowAddTeamModal] = useState<boolean>(false);
  const [editingTeam, setEditingTeam] = useState<CustomTeam | null>(null);
  const [teamToDelete, setTeamToDelete] = useState<CustomTeam | null>(null);

  // New Team Form Fields
  const [newTeamName, setNewTeamName] = useState<string>("");
  const [newTeamIcon, setNewTeamIcon] = useState<string>("🦅");
  const [newTeamColor, setNewTeamColor] = useState<string>("#3B82F6");
  const [newTeamSlogan, setNewTeamSlogan] = useState<string>("");
  const [newTeamLeader, setNewTeamLeader] = useState<string>("");
  const [newTeamDesc, setNewTeamDesc] = useState<string>("");
  const [newTeamInitialPoints, setNewTeamInitialPoints] = useState<number>(0);

  // Quick Points Update State
  const [pointTargetTeamId, setPointTargetTeamId] = useState<string>("");
  const [pointDelta, setPointDelta] = useState<number>(50);
  const [customPointAmount, setCustomPointAmount] = useState<string>("");
  const [pointReason, setPointReason] = useState<string>("");
  const [pointCategory, setPointCategory] = useState<string>("نشاط جماعي");
  const [pointOperation, setPointOperation] = useState<"add" | "deduct">("add");

  // Team Points Inline Adjuster Modal
  const [teamForPointsAdjust, setTeamForPointsAdjust] = useState<CustomTeam | null>(null);

  // Other Modals
  const [showQRScanner, setShowQRScanner] = useState<boolean>(false);
  const [showUserSwitcher, setShowUserSwitcher] = useState<boolean>(false);
  const [showAdvancedPanel, setShowAdvancedPanel] = useState<boolean>(!!initialPanelTab);
  const [panelTab, setPanelTab] = useState<"quick_score" | "reasons" | "teams" | "members" | "events" | "permissions" | "log" | "settings" | undefined>(initialPanelTab);

  // Toast / Feedback Alert
  const [feedback, setFeedback] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);

  const showFeedback = (text: string, type: "success" | "error" | "info" = "success") => {
    setFeedback({ text, type });
    setTimeout(() => setFeedback(null), 3800);
  };

  // Sync with Stores
  useEffect(() => {
    const unsubStore = meetingStore.subscribe(() => {
      setData({ ...meetingStore.getData() });
    });
    const unsubAuth = authStore.subscribe(() => {
      const user = authStore.getCurrentUser();
      setCurrentUser(user);
      if (user.role === "admin" || user.role === "priest" || user.role === "leader" || user.role === "servant") {
        setIsUnlocked(true);
      }
    });
    return () => {
      unsubStore();
      unsubAuth();
    };
  }, []);

  // Processed Teams with Rank
  const processedTeams = useMemo(() => {
    return meetingStore.getProcessedTeams();
  }, [data]);

  // Filtered Teams
  const filteredTeams = useMemo(() => {
    if (!teamSearch.trim()) return processedTeams;
    const q = teamSearch.toLowerCase().trim();
    return processedTeams.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.leaderName && t.leaderName.toLowerCase().includes(q)) ||
        (t.slogan && t.slogan.toLowerCase().includes(q))
    );
  }, [processedTeams, teamSearch]);

  // Statistics
  const totalTeams = data.teams.length;
  const totalPoints = useMemo(() => {
    return data.teams.reduce((acc, t) => acc + (t.points || 0), 0);
  }, [data.teams]);
  const topTeam = processedTeams[0];
  const avgPoints = totalTeams > 0 ? Math.round(totalPoints / totalTeams) : 0;

  // Predefined reasons
  const activityReasons = data.activityReasons || [];

  // ==========================================
  // Simple Security System Handlers
  // ==========================================
  const handleUnlockWithPin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setPinError(null);

    const clean = enteredPin.trim();
    if (!clean) {
      setPinError("يرجى إدخال الرمز السري");
      sounds.playClose();
      return;
    }

    // Verify PIN: matches saved PIN OR Super Admin code OR "9999"
    if (clean === savedPin || clean === SUPER_ADMIN_USER.accessCode || clean === "9999") {
      setIsUnlocked(true);
      setEnteredPin("");
      sessionStorage.setItem(ADMIN_UNLOCKED_SESSION_KEY, "true");
      sounds.playVictory();
      showFeedback("تم فك قفل لوحة التحكم بنجاح! مرحباً بالمسؤول.", "success");
      // Also log audit
      meetingStore.logAudit({
        userId: currentUser.id,
        userName: currentUser.name,
        userRole: currentUser.role,
        action: "security_block",
        targetType: "system",
        targetId: "admin_pin",
        targetName: "لوحة التحكم",
        details: "تم فك قفل الحماية البسيط للوحة التحكم بالرمز السري بنجاح",
        status: "success",
      });
    } else {
      setPinError("رمز المرور غير صحيح! (الرمز الافتراضي: 9999)");
      sounds.playClose();
      meetingStore.logAudit({
        userId: currentUser.id,
        userName: currentUser.name,
        userRole: currentUser.role,
        action: "security_block",
        targetType: "system",
        targetId: "admin_pin",
        targetName: "لوحة التحكم",
        details: `محاولة فاشلة لفك قفل اللوحة برمز خاطئ: [${clean}]`,
        status: "denied",
      });
    }
  };

  const handleLockDashboard = () => {
    setIsUnlocked(false);
    sessionStorage.removeItem(ADMIN_UNLOCKED_SESSION_KEY);
    sounds.playTap();
    showFeedback("تم قفل لوحة التحكم الإدارية لحماية البيانات.", "info");
  };

  const handleChangePin = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newPinValue.trim();
    if (clean.length < 4) {
      showFeedback("يجب أن يتكون الرمز السري من 4 أرقام على الأقل", "error");
      return;
    }
    setSavedPin(clean);
    localStorage.setItem(ADMIN_PIN_KEY, clean);
    setShowChangePinModal(false);
    setNewPinValue("");
    sounds.playVictory();
    showFeedback(`تم تحديث الرمز السري للإدارة بنجاح: [${clean}]`, "success");
  };

  // Helper Keypad Click
  const handleKeypadDigit = (digit: string) => {
    sounds.playTap();
    if (enteredPin.length < 8) {
      setEnteredPin((prev) => prev + digit);
    }
  };

  const handleKeypadClear = () => {
    sounds.playTap();
    setEnteredPin("");
    setPinError(null);
  };

  // ==========================================
  // Team Management Handlers (Add, Edit, Delete)
  // ==========================================
  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isUnlocked && currentUser.role !== "admin") {
      showFeedback("لوحة التحكم مقفلة! يرجى إدخال الرمز السري أولاً", "error");
      return;
    }

    if (!newTeamName.trim()) {
      showFeedback("برجاء إدخال اسم الفريق", "error");
      return;
    }

    const res = await meetingStore.addTeam(
      {
        name: newTeamName.trim(),
        icon: newTeamIcon || "🦅",
        color: newTeamColor,
        slogan: newTeamSlogan.trim(),
        leaderName: newTeamLeader.trim(),
        description: newTeamDesc.trim(),
        initialPoints: Number(newTeamInitialPoints) || 0,
      },
      currentUser
    );

    if (res.success && res.team) {
      sounds.playVictory();
      showFeedback(`تمت إضافة فريق (${res.team.name}) بنجاح!`, "success");
      setShowAddTeamModal(false);
      // Reset form
      setNewTeamName("");
      setNewTeamSlogan("");
      setNewTeamLeader("");
      setNewTeamDesc("");
      setNewTeamInitialPoints(0);
    } else {
      sounds.playClose();
      showFeedback(res.error || "تعذر إضافة الفريق، تأكد من الصلاحيات", "error");
    }
  };

  const handleUpdateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeam) return;

    if (!isUnlocked && currentUser.role !== "admin") {
      showFeedback("لوحة التحكم مقفلة! يرجى إدخال الرمز السري", "error");
      return;
    }

    const res = await meetingStore.updateTeam(
      editingTeam.id,
      {
        name: editingTeam.name.trim(),
        icon: editingTeam.icon || "🦅",
        color: editingTeam.color,
        slogan: editingTeam.slogan?.trim() || "",
        leaderName: editingTeam.leaderName?.trim() || "",
        description: editingTeam.description?.trim() || "",
      },
      currentUser
    );

    if (res.success) {
      sounds.playVictory();
      showFeedback(`تم تحديث بيانات فريق (${editingTeam.name}) بنجاح!`, "success");
      setEditingTeam(null);
    } else {
      sounds.playClose();
      showFeedback(res.error || "تعذر تحديث الفريق", "error");
    }
  };

  const handleDeleteTeamConfirm = async () => {
    if (!teamToDelete) return;

    if (!isUnlocked && currentUser.role !== "admin") {
      showFeedback("لوحة التحكم مقفلة! يرجى فك القفل أولاً", "error");
      return;
    }

    const res = await meetingStore.deleteTeam(teamToDelete.id, currentUser);
    if (res.success) {
      sounds.playVictory();
      showFeedback(`تم حذف فريق (${teamToDelete.name}) بنجاح!`, "success");
      setTeamToDelete(null);
    } else {
      sounds.playClose();
      showFeedback(res.error || "تعذر حذف الفريق", "error");
    }
  };

  // ==========================================
  // Points Management Handlers
  // ==========================================
  const handleApplyTeamPoints = async (teamId: string, deltaPoints: number, reasonText: string, categoryText: string) => {
    if (!isUnlocked && currentUser.role !== "admin") {
      showFeedback("لوحة التحكم مقفلة! أدخل الرمز السري لتحديث النقاط", "error");
      return;
    }

    const team = data.teams.find((t) => t.id === teamId);
    if (!team) return;

    const res = await meetingStore.awardPoints(
      {
        targetType: "team",
        targetId: team.id,
        points: deltaPoints,
        reason: reasonText || "تحديث نقاط الفريق من لوحة التحكم الإدارية",
        category: categoryText || "تحدي وتنافس",
      },
      currentUser
    );

    if (res) {
      sounds.playVictory();
      const sign = deltaPoints > 0 ? "+" : "";
      showFeedback(`تم تطبيق ${sign}${deltaPoints} XP لفريق (${team.name}) بنجاح! ⚡`, "success");
    } else {
      sounds.playClose();
      showFeedback("تعذر تحديث النقاط، تحقق من الصلاحيات", "error");
    }
  };

  const handleQuickPointsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pointTargetTeamId) {
      showFeedback("يرجى اختيار الفريق أولاً", "error");
      return;
    }

    const amount = customPointAmount ? parseInt(customPointAmount, 10) : pointDelta;
    if (isNaN(amount) || amount === 0) {
      showFeedback("يرجى إدخال عدد نقاط صالح", "error");
      return;
    }

    const finalPoints = pointOperation === "deduct" ? -Math.abs(amount) : Math.abs(amount);
    const finalReason = pointReason.trim() || (pointOperation === "deduct" ? "خصم نقاط بسبب مخالفة" : "رصد نقاط نشاط إضافي");

    await handleApplyTeamPoints(pointTargetTeamId, finalPoints, finalReason, pointCategory);
    setCustomPointAmount("");
    setPointReason("");
  };

  // Reset team points to 0 with confirmation
  const handleResetTeamPoints = async (team: CustomTeam) => {
    if (!isUnlocked && currentUser.role !== "admin") {
      showFeedback("لوحة التحكم مقفلة!", "error");
      return;
    }
    if (window.confirm(`هل أنت متأكد من تصفير نقاط فريق (${team.name})؟ ستصبح نقاطه 0.`)) {
      await meetingStore.awardPoints(
        {
          targetType: "team",
          targetId: team.id,
          points: -team.points,
          reason: "تصفير نقاط الفريق يدوياً من لوحة التحكم الإدارية",
          category: "إعادة ضبط",
        },
        currentUser
      );
      sounds.playVictory();
      showFeedback(`تم تصفير نقاط فريق (${team.name}) بنجاح.`, "info");
    }
  };

  if (showAdvancedPanel) {
    return <AdminPanel onBackToScoreboard={() => {
        setShowAdvancedPanel(false);
        setPanelTab(undefined);
    }} initialTab={panelTab} />;
  }

  return (
    <div className="relative min-h-screen bg-[#070A1E] text-slate-100 font-arabic selection:bg-amber-500/30 selection:text-white pb-16" dir="rtl">
      {/* Background Ambient Glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="absolute top-0 right-1/4 w-[600px] h-[350px] bg-blue-600/10 blur-[130px] rounded-full" />
        <div className="absolute top-[20%] left-10 w-[500px] h-[300px] bg-amber-500/10 blur-[140px] rounded-full" />
        <div className="absolute bottom-10 right-10 w-[450px] h-[350px] bg-emerald-500/10 blur-[140px] rounded-full" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* ========================================================= */}
        {/* TOP HEADER BAR */}
        {/* ========================================================= */}
        <header className="rounded-3xl border border-slate-800 bg-[#0B132B]/90 backdrop-blur-xl p-5 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="h-12 w-12 rounded-2xl bg-white/95 border-2 border-amber-400/80 p-0.5 flex items-center justify-center text-slate-950 shadow-lg shadow-amber-500/20 font-black overflow-hidden shrink-0">
              <img
                src={data.config.meetingLogoUrl || "/assets/aistudio/_______________________55ad5e73.png"}
                alt="لوجو الاجتماع"
                className="w-full h-full object-contain rounded-xl"
              />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  لوحة التحكم الإدارية (Admin Dashboard)
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold font-mono">
                  v2.8 نظام متكامل
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                إضافة وتعديل الفرق، وتحديث النقاط المباشر، ونظام حماية وأمان ذكي بالرمز السري
              </p>
            </div>
          </div>

          {/* Quick Actions & Security Status */}
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {/* Simple Security Badge & Toggle */}
            <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-700/80 px-3 py-1.5 rounded-2xl shadow-inner">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1">
                {isUnlocked ? (
                  <>
                    <Unlock className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="text-emerald-300">مفتوحة ومصرحة</span>
                  </>
                ) : (
                  <>
                    <Lock className="h-3.5 w-3.5 text-rose-400" />
                    <span className="text-rose-300">مقفلة بالحماية</span>
                  </>
                )}
              </span>

              {isUnlocked ? (
                <button
                  type="button"
                  onClick={handleLockDashboard}
                  className="px-2 py-0.5 rounded-lg bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/40 text-[11px] font-black transition-all cursor-pointer mr-1"
                  title="قفل لوحة التحكم فوراً لمنع التعديلات غير المصرح بها"
                >
                  قفل الآن 🔒
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setActiveTab("security")}
                  className="px-2 py-0.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 border border-emerald-500/40 text-[11px] font-black transition-all cursor-pointer mr-1"
                  title="إدخال رمز المرور لفك القفل"
                >
                  فك القفل 🔑
                </button>
              )}
            </div>

            {/* User Switcher / Current User Badge */}
            <button
              type="button"
              onClick={() => {
                sounds.playTap();
                setShowUserSwitcher(true);
              }}
              className="px-3.5 py-1.5 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95"
              title="تبديل حساب المستخدم النشط"
            >
              <KeyRound className="h-3.5 w-3.5 text-amber-400" />
              <span>{currentUser.name.split(" ")[0]} ({currentUser.roleLabel})</span>
            </button>

            {/* Direct QR Attendance Scan */}
            <button
              type="button"
              onClick={() => {
                sounds.playTap();
                setShowQRScanner(true);
              }}
              className="px-3.5 py-1.5 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-emerald-500/20 active:scale-95"
              title="مسح QR للحضور الفوري"
            >
              <Camera className="h-3.5 w-3.5" />
              <span>مسح QR للحضور 📱</span>
            </button>

            {/* Advanced Settings & System Panel Button */}
            <button
              type="button"
              onClick={() => {
                sounds.playTap();
                setShowAdvancedPanel(true);
              }}
              className="px-3 py-1.5 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95"
              title="فتح لوحة الإعدادات الشاملة (الأعضاء والفعاليات والنسخ الاحتياطي)"
            >
              <Settings className="h-3.5 w-3.5 text-slate-400" />
              <span>إعدادات شاملة ⚙️</span>
            </button>

            {/* PDF Report Export Button */}
            <button
              type="button"
              onClick={() => {
                sounds.playTap();
                setShowPdfReportModal(true);
              }}
              className="px-3.5 py-1.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-amber-500/20 active:scale-95"
              title="تصدير تقرير نهائي لنتائج وترتيب الفرق بتنسيق PDF أو صورة للتليجرام والواتساب"
            >
              <Download className="h-3.5 w-3.5" />
              <span>تقرير النتائج PDF 📄</span>
            </button>

            {/* Theme Switcher Toggle (Auto Time / Day / Night) */}
            <div className="flex items-center gap-1 bg-slate-900/90 border border-amber-500/30 p-1 rounded-2xl shadow-sm">
              <button
                type="button"
                onClick={() => {
                  sounds.playTap();
                  setThemePreference("auto");
                }}
                className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  themePreference === "auto"
                    ? "bg-amber-500 text-slate-950 font-black shadow-xs"
                    : "text-slate-300 hover:text-white"
                }`}
                title={`تلقائي حسب الوقت (${isDaytime ? "نهار ☀️ 06:00-18:00" : "ليل 🌙 18:00-06:00"})`}
              >
                <Clock className="h-3.5 w-3.5" />
                <span>تلقائي ({isDaytime ? "☀️" : "🌙"})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  sounds.playTap();
                  setThemePreference("light");
                }}
                className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  themePreference === "light"
                    ? "bg-amber-400 text-slate-950 font-black shadow-xs"
                    : "text-slate-300 hover:text-white"
                }`}
                title="الوضع النهاري"
              >
                <Sun className="h-3.5 w-3.5 text-amber-600" />
                <span>نهاري</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  sounds.playTap();
                  setThemePreference("dark");
                }}
                className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  themePreference === "dark"
                    ? "bg-indigo-600 text-white font-black shadow-xs"
                    : "text-slate-300 hover:text-white"
                }`}
                title="الوضع الليلي"
              >
                <Moon className="h-3.5 w-3.5 text-indigo-300" />
                <span>ليلي</span>
              </button>
            </div>

            {/* Back to Public Scoreboard */}
            <button
              type="button"
              onClick={() => {
                sounds.playTap();
                onBackToScoreboard();
              }}
              className="px-4 py-1.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-amber-500/20 active:scale-95"
            >
              <span>لوحة الشرف الكبرى</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* ========================================================= */}
        {/* STATS OVERVIEW CARDS */}
        {/* ========================================================= */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 rounded-3xl border border-slate-800 bg-[#0B132B]/80 backdrop-blur-md shadow-lg space-y-1">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>إجمالي الفرق المشاركة</span>
              <Shield className="h-4 w-4 text-blue-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white font-mono">
              {totalTeams}
            </div>
            <div className="text-[11px] text-slate-400">
              {data.members.length} عضو مسجل بالفرق
            </div>
          </div>

          <div className="p-4 rounded-3xl border border-slate-800 bg-[#0B132B]/80 backdrop-blur-md shadow-lg space-y-1">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>مجموع النقاط الممنوحة</span>
              <Zap className="h-4 w-4 text-amber-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-amber-400 font-mono">
              {totalPoints.toLocaleString()} <span className="text-xs text-amber-300 font-arabic">XP</span>
            </div>
            <div className="text-[11px] text-slate-400">
              متوسط: {avgPoints.toLocaleString()} XP لكل فريق
            </div>
          </div>

          <div className="p-4 rounded-3xl border border-slate-800 bg-[#0B132B]/80 backdrop-blur-md shadow-lg space-y-1">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>الفريق المتصدر حالياً</span>
              <Trophy className="h-4 w-4 text-yellow-400" />
            </div>
            <div className="text-base sm:text-lg font-black text-emerald-400 truncate flex items-center gap-1.5">
              <span>{topTeam?.icon || "🏆"}</span>
              <span className="truncate">{topTeam?.name || "لا يوجد فرق"}</span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono">
              {topTeam ? `${topTeam.points.toLocaleString()} XP` : "-"}
            </div>
          </div>

          <div className="p-4 rounded-3xl border border-slate-800 bg-[#0B132B]/80 backdrop-blur-md shadow-lg space-y-1">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>حالة الحماية والأمان</span>
              <Lock className="h-4 w-4 text-purple-400" />
            </div>
            <div className="text-base sm:text-lg font-black flex items-center gap-1.5">
              {isUnlocked ? (
                <span className="text-emerald-400 flex items-center gap-1">
                  <CheckCircle className="h-4 w-4" /> موثقة ومفتوحة
                </span>
              ) : (
                <span className="text-rose-400 flex items-center gap-1">
                  <Lock className="h-4 w-4" /> محمية برقم PIN
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-400">
              {isUnlocked ? "مسموح بتحديث الفرق والنقاط" : "أدخل الرمز السري للتعديل"}
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* TOAST FEEDBACK NOTIFICATION */}
        {/* ========================================================= */}
        {feedback && (
          <div
            className={`p-4 rounded-2xl border flex items-center gap-3 shadow-xl transition-all animate-bounce ${
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

        {/* ========================================================= */}
        {/* TAB BUTTONS NAVIGATION */}
        {/* ========================================================= */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <button
            type="button"
            onClick={() => {
              sounds.playTap();
              setActiveTab("teams");
            }}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "teams"
                ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20 font-black scale-102"
                : "bg-slate-900/80 text-slate-300 hover:bg-slate-800 border border-slate-800"
            }`}
          >
            <Shield className="h-4 w-4" />
            <span>إدارة وتعديل الفرق 🛡️ ({data.teams.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              sounds.playTap();
              setActiveTab("quick_points");
            }}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "quick_points"
                ? "bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-lg shadow-amber-500/20 font-black scale-102"
                : "bg-slate-900/80 text-slate-300 hover:bg-slate-800 border border-slate-800"
            }`}
          >
            <Zap className="h-4 w-4" />
            <span>تحديث النقاط المباشر ⚡</span>
          </button>

          <button
            type="button"
            onClick={() => {
              sounds.playTap();
              setActiveTab("security");
            }}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "security"
                ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/20 font-black scale-102"
                : "bg-slate-900/80 text-slate-300 hover:bg-slate-800 border border-slate-800"
            }`}
          >
            <Lock className="h-4 w-4" />
            <span>نظام الحماية والـ PIN 🔒</span>
          </button>

          <button
            type="button"
            onClick={() => {
              sounds.playTap();
              setActiveTab("history");
            }}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "history"
                ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/20 font-black scale-102"
                : "bg-slate-900/80 text-slate-300 hover:bg-slate-800 border border-slate-800"
            }`}
          >
            <Clock className="h-4 w-4" />
            <span>سجل المعاملات والتاريخ 📜</span>
          </button>

          <button
            type="button"
            onClick={() => {
              sounds.playTap();
              setActiveTab("google_sheets" as any);
            }}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
              (activeTab as any) === "google_sheets"
                ? "bg-gradient-to-r from-emerald-600 to-green-600 text-white shadow-lg shadow-emerald-500/20 font-black scale-102"
                : "bg-slate-900/80 text-slate-300 hover:bg-slate-800 border border-slate-800"
            }`}
          >
            <Share2 className="h-4 w-4" />
            <span>ربط Google Sheets 📊</span>
          </button>
        </div>

        {/* ========================================================= */}
        {/* TAB 1: TEAMS MANAGEMENT (إضافة وتعديل الفرق) */}
        {/* ========================================================= */}
        {activeTab === "teams" && (
          <div className="space-y-6">
            {/* Action Bar: Search & Add Team */}
            <div className="rounded-3xl border border-slate-800 bg-[#0B132B]/80 p-5 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="relative w-full sm:w-96">
                <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={teamSearch}
                  onChange={(e) => setTeamSearch(e.target.value)}
                  placeholder="ابحث عن اسم فريق أو قائد أو شعار..."
                  className="w-full h-11 pr-10 pl-4 rounded-2xl bg-slate-900 border border-slate-700 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-400 shadow-inner"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    sounds.playTap();
                    setShowAddTeamModal(true);
                  }}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs sm:text-sm shadow-md shadow-blue-600/30 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>إضافة فريق جديد 🛡️</span>
                </button>
              </div>
            </div>

            {/* Locked Warning Banner if not unlocked */}
            {!isUnlocked && (
              <div className="p-4 rounded-3xl bg-slate-900/90 border border-amber-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                    <Lock className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-amber-300">لوحة التعديل محمية بالرمز السري</h4>
                    <p className="text-xs text-slate-300">
                      يمكنك استعراض الفرق فقط. لإضافة أو تعديل أي فريق أو تغيير النقاط، يرجى فك القفل بالرمز السري (الافتراضي: 9999).
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab("security")}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all cursor-pointer whitespace-nowrap self-end sm:self-auto"
                >
                  إدخال الرمز السري 🔑
                </button>
              </div>
            )}

            {/* Teams Grid Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTeams.length === 0 ? (
                <div className="col-span-full py-16 text-center text-slate-400 text-sm bg-slate-900/40 rounded-3xl border border-slate-800 space-y-3">
                  <Shield className="h-12 w-12 mx-auto text-slate-600" />
                  <p>لا توجد فرق مطابقة للبحث أو لم يتم إنشاء فرق بعد.</p>
                  <button
                    type="button"
                    onClick={() => setShowAddTeamModal(true)}
                    className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-xs"
                  >
                    إضافة أول فريق الآن
                  </button>
                </div>
              ) : (
                filteredTeams.map((team) => (
                  <div
                    key={team.id}
                    className="rounded-3xl border border-slate-800 bg-[#0B132B]/85 backdrop-blur-md p-5 shadow-xl hover:border-slate-700 transition-all flex flex-col justify-between space-y-4 group"
                    style={{ borderTopColor: team.color, borderTopWidth: 4 }}
                  >
                    {/* Top Row: Icon, Name, Rank, Points */}
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <span
                            className="text-3xl p-2 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm"
                            style={{ boxShadow: `0 0 15px ${team.color}25` }}
                          >
                            {team.icon}
                          </span>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h3 className="text-base sm:text-lg font-black text-white group-hover:text-blue-300 transition-colors">
                                {team.name}
                              </h3>
                              <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono font-bold">
                                #{team.rank}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 line-clamp-1">
                              {team.slogan || "لا يوجد شعار"}
                            </p>
                          </div>
                        </div>

                        {/* Points Badge */}
                        <div className="text-left shrink-0">
                          <div className="text-xl sm:text-2xl font-black text-amber-400 font-mono">
                            {team.points.toLocaleString()}
                          </div>
                          <span className="text-[10px] text-amber-300/80 font-bold">
                            XP تراكمي
                          </span>
                        </div>
                      </div>

                      {/* Team Hierarchy Details: Leader -> Servant -> Makhdoumeen */}
                      <div className="grid grid-cols-3 gap-1.5 text-xs pt-1 border-t border-slate-800/80 text-slate-300">
                        <div className="p-2 rounded-xl bg-amber-950/20 border border-amber-500/20 text-center">
                          <span className="text-[10px] text-amber-400/80 block font-bold">👑 القائد</span>
                          <span className="font-black text-amber-200 text-[11px] truncate block mt-0.5">
                            {team.leaderName || (team.leadersCount > 0 ? `${team.leadersCount}` : "—")}
                          </span>
                        </div>
                        <div className="p-2 rounded-xl bg-purple-950/20 border border-purple-500/20 text-center">
                          <span className="text-[10px] text-purple-300/80 block font-bold">✝️ الخدام</span>
                          <span className="font-black text-purple-200 text-[11px] block mt-0.5">
                            {team.servantsCount || 0}
                          </span>
                        </div>
                        <div className="p-2 rounded-xl bg-teal-950/20 border border-teal-500/20 text-center">
                          <span className="text-[10px] text-teal-300/80 block font-bold">👥 المخدومين</span>
                          <span className="font-black text-teal-200 text-[11px] block mt-0.5">
                            {team.makhdoumeenCount !== undefined ? team.makhdoumeenCount : team.membersCount}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons: Points Update, Edit, Delete */}
                    <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-1.5 flex-wrap">
                      {/* Update Points Button */}
                      <button
                        type="button"
                        onClick={() => {
                          sounds.playTap();
                          setTeamForPointsAdjust(team);
                        }}
                        className="flex-1 py-2 px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/30 text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
                      >
                        <Zap className="h-3.5 w-3.5" />
                        <span>تحديث النقاط ⚡</span>
                      </button>

                      {/* Edit Team Button */}
                      <button
                        type="button"
                        onClick={() => {
                          sounds.playTap();
                          setEditingTeam(team);
                        }}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-blue-600 text-slate-300 hover:text-white border border-slate-700 text-xs transition-all cursor-pointer"
                        title="تعديل بيانات الفريق"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>

                      {/* Reset Team Points */}
                      <button
                        type="button"
                        onClick={() => handleResetTeamPoints(team)}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-amber-600 text-slate-300 hover:text-slate-950 border border-slate-700 text-xs transition-all cursor-pointer"
                        title="تصفير نقاط الفريق"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </button>

                      {/* Delete Team Button */}
                      <button
                        type="button"
                        onClick={() => {
                          sounds.playTap();
                          setTeamToDelete(team);
                        }}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white border border-slate-700 text-xs transition-all cursor-pointer"
                        title="حذف الفريق"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: QUICK POINTS UPDATER (تحديث ورصد النقاط) */}
        {/* ========================================================= */}
        {activeTab === "quick_points" && (
          <div className="rounded-3xl border border-slate-800 bg-[#0B132B]/85 backdrop-blur-xl p-5 sm:p-7 shadow-2xl space-y-6">
            <div className="border-b border-slate-800 pb-4">
              <h2 className="text-lg sm:text-xl font-black text-amber-300 flex items-center gap-2">
                <Zap className="h-5 w-5 text-amber-400" />
                <span>رصد وتحديث النقاط المباشر (+ / - XP) للفرق</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                اختر الفريق والعملية (إضافة أو خصم) وعدد النقاط والسبب، وسيتم التحديث لحظياً على شاشة العرض الكبرى!
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* LEFT: Points Form */}
              <div className="lg:col-span-2 space-y-6">
                <form onSubmit={handleQuickPointsSubmit} className="space-y-6">
                  {/* Select Target Team */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-300 block">
                      1. اختر الفريق المستهدف بالرصد:
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                      {data.teams.map((t) => {
                        const isSelected = pointTargetTeamId === t.id;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => {
                              sounds.playTap();
                              setPointTargetTeamId(t.id);
                            }}
                            className={`p-3 rounded-2xl border text-right transition-all cursor-pointer flex items-center gap-2.5 ${
                              isSelected
                                ? "bg-amber-500/20 border-amber-400 text-white font-black shadow-md shadow-amber-500/10 scale-102"
                                : "bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-800"
                            }`}
                          >
                            <span className="text-2xl">{t.icon}</span>
                            <div className="min-w-0 flex-1">
                              <span className="text-xs font-bold block truncate">{t.name}</span>
                              <span className="text-[10px] text-amber-400 font-mono block">
                                {t.points.toLocaleString()} XP
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Operation: Add or Deduct */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-300 block">
                      2. نوع العملية (إضافة نقاط تفوق أو خصم):
                    </label>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          sounds.playTap();
                          setPointOperation("add");
                        }}
                        className={`flex-1 py-3 px-4 rounded-2xl font-black text-xs sm:text-sm border transition-all cursor-pointer flex items-center justify-center gap-2 ${
                          pointOperation === "add"
                            ? "bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-md"
                            : "bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800"
                        }`}
                      >
                        <Plus className="h-4 w-4 text-emerald-400" />
                        <span>إضافة نقاط (+ XP) ⚡</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          sounds.playTap();
                          setPointOperation("deduct");
                        }}
                        className={`flex-1 py-3 px-4 rounded-2xl font-black text-xs sm:text-sm border transition-all cursor-pointer flex items-center justify-center gap-2 ${
                          pointOperation === "deduct"
                            ? "bg-rose-500/20 border-rose-500 text-rose-300 shadow-md"
                            : "bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800"
                        }`}
                      >
                        <span className="text-base font-mono">-</span>
                        <span>خصم نقاط (- XP) ⚠️</span>
                      </button>
                    </div>
                  </div>

                  {/* Amount of Points */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-300 block">
                      3. مقدار النقاط:
                    </label>
                    <div className="flex items-center gap-2 flex-wrap">
                      {[10, 25, 50, 100, 150, 200, 500].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => {
                            sounds.playTap();
                            setPointDelta(val);
                            setCustomPointAmount("");
                          }}
                          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-mono font-black border transition-all cursor-pointer ${
                            pointDelta === val && !customPointAmount
                              ? "bg-amber-500 text-slate-950 border-amber-400 shadow-sm"
                              : "bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800"
                          }`}
                        >
                          {pointOperation === "deduct" ? `-${val}` : `+${val}`} XP
                        </button>
                      ))}

                      <div className="flex items-center gap-1.5 mr-auto">
                        <span className="text-xs text-slate-400">أو قيمة مخصصة:</span>
                        <input
                          type="number"
                          value={customPointAmount}
                          onChange={(e) => setCustomPointAmount(e.target.value)}
                          placeholder="XP مخصص"
                          className="w-28 h-9 px-3 rounded-xl bg-slate-900 border border-slate-700 text-xs text-amber-300 font-mono font-bold focus:outline-none focus:border-amber-400"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Reason Selection */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-300 block">
                      4. سبب الرصد / نوع النشاط المعتمد:
                    </label>
                    {meetingStore.getActivityReasons().length > 0 && (
                      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                        {meetingStore.getActivityReasons().map((r) => (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => {
                              sounds.playTap();
                              setPointReason(r.text);
                              setPointDelta(r.points);
                              setPointCategory(r.category);
                              setCustomPointAmount("");
                            }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                              pointReason === r.text
                                ? "bg-amber-500 text-slate-950 border-amber-400 font-black shadow-sm"
                                : "bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800"
                            }`}
                          >
                            <span>{r.icon}</span>
                            <span>{r.text}</span>
                            <span className="font-mono text-[11px] opacity-80">({r.points} XP)</span>
                          </button>
                        ))}
                      </div>
                    )}

                    <input
                      type="text"
                      value={pointReason}
                      onChange={(e) => setPointReason(e.target.value)}
                      placeholder="أو اكتب سبب الرصد أو تفاصيل النشاط هنا..."
                      className="w-full h-11 px-4 rounded-2xl bg-slate-900 border border-slate-700 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  {/* Submit Button */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-sm sm:text-base shadow-xl shadow-amber-500/20 active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Zap className="h-5 w-5" />
                      <span>
                        اعتماد وتحديث النقاط فوراً (
                        {pointOperation === "deduct" ? "-" : "+"}
                        {customPointAmount || pointDelta} XP)
                      </span>
                    </button>
                  </div>
                </form>
              </div>

              {/* RIGHT: Live Feed & Mini Board */}
              <div className="space-y-6">
                {/* Mini Leaderboard */}
                <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
                  <h3 className="text-xs font-black text-white flex items-center gap-1.5 uppercase tracking-wider">
                    <Trophy className="h-3.5 w-3.5 text-amber-400" />
                    <span>ترتيب الفرق المباشر</span>
                  </h3>
                  <div className="space-y-2">
                    {meetingStore.getProcessedTeams().slice(0, 5).map((t, idx) => (
                      <div key={t.id} className="flex items-center justify-between p-2 rounded-xl bg-slate-950/50 border border-slate-800/50">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-[10px] font-mono font-black text-slate-500 w-4">#{idx + 1}</span>
                          <span className="text-base">{t.icon}</span>
                          <span className="text-[11px] font-bold text-white truncate">{t.name}</span>
                        </div>
                        <span className="text-[11px] font-mono font-black text-amber-400">{t.points.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Live Transactions Feed */}
                <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
                  <h3 className="text-xs font-black text-white flex items-center gap-1.5 uppercase tracking-wider">
                    <Clock className="h-3.5 w-3.5 text-emerald-400" />
                    <span>آخر التحديثات المسجلة</span>
                  </h3>
                  <div className="space-y-2.5">
                    {data.transactions.slice(0, 5).map((tx) => (
                      <div key={tx.id} className="text-[10px] space-y-1 p-2 rounded-xl border border-slate-800 bg-slate-950/30 animate-in fade-in slide-in-from-right-2 duration-300">
                        <div className="flex justify-between items-center">
                          <span className="font-black text-white">{tx.targetName}</span>
                          <span className={`font-mono font-black ${tx.points > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                            {tx.points > 0 ? "+" : ""}{tx.points} XP
                          </span>
                        </div>
                        <div className="text-slate-400 truncate">{tx.reason}</div>
                        <div className="text-[8px] text-slate-600 flex justify-between items-center">
                           <span>بواسطة: {tx.executorName?.split(" ")[0]}</span>
                           <span>{new Date(tx.timestamp).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                      </div>
                    ))}
                    {data.transactions.length === 0 && (
                      <p className="text-center py-4 text-slate-600 text-[10px]">لا توجد عمليات مؤخراً</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: SIMPLE SECURITY SYSTEM (نظام الحماية والـ PIN) */}
        {/* ========================================================= */}
        {activeTab === "security" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* PIN Unlock Card / Keypad */}
            <div className="rounded-3xl border border-slate-800 bg-[#0B132B]/85 backdrop-blur-xl p-6 shadow-2xl space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="h-10 w-10 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                    <KeyRound className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">
                      قفل الحماية والتحقق من الهوية
                    </h3>
                    <p className="text-xs text-slate-400">
                      نظام حماية بسيط لمنع التعديلات العشوائية
                    </p>
                  </div>
                </div>

                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold border ${
                    isUnlocked
                      ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                      : "bg-rose-500/15 border-rose-500/30 text-rose-400"
                  }`}
                >
                  {isUnlocked ? "مفتوحة 🔓" : "مقفلة 🔒"}
                </span>
              </div>

              {/* Current Status Explanation */}
              <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-xs text-slate-300 space-y-1">
                <p>
                  الرمز السري الافتراضي للمسؤول: <strong className="text-amber-300 font-mono font-bold">9999</strong>
                </p>
                <p className="text-[11px] text-slate-400">
                  بمجرد إدخال الرمز الصحيح، سيتم تفعيل وضع التعديل وتحديث النقاط والفرق دون قيود.
                </p>
              </div>

              {/* PIN Input & Keypad */}
              <form onSubmit={handleUnlockWithPin} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 block">
                    أدخل رمز PIN السري:
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      value={enteredPin}
                      onChange={(e) => setEnteredPin(e.target.value)}
                      maxLength={8}
                      placeholder="••••"
                      className="w-full h-12 text-center tracking-[0.5em] text-xl font-mono font-black rounded-2xl bg-slate-950 border border-slate-700 text-amber-300 focus:outline-none focus:border-purple-400 shadow-inner"
                    />
                  </div>
                </div>

                {pinError && (
                  <div className="p-2.5 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs font-bold flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
                    <span>{pinError}</span>
                  </div>
                )}

                {/* Keypad Buttons (1-9, 0, Clear) */}
                <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
                  {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
                    <button
                      key={digit}
                      type="button"
                      onClick={() => handleKeypadDigit(digit)}
                      className="h-11 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white font-mono font-black text-lg transition-all cursor-pointer active:scale-95"
                    >
                      {digit}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={handleKeypadClear}
                    className="h-11 rounded-xl bg-slate-900 hover:bg-rose-950 text-rose-400 border border-slate-700 text-xs font-bold transition-all cursor-pointer"
                  >
                    مسح C
                  </button>
                  <button
                    type="button"
                    onClick={() => handleKeypadDigit("0")}
                    className="h-11 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white font-mono font-black text-lg transition-all cursor-pointer active:scale-95"
                  >
                    0
                  </button>
                  <button
                    type="submit"
                    className="h-11 rounded-xl bg-purple-600 hover:bg-purple-500 text-white border border-purple-500 font-bold text-xs transition-all cursor-pointer active:scale-95"
                  >
                    تأكيد ✓
                  </button>
                </div>

                {/* Lock / Unlock Toggle Button */}
                <div className="pt-2 flex items-center gap-2">
                  {isUnlocked ? (
                    <button
                      type="button"
                      onClick={handleLockDashboard}
                      className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Lock className="h-4 w-4" />
                      <span>قفل لوحة التحكم فوراً 🔒</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleUnlockWithPin()}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-black text-xs transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-purple-600/20"
                    >
                      <Unlock className="h-4 w-4" />
                      <span>فك القفل واعتماد التعديل 🔓</span>
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* Security Settings & PIN Modification */}
            <div className="rounded-3xl border border-slate-800 bg-[#0B132B]/85 backdrop-blur-xl p-6 shadow-2xl space-y-5">
              <div className="flex items-center gap-2.5 border-b border-slate-800 pb-4">
                <div className="h-10 w-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Settings className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">
                    إعدادات الحماية وتغيير الرمز
                  </h3>
                  <p className="text-xs text-slate-400">
                    تخصيص الرمز السري للإدارة وتعيين صلاحيات المسؤولين
                  </p>
                </div>
              </div>

              <div className="space-y-4 text-xs text-slate-300">
                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white">الرمز السري الحالي:</span>
                    <span className="font-mono px-2 py-0.5 rounded bg-slate-950 border border-slate-700 text-amber-300 font-bold tracking-widest">
                      {isUnlocked ? savedPin : "••••"}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    يمكنك تغيير هذا الرمز في أي وقت لحماية لوحة التحكم من التعديلات غير المصرح بها أثناء العرض.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      sounds.playTap();
                      setShowChangePinModal(true);
                    }}
                    className="w-full mt-2 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40 font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    <span>تغيير الرمز السري (Change PIN)</span>
                  </button>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                  <h4 className="font-bold text-white flex items-center gap-1.5">
                    <Shield className="h-4 w-4 text-emerald-400" />
                    <span>مبادئ الحماية المطبقة في النظام:</span>
                  </h4>
                  <ul className="space-y-1.5 text-slate-400 pr-4 list-disc text-[11px]">
                    <li>تثبيت هوية المسؤول المختص وتوثيق العمليات في سجل المراجعة (Audit Log).</li>
                    <li>منع إضافة أو حذف الفرق أو تعديل النقاط في حال كانت اللوحة مقفلة.</li>
                    <li>إمكانية استخدام قادة المجموعات لماسح QR لتسجيل حضور فرقهم دون إمكانية التعديل اليدوي للنقاط.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 4: TRANSACTION & AUDIT LOG (سجل المعاملات والتاريخ) */}
        {/* ========================================================= */}
        {activeTab === "history" && (
          <div className="rounded-3xl border border-slate-800 bg-[#0B132B]/85 backdrop-blur-xl p-5 sm:p-7 shadow-2xl space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <Clock className="h-5 w-5 text-emerald-400" />
                  <span>سجل المعاملات والعمليات التاريخي</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  توثيق دقيق لكافة عمليات رصد النقاط وتعديل الفرق مع اسم المنفذ والتاريخ بالثانية
                </p>
              </div>

              <span className="px-3 py-1 rounded-full bg-slate-900 border border-slate-700 text-emerald-300 font-mono text-xs font-bold">
                {data.transactions.length} معاملة مسجلة
              </span>
            </div>

            {data.transactions.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                لا توجد معاملات مسجلة بعد. عند تحديث نقاط أي فريق ستظهر تفاصيلها هنا فوراً.
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-800 overflow-hidden bg-slate-900/60">
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-950 text-slate-400 text-[11px] font-bold border-b border-slate-800 sticky top-0">
                      <tr>
                        <th className="p-3">التاريخ والوقت</th>
                        <th className="p-3">المستهدف</th>
                        <th className="p-3">النقاط</th>
                        <th className="p-3">النشاط / السبب</th>
                        <th className="p-3">المسؤول المنفذ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80">
                      {data.transactions.slice(0, 50).map((tx) => (
                        <tr key={tx.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="p-3 text-slate-400 font-mono whitespace-nowrap">
                            {new Date(tx.timestamp).toLocaleString("ar-EG", {
                              hour: "2-digit",
                              minute: "2-digit",
                              day: "numeric",
                              month: "short",
                            })}
                          </td>
                          <td className="p-3 font-bold text-white whitespace-nowrap">
                            {tx.targetName}
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded font-mono font-bold ${
                                tx.points > 0
                                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                  : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                              }`}
                            >
                              {tx.points > 0 ? `+${tx.points}` : tx.points} XP
                            </span>
                          </td>
                          <td className="p-3 text-slate-300 min-w-[180px]">
                            {tx.reason}
                          </td>
                          <td className="p-3 text-slate-400 whitespace-nowrap">
                            {tx.executorName || "المسؤول"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 5: GOOGLE SHEETS SYNC (ربط وجدولة المزامنة) */}
        {/* ========================================================= */}
        {(activeTab as any) === "google_sheets" && (
          <div className="rounded-3xl border border-slate-800 bg-[#0B132B]/85 backdrop-blur-xl p-5 sm:p-7 shadow-2xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <Share2 className="h-5 w-5 text-emerald-400" />
                  <span>ربط ومزامنة جداول بيانات جوجل (Google Sheets)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  احتفظ بنسخة احتياطية دائمة ومجانية من كافة بيانات الاجتماع والفرق والدرجات في حسابك الخاص
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Connection Status */}
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-blue-400" />
                  <span>حالة الاتصال والربط</span>
                </h4>
                
                {!authStore.getGoogleUser() ? (
                  <div className="space-y-3">
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs leading-relaxed">
                      ⚠️ لم يتم تسجيل الدخول بحساب جوجل. يرجى تسجيل الدخول أولاً لتمكين المزامنة مع جداول البيانات.
                    </div>
                    <button
                      onClick={async () => {
                        sounds.playTap();
                        const res = await authStore.loginWithGoogle();
                        if (res.success) {
                          showFeedback("تم تسجيل الدخول بحساب جوجل بنجاح!", "success");
                        } else {
                          showFeedback(res.error || "فشل تسجيل الدخول", "error");
                        }
                      }}
                      className="w-full py-3 rounded-xl bg-white text-slate-900 font-black text-xs flex items-center justify-center gap-2 hover:bg-slate-100 transition-all cursor-pointer"
                    >
                      <img src="https://www.google.com/favicon.ico" className="h-4 w-4" alt="Google" />
                      <span>تسجيل الدخول باستخدام Google</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                      {authStore.getGoogleUser()?.photoURL && (
                        <div className="h-10 w-10 rounded-full border-2 border-emerald-500 overflow-hidden shrink-0">
                          <img src={authStore.getGoogleUser()?.photoURL || ""} alt="User" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-black text-white truncate">{authStore.getGoogleUser()?.displayName}</div>
                        <div className="text-[10px] text-slate-400 truncate">{authStore.getGoogleUser()?.email}</div>
                      </div>
                      <button 
                        onClick={() => authStore.logout()}
                        className="text-[10px] font-bold text-rose-400 hover:text-rose-300"
                      >
                        خروج
                      </button>
                    </div>

                    {!googleSheets.getSpreadsheetId() ? (
                      <div className="space-y-3">
                        <p className="text-xs text-slate-300">
                          جاهز للربط! يمكنك إنشاء ملف شيت جديد الآن ليبدأ النظام في حفظ البيانات عليه.
                        </p>
                        <button
                          onClick={async () => {
                            try {
                              sounds.playTap();
                              showFeedback("جاري إنشاء ملف الشيت...", "info");
                              const id = await googleSheets.createMeetingSheet(`بيانات اجتماع الشباب - ${data.config.meetingName}`);
                              showFeedback("تم إنشاء الملف وربطه بنجاح! 🎉", "success");
                              setData({ ...meetingStore.getData() }); // Refresh
                            } catch (e: any) {
                              showFeedback(e.message, "error");
                            }
                          }}
                          className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
                        >
                          إنشاء ملف شيت جديد للاجتماع 📊
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30">
                          <div className="text-[10px] text-slate-400 block mb-1">معرف الملف المرتبط:</div>
                          <code className="text-[10px] text-blue-300 font-mono break-all">{googleSheets.getSpreadsheetId()}</code>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => window.open(`https://docs.google.com/spreadsheets/d/${googleSheets.getSpreadsheetId()}`, "_blank")}
                            className="flex-1 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-[11px] font-bold border border-slate-700 transition-all cursor-pointer"
                          >
                            فتح الملف في جوجل 🔗
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm("هل أنت متأكد من إلغاء ربط هذا الملف؟ لن يتم حذف البيانات من جوجل ولكن سيتوقف الموقع عن استخدامه.")) {
                                googleSheets.setSpreadsheetId("");
                                setData({ ...meetingStore.getData() });
                              }
                            }}
                            className="px-3 py-2 rounded-lg bg-rose-950/30 text-rose-400 hover:bg-rose-500 hover:text-white text-[11px] font-bold border border-rose-500/30 transition-all cursor-pointer"
                          >
                            إلغاء الربط
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Sync Actions */}
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-5">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-400" />
                  <span>عمليات المزامنة والنسخ</span>
                </h4>

                <div className="grid grid-cols-1 gap-3">
                  <button
                    disabled={!googleSheets.getSpreadsheetId()}
                    onClick={async () => {
                      sounds.playTap();
                      showFeedback("جاري رفع البيانات إلى جوجل...", "info");
                      const res = await meetingStore.syncToSheets();
                      if (res.success) {
                        showFeedback("تم رفع كافة البيانات بنجاح! ✅", "success");
                      } else {
                        showFeedback(res.error || "فشل الرفع", "error");
                      }
                    }}
                    className="group relative overflow-hidden p-4 rounded-xl border border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 transition-all text-right disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-black text-blue-300">رفع البيانات (Upload)</span>
                      <ArrowRight className="h-4 w-4 text-blue-400 -rotate-90" />
                    </div>
                    <p className="text-[10px] text-slate-400">تحديث ملف الشيت بالبيانات الموجودة حالياً في الموقع (الفرق، الأعضاء، النقاط)</p>
                  </button>

                  <button
                    disabled={!googleSheets.getSpreadsheetId()}
                    onClick={async () => {
                      if (window.confirm("هل أنت متأكد؟ هذا سيقوم باستبدال البيانات الحالية في الموقع بالبيانات الموجودة في جوجل شيت.")) {
                        sounds.playTap();
                        showFeedback("جاري جلب البيانات من جوجل...", "info");
                        const res = await meetingStore.syncFromSheets();
                        if (res.success) {
                          showFeedback("تم استيراد البيانات بنجاح! 📥", "success");
                        } else {
                          showFeedback(res.error || "فشل الاستيراد", "error");
                        }
                      }
                    }}
                    className="group relative overflow-hidden p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 transition-all text-right disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-black text-emerald-300">جلب البيانات (Download)</span>
                      <ArrowRight className="h-4 w-4 text-emerald-400 rotate-90" />
                    </div>
                    <p className="text-[10px] text-slate-400">تحميل البيانات من جوجل شيت إلى الموقع (مفيد لاستعادة نسخة سابقة أو مزامنة جهاز آخر)</p>
                  </button>
                </div>

                <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700 text-[10px] text-slate-400 leading-relaxed">
                  <span className="font-bold text-slate-300 block mb-1">نصيحة للمدير:</span>
                  يمكنك تعديل درجات الفرق أو أسماء الأعضاء يدوياً من ملف الشيت في جوجل، ثم الضغط على "جلب البيانات" لتظهر التعديلات هنا فوراً.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* MODAL 1: ADD NEW TEAM */}
      {/* ========================================================= */}
      {showAddTeamModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setShowAddTeamModal(false)}
        >
          <div
            className="relative w-full max-w-lg rounded-3xl border border-slate-700 bg-[#0B132B] p-6 shadow-2xl text-slate-100 space-y-4 max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowAddTeamModal(false)}
              className="absolute top-4 left-4 p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="space-y-1">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-400" />
                <span>إضافة فريق جديد للوحة الشرف</span>
              </h3>
              <p className="text-xs text-slate-400">
                أدخل اسم الفريق، الأيقونة، اللون المميز، الشعار، والنقاط الافتتاحية
              </p>
            </div>

            <form onSubmit={handleCreateTeam} className="space-y-4">
              {/* Team Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">اسم الفريق *</label>
                <input
                  type="text"
                  required
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="مثال: نسور السماء، أسود داود، حماة الإيمان..."
                  className="w-full h-11 px-3.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-400"
                />
              </div>

              {/* Icon / Emblem Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">شعار / أيقونة الفريق:</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {TEAM_PRESET_ICONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setNewTeamIcon(emoji)}
                      className={`h-10 w-10 text-xl rounded-xl border transition-all cursor-pointer flex items-center justify-center ${
                        newTeamIcon === emoji
                          ? "bg-blue-600 border-blue-400 scale-110 shadow-sm"
                          : "bg-slate-900 border-slate-800 hover:bg-slate-800"
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Team Color */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">اللون المميز للفريق:</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {TEAM_PRESET_COLORS.map((c) => (
                    <button
                      key={c.val}
                      type="button"
                      onClick={() => setNewTeamColor(c.val)}
                      className={`h-8 w-8 rounded-full transition-all cursor-pointer border-2 ${
                        newTeamColor === c.val
                          ? "scale-110 border-white shadow-md"
                          : "border-transparent opacity-75 hover:opacity-100"
                      }`}
                      style={{ backgroundColor: c.val }}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>

              {/* Slogan */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">شعار أو آية الفريق:</label>
                <input
                  type="text"
                  value={newTeamSlogan}
                  onChange={(e) => setNewTeamSlogan(e.target.value)}
                  placeholder="مثال: «أستطيع كل شيء في المسيح الذي يقويني»"
                  className="w-full h-10 px-3.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-400"
                />
              </div>

              {/* Leader & Initial Points */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 block">اسم قائد الفريق:</label>
                  <input
                    type="text"
                    value={newTeamLeader}
                    onChange={(e) => setNewTeamLeader(e.target.value)}
                    placeholder="اسم القائد..."
                    className="w-full h-10 px-3.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-400"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 block">النقاط الافتتاحية (XP):</label>
                  <input
                    type="number"
                    value={newTeamInitialPoints}
                    onChange={(e) => setNewTeamInitialPoints(Number(e.target.value))}
                    min={0}
                    placeholder="0"
                    className="w-full h-10 px-3.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-amber-300 font-mono font-bold focus:outline-none focus:border-blue-400"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">وصف نبذة عن الفريق:</label>
                <textarea
                  rows={2}
                  value={newTeamDesc}
                  onChange={(e) => setNewTeamDesc(e.target.value)}
                  placeholder="ملاحظات أو وصف إضافي..."
                  className="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-400 resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddTeamModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="h-4 w-4" />
                  <span>حفظ وإضافة الفريق 🛡️</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: EDIT TEAM */}
      {/* ========================================================= */}
      {editingTeam && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setEditingTeam(null)}
        >
          <div
            className="relative w-full max-w-lg rounded-3xl border border-slate-700 bg-[#0B132B] p-6 shadow-2xl text-slate-100 space-y-4 max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setEditingTeam(null)}
              className="absolute top-4 left-4 p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="space-y-1">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <Edit2 className="h-5 w-5 text-blue-400" />
                <span>تعديل بيانات فريق ({editingTeam.name})</span>
              </h3>
              <p className="text-xs text-slate-400">
                قم بتحديث اسم الفريق أو الشعار أو القائد واللون المميز
              </p>
            </div>

            <form onSubmit={handleUpdateTeam} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">اسم الفريق:</label>
                <input
                  type="text"
                  required
                  value={editingTeam.name}
                  onChange={(e) => setEditingTeam({ ...editingTeam, name: e.target.value })}
                  className="w-full h-11 px-3.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-400"
                />
              </div>

              {/* Icon Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">أيقونة الفريق:</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {TEAM_PRESET_ICONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setEditingTeam({ ...editingTeam, icon: emoji })}
                      className={`h-10 w-10 text-xl rounded-xl border transition-all cursor-pointer flex items-center justify-center ${
                        editingTeam.icon === emoji
                          ? "bg-blue-600 border-blue-400 scale-110 shadow-sm"
                          : "bg-slate-900 border-slate-800 hover:bg-slate-800"
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">لون الفريق:</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {TEAM_PRESET_COLORS.map((c) => (
                    <button
                      key={c.val}
                      type="button"
                      onClick={() => setEditingTeam({ ...editingTeam, color: c.val })}
                      className={`h-8 w-8 rounded-full transition-all cursor-pointer border-2 ${
                        editingTeam.color === c.val
                          ? "scale-110 border-white shadow-md"
                          : "border-transparent opacity-75 hover:opacity-100"
                      }`}
                      style={{ backgroundColor: c.val }}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>

              {/* Slogan */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">الشعار / الآية:</label>
                <input
                  type="text"
                  value={editingTeam.slogan || ""}
                  onChange={(e) => setEditingTeam({ ...editingTeam, slogan: e.target.value })}
                  className="w-full h-10 px-3.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-400"
                />
              </div>

              {/* Leader */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">اسم القائد:</label>
                <input
                  type="text"
                  value={editingTeam.leaderName || ""}
                  onChange={(e) => setEditingTeam({ ...editingTeam, leaderName: e.target.value })}
                  className="w-full h-10 px-3.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-400"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingTeam(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle className="h-4 w-4" />
                  <span>حفظ التعديلات</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: INLINE TEAM POINTS ADJUSTER */}
      {/* ========================================================= */}
      {teamForPointsAdjust && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setTeamForPointsAdjust(null)}
        >
          <div
            className="relative w-full max-w-md rounded-3xl border border-slate-700 bg-[#0B132B] p-6 shadow-2xl text-slate-100 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setTeamForPointsAdjust(null)}
              className="absolute top-4 left-4 p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3">
              <span className="text-3xl p-2 rounded-2xl bg-slate-900 border border-slate-800">
                {teamForPointsAdjust.icon}
              </span>
              <div>
                <h3 className="text-lg font-black text-white">
                  تحديث نقاط: {teamForPointsAdjust.name}
                </h3>
                <span className="text-xs text-amber-400 font-mono font-bold">
                  الرصيد الحالي: {teamForPointsAdjust.points.toLocaleString()} XP
                </span>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <span className="text-xs font-bold text-slate-300 block">
                أزرار سريعة لتحديث النقاط:
              </span>
              <div className="grid grid-cols-3 gap-2">
                {[25, 50, 100, 150, 200, 500].map((pts) => (
                  <button
                    key={pts}
                    type="button"
                    onClick={async () => {
                      await handleApplyTeamPoints(
                        teamForPointsAdjust.id,
                        pts,
                        `رصد نقاط سريع (+${pts} XP) من شاشة التعديل`,
                        "تحدي فوري"
                      );
                      setTeamForPointsAdjust(null);
                    }}
                    className="py-2.5 px-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 border border-emerald-500/30 text-xs font-mono font-black transition-all cursor-pointer active:scale-95"
                  >
                    +{pts} XP
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1">
                {[-25, -50, -100].map((pts) => (
                  <button
                    key={pts}
                    type="button"
                    onClick={async () => {
                      await handleApplyTeamPoints(
                        teamForPointsAdjust.id,
                        pts,
                        `خصم نقاط (${pts} XP) من شاشة التعديل`,
                        "خصم مخالفة"
                      );
                      setTeamForPointsAdjust(null);
                    }}
                    className="py-2.5 px-3 rounded-xl bg-rose-500/15 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/30 text-xs font-mono font-black transition-all cursor-pointer active:scale-95"
                  >
                    {pts} XP
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 4: DELETE CONFIRMATION */}
      {/* ========================================================= */}
      {teamToDelete && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setTeamToDelete(null)}
        >
          <div
            className="relative w-full max-w-sm rounded-3xl border border-rose-500/50 bg-[#0B132B] p-6 shadow-2xl text-slate-100 space-y-4 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-14 w-14 mx-auto rounded-3xl bg-rose-500/20 text-rose-400 flex items-center justify-center">
              <Trash2 className="h-7 w-7" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-black text-white">تأكيد حذف الفريق؟</h3>
              <p className="text-xs text-slate-300">
                هل أنت متأكد من رغبتك في حذف فريق (
                <strong className="text-rose-400 font-bold">{teamToDelete.name}</strong>)؟
                سيتم حذف كافة بياناته وسجلات أعضائه.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setTeamToDelete(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
              >
                إلغاء التراجع
              </button>
              <button
                type="button"
                onClick={handleDeleteTeamConfirm}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black transition-all cursor-pointer shadow-md"
              >
                تأكيد الحذف ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 5: CHANGE ADMIN PIN */}
      {/* ========================================================= */}
      {showChangePinModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setShowChangePinModal(false)}
        >
          <div
            className="relative w-full max-w-sm rounded-3xl border border-slate-700 bg-[#0B132B] p-6 shadow-2xl text-slate-100 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowChangePinModal(false)}
              className="absolute top-4 left-4 p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="space-y-1">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-amber-400" />
                <span>تعيين رمز سري جديد (PIN)</span>
              </h3>
              <p className="text-xs text-slate-400">
                أدخل 4 أرقام أو أحرف لتكون رمز المرور الجديد للوحة التحكم
              </p>
            </div>

            <form onSubmit={handleChangePin} className="space-y-4">
              <input
                type="text"
                required
                maxLength={8}
                value={newPinValue}
                onChange={(e) => setNewPinValue(e.target.value)}
                placeholder="مثال: 1234 أو 9999"
                className="w-full h-11 text-center font-mono font-black text-lg px-3 rounded-xl bg-slate-900 border border-slate-700 text-amber-300 focus:outline-none focus:border-amber-400"
              />

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowChangePinModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all shadow-md"
                >
                  حفظ الرمز السري الجديد
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Scanner Modal */}
      {showQRScanner && (
        <QRScannerModal onClose={() => setShowQRScanner(false)} />
      )}

      {/* User Switcher Modal */}
      {showUserSwitcher && (
        <UserSwitcherModal onClose={() => setShowUserSwitcher(false)} />
      )}

      {/* PDF Report Export Modal */}
      {showPdfReportModal && (
        <PDFReportModal onClose={() => setShowPdfReportModal(false)} />
      )}
    </div>
  );
};
