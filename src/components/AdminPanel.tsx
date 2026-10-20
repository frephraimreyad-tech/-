import React, { useState, useEffect, useMemo } from "react";
import {
  Zap,
  Users,
  Shield,
  Clock,
  Settings,
  Plus,
  Trash2,
  Edit2,
  ArrowRight,
  Download,
  Upload,
  RotateCcw,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Calendar,
  Filter,
  Search,
  FileText,
  ChevronDown,
  ChevronUp,
  Share2,
  QrCode,
  KeyRound,
  Lock,
  Unlock,
  ShieldCheck,
  Eye,
  Camera,
  Check,
  X,
  CreditCard,
} from "lucide-react";
import type {
  ActivityReason,
  AttendanceRecord,
  AuditLogEntry,
  CustomMember,
  CustomTeam,
  EventSession,
  MeetingConfig,
  MemberPermissions,
  RoleType,
  ScoreTransaction,
} from "../types";
import { meetingStore } from "../utils/meetingStore";
import { sounds } from "../utils/soundEffects";
import { formatArabicTimestamp } from "../utils/dateFormatter";
import { authStore, type SystemUser, getRoleDefaultPermissions } from "../utils/authStore";
import { QRCodeModal } from "./QRCodeModal";
import { QRScannerModal } from "./QRScannerModal";
import { UserSwitcherModal } from "./UserSwitcherModal";
import { MemberCard } from "./MemberCard";

interface AdminPanelProps {
  onBackToScoreboard: () => void;
  initialTab?: "quick_score" | "reasons" | "teams" | "members" | "events" | "permissions" | "log" | "settings";
}

const EMOJI_OPTIONS = ["🦁", "⚔️", "📜", "🕊️", "⭐", "👑", "🛡️", "⚓", "🌿", "📖", "❤️", "🔥", "⛵", "🦅", "💡", "🎺"];

const COLOR_OPTIONS = [
  { name: "ذهبي", hex: "#EAB308" },
  { name: "أحمر قرمزي", hex: "#EF4444" },
  { name: "أزرق ملكي", hex: "#3B82F6" },
  { name: "أخضر زمردي", hex: "#10B981" },
  { name: "بنفسجي", hex: "#8B5CF6" },
  { name: "وردي", hex: "#EC4899" },
  { name: "برتقالي", hex: "#F97316" },
  { name: "سماوي", hex: "#06B6D4" },
];

const REASON_CATEGORIES = [
  "حضور والتزام",
  "مسابقة روحية",
  "نشاط وتحدي",
  "خدمة ومحبة",
  "تحدي فوري",
  "إبداع ومواهب",
  "دوري رياضي",
  "ألحان وترانيم",
  "حفظ آيات",
  "نقاط عامة",
];

const REASON_EMOJI_OPTIONS = [
  "🎯", "⏰", "📖", "💡", "❤️", "✨", "🏓", "🎵", "🏆", "🦁", "⚔️", "📜", "🕊️", "⭐", "👑", "🛡️", "🔥", "⛵", "🌿"
];

export const AdminPanel: React.FC<AdminPanelProps> = ({ onBackToScoreboard, initialTab }) => {
  const [activeTab, setActiveTab] = useState<
    "quick_score" | "reasons" | "teams" | "members" | "events" | "permissions" | "log" | "settings"
  >(initialTab || "quick_score");

  // Auth User
  const [currentUser, setCurrentUser] = useState<SystemUser>(authStore.getCurrentUser());
  const [showUserSwitcher, setShowUserSwitcher] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState<boolean | string>(false);
  const [activeQRModalEvent, setActiveQRModalEvent] = useState<EventSession | null>(null);
  const [previewingCardMember, setPreviewingCardMember] = useState<CustomMember | null>(null);

  // Store data
  const [data, setData] = useState(meetingStore.getData());
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // In-app confirmation modal state (replaces window.confirm which is blocked in iframes)
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
  } | null>(null);

  useEffect(() => {
    const unsubStore = meetingStore.subscribe(() => {
      setData({ ...meetingStore.getData() });
    });
    const unsubAuth = authStore.subscribe(() => {
      setCurrentUser(authStore.getCurrentUser());
    });
    return () => {
      unStore();
      unsubAuth();
    };
    function unStore() {
      unsubStore();
    }
  }, []);

  // Sync local form states if store changes externally
  useEffect(() => {
    setMeetingConfig(data.config);
  }, [data.config]);

  const showFeedback = (text: string, type: "success" | "error" = "success") => {
    setFeedbackMsg({ text, type });
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  // --- Quick Score State ---
  const [scoreTargetType, setScoreTargetType] = useState<"team" | "member">("team");
  const [selectedTargetId, setSelectedTargetId] = useState<string>(data.teams[0]?.id || "");
  const [scorePoints, setScorePoints] = useState<number>(50);
  const [scoreReason, setScoreReason] = useState<string>("");
  const [scoreCategory, setScoreCategory] = useState<string>("نقاط عامة");
  const [scoreCustomDate, setScoreCustomDate] = useState<string>("");
  const [scoreNotes, setScoreNotes] = useState<string>("");
  const [showAdvancedTimeOptions, setShowAdvancedTimeOptions] = useState<boolean>(false);

  // --- Historical Log Filters State ---
  const [logTeamFilter, setLogTeamFilter] = useState<string>("all");
  const [logCategoryFilter, setLogCategoryFilter] = useState<string>("all");
  const [logSearchQuery, setLogSearchQuery] = useState<string>("");

  // --- Events and QR State ---
  const [newEventTitle, setNewEventTitle] = useState("");
  const [newEventDesc, setNewEventDesc] = useState("");
  const [newEventPoints, setNewEventPoints] = useState(30);
  const [newEventBonus, setNewEventBonus] = useState(15);
  const [newEventStartTime, setNewEventStartTime] = useState("18:30");
  const [newEventDate, setNewEventDate] = useState(new Date().toISOString().slice(0, 10));
  const [newEventCode, setNewEventCode] = useState("");

  // --- Permissions Management State ---
  const [editingMember, setEditingMember] = useState<CustomMember | null>(null);
  const [permFormRole, setPermFormRole] = useState<RoleType>("member");
  const [permFormCode, setPermFormCode] = useState<string>("");
  const [permFormFlags, setPermFormFlags] = useState<MemberPermissions>(getRoleDefaultPermissions("member"));
  const [auditFilterAction, setAuditFilterAction] = useState<string>("all");

  // Update selected target if list changes
  useEffect(() => {
    if (scoreTargetType === "team" && !data.teams.some((t) => t.id === selectedTargetId)) {
      setSelectedTargetId(data.teams[0]?.id || "");
    } else if (scoreTargetType === "member" && !data.members.some((m) => m.id === selectedTargetId)) {
      setSelectedTargetId(data.members[0]?.id || "");
    }
  }, [scoreTargetType, data.teams, data.members]);

  const handleApplyPoints = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTargetId) {
      showFeedback("برجاء اختيار الفريق أو العضو المستهدف", "error");
      return;
    }
    if (scorePoints === 0) {
      showFeedback("برجاء إدخال قيمة نقاط صحيحة", "error");
      return;
    }

    const tx = await meetingStore.awardPoints(
      {
        targetType: scoreTargetType,
        targetId: selectedTargetId,
        points: scorePoints,
        reason: scoreReason || (scorePoints > 0 ? "رصد نقاط مباشرة" : "خصم نقاط"),
        category: scoreCategory,
        timestamp: scoreCustomDate ? new Date(scoreCustomDate).toISOString() : new Date().toISOString(),
        notes: scoreNotes,
      },
      currentUser
    );

    if (tx) {
      sounds.playVictory();
      showFeedback(`تم إضافة ${scorePoints > 0 ? "+" : ""}${scorePoints} XP بنجاح إلى ${tx.targetName}!`);
      setScoreReason("");
      setScoreNotes("");
      setScoreCustomDate("");
      setShowAdvancedTimeOptions(false);
    } else {
      sounds.playClose();
      showFeedback(
        currentUser.permissions.canAwardPoints
          ? "تعذر تطبيق النقاط، تأكد من البيانات"
          : "🔒 عملية محظورة: ليس لديك صلاحية لإضافة أو تعديل النقاط. هذه الصلاحية مقصورة على المسؤولين فقط.",
        "error"
      );
    }
  };

  // --- Activity Reasons Form & Management State ---
  const [newReasonText, setNewReasonText] = useState("");
  const [newReasonCategory, setNewReasonCategory] = useState("نشاط وتحدي");
  const [newReasonPoints, setNewReasonPoints] = useState(30);
  const [newReasonIcon, setNewReasonIcon] = useState("🎯");
  const [editingReasonId, setEditingReasonId] = useState<string | null>(null);

  const handleSaveReason = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReasonText.trim()) {
      showFeedback("برجاء إدخال اسم النشاط أو سبب رصد النقاط", "error");
      return;
    }

    if (editingReasonId) {
      meetingStore.updateActivityReason(editingReasonId, {
        text: newReasonText.trim(),
        category: newReasonCategory.trim() || "نشاط وتحدي",
        points: newReasonPoints,
        icon: newReasonIcon,
      });
      sounds.playTap();
      showFeedback("تم تحديث سبب الرصد / نوع النشاط بنجاح!");
      setEditingReasonId(null);
    } else {
      meetingStore.addActivityReason({
        text: newReasonText.trim(),
        category: newReasonCategory.trim() || "نشاط وتحدي",
        points: newReasonPoints,
        icon: newReasonIcon,
      });
      sounds.playTap();
      showFeedback(`تمت إضافة "${newReasonText}" إلى أسباب رصد النقاط!`);
    }

    setNewReasonText("");
    setNewReasonPoints(30);
  };

  const handleStartEditReason = (reason: ActivityReason) => {
    setEditingReasonId(reason.id);
    setNewReasonText(reason.text);
    setNewReasonCategory(reason.category);
    setNewReasonPoints(reason.points);
    setNewReasonIcon(reason.icon || "🎯");
    setActiveTab("reasons");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDeleteReason = (reasonId: string, text: string) => {
    setConfirmDialog({
      title: "تأكيد حذف سبب الرصد",
      message: `هل أنت متأكد من رغبتك في حذف "${text}" من قائمة أسباب رصد النقاط؟`,
      confirmLabel: "نعم، حذف السبب",
      cancelLabel: "إلغاء",
      onConfirm: () => {
        meetingStore.deleteActivityReason(reasonId);
        sounds.playTap();
        showFeedback(`تم حذف سبب "${text}" بنجاح!`);
        setConfirmDialog(null);
      },
    });
  };

  const handleResetReasonsToDefaults = () => {
    setConfirmDialog({
      title: "استعادة أسباب الرصد الافتراضية",
      message: "هل تريد استعادة قائمة الأسباب والأنشطة النموذجية الافتراضية؟ سيتم إرجاع البنود الأساسية.",
      confirmLabel: "استعادة الافتراضي",
      cancelLabel: "إلغاء",
      onConfirm: () => {
        meetingStore.resetActivityReasonsToDefault();
        sounds.playTap();
        showFeedback("تمت استعادة أسباب الرصد والأنشطة الافتراضية بنجاح!");
        setConfirmDialog(null);
      },
    });
  };

  // --- Team Management Form State ---
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamIcon, setNewTeamIcon] = useState("🦁");
  const [newTeamColor, setNewTeamColor] = useState("#EAB308");
  const [newTeamSlogan, setNewTeamSlogan] = useState("");
  const [newTeamLeader, setNewTeamLeader] = useState("");
  const [newTeamPoints, setNewTeamPoints] = useState(0);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);

  const handleSaveTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) {
      showFeedback("برجاء إدخال اسم الفريق", "error");
      return;
    }

    if (editingTeamId) {
      await meetingStore.updateTeam(editingTeamId, {
        name: newTeamName.trim(),
        icon: newTeamIcon,
        color: newTeamColor,
        slogan: newTeamSlogan.trim(),
        leaderName: newTeamLeader.trim(),
      });
      sounds.playTap();
      showFeedback("تم تحديث بيانات الفريق بنجاح!");
      setEditingTeamId(null);
    } else {
      await meetingStore.addTeam({
        name: newTeamName,
        icon: newTeamIcon,
        color: newTeamColor,
        slogan: newTeamSlogan,
        leaderName: newTeamLeader,
        initialPoints: newTeamPoints,
      });
      sounds.playTap();
      showFeedback(`تم إضافة "${newTeamName}" بنجاح إلى الفرق!`);
    }

    // Reset team form
    setNewTeamName("");
    setNewTeamSlogan("");
    setNewTeamLeader("");
    setNewTeamPoints(0);
  };

  const handleStartEditTeam = (team: CustomTeam) => {
    setEditingTeamId(team.id);
    setNewTeamName(team.name);
    setNewTeamIcon(team.icon);
    setNewTeamColor(team.color);
    setNewTeamSlogan(team.slogan || "");
    setNewTeamLeader(team.leaderName || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDeleteTeam = (teamId: string, name: string) => {
    setConfirmDialog({
      title: "تأكيد حذف الفريق",
      message: `هل أنت متأكد من رغبتك في حذف فريق "${name}"؟ سيتم حذف بيانات الفريق وكافة أعضائه وسجلات نقاطه نهائياً من السكور بورد.`,
      confirmLabel: "نعم، حذف الفريق",
      cancelLabel: "إلغاء",
      onConfirm: async () => {
        await meetingStore.deleteTeam(teamId);
        sounds.playTap();
        showFeedback(`تم حذف فريق "${name}" بنجاح!`);
        setConfirmDialog(null);
      },
    });
  };

  // --- Member Management Form State ---
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberTeamId, setNewMemberTeamId] = useState(data.teams[0]?.id || "");
  const [newMemberRole, setNewMemberRole] = useState<"member" | "leader" | "servant">("member");
  const [newMemberPhone, setNewMemberPhone] = useState("");
  const [newMemberAvatarUrl, setNewMemberAvatarUrl] = useState("");
  const [memberSearchTerm, setMemberSearchTerm] = useState("");
  const [memberSubTab, setMemberSubTab] = useState<RoleType>("member");
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);

  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim()) {
      showFeedback("برجاء إدخال اسم المشارك", "error");
      return;
    }
    if (!newMemberTeamId) {
      showFeedback("برجاء اختيار الفريق التابع له", "error");
      return;
    }

    if (editingMemberId) {
      await meetingStore.updateMember(editingMemberId, {
        name: newMemberName,
        teamId: newMemberTeamId,
        role: newMemberRole,
        phone: newMemberPhone,
        avatarUrl: newMemberAvatarUrl,
      });
      sounds.playVictory();
      showFeedback(`تم تحديث بيانات "${newMemberName}" بنجاح!`);
    } else {
      await meetingStore.addMember({
        name: newMemberName,
        teamId: newMemberTeamId,
        role: newMemberRole,
        phone: newMemberPhone,
        avatarUrl: newMemberAvatarUrl,
      });
      sounds.playTap();
      showFeedback(`تم إضافة "${newMemberName}" إلى أعضاء الفريق!`);
    }
    
    setEditingMemberId(null);
    setNewMemberName("");
    setNewMemberPhone("");
    setNewMemberAvatarUrl("");
  };

  const handleStartEditMember = (member: CustomMember) => {
    setEditingMemberId(member.id);
    setNewMemberName(member.name);
    setNewMemberTeamId(member.teamId);
    setNewMemberRole(member.role as any);
    setNewMemberPhone(member.phone || "");
    setNewMemberAvatarUrl(member.avatarUrl || "");
    sounds.playTap();
    // Scroll to form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteMember = (memberId: string, name: string) => {
    setConfirmDialog({
      title: "تأكيد حذف المشارك",
      message: `هل أنت متأكد من رغبتك في حذف "${name}" من قائمة أعضاء الفريق؟`,
      confirmLabel: "نعم، حذف المشارك",
      cancelLabel: "إلغاء",
      onConfirm: async () => {
        await meetingStore.deleteMember(memberId);
        sounds.playTap();
        showFeedback(`تم حذف المشارك "${name}"`);
        setConfirmDialog(null);
      },
    });
  };

  // --- Settings & Backup ---
  const [meetingConfig, setMeetingConfig] = useState<MeetingConfig>(data.config);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    await meetingStore.updateConfig(meetingConfig);
    sounds.playTap();
    showFeedback("تم حفظ إعدادات الاجتماع بنجاح!");
  };

  const handleExportJson = () => {
    const jsonStr = meetingStore.exportDataJson();
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `meeting_scoreboard_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    sounds.playTap();
    showFeedback("تم تنزيل النسخة الاحتياطية بنجاح!");
  };

  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      const result = await meetingStore.importDataJson(content);
      if (result.success) {
        sounds.playVictory();
        showFeedback("تم استيراد كشف الفرق والبيانات بنجاح!");
      } else {
        showFeedback(result.error || "فشل استيراد الملف، تأكد من صحة تنسيق JSON", "error");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleResetScoresOnly = () => {
    setConfirmDialog({
      title: "تصفير النقاط وبدء موسم جديد",
      message: "هل تريد تصفير نقاط جميع الفرق والأعضاء وبدء دورة مسابقات جديدة؟ سيتم الاحتفاظ بجميع أسماء الفرق والأعضاء كما هي.",
      confirmLabel: "تصفير النقاط الآن",
      cancelLabel: "تراجع",
      onConfirm: async () => {
        await meetingStore.resetScoresOnly();
        sounds.playTap();
        showFeedback("تم تصفير النقاط لبدء موسم جديد بنجاح!");
        setConfirmDialog(null);
      },
    });
  };

  const handleResetToDefaults = () => {
    setConfirmDialog({
      title: "استعادة الفرق النموذجية الافتراضية",
      message: "هل تريد استعادة البيانات والفرق النموذجية الافتراضية؟ سيتم استبدال التعديلات الحالية بالكامل.",
      confirmLabel: "استعادة الافتراضي",
      cancelLabel: "إلغاء",
      onConfirm: async () => {
        await meetingStore.resetToDefaults();
        sounds.playTap();
        showFeedback("تمت استعادة البيانات النموذجية الافتراضية بنجاح");
        setConfirmDialog(null);
      },
    });
  };

  // --- Historical Log Filters & Statistics ---
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    data.transactions.forEach((tx) => {
      if (tx.category) cats.add(tx.category);
    });
    REASON_CATEGORIES.forEach((c) => cats.add(c));
    return Array.from(cats);
  }, [data.transactions]);

  const filteredTransactions = useMemo(() => {
    return data.transactions.filter((tx) => {
      // Team filter
      if (logTeamFilter !== "all") {
        const matchesTeam =
          tx.teamId === logTeamFilter ||
          (tx.targetType === "team" && tx.targetId === logTeamFilter);
        if (!matchesTeam) return false;
      }
      // Category filter
      if (logCategoryFilter !== "all") {
        if ((tx.category || "عام") !== logCategoryFilter) return false;
      }
      // Search query
      if (logSearchQuery.trim()) {
        const q = logSearchQuery.toLowerCase();
        const inReason = tx.reason.toLowerCase().includes(q);
        const inTarget = tx.targetName.toLowerCase().includes(q);
        const inTeam = tx.teamName.toLowerCase().includes(q);
        const inNotes = (tx.notes || "").toLowerCase().includes(q);
        const inCat = (tx.category || "").toLowerCase().includes(q);
        if (!inReason && !inTarget && !inTeam && !inNotes && !inCat) return false;
      }
      return true;
    });
  }, [data.transactions, logTeamFilter, logCategoryFilter, logSearchQuery]);

  const selectedLogTeam = useMemo(() => {
    if (logTeamFilter === "all") return null;
    return data.teams.find((t) => t.id === logTeamFilter) || null;
  }, [data.teams, logTeamFilter]);

  const selectedTeamTransactions = useMemo(() => {
    if (!selectedLogTeam) return [];
    return data.transactions.filter(
      (tx) => tx.teamId === selectedLogTeam.id || (tx.targetType === "team" && tx.targetId === selectedLogTeam.id)
    );
  }, [data.transactions, selectedLogTeam]);

  const selectedTeamStats = useMemo(() => {
    if (!selectedLogTeam) return null;
    const totalPoints = selectedTeamTransactions.reduce((acc, curr) => acc + curr.points, 0);
    const count = selectedTeamTransactions.length;
    const latestTx = selectedTeamTransactions[0];
    const earliestTx = selectedTeamTransactions[selectedTeamTransactions.length - 1];
    return {
      totalPoints,
      count,
      latestTx,
      earliestTx,
    };
  }, [selectedLogTeam, selectedTeamTransactions]);

  const handleExportHistoricalLog = () => {
    const targetTeamName = selectedLogTeam ? selectedLogTeam.name : "كافة الفرق";
    let content = `========================================================\n`;
    content += `سجل نشاط الفرق والعمليات التاريخي بالتواريخ (Scoreboard Audit Log)\n`;
    content += `الاجتماع: ${data.config.meetingName} - ${data.config.churchName}\n`;
    content += `الموسم: ${data.config.seasonName}\n`;
    content += `تاريخ ووقت استخراج التقرير: ${new Date().toLocaleString("ar-EG")}\n`;
    content += `نطاق الفلترة: ${targetTeamName} | التصنيف: ${logCategoryFilter === "all" ? "الكل" : logCategoryFilter}\n`;
    content += `إجمالي العمليات المسجلة: ${filteredTransactions.length}\n`;
    content += `========================================================\n\n`;

    if (filteredTransactions.length === 0) {
      content += `لا توجد عمليات مسجلة تطابق محددات البحث الحالية.\n`;
    } else {
      filteredTransactions.forEach((tx, idx) => {
        const timeObj = formatArabicTimestamp(tx.timestamp);
        content += `#${idx + 1} | [${timeObj.fullDate}] (${timeObj.relative})\n`;
        content += `   المستهدف: ${tx.targetName} [${tx.targetType === "team" ? "فريق" : "مشارك"}]\n`;
        content += `   اسم الفريق: ${tx.teamName}\n`;
        content += `   النقاط المرصودة: ${tx.points > 0 ? "+" : ""}${tx.points} XP\n`;
        content += `   التصنيف / النشاط: ${tx.category || "عام"}\n`;
        content += `   السبب والمناسبة: ${tx.reason}\n`;
        if (tx.notes) content += `   ملاحظات توثيقية: ${tx.notes}\n`;
        content += `--------------------------------------------------------\n`;
      });
    }

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `سجل_نشاط_${targetTeamName.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    sounds.playTap();
    showFeedback("تم تنزيل وتصدير ملف السجل التاريخي بنجاح 📄");
  };

  const handleClearLog = () => {
    if (logTeamFilter !== "all" && selectedLogTeam) {
      setConfirmDialog({
        title: `مسح سجل نشاط ${selectedLogTeam.name}`,
        message: `هل أنت متأكد من مسح جميع سجلات وتواريخ نشاط فريق "${selectedLogTeam.name}"؟ لن يتم تصفير رصيد النقاط الحالي (${selectedLogTeam.points} XP)، بل مسح السجل التاريخي للعمليات فقط.`,
        confirmLabel: "نعم، مسح سجل هذا الفريق",
        cancelLabel: "إلغاء",
        onConfirm: async () => {
          await meetingStore.clearTeamTransactions(selectedLogTeam.id);
          sounds.playTap();
          showFeedback(`تم مسح السجل التاريخي لنشاط ${selectedLogTeam.name}`);
          setConfirmDialog(null);
        },
      });
    } else {
      setConfirmDialog({
        title: "مسح السجل التاريخي لكافة الفرق",
        message: "هل تريد بالتأكيد مسح كافة سجلات وتواريخ رصد النقاط لجميع الفرق؟ لن تتأثر أرصدة النقاط الحالية للفرق، فقط سيتم تفريغ السجل.",
        confirmLabel: "نعم، مسح السجل بالكامل",
        cancelLabel: "إلغاء",
        onConfirm: async () => {
          await meetingStore.clearAllTransactions();
          sounds.playTap();
          showFeedback("تم مسح السجل التاريخي لكافة الفرق بنجاح");
          setConfirmDialog(null);
        },
      });
    }
  };

  // --- Event & QR Management Handlers ---
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventTitle.trim()) {
      showFeedback("برجاء إدخال اسم الفعالية", "error");
      return;
    }
    const res = await meetingStore.createEvent(
      {
        title: newEventTitle,
        description: newEventDesc,
        attendancePoints: newEventPoints,
        date: newEventDate,
        startTime: newEventStartTime,
        punctualityBonusPoints: newEventBonus,
        qrCode: newEventCode || undefined,
      },
      currentUser
    );
    if (res.success && res.event) {
      sounds.playVictory();
      showFeedback(`تم إنشاء الفعالية (${res.event.title}) وتوليد رمز QR بنجاح!`);
      setNewEventTitle("");
      setNewEventDesc("");
      setNewEventPoints(30);
      setNewEventBonus(15);
      setNewEventStartTime("18:30");
      setNewEventDate(new Date().toISOString().slice(0, 10));
      setNewEventCode("");
    } else {
      sounds.playClose();
      showFeedback(res.error || "تعذر إنشاء الفعالية", "error");
    }
  };

  const handleToggleEvent = async (id: string) => {
    const res = await meetingStore.toggleEventStatus(id, currentUser);
    if (res.success) {
      sounds.playTap();
      showFeedback("تم تحديث حالة الفعالية");
    } else {
      sounds.playClose();
      showFeedback(res.error || "خطأ في الصلاحيات", "error");
    }
  };

  const handleDeleteEvent = (evt: EventSession) => {
    setConfirmDialog({
      title: `حذف فعالية: ${evt.title}`,
      message: `هل أنت متأكد من حذف هذه الفعالية نهائياً؟ لن يتمكن الأعضاء من تسجيل الحضور بها مجدداً.`,
      confirmLabel: "نعم، حذف الفعالية",
      cancelLabel: "إلغاء",
      onConfirm: async () => {
        const res = await meetingStore.deleteEvent(evt.id, currentUser);
        if (res.success) {
          sounds.playTap();
          showFeedback(`تم حذف فعالية ${evt.title}`);
        } else {
          showFeedback(res.error || "تعذر الحذف", "error");
        }
        setConfirmDialog(null);
      },
    });
  };

  // --- Member Permissions Handlers ---
  const handleOpenEditMemberPerms = (member: CustomMember) => {
    setEditingMember(member);
    setPermFormRole(member.role);
    setPermFormCode(member.accessCode || Math.floor(1000 + Math.random() * 9000).toString());
    const defaults = getRoleDefaultPermissions(member.role);
    setPermFormFlags({
      ...defaults,
      ...(member.permissions || {}),
    });
  };

  const handleSaveMemberPerms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;
    const res = await meetingStore.updateMemberPermissions(
      editingMember.id,
      {
        role: permFormRole,
        accessCode: permFormCode.trim(),
        permissions: permFormFlags,
      },
      currentUser
    );
    if (res.success) {
      sounds.playVictory();
      showFeedback(`تم تحديث صلاحيات وكود وصول [${editingMember.name}] بنجاح!`);
      setEditingMember(null);
    } else {
      sounds.playClose();
      showFeedback(res.error || "تعذر تحديث الصلاحيات", "error");
    }
  };

  const filteredAuditLogs = useMemo(() => {
    const logs = data.auditLogs || [];
    if (auditFilterAction === "all") return logs;
    return logs.filter(
      (l) => l.action === auditFilterAction || (auditFilterAction === "denied" && l.status === "denied")
    );
  }, [data.auditLogs, auditFilterAction]);

  return (
    <div className="min-h-screen bg-[#070A1E] text-slate-100 p-4 sm:p-6 lg:p-8 font-arabic" dir="rtl">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header Bar */}
        <div className="rounded-3xl border border-slate-800 bg-[#0B132B]/90 backdrop-blur-xl p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                sounds.playClose();
                onBackToScoreboard();
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs sm:text-sm border border-slate-700 shadow-sm active:scale-95 transition-all cursor-pointer"
            >
              <ArrowRight className="h-4 w-4" />
              <span>العودة لشاشة العرض الكبرى 📺</span>
            </button>

            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white">
                لوحة تحكم وإدارة السكور بورد
              </h1>
              <p className="text-xs text-slate-400">
                {data.config.meetingName} • {data.config.seasonName}
              </p>
            </div>
          </div>

          {/* User Profile & Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => {
                sounds.playTap();
                setShowUserSwitcher(true);
              }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-amber-500/40 text-amber-300 text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-sm"
              title="تبديل المستخدم والتحقق من الصلاحيات"
            >
              <KeyRound className="h-4 w-4 text-amber-400 shrink-0" />
              <div className="text-right">
                <div className="text-[10px] text-slate-400 leading-tight">المستخدم النشط:</div>
                <div className="text-xs font-black text-white">{currentUser.name} ({currentUser.roleLabel}) 🔑</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                sounds.playTap();
                setShowQRScanner(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs shadow-md shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer"
              title="مسح QR لتسجيل حضور الفعالية"
            >
              <Camera className="h-4 w-4" />
              <span>مسح QR للحضور 📱</span>
            </button>

            {/* Quick Stats Pill */}
            <div className="hidden sm:flex items-center gap-3 text-xs bg-slate-900/80 px-3 py-2 rounded-2xl border border-slate-800">
              <div>
                <span className="text-slate-400 block text-[10px]">الفرق:</span>
                <span className="font-bold text-amber-300 font-mono leading-none">{data.teams.length}</span>
              </div>
              <div className="h-4 w-px bg-slate-700" />
              <div>
                <span className="text-slate-400 block text-[10px]">الأعضاء:</span>
                <span className="font-bold text-sky-400 font-mono leading-none">{data.members.length}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Leader / Restricted User Security Banner */}
        {currentUser.role === "leader" && (
          <div className="p-4 rounded-3xl border border-sky-500/40 bg-sky-950/40 text-sky-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400 shrink-0">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div className="space-y-0.5">
                <div className="text-sm font-black text-white flex items-center gap-2">
                  <span>حساب قائد المجموعة: {currentUser.name}</span>
                  <span className="px-2 py-0.5 rounded-full bg-sky-500/20 border border-sky-500/30 text-[10px] text-sky-300 font-bold">
                    مقيد الصلاحيات أمنياً
                  </span>
                </div>
                <p className="text-xs text-sky-300/90 leading-relaxed">
                  حرصاً على النزاهة والعدالة، تم تقييد صلاحيات قادة المجموعات في لوحة تحكم الخادم عن تعديل أي بيانات أو إضافة أو تعديل النقاط لأي شخص أو فريق. مهمتك المصرح بها: مسح كود QR الفعالية لتسجيل حضور أعضاء مجموعتك واحتساب نقاطهم تلقائياً.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                sounds.playTap();
                setShowQRScanner(true);
              }}
              className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs shadow-md shadow-amber-500/20 active:scale-95 transition-all shrink-0 cursor-pointer flex items-center gap-1.5"
            >
              <Camera className="h-4 w-4" />
              <span>مسح QR لحضور مجموعتي</span>
            </button>
          </div>
        )}

        {/* Feedback alert toast */}
        {feedbackMsg && (
          <div
            className={`p-4 rounded-2xl border flex items-center gap-3 shadow-lg transition-all animate-bounce ${
              feedbackMsg.type === "success"
                ? "bg-emerald-950/80 border-emerald-500/50 text-emerald-200"
                : "bg-rose-950/80 border-rose-500/50 text-rose-200"
            }`}
          >
            {feedbackMsg.type === "success" ? (
              <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 text-rose-400 shrink-0" />
            )}
            <span className="text-sm font-bold">{feedbackMsg.text}</span>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
          <button
            onClick={() => {
              sounds.playTap();
              setActiveTab("quick_score");
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "quick_score"
                ? "bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-md font-black"
                : "bg-slate-900/80 text-slate-300 hover:bg-slate-800 border border-slate-800"
            }`}
          >
            <Zap className="h-4 w-4" />
            <span>رصد النقاط السريع ⚡</span>
          </button>

          <button
            onClick={() => {
              sounds.playTap();
              setActiveTab("events");
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "events"
                ? "bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 shadow-md font-black"
                : "bg-slate-900/80 text-slate-300 hover:bg-slate-800 border border-slate-800"
            }`}
          >
            <QrCode className="h-4 w-4" />
            <span>الفعاليات والحضور (QR) 📱 ({data.events?.length || 0})</span>
          </button>

          <button
            onClick={() => {
              sounds.playTap();
              setActiveTab("permissions");
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "permissions"
                ? "bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md font-black"
                : "bg-slate-900/80 text-slate-300 hover:bg-slate-800 border border-slate-800"
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
            <span>الصلاحيات والأمان (RBAC) 🛡️</span>
          </button>

          <button
            onClick={() => {
              sounds.playTap();
              setActiveTab("reasons");
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "reasons"
                ? "bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 shadow-md font-black"
                : "bg-slate-900/80 text-slate-300 hover:bg-slate-800 border border-slate-800"
            }`}
          >
            <Sparkles className="h-4 w-4" />
            <span>أسباب الرصد والأنشطة ({data.activityReasons?.length || 0})</span>
          </button>

          <button
            onClick={() => {
              sounds.playTap();
              setActiveTab("teams");
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "teams"
                ? "bg-amber-500 text-slate-950 shadow-md font-black"
                : "bg-slate-900/80 text-slate-300 hover:bg-slate-800 border border-slate-800"
            }`}
          >
            <Shield className="h-4 w-4" />
            <span>إدارة الفرق ({data.teams.length})</span>
          </button>

          <button
            onClick={() => {
              sounds.playTap();
              setActiveTab("members");
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "members"
                ? "bg-sky-500 text-slate-950 shadow-md font-black"
                : "bg-slate-900/80 text-slate-300 hover:bg-slate-800 border border-slate-800"
            }`}
          >
            <Users className="h-4 w-4" />
            <span>إدارة الأعضاء ({data.members.length})</span>
          </button>

          <button
            onClick={() => {
              sounds.playTap();
              setActiveTab("log");
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "log"
                ? "bg-purple-500 text-white shadow-md font-black"
                : "bg-slate-900/80 text-slate-300 hover:bg-slate-800 border border-slate-800"
            }`}
          >
            <Clock className="h-4 w-4" />
            <span>سجل المعاملات ({data.transactions.length})</span>
          </button>

          <button
            onClick={() => {
              sounds.playTap();
              setActiveTab("settings");
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "settings"
                ? "bg-emerald-500 text-slate-950 shadow-md font-black"
                : "bg-slate-900/80 text-slate-300 hover:bg-slate-800 border border-slate-800"
            }`}
          >
            <Settings className="h-4 w-4" />
            <span>الإعدادات والنسخ الاحتياطي</span>
          </button>
        </div>

        {/* TAB 1: QUICK SCORE INJECTOR */}
        {activeTab === "quick_score" && (
          <div className="rounded-3xl border border-slate-800 bg-[#0B132B]/80 p-5 sm:p-7 shadow-xl space-y-6">
            {!currentUser.permissions.canAwardPoints ? (
              <div className="py-12 px-6 rounded-3xl bg-slate-900/60 border border-rose-500/30 text-center space-y-4 max-w-lg mx-auto">
                <div className="h-16 w-16 mx-auto rounded-3xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                  <Lock className="h-8 w-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-black text-white">رصد النقاط اليدوي مقيّد لحسابك</h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    حسابك الحالي (<span className="text-amber-300 font-bold">{currentUser.name} - {currentUser.roleLabel}</span>) لا يمتلك صلاحية رصد أو تعديل النقاط يدوياً. تم قصر هذه الصلاحية أمنياً على مسؤولي النظام لضمان نزاهة النتائج.
                  </p>
                </div>
                <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400">
                  يمكنك استخدام ميزة <strong className="text-emerald-400 font-bold">«مسح QR للحضور»</strong> لاحتساب نقاط الحضور والالتزام تلقائياً وفق القواعد المعتمدة دون تدخل يدوي.
                </div>
                <button
                  type="button"
                  onClick={() => setShowQRScanner(true)}
                  className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs shadow-md active:scale-95 transition-all cursor-pointer inline-flex items-center gap-2"
                >
                  <Camera className="h-4 w-4" />
                  <span>فتح ماسح QR للحضور 📱</span>
                </button>
              </div>
            ) : (
              <>
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-amber-300 flex items-center gap-2">
                    <Zap className="h-5 w-5 text-amber-400" />
                    <span>رصد النقاط المباشر (+XP) للفرق والمشاركين</span>
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-400 mt-1">
                    اختر الفريق أو العضو، ثم اختر عدد النقاط وسبب الرصد واضغط على زر الاعتماد. ستنعكس فوراً على شاشة العرض الكبرى!
                  </p>
                </div>

                <form onSubmit={handleApplyPoints} className="space-y-6">
              {/* Target Type Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 block">المستهدف بالرصد:</label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setScoreTargetType("team")}
                    className={`flex-1 py-3 px-4 rounded-2xl font-bold text-xs sm:text-sm border transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      scoreTargetType === "team"
                        ? "bg-amber-500/20 border-amber-500 text-amber-300 shadow-md"
                        : "bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800"
                    }`}
                  >
                    <Shield className="h-4 w-4" />
                    <span>رصد لفريق بالكامل 🛡️</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setScoreTargetType("member")}
                    className={`flex-1 py-3 px-4 rounded-2xl font-bold text-xs sm:text-sm border transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      scoreTargetType === "member"
                        ? "bg-sky-500/20 border-sky-500 text-sky-300 shadow-md"
                        : "bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800"
                    }`}
                  >
                    <Users className="h-4 w-4" />
                    <span>رصد لعضو محدد 👤</span>
                  </button>
                </div>
              </div>

              {/* Target Selection Dropdown */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 block">
                  {scoreTargetType === "team" ? "اختر الفريق المستهدف:" : "اختر العضو المستهدف:"}
                </label>
                {scoreTargetType === "team" ? (
                  <select
                    value={selectedTargetId}
                    onChange={(e) => setSelectedTargetId(e.target.value)}
                    className="w-full h-12 px-4 rounded-2xl bg-slate-900 border border-slate-700 text-sm font-bold text-white focus:outline-none focus:border-amber-400"
                  >
                    {data.teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.icon} {team.name} (الرصيد الحالي: {team.points} XP)
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    value={selectedTargetId}
                    onChange={(e) => setSelectedTargetId(e.target.value)}
                    className="w-full h-12 px-4 rounded-2xl bg-slate-900 border border-slate-700 text-sm font-bold text-white focus:outline-none focus:border-sky-400"
                  >
                    {data.members.map((m) => {
                      const t = data.teams.find((x) => x.id === m.teamId);
                      return (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.roleLabel || "مشارك"}) • فريق {t?.name || "عام"} (رصيده: {m.points} XP)
                        </option>
                      );
                    })}
                  </select>
                )}
              </div>

              {/* Points Value & Quick Presets */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 block">مقدار النقاط (+XP):</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {[10, 25, 50, 100, 150, 200, 300].map((pts) => (
                    <button
                      key={pts}
                      type="button"
                      onClick={() => setScorePoints(pts)}
                      className={`px-3.5 py-2 rounded-xl font-bold font-mono text-xs sm:text-sm cursor-pointer transition-all border ${
                        scorePoints === pts
                          ? "bg-amber-500 text-slate-950 border-amber-400 shadow-md font-black"
                          : "bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800"
                      }`}
                    >
                      +{pts} XP
                    </button>
                  ))}
                  {[-25, -50].map((pts) => (
                    <button
                      key={pts}
                      type="button"
                      onClick={() => setScorePoints(pts)}
                      className={`px-3 py-2 rounded-xl font-bold font-mono text-xs cursor-pointer transition-all border ${
                        scorePoints === pts
                          ? "bg-rose-500 text-white border-rose-400 shadow-md font-black"
                          : "bg-slate-900 text-rose-300 border-rose-900/40 hover:bg-slate-800"
                      }`}
                    >
                      {pts} XP (خصم)
                    </button>
                  ))}
                </div>

                <div className="pt-2">
                  <div className="relative">
                    <input
                      type="number"
                      value={scorePoints}
                      onChange={(e) => setScorePoints(parseInt(e.target.value) || 0)}
                      className="w-full h-11 px-4 rounded-xl bg-slate-900 border border-slate-700 text-base font-black text-amber-300 font-mono focus:outline-none focus:border-amber-400"
                      placeholder="أو اكتب عدد النقاط المخصص هنا..."
                    />
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
                      XP نقطة
                    </span>
                  </div>
                </div>
              </div>

              {/* Preset Reasons & Custom Reason Input */}
              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <label className="text-xs font-bold text-slate-300 block">
                    سبب رصد النقاط / نوع النشاط:
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      sounds.playTap();
                      setActiveTab("reasons");
                    }}
                    className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs active:scale-95"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <Edit2 className="h-3 w-3" />
                    <span>إضافة وتعديل أسباب الرصد والأنشطة ({data.activityReasons?.length || 0}) ⚙️</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(data.activityReasons || []).map((preset) => {
                    const isSelected = scoreReason === preset.text;
                    return (
                      <div
                        key={preset.id}
                        onClick={() => {
                          setScoreReason(preset.text);
                          setScoreCategory(preset.category);
                          setScorePoints(preset.points);
                        }}
                        className={`text-right p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected
                            ? "bg-amber-500/20 border-amber-400 ring-1 ring-amber-400 shadow-md"
                            : "bg-slate-900/90 border-slate-800 hover:border-amber-500/50 hover:bg-slate-800/80"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <span className="text-xl shrink-0 p-1.5 rounded-xl bg-slate-800 border border-slate-700/60">
                            {preset.icon || "🎯"}
                          </span>
                          <div className="min-w-0">
                            <div className="font-bold text-white text-xs sm:text-sm truncate">
                              {preset.text}
                            </div>
                            <div className="text-[10px] text-amber-400/90 flex items-center gap-2 mt-1">
                              <span className="px-1.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 font-medium">
                                {preset.category}
                              </span>
                              <span className="font-mono font-bold">
                                +{preset.points} XP
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartEditReason(preset);
                            }}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-400 transition-all cursor-pointer"
                            title="تعديل هذا السبب"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <input
                  type="text"
                  value={scoreReason}
                  onChange={(e) => setScoreReason(e.target.value)}
                  placeholder="أو اكتب سبب أو مناسبة الرصد يدوياً هنا..."
                  className="w-full h-11 px-4 mt-2 rounded-xl bg-slate-900 border border-slate-700 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* Timestamp & Notes Options */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-amber-400" />
                    <span className="text-xs font-bold text-slate-300">
                      توقيت وتاريخ حفظ العملية (Timestamp):
                    </span>
                    <span className="text-[11px] font-mono text-emerald-300 bg-emerald-500/15 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                      {scoreCustomDate ? "تاريخ محدد 📅" : "الآن تلقائياً ⚡ (التاريخ اللحظي)"}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowAdvancedTimeOptions(!showAdvancedTimeOptions)}
                    className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer font-bold px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700/60"
                  >
                    <span>{showAdvancedTimeOptions ? "إخفاء الخيارات المتقدمة" : "تحديد تاريخ/وقت سابق أو ملاحظات 🕒"}</span>
                    {showAdvancedTimeOptions ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>
                </div>

                {showAdvancedTimeOptions && (
                  <div className="pt-3 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3 animate-fadeIn">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-amber-400" />
                        <span>تاريخ وساعة الرصد المخصصة:</span>
                      </label>
                      <input
                        type="datetime-local"
                        value={scoreCustomDate}
                        onChange={(e) => setScoreCustomDate(e.target.value)}
                        className="w-full h-10 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-400 font-mono"
                      />
                      {scoreCustomDate ? (
                        <p className="text-[10px] text-amber-300/80">
                          سيتم التوثيق بتاريخ: {new Date(scoreCustomDate).toLocaleString("ar-EG")}
                        </p>
                      ) : (
                        <p className="text-[10px] text-slate-500">
                          اتركه فارغاً ليتم استخدام تاريخ وتوقيت اللحظة الحالية تلقائياً.
                        </p>
                      )}
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                        <FileText className="h-3.5 w-3.5 text-amber-400" />
                        <span>ملاحظات إضافية عن النشاط (اختياري):</span>
                      </label>
                      <input
                        type="text"
                        value={scoreNotes}
                        onChange={(e) => setScoreNotes(e.target.value)}
                        placeholder="مثال: الجولة الثانية من مسابقة الإنجيل"
                        className="w-full h-10 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-base shadow-xl shadow-amber-500/25 active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Zap className="h-5 w-5 fill-slate-950" />
                <span>اعتماد ورصد النقاط الآن ⚡</span>
              </button>
            </form>
          </>
        )}
      </div>
    )}

        {/* TAB: ACTIVITY REASONS & CRITERIA MANAGER */}
        {activeTab === "reasons" && (
          <div className="space-y-6">
            {/* Add / Edit Activity Reason Form */}
            <div className="rounded-3xl border border-slate-800 bg-[#0B132B]/80 p-5 sm:p-7 shadow-xl space-y-5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-lg font-black text-amber-300 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-amber-400" />
                  <span>
                    {editingReasonId ? "تعديل سبب الرصد / نوع النشاط" : "إضافة سبب رصد أو نوع نشاط جديد"}
                  </span>
                </h2>
                {editingReasonId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingReasonId(null);
                      setNewReasonText("");
                      setNewReasonPoints(30);
                    }}
                    className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 cursor-pointer"
                  >
                    إلغاء التعديل
                  </button>
                )}
              </div>

              <p className="text-xs text-slate-400">
                يمكنك تخصيص الأنشطة والمناسبات والمسابقات التي يتم احتساب النقاط عليها في الاجتماع (مثل الحضور المبكر، مسابقات الإنجيل، التحديات الرياضية، الألحان، والخدمة).
              </p>

              <form onSubmit={handleSaveReason} className="space-y-4">
                {/* Reason Text */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300 block">
                    نص ومسمى سبب الرصد / النشاط:
                  </label>
                  <input
                    type="text"
                    value={newReasonText}
                    onChange={(e) => setNewReasonText(e.target.value)}
                    placeholder="مثال: الفوز في مسابقة دراسة الكتاب المقدس أو حضور مبكر..."
                    className="w-full h-11 px-4 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-amber-400"
                    required
                  />
                </div>

                {/* Category Selection */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300 block">
                    نوع / تصنيف النشاط:
                  </label>
                  <div className="flex items-center gap-2 flex-wrap">
                    {REASON_CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setNewReasonCategory(cat)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer transition-all ${
                          newReasonCategory === cat
                            ? "bg-amber-500 text-slate-950 border-amber-400 shadow-md font-black"
                            : "bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  <input
                    type="text"
                    value={newReasonCategory}
                    onChange={(e) => setNewReasonCategory(e.target.value)}
                    placeholder="أو اكتب تصنيفاً مخصصاً هنا..."
                    className="w-full h-10 px-4 mt-1 rounded-xl bg-slate-900 border border-slate-700 text-xs sm:text-sm text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                {/* Points Selection */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300 block">
                    مقدار النقاط الافتراضية المقترحة (+XP):
                  </label>
                  <div className="flex items-center gap-2 flex-wrap">
                    {[10, 20, 25, 30, 40, 50, 60, 100].map((pts) => (
                      <button
                        key={pts}
                        type="button"
                        onClick={() => setNewReasonPoints(pts)}
                        className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold border cursor-pointer transition-all ${
                          newReasonPoints === pts
                            ? "bg-amber-500 text-slate-950 border-amber-400 shadow-md font-black"
                            : "bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800"
                        }`}
                      >
                        +{pts} XP
                      </button>
                    ))}
                  </div>

                  <div className="relative w-48">
                    <input
                      type="number"
                      value={newReasonPoints}
                      onChange={(e) => setNewReasonPoints(parseInt(e.target.value) || 0)}
                      className="w-full h-10 px-4 rounded-xl bg-slate-900 border border-slate-700 text-sm font-mono text-amber-300 focus:outline-none focus:border-amber-400"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
                      XP
                    </span>
                  </div>
                </div>

                {/* Icon Picker */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 block">
                    رمز وأيقونة النشاط التعبيرية:
                  </label>
                  <div className="flex items-center gap-2 flex-wrap">
                    {REASON_EMOJI_OPTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setNewReasonIcon(emoji)}
                        className={`h-10 w-10 text-xl rounded-xl border flex items-center justify-center cursor-pointer transition-all ${
                          newReasonIcon === emoji
                            ? "bg-amber-500/30 border-amber-400 scale-110 shadow-md"
                            : "bg-slate-900 border-slate-800 hover:bg-slate-800"
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Submit Action */}
                <div className="pt-2 flex items-center gap-3">
                  <button
                    type="submit"
                    className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm shadow-md transition-all cursor-pointer flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    <span>{editingReasonId ? "حفظ وتحديث التعديلات" : "إضافة السبب لقائمة الأنشطة"}</span>
                  </button>

                  {editingReasonId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingReasonId(null);
                        setNewReasonText("");
                        setNewReasonPoints(30);
                      }}
                      className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm cursor-pointer"
                    >
                      إلغاء
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* Configured Reasons List */}
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>أسباب الرصد والأنشطة المعتمدة في الاجتماع</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-amber-400 border border-slate-700 font-mono">
                    {data.activityReasons?.length || 0} نشاط
                  </span>
                </h3>

                <button
                  type="button"
                  onClick={handleResetReasonsToDefaults}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white text-xs font-bold transition-all cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>استعادة الأسباب الافتراضية</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(data.activityReasons || []).map((reason) => (
                  <div
                    key={reason.id}
                    className="p-4 rounded-2xl bg-[#0B132B]/80 border border-slate-800 hover:border-slate-700 flex items-center justify-between gap-3 shadow-md transition-all"
                    style={{ borderRightWidth: "4px", borderRightColor: "#EAB308" }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-12 w-12 rounded-xl flex items-center justify-center text-2xl border shrink-0 bg-amber-500/15 border-amber-500/40 shadow-xs">
                        {reason.icon || "🎯"}
                      </div>
                      <div className="min-w-0 space-y-1">
                        <h4 className="text-sm sm:text-base font-bold text-white leading-snug">
                          {reason.text}
                        </h4>
                        <div className="flex items-center gap-2 flex-wrap text-xs">
                          <span className="px-2 py-0.5 rounded-md bg-slate-800 text-amber-300/90 border border-slate-700/80 text-[11px] font-medium">
                            بند: {reason.category}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span className="font-mono font-black text-amber-400 text-base">
                        +{reason.points} XP
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setScoreReason(reason.text);
                            setScoreCategory(reason.category);
                            setScorePoints(reason.points);
                            setActiveTab("quick_score");
                            sounds.playTap();
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-bold cursor-pointer transition-all active:scale-95"
                          title="استخدام في الرصد المباشر الآن"
                        >
                          رصد ⚡
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStartEditReason(reason)}
                          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 cursor-pointer transition-all active:scale-95"
                          title="تعديل هذا السبب"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteReason(reason.id, reason.text)}
                          className="p-2 rounded-xl bg-slate-800/90 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/30 hover:border-rose-600 cursor-pointer transition-all shadow-sm active:scale-95"
                          title="حذف هذا السبب"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: TEAMS MANAGER */}
        {activeTab === "teams" && (
          <div className="space-y-6">
            {/* Add / Edit Team Form */}
            <div className="rounded-3xl border border-slate-800 bg-[#0B132B]/80 p-5 sm:p-7 shadow-xl space-y-5">
              <h2 className="text-lg font-black text-amber-300 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-amber-400" />
                  <span>{editingTeamId ? "تعديل بيانات الفريق" : "إضافة فريق جديد للسكور بورد"}</span>
                </span>
                {editingTeamId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTeamId(null);
                      setNewTeamName("");
                      setNewTeamSlogan("");
                      setNewTeamLeader("");
                    }}
                    className="text-xs text-slate-400 hover:text-white px-3 py-1 rounded-lg bg-slate-800"
                  >
                    إلغاء التعديل
                  </button>
                )}
              </h2>

              <form onSubmit={handleSaveTeam} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-300 block">اسم الفريق:</label>
                    <input
                      type="text"
                      value={newTeamName}
                      onChange={(e) => setNewTeamName(e.target.value)}
                      placeholder="مثال: فريق القديس مارمرقس"
                      className="w-full h-11 px-4 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-amber-400"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-300 block">قائد الفريق (اختياري):</label>
                    <input
                      type="text"
                      value={newTeamLeader}
                      onChange={(e) => setNewTeamLeader(e.target.value)}
                      placeholder="اسم خادم أو قائد المجموعة"
                      className="w-full h-11 px-4 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300 block">شعار الفريق (Slogan):</label>
                  <input
                    type="text"
                    value={newTeamSlogan}
                    onChange={(e) => setNewTeamSlogan(e.target.value)}
                    placeholder="مثال: كاروز الديار المصرية وبشير الإنجيل"
                    className="w-full h-11 px-4 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                {/* Team Icon Picker */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 block">رمز وأيقونة الفريق:</label>
                  <div className="flex items-center gap-2 flex-wrap">
                    {EMOJI_OPTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setNewTeamIcon(emoji)}
                        className={`h-10 w-10 text-xl rounded-xl border flex items-center justify-center cursor-pointer transition-all ${
                          newTeamIcon === emoji
                            ? "bg-amber-500/30 border-amber-400 scale-110 shadow-md"
                            : "bg-slate-900 border-slate-800 hover:bg-slate-800"
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Team Color Picker */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 block">لون هوية الفريق:</label>
                  <div className="flex items-center gap-2 flex-wrap">
                    {COLOR_OPTIONS.map((col) => (
                      <button
                        key={col.hex}
                        type="button"
                        onClick={() => setNewTeamColor(col.hex)}
                        className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 text-xs font-bold cursor-pointer transition-all ${
                          newTeamColor === col.hex
                            ? "border-white scale-105 shadow-md"
                            : "border-slate-800 opacity-80 hover:opacity-100"
                        }`}
                        style={{ backgroundColor: `${col.hex}30`, borderColor: col.hex }}
                      >
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: col.hex }} />
                        <span className="text-slate-200">{col.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {!editingTeamId && (
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-300 block">الرصيد الافتتاحي للنقاط:</label>
                    <input
                      type="number"
                      value={newTeamPoints}
                      onChange={(e) => setNewTeamPoints(parseInt(e.target.value) || 0)}
                      className="w-48 h-10 px-4 rounded-xl bg-slate-900 border border-slate-700 text-sm font-mono text-amber-300 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                )}

                <button
                  type="submit"
                  className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm shadow-md transition-all cursor-pointer flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>{editingTeamId ? "حفظ التعديلات" : "إضافة الفريق للسكور بورد"}</span>
                </button>
              </form>
            </div>

            {/* Existing Teams List */}
            <div className="space-y-3">
              <h3 className="text-base font-bold text-white">قائمة الفرق الحالية ({data.teams.length})</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {data.teams.map((team) => {
                  const memberCount = data.members.filter((m) => m.teamId === team.id).length;
                  return (
                    <div
                      key={team.id}
                      className="p-4 rounded-2xl bg-[#0B132B]/80 border border-slate-800 flex items-center justify-between gap-3 shadow-md"
                      style={{ borderRightWidth: "4px", borderRightColor: team.color }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="h-12 w-12 rounded-xl flex items-center justify-center text-2xl border shrink-0"
                          style={{ backgroundColor: `${team.color}25`, borderColor: team.color }}
                        >
                          {team.icon}
                        </div>
                        <div className="min-w-0 space-y-0.5">
                          <h4 className="text-base font-bold text-white truncate">{team.name}</h4>
                          <p className="text-xs text-slate-400 truncate">{team.slogan || "بدون شعار"}</p>
                          <div className="text-[11px] text-slate-400 flex items-center gap-2">
                            <span>{memberCount} عضو</span>
                            {team.leaderName && <span>• القائد: {team.leaderName}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <span className="font-mono font-black text-amber-400 text-base">
                          {team.points.toLocaleString("en-US")} XP
                        </span>
                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              sounds.playTap();
                              setLogTeamFilter(team.id);
                              setActiveTab("log");
                            }}
                            className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-purple-600/80 text-purple-300 hover:text-white border border-purple-500/30 cursor-pointer transition-all active:scale-95 flex items-center gap-1.5 text-xs font-bold"
                            title="عرض السجل التاريخي لنشاط هذا الفريق"
                          >
                            <Clock className="h-3.5 w-3.5 text-purple-400" />
                            <span>سجل النشاط 📜</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStartEditTeam(team)}
                            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 cursor-pointer transition-all active:scale-95"
                            title="تعديل الفريق"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteTeam(team.id, team.name)}
                            className="p-2 rounded-xl bg-slate-800/90 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/30 hover:border-rose-600 cursor-pointer transition-all shadow-sm active:scale-95"
                            title="حذف هذا الفريق نهائياً"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: MEMBERS MANAGER */}
        {activeTab === "members" && (
          <div className="space-y-6">
            {/* Add Member Form */}
            <div className="rounded-3xl border border-slate-800 bg-[#0B132B]/80 p-5 sm:p-7 shadow-xl space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="h-9 w-9 rounded-xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400">
                      {editingMemberId ? <Edit2 className="h-5 w-5" /> : <Users className="h-5 w-5" />}
                    </span>
                    <h2 className="text-lg sm:text-xl font-black text-white">
                      {editingMemberId ? "تعديل بيانات العضو" : "إضافة مشارك / خادم جديد للفريق"}
                    </h2>
                  </div>
                  <p className="text-xs text-slate-400">
                    {editingMemberId ? "قم بتعديل بيانات العضو الحالي ثم اضغط حفظ" : "إضافة الأعضاء وتوزيعهم على الفرق وتحديد أدوارهم (قائد، خادم، أو مشارك)."}
                  </p>
                </div>
                {editingMemberId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingMemberId(null);
                      setNewMemberName("");
                      setNewMemberPhone("");
                      setNewMemberAvatarUrl("");
                      sounds.playClose();
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white text-xs font-bold transition-all active:scale-95 cursor-pointer"
                  >
                    إلغاء التعديل
                  </button>
                )}
              </div>

              <form onSubmit={handleSaveMember} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-300 block">اسم المشارك:</label>
                    <input
                      type="text"
                      value={newMemberName}
                      onChange={(e) => setNewMemberName(e.target.value)}
                      placeholder="الاسم ثلاثي أو ثنائي"
                      className="w-full h-11 px-4 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-sky-400"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-300 block">الفريق التابع له:</label>
                    <select
                      value={newMemberTeamId}
                      onChange={(e) => setNewMemberTeamId(e.target.value)}
                      className="w-full h-11 px-4 rounded-xl bg-slate-900 border border-slate-700 text-sm font-bold text-white focus:outline-none focus:border-sky-400"
                      required
                    >
                      {data.teams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.icon} {t.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-300 block">الصفة / الدور:</label>
                    <select
                      value={newMemberRole}
                      onChange={(e) => setNewMemberRole(e.target.value as any)}
                      className="w-full h-11 px-4 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-sky-400"
                    >
                      <option value="member">مشارك في الاجتماع</option>
                      <option value="leader">قائد الفريق</option>
                      <option value="servant">خادم رفيق</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-300 block">رابط صورة العضو (اختياري):</label>
                    <div className="relative">
                      <input
                        type="url"
                        value={newMemberAvatarUrl}
                        onChange={(e) => setNewMemberAvatarUrl(e.target.value)}
                        placeholder="https://example.com/photo.jpg"
                        className="w-full h-11 pl-10 pr-4 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-sky-400"
                      />
                      <Camera className="absolute left-3 top-3 h-5 w-5 text-slate-500" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-300 block">رقم الهاتف أو الواتساب (اختياري):</label>
                    <input
                      type="text"
                      value={newMemberPhone}
                      onChange={(e) => setNewMemberPhone(e.target.value)}
                      placeholder="01xxxxxxxxx"
                      className="w-full h-11 px-4 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-sky-400"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className={`w-full h-11 rounded-xl font-black text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      editingMemberId ? 'bg-amber-500 hover:bg-amber-400 text-slate-950' : 'bg-sky-500 hover:bg-sky-400 text-slate-950'
                    }`}
                  >
                    {editingMemberId ? <CheckCircle className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    <span>{editingMemberId ? "حفظ التعديلات" : "إضافة المشارك للفريق"}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Sub-tabs for roles */}
            <div className="flex items-center gap-2 p-1 bg-slate-900/80 rounded-2xl border border-slate-800 mb-4 overflow-x-auto no-scrollbar">
              <button
                onClick={() => setMemberSubTab("member")}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all whitespace-nowrap cursor-pointer ${
                  memberSubTab === "member" ? "bg-emerald-500 text-slate-950 shadow-md" : "text-slate-400 hover:text-white"
                }`}
              >
                المخدومين / المشاركين ({data.members.filter(m => m.role === "member").length})
              </button>
              <button
                onClick={() => setMemberSubTab("leader")}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all whitespace-nowrap cursor-pointer ${
                  memberSubTab === "leader" ? "bg-sky-500 text-slate-950 shadow-md" : "text-slate-400 hover:text-white"
                }`}
              >
                قادة المجموعات ({data.members.filter(m => m.role === "leader").length})
              </button>
              <button
                onClick={() => setMemberSubTab("servant")}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all whitespace-nowrap cursor-pointer ${
                  memberSubTab === "servant" ? "bg-amber-500 text-slate-950 shadow-md" : "text-slate-400 hover:text-white"
                }`}
              >
                الخدام / المسؤولين ({data.members.filter(m => m.role === "servant" || m.role === "admin").length})
              </button>
            </div>

            {/* Search and List */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <Users className="h-4 w-4 text-sky-400" />
                  <span>
                    {memberSubTab === "member" ? "قائمة المخدومين" : memberSubTab === "leader" ? "قائمة القادة" : "قائمة الخدام والمسؤولين"}
                  </span>
                </h3>
                <div className="relative">
                  <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                  <input
                    type="text"
                    value={memberSearchTerm}
                    onChange={(e) => setMemberSearchTerm(e.target.value)}
                    placeholder="ابحث بالاسم أو الكود..."
                    className="w-full sm:w-64 h-9 pr-8 pl-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-500 shadow-inner"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {data.members
                  .filter((m) => {
                    const matchesRole = memberSubTab === "servant" 
                      ? (m.role === "servant" || m.role === "admin" || m.role === "priest")
                      : m.role === memberSubTab;
                    const matchesSearch = !memberSearchTerm || 
                      m.name.toLowerCase().includes(memberSearchTerm.toLowerCase()) ||
                      (m.accessCode && m.accessCode.toLowerCase().includes(memberSearchTerm.toLowerCase()));
                    return matchesRole && matchesSearch;
                  })
                  .map((m) => {
                    const team = data.teams.find((t) => t.id === m.teamId);
                    return (
                      <div
                        key={m.id}
                        className="p-3.5 rounded-2xl bg-[#0B132B]/80 border border-slate-800 flex items-center justify-between gap-3 shadow-sm"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-12 w-12 rounded-full overflow-hidden bg-slate-800 border-2 border-slate-700 shrink-0 flex items-center justify-center">
                            {m.avatarUrl ? (
                              <img src={m.avatarUrl} alt={m.name} className="h-full w-full object-cover" />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center text-slate-500 bg-slate-800">
                                <Users className="h-6 w-6" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-sm text-white truncate">{m.name}</span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                                m.role === "admin"
                                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                                  : m.role === "leader"
                                  ? "bg-sky-500/20 text-sky-300 border-sky-500/40"
                                  : m.role === "servant"
                                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                                  : "bg-slate-800 text-slate-400 border-slate-700"
                              }`}
                            >
                              {m.roleLabel || (m.role === "leader" ? "قائد" : m.role === "servant" ? "خادم" : "مشارك")}
                            </span>
                            {m.accessCode && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-950 text-amber-400 border border-slate-800">
                                PIN: {m.accessCode}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 flex items-center gap-1 truncate">
                            <span>{team?.icon}</span>
                            <span>{team?.name || "بدون فريق"}</span>
                          </p>
                          {m.phone && <p className="text-[10px] text-slate-500 font-mono">{m.phone}</p>}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <span className="text-xs font-black font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                            {m.points} XP
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleStartEditMember(m)}
                              className="p-1.5 rounded-lg bg-slate-800/90 hover:bg-emerald-500 hover:text-slate-950 text-emerald-400 border border-emerald-500/30 transition-all cursor-pointer shadow-xs active:scale-90"
                              title="تعديل بيانات العضو"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEditMemberPerms(m)}
                              className="p-1.5 rounded-lg bg-slate-800/90 hover:bg-amber-500 hover:text-slate-950 text-amber-400 border border-amber-500/30 transition-all cursor-pointer shadow-xs active:scale-90"
                              title="تعديل الصلاحيات وكود المرور"
                            >
                              <KeyRound className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                sounds.playOpen();
                                setPreviewingCardMember(m);
                              }}
                              className="p-1.5 rounded-lg bg-slate-800/90 hover:bg-sky-500 hover:text-slate-950 text-sky-400 border border-sky-500/30 transition-all cursor-pointer shadow-xs active:scale-90"
                              title="معاينة وطباعة الكارنيه"
                            >
                              <CreditCard className="h-3.5 w-3.5" />
                            </button>
                            {currentUser.permissions.canEditMembers && (
                              <button
                                type="button"
                                onClick={() => handleDeleteMember(m.id, m.name)}
                                className="p-1.5 rounded-lg bg-slate-800/90 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/20 hover:border-rose-600 transition-all cursor-pointer shadow-xs active:scale-90"
                                title="حذف هذا المشارك"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}

        {/* TAB: EVENTS & QR ATTENDANCE */}
        {activeTab === "events" && (
          <div className="space-y-6">
            {/* Header & Quick Action */}
            <div className="rounded-3xl border border-slate-800 bg-[#0B132B]/80 p-5 sm:p-7 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="h-9 w-9 rounded-xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-400">
                      <QrCode className="h-5 w-5" />
                    </span>
                    <h2 className="text-lg sm:text-xl font-black text-white">
                      نظام الفعاليات ورموز QR للحضور التلقائي 📱
                    </h2>
                  </div>
                  <p className="text-xs text-slate-400">
                    توليد رموز QR مشفرة لكل فعالية. بمجرد مسح الرمز من كاميرا قائد المجموعة، يتم تسجيل الحضور واحتساب النقاط آلياً دون تدخل يدوي مع منع التكرار.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    sounds.playTap();
                    setShowQRScanner(true);
                  }}
                  className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs shadow-md shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer flex items-center gap-2 shrink-0 self-start sm:self-auto"
                >
                  <Camera className="h-4 w-4" />
                  <span>فتح ماسح QR للحضور 📷</span>
                </button>
              </div>

              {/* Create New Event Form (Only for Admins or users with canCreateEvents) */}
              {currentUser.permissions.canCreateEvents ? (
                <form onSubmit={handleCreateEvent} className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
                  <h3 className="text-sm font-black text-teal-300 flex items-center gap-1.5">
                    <Plus className="h-4 w-4" />
                    <span>إنشاء فعالية جديدة وتوليد رمز QR خاص بها</span>
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-[11px] font-bold text-slate-300 block">عنوان الفعالية / اللقاء:</label>
                      <input
                        type="text"
                        value={newEventTitle}
                        onChange={(e) => setNewEventTitle(e.target.value)}
                        placeholder="مثال: اجتماع الجمعة - لقاء دراسة الإنجيل"
                        className="w-full h-10 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-teal-400"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-300 block">تاريخ الفعالية:</label>
                      <input
                        type="date"
                        value={newEventDate}
                        onChange={(e) => setNewEventDate(e.target.value)}
                        className="w-full h-10 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-teal-400"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-300 block">نقاط الحضور التلقائية:</label>
                      <input
                        type="number"
                        value={newEventPoints}
                        onChange={(e) => setNewEventPoints(Number(e.target.value))}
                        className="w-full h-10 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white font-mono focus:outline-none focus:border-teal-400"
                        min={1}
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-300 block">بونص الالتزام بالموعد:</label>
                      <input
                        type="number"
                        value={newEventBonus}
                        onChange={(e) => setNewEventBonus(Number(e.target.value))}
                        className="w-full h-10 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white font-mono focus:outline-none focus:border-teal-400"
                        min={0}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-300 block">وقت البدء (للـ Bonus التلقائي):</label>
                      <input
                        type="time"
                        value={newEventStartTime}
                        onChange={(e) => setNewEventStartTime(e.target.value)}
                        className="w-full h-10 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-teal-400"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-[11px] font-bold text-slate-300 block">وصف الفعالية (اختياري):</label>
                      <input
                        type="text"
                        value={newEventDesc}
                        onChange={(e) => setNewEventDesc(e.target.value)}
                        placeholder="تفاصيل الفعالية أو الفقرات..."
                        className="w-full h-10 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-teal-400"
                      />
                    </div>

                    <div className="flex items-end">
                      <button
                        type="submit"
                        className="w-full h-10 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs transition-all shadow-md active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <QrCode className="h-4 w-4" />
                        <span>توليد كود الـ QR والفعالية ✨</span>
                      </button>
                    </div>
                  </div>
                </form>
              ) : (
                <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-xs text-slate-400 flex items-center gap-2">
                  <Lock className="h-4 w-4 text-amber-400 shrink-0" />
                  <span>إنشاء الفعاليات وتوليد رموز QR مقصور على مسؤولي النظام. يمكنك مسح الرموز الحالية لتسجيل حضور أعضاء مجموعتك.</span>
                </div>
              )}

              {/* Events Cards Grid */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white">الفعاليات الحالية المتاحة للحضور ({data.events?.length || 0}):</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {data.events?.map((evt) => {
                    const attendeesCount = (data.attendance || []).filter((a) => a.eventId === evt.id).length;
                    return (
                      <div
                        key={evt.id}
                        className={`p-4 rounded-2xl border transition-all space-y-3 flex flex-col justify-between ${
                          evt.isActive
                            ? "bg-slate-900/90 border-slate-800 hover:border-teal-500/50"
                            : "bg-slate-950/60 border-slate-900 opacity-60"
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm font-black text-white">{evt.title}</h4>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${
                                    evt.isActive
                                      ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                                      : "bg-rose-500/15 border-rose-500/30 text-rose-400"
                                  }`}
                                >
                                  {evt.isActive ? "نشطة وتقبل الحضور" : "مغلقة"}
                                </span>
                              </div>
                              <p className="text-xs text-slate-400 mt-0.5">{evt.description || "فعالية حضور رسمية"}</p>
                            </div>
                          </div>

                          {/* Points and Code Info */}
                          <div className="flex items-center gap-2 flex-wrap text-xs">
                            <span className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 text-emerald-400 font-mono font-bold">
                              +{evt.attendancePoints} XP حضور
                            </span>
                            {evt.punctualityBonusPoints > 0 && (
                              <span className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 text-amber-400 font-mono font-bold flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {evt.startTime || "غير محدد"}
                                <span className="mx-1">|</span>
                                +{evt.punctualityBonusPoints} XP بونص
                              </span>
                            )}
                            <span className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 font-mono text-[11px]">
                              الكود: {evt.qrCode}
                            </span>
                            <span className="px-2 py-1 rounded-lg bg-sky-950/40 border border-sky-500/20 text-sky-300 font-bold text-[11px]">
                              {attendeesCount} مسجلين
                            </span>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
                          <button
                            type="button"
                            onClick={() => {
                              sounds.playTap();
                              setActiveQRModalEvent(evt);
                            }}
                            className="flex-1 py-2 rounded-xl bg-teal-500/20 hover:bg-teal-500 text-teal-300 hover:text-slate-950 border border-teal-500/40 text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
                          >
                            <QrCode className="h-3.5 w-3.5" />
                            <span>عرض وتكبير QR 📱</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              sounds.playTap();
                              setShowQRScanner(evt.id);
                            }}
                            className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 text-xs font-bold transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                            title="مسح الحضور لهذه الفعالية"
                          >
                            <Camera className="h-3.5 w-3.5" />
                            <span>مسح الحضور</span>
                          </button>

                          {currentUser.permissions.canCreateEvents && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleToggleEvent(evt.id)}
                                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-all cursor-pointer"
                                title={evt.isActive ? "إيقاف الفعالية" : "تفعيل الفعالية"}
                              >
                                {evt.isActive ? "إيقاف" : "تفعيل"}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteEvent(evt)}
                                className="p-2 rounded-xl bg-slate-800 hover:bg-rose-600 text-rose-400 hover:text-white transition-all cursor-pointer"
                                title="حذف الفعالية"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Attendance Log Table */}
              <div className="pt-4 border-t border-slate-800 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-black text-white flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-400" />
                    <span>سجل الحضور المسجل آلياً بالـ QR ({data.attendance?.length || 0})</span>
                  </h3>
                  <span className="text-xs text-slate-400 font-mono">
                    منع تكرار الاحتساب مفعل بنسبة 100%
                  </span>
                </div>

                {(!data.attendance || data.attendance.length === 0) ? (
                  <div className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800 text-center text-slate-400 text-xs">
                    لا يوجد حضور مسجل بعد. استخدم زر «مسح QR للحضور» لتسجيل الحضور وتوثيق النقاط تلقائياً!
                  </div>
                ) : (
                  <div className="rounded-2xl border border-slate-800 overflow-hidden bg-slate-900/60">
                    <div className="overflow-x-auto max-h-80">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-950 text-slate-400 text-[11px] font-bold border-b border-slate-800 sticky top-0">
                          <tr>
                            <th className="p-3">العضو الحاضر</th>
                            <th className="p-3">الفريق</th>
                            <th className="p-3">الفعالية</th>
                            <th className="p-3">تاريخ ووقت المسح</th>
                            <th className="p-3">النقاط المرصودة</th>
                            <th className="p-3">المسؤول عن المسح</th>
                            <th className="p-3">حالة الأمان</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/80">
                          {data.attendance.map((rec) => {
                            const timeObj = formatArabicTimestamp(rec.scannedAt);
                            return (
                              <tr key={rec.id} className="hover:bg-slate-800/50 transition-colors">
                                <td className="p-3 font-bold text-white whitespace-nowrap">{rec.memberName}</td>
                                <td className="p-3 text-slate-300 whitespace-nowrap">{rec.teamName}</td>
                                <td className="p-3 text-teal-300 font-medium whitespace-nowrap">{rec.eventTitle}</td>
                                <td className="p-3 text-slate-400 font-mono whitespace-nowrap">
                                  {timeObj.dateStr} {timeObj.timeStr}
                                </td>
                                <td className="p-3 whitespace-nowrap">
                                  <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold font-mono">
                                    +{rec.pointsAwarded} XP
                                  </span>
                                </td>
                                <td className="p-3 text-slate-400 whitespace-nowrap">{rec.scannedByUserName}</td>
                                <td className="p-3 whitespace-nowrap">
                                  <span className="px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-500/40 text-[10px] text-emerald-400 font-bold">
                                    موثّق وغير مكرر ✓
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB: PERMISSIONS & AUDIT LEDGER */}
        {activeTab === "permissions" && (
          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-800 bg-[#0B132B]/80 p-5 sm:p-7 shadow-xl space-y-6">
              {/* Permissions Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="h-9 w-9 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
                      <ShieldCheck className="h-5 w-5" />
                    </span>
                    <h2 className="text-lg sm:text-xl font-black text-white">
                      إدارة الصلاحيات وأكواد الوصول وسجل المراجعة 🛡️
                    </h2>
                  </div>
                  <p className="text-xs text-slate-400">
                    كود وصول مستقل لكل عضو، وتحديد دقيق للمهام المسموح بها مع تقييد القادة والأعضاء عن تعديل النقاط، ومتابعة سجل المراجعة الأمني.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    sounds.playTap();
                    setShowUserSwitcher(true);
                  }}
                  className="px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40 text-xs font-black shadow-sm active:scale-95 transition-all cursor-pointer flex items-center gap-2 shrink-0 self-start sm:self-auto"
                >
                  <KeyRound className="h-4 w-4" />
                  <span>تبديل الحساب النشط 🔑</span>
                </button>
              </div>

              {/* Members Permissions Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-white">أكواد الوصول والصلاحيات الممنوحة للأعضاء ({data.members.length}):</h3>
                  <span className="text-[11px] text-slate-400">
                    اضغط على زر المفتاح 🔑 لتعديل كود أو صلاحيات أي عضو
                  </span>
                </div>

                <div className="rounded-2xl border border-slate-800 overflow-hidden bg-slate-900/60">
                  <div className="overflow-x-auto max-h-96">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-950 text-slate-400 text-[11px] font-bold border-b border-slate-800 sticky top-0">
                        <tr>
                          <th className="p-3">اسم العضو</th>
                          <th className="p-3">الفريق</th>
                          <th className="p-3">الدور</th>
                          <th className="p-3">كود الوصول (PIN)</th>
                          <th className="p-3 text-center">رصد النقاط اليدوي</th>
                          <th className="p-3 text-center">مسح QR للحضور</th>
                          <th className="p-3 text-center">تعديل الفرق</th>
                          <th className="p-3 text-center">إنشاء الفعاليات</th>
                          <th className="p-3 text-center">إجراءات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80">
                        {data.members.map((m) => {
                          const team = data.teams.find((t) => t.id === m.teamId);
                          const perms = m.permissions || getRoleDefaultPermissions(m.role);
                          return (
                            <tr key={m.id} className="hover:bg-slate-800/40 transition-colors">
                              <td className="p-3 font-bold text-white whitespace-nowrap">{m.name}</td>
                              <td className="p-3 text-slate-300 whitespace-nowrap">{team?.name || "بدون فريق"}</td>
                              <td className="p-3 whitespace-nowrap">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                    m.role === "admin"
                                      ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                                      : m.role === "leader"
                                      ? "bg-sky-500/20 text-sky-300 border-sky-500/40"
                                      : m.role === "servant"
                                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                                      : "bg-slate-800 text-slate-400 border-slate-700"
                                  }`}
                                >
                                  {m.roleLabel || (m.role === "leader" ? "قائد المجموعة" : "عضو مشارك")}
                                </span>
                              </td>
                              <td className="p-3 whitespace-nowrap">
                                <span className="font-mono px-2 py-1 rounded bg-slate-950 border border-slate-800 text-amber-300 font-bold tracking-wider">
                                  {m.accessCode || "1234"}
                                </span>
                              </td>
                              <td className="p-3 text-center">
                                {perms.canAwardPoints ? (
                                  <span className="inline-flex p-1 rounded-full bg-emerald-500/20 text-emerald-400">
                                    <Check className="h-3.5 w-3.5" />
                                  </span>
                                ) : (
                                  <span className="inline-flex p-1 rounded-full bg-slate-800 text-slate-500">
                                    <Lock className="h-3.5 w-3.5" />
                                  </span>
                                )}
                              </td>
                              <td className="p-3 text-center">
                                {perms.canScanAttendance ? (
                                  <span className="inline-flex p-1 rounded-full bg-emerald-500/20 text-emerald-400">
                                    <Check className="h-3.5 w-3.5" />
                                  </span>
                                ) : (
                                  <span className="inline-flex p-1 rounded-full bg-slate-800 text-slate-500">
                                    <Lock className="h-3.5 w-3.5" />
                                  </span>
                                )}
                              </td>
                              <td className="p-3 text-center">
                                {perms.canEditTeams ? (
                                  <span className="inline-flex p-1 rounded-full bg-emerald-500/20 text-emerald-400">
                                    <Check className="h-3.5 w-3.5" />
                                  </span>
                                ) : (
                                  <span className="inline-flex p-1 rounded-full bg-slate-800 text-slate-500">
                                    <Lock className="h-3.5 w-3.5" />
                                  </span>
                                )}
                              </td>
                              <td className="p-3 text-center">
                                {perms.canCreateEvents ? (
                                  <span className="inline-flex p-1 rounded-full bg-emerald-500/20 text-emerald-400">
                                    <Check className="h-3.5 w-3.5" />
                                  </span>
                                ) : (
                                  <span className="inline-flex p-1 rounded-full bg-slate-800 text-slate-500">
                                    <Lock className="h-3.5 w-3.5" />
                                  </span>
                                )}
                              </td>
                              <td className="p-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditMemberPerms(m)}
                                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-amber-300 border border-amber-500/30 text-xs font-bold transition-all cursor-pointer"
                                >
                                  تعديل 🔑
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* SECURITY AUDIT LEDGER */}
              <div className="pt-5 border-t border-slate-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-black text-white flex items-center gap-2">
                      <Shield className="h-4 w-4 text-purple-400" />
                      <span>سجل المراجعة الأمني لجميع العمليات (Audit Log)</span>
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      توثيق دقيق لكل عملية رصد، تعديل، مسح QR، أو محاولة غير مصرح بها تمت في التطبيق بالوقت واسم المستخدم.
                    </p>
                  </div>

                  {/* Audit Filters */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setAuditFilterAction("all")}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        auditFilterAction === "all"
                          ? "bg-purple-500 text-white"
                          : "bg-slate-900 text-slate-400 hover:text-white"
                      }`}
                    >
                      الكل ({data.auditLogs?.length || 0})
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuditFilterAction("award_points")}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        auditFilterAction === "award_points"
                          ? "bg-amber-500 text-slate-950 font-black"
                          : "bg-slate-900 text-slate-400 hover:text-white"
                      }`}
                    >
                      رصد نقاط
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuditFilterAction("attendance_scan")}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        auditFilterAction === "attendance_scan"
                          ? "bg-teal-500 text-slate-950 font-black"
                          : "bg-slate-900 text-slate-400 hover:text-white"
                      }`}
                    >
                      حضور QR
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuditFilterAction("denied")}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        auditFilterAction === "denied"
                          ? "bg-rose-500 text-white font-black"
                          : "bg-slate-900 text-slate-400 hover:text-white"
                      }`}
                    >
                      محاولات محظورة 🚫
                    </button>
                  </div>
                </div>

                {filteredAuditLogs.length === 0 ? (
                  <div className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800 text-center text-slate-400 text-xs">
                    لا توجد سجلات مطابقة للفلتر المحدد.
                  </div>
                ) : (
                  <div className="rounded-2xl border border-slate-800 overflow-hidden bg-slate-900/60">
                    <div className="overflow-x-auto max-h-80">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-950 text-slate-400 text-[11px] font-bold border-b border-slate-800 sticky top-0">
                          <tr>
                            <th className="p-3">التاريخ والوقت</th>
                            <th className="p-3">المستخدم المنفذ</th>
                            <th className="p-3">نوع العملية</th>
                            <th className="p-3">المستهدف</th>
                            <th className="p-3">تفاصيل العملية</th>
                            <th className="p-3">حالة العملية</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/80">
                          {filteredAuditLogs.map((log) => {
                            const timeObj = formatArabicTimestamp(log.timestamp);
                            const isDenied = log.status === "denied";
                            return (
                              <tr
                                key={log.id}
                                className={`transition-colors ${
                                  isDenied ? "bg-rose-950/20 hover:bg-rose-950/30" : "hover:bg-slate-800/40"
                                }`}
                              >
                                <td className="p-3 text-slate-400 font-mono whitespace-nowrap">
                                  {timeObj.dateStr} {timeObj.timeStr}
                                </td>
                                <td className="p-3 font-bold text-white whitespace-nowrap">
                                  {log.userName}
                                  <span className="text-[10px] text-slate-400 block font-normal">
                                    {log.userRole === "admin" ? "مدير نظام" : log.userRole === "leader" ? "قائد مجموعة" : "عضو"}
                                  </span>
                                </td>
                                <td className="p-3 whitespace-nowrap">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                      log.action === "award_points"
                                        ? "bg-amber-500/15 border-amber-500/30 text-amber-300"
                                        : log.action === "attendance_scan"
                                        ? "bg-teal-500/15 border-teal-500/30 text-teal-300"
                                        : log.action === "security_block"
                                        ? "bg-rose-500/20 border-rose-500/40 text-rose-300 font-black"
                                        : "bg-slate-800 border-slate-700 text-slate-300"
                                    }`}
                                  >
                                    {log.action === "award_points"
                                      ? "رصد نقاط"
                                      : log.action === "attendance_scan"
                                      ? "حضور QR"
                                      : log.action === "security_block"
                                      ? "حظر أمني"
                                      : log.action === "permission_change"
                                      ? "تعديل صلاحيات"
                                      : log.action}
                                  </span>
                                </td>
                                <td className="p-3 text-slate-300 whitespace-nowrap">{log.targetName}</td>
                                <td className="p-3 text-slate-300 min-w-[200px]">{log.details}</td>
                                <td className="p-3 whitespace-nowrap">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${
                                      isDenied
                                        ? "bg-rose-500/20 border-rose-500/40 text-rose-400"
                                        : "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                                    }`}
                                  >
                                    {isDenied ? "مرفوضة أمنياً ✕" : "ناجحة مصرح بها ✓"}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: HISTORICAL ACTIVITY LOG */}
        {activeTab === "log" && (
          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-800 bg-[#0B132B]/80 p-5 sm:p-7 shadow-xl space-y-5">
              {/* Log Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="h-9 w-9 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
                      <Clock className="h-5 w-5" />
                    </div>
                    <h2 className="text-lg sm:text-xl font-black text-white">
                      سجل الأنشطة والتواريخ (Timestamp Audit Log)
                    </h2>
                    <span className="text-xs px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold font-mono">
                      {filteredTransactions.length} من أصل {data.transactions.length} عملية
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    توثيق كامل لكافة عمليات رصد وخصم النقاط بالساعة والتاريخ والتفاصيل، مع إمكانية التصفية لكل فريق على حدة.
                  </p>
                </div>

                {/* Top Action Buttons: Export & Clear */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={handleExportHistoricalLog}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-300 font-bold text-xs border border-slate-700 shadow-sm transition-all cursor-pointer active:scale-95"
                    title="تصدير السجل التاريخي كملف تقرير نصي"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>تصدير السجل 📄</span>
                  </button>

                  {data.transactions.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearLog}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 font-bold text-xs border border-rose-800/50 shadow-sm transition-all cursor-pointer active:scale-95"
                      title={logTeamFilter !== "all" ? "مسح سجل هذا الفريق" : "مسح السجل بالكامل"}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>{logTeamFilter !== "all" ? "مسح سجل الفريق" : "مسح السجل"}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Filter by Team (Pills) */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Filter className="h-3.5 w-3.5 text-purple-400" />
                  <span>تصفية السجل حسب الفريق:</span>
                </label>
                <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar flex-nowrap">
                  <button
                    type="button"
                    onClick={() => {
                      sounds.playTap();
                      setLogTeamFilter("all");
                    }}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                      logTeamFilter === "all"
                        ? "bg-purple-600 text-white shadow-md font-black"
                        : "bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800"
                    }`}
                  >
                    <span>كافة الفرق</span>
                    <span className="font-mono text-[10px] px-1.5 py-0.2 bg-black/30 rounded-md">
                      {data.transactions.length}
                    </span>
                  </button>

                  {data.teams.map((t) => {
                    const count = data.transactions.filter(
                      (tx) => tx.teamId === t.id || (tx.targetType === "team" && tx.targetId === t.id)
                    ).length;
                    const isSelected = logTeamFilter === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          sounds.playTap();
                          setLogTeamFilter(t.id);
                        }}
                        className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-2 border ${
                          isSelected
                            ? "border-purple-400 text-white shadow-md font-black"
                            : "bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800"
                        }`}
                        style={{
                          backgroundColor: isSelected ? `${t.color}35` : undefined,
                          borderColor: isSelected ? t.color : undefined,
                        }}
                      >
                        <span className="text-sm">{t.icon}</span>
                        <span>{t.name}</span>
                        <span className="font-mono text-[10px] px-1.5 py-0.2 bg-black/40 rounded-md">
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Secondary Filters: Category & Search */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={logSearchQuery}
                    onChange={(e) => setLogSearchQuery(e.target.value)}
                    placeholder="ابحث في السجل بالسبب، اسم المشارك، أو الفريق..."
                    className="w-full h-10 pr-10 pl-3 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-400"
                  />
                  {logSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setLogSearchQuery("")}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 hover:text-white bg-slate-800 px-1.5 py-0.5 rounded cursor-pointer"
                    >
                      مسح
                    </button>
                  )}
                </div>

                {/* Category Filter */}
                <div className="flex items-center gap-2">
                  <select
                    value={logCategoryFilter}
                    onChange={(e) => {
                      sounds.playTap();
                      setLogCategoryFilter(e.target.value);
                    }}
                    className="w-full h-10 px-3 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-purple-400 cursor-pointer"
                  >
                    <option value="all">كل التصنيفات والأنشطة ({data.transactions.length})</option>
                    {availableCategories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Team Profile & Statistics Focus Card (Visible when a team is selected) */}
              {selectedLogTeam && selectedTeamStats && (
                <div
                  className="p-4 sm:p-5 rounded-2xl border shadow-lg space-y-4"
                  style={{
                    backgroundColor: `${selectedLogTeam.color}15`,
                    borderColor: `${selectedLogTeam.color}50`,
                  }}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-12 w-12 rounded-xl flex items-center justify-center text-2xl border shadow-inner shrink-0"
                        style={{
                          backgroundColor: `${selectedLogTeam.color}30`,
                          borderColor: selectedLogTeam.color,
                        }}
                      >
                        {selectedLogTeam.icon}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base sm:text-lg font-black text-white">
                            السجل التاريخي: {selectedLogTeam.name}
                          </h3>
                          <span className="text-xs px-2 py-0.5 rounded-md font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            الرصيد الكلي: {selectedLogTeam.points.toLocaleString("en-US")} XP
                          </span>
                        </div>
                        <p className="text-xs text-slate-300">
                          {selectedLogTeam.slogan || "لا يوجد شعار"} • القائد: {selectedLogTeam.leaderName || "غير محدد"}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        sounds.playTap();
                        setScoreTargetType("team");
                        setSelectedTargetId(selectedLogTeam.id);
                        setActiveTab("quick_score");
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
                    >
                      <Zap className="h-3.5 w-3.5 fill-slate-950" />
                      <span>رصد نقاط جديدة لهذا الفريق ⚡</span>
                    </button>
                  </div>

                  {/* Summary Grid for Selected Team */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800/60">
                    <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80">
                      <span className="text-[10px] text-slate-400 block">عمليات الرصد المسجلة:</span>
                      <span className="text-base font-black font-mono text-purple-300">
                        {selectedTeamStats.count} عملية
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80">
                      <span className="text-[10px] text-slate-400 block">مجموع نقاط العمليات:</span>
                      <span
                        className={`text-base font-black font-mono ${
                          selectedTeamStats.totalPoints >= 0 ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {selectedTeamStats.totalPoints > 0 ? "+" : ""}
                        {selectedTeamStats.totalPoints} XP
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80 col-span-2 sm:col-span-2">
                      <span className="text-[10px] text-slate-400 block">آخر عملية رصد وتاريخها:</span>
                      <span className="text-xs font-bold text-amber-300 truncate block mt-0.5">
                        {selectedTeamStats.latestTx
                          ? formatArabicTimestamp(selectedTeamStats.latestTx.timestamp).fullDate
                          : "لا توجد عمليات"}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Transactions Timeline List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    الجدول الزمني للعمليات ({filteredTransactions.length}):
                  </h3>
                  {filteredTransactions.length > 0 && (
                    <span className="text-[11px] text-slate-500">
                      مرتبة من الأحدث إلى الأقدم حسب وقت الرصد (Timestamp)
                    </span>
                  )}
                </div>

                {filteredTransactions.length === 0 ? (
                  <div className="py-16 text-center text-slate-400 bg-slate-900/40 rounded-2xl border border-slate-800 space-y-2">
                    <Clock className="h-8 w-8 text-slate-600 mx-auto" />
                    <p className="text-sm font-bold text-slate-300">لا توجد عمليات رصد مسجلة مطابقة للبحث أو الفلترة</p>
                    <p className="text-xs text-slate-500">
                      {logTeamFilter !== "all"
                        ? "هذا الفريق ليس لديه عمليات مسجلة حتى الآن."
                        : "قم برصد النقاط للفرق لتظهر هنا فوراً مع التاريخ والوقت."}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
                    {filteredTransactions.map((tx) => {
                      const timeInfo = formatArabicTimestamp(tx.timestamp);
                      const isTeamTarget = tx.targetType === "team";

                      return (
                        <div
                          key={tx.id}
                          className="p-3.5 sm:p-4 rounded-2xl bg-slate-900/80 hover:bg-slate-900 border border-slate-800/90 hover:border-slate-700/80 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm"
                        >
                          <div className="space-y-1.5 min-w-0 flex-1">
                            {/* Target & Team & Category Line */}
                            <div className="flex items-center gap-2 flex-wrap text-xs">
                              {/* Target Badge */}
                              <span
                                className={`px-2.5 py-0.5 rounded-lg font-bold flex items-center gap-1.5 ${
                                  isTeamTarget
                                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                    : "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                                }`}
                              >
                                {isTeamTarget ? (
                                  <>
                                    <span>🏆 فريق:</span>
                                    <span className="font-black">{tx.targetName}</span>
                                  </>
                                ) : (
                                  <>
                                    <span>👤 مشارك:</span>
                                    <span className="font-black">{tx.targetName}</span>
                                    <span className="text-[10px] text-slate-400">({tx.teamName})</span>
                                  </>
                                )}
                              </span>

                              {/* Category Chip */}
                              <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-800 text-purple-300 border border-purple-500/20 font-medium">
                                {tx.category || "عام"}
                              </span>

                              {/* Relative Time Pill */}
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800/80 text-emerald-400 font-mono">
                                {timeInfo.relative}
                              </span>
                            </div>

                            {/* Reason & Notes */}
                            <div className="space-y-0.5">
                              <p className="text-sm font-bold text-white break-words">
                                {tx.reason}
                              </p>
                              {tx.notes && (
                                <p className="text-xs text-slate-400 flex items-center gap-1 italic">
                                  <FileText className="h-3 w-3 text-slate-500 shrink-0" />
                                  <span>{tx.notes}</span>
                                </p>
                              )}
                            </div>

                            {/* Accurate Date & Time Bar */}
                            <div className="flex items-center gap-3 text-[11px] text-slate-400 flex-wrap font-mono pt-0.5">
                              <span className="flex items-center gap-1 text-slate-300">
                                <Calendar className="h-3 w-3 text-amber-400/80 shrink-0" />
                                <span>{timeInfo.dateStr}</span>
                              </span>
                              <span className="flex items-center gap-1 text-amber-300/90 font-bold">
                                <Clock className="h-3 w-3 text-amber-400/80 shrink-0" />
                                <span>{timeInfo.timeStr}</span>
                              </span>
                            </div>
                          </div>

                          {/* Points and Undo Actions */}
                          <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 shrink-0 border-t sm:border-t-0 border-slate-800 pt-2 sm:pt-0">
                            <span
                              className={`font-black font-mono text-base px-3 py-1 rounded-xl border shadow-sm ${
                                tx.points > 0
                                  ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                                  : "bg-rose-500/15 border-rose-500/40 text-rose-300"
                              }`}
                            >
                              {tx.points > 0 ? `+${tx.points}` : tx.points} XP
                            </span>

                            <button
                              type="button"
                              onClick={() => {
                                setConfirmDialog({
                                  title: "التراجع عن رصد النقاط",
                                  message: `هل تريد التراجع عن هذه المعاملة (${tx.points > 0 ? "+" : ""}${tx.points} XP لـ ${tx.targetName}) واسترداد الرصيد؟`,
                                  confirmLabel: "نعم، تراجع عن العملية",
                                  cancelLabel: "إلغاء",
                                  onConfirm: async () => {
                                    if (await meetingStore.undoTransaction(tx.id)) {
                                      sounds.playTap();
                                      showFeedback("تم التراجع عن المعاملة بنجاح واسترداد الرصيد");
                                    }
                                    setConfirmDialog(null);
                                  },
                                });
                              }}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700/80 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                              title="تراجع عن هذه العملية واسترداد النقاط"
                            >
                              <RotateCcw className="h-3 w-3" />
                              <span>تراجع ↩️</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: SETTINGS & BACKUP */}
        {activeTab === "settings" && (
          <div className="space-y-6">
            {/* General Info */}
            <div className="rounded-3xl border border-slate-800 bg-[#0B132B]/80 p-5 sm:p-7 shadow-xl space-y-4">
              <h2 className="text-lg font-black text-emerald-300 flex items-center gap-2">
                <Settings className="h-5 w-5 text-emerald-400" />
                <span>إعدادات وهوية الاجتماع</span>
              </h2>
              
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] sm:text-xs font-bold w-fit">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>ميزة الحفظ التلقائي مفعلة (Auto-save)</span>
                {data.lastSaved && (
                  <span className="opacity-70 border-r border-emerald-500/30 pr-2 mr-2">
                    آخر حفظ: {new Date(data.lastSaved).toLocaleTimeString("ar-EG")}
                  </span>
                )}
              </div>

              <form onSubmit={handleSaveConfig} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-300 block">اسم الاجتماع:</label>
                    <input
                      type="text"
                      value={meetingConfig.meetingName}
                      onChange={(e) => setMeetingConfig({ ...meetingConfig, meetingName: e.target.value })}
                      className="w-full h-11 px-4 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-400"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-300 block">اسم الكنيسة أو الإيبارشية:</label>
                    <input
                      type="text"
                      value={meetingConfig.churchName}
                      onChange={(e) => setMeetingConfig({ ...meetingConfig, churchName: e.target.value })}
                      className="w-full h-11 px-4 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-300 block">عنوان الدوري أو الموسم:</label>
                    <input
                      type="text"
                      value={meetingConfig.seasonName}
                      onChange={(e) => setMeetingConfig({ ...meetingConfig, seasonName: e.target.value })}
                      className="w-full h-11 px-4 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-400"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-300 block">الوصف الفرعي للشاشة:</label>
                    <input
                      type="text"
                      value={meetingConfig.subTitle}
                      onChange={(e) => setMeetingConfig({ ...meetingConfig, subTitle: e.target.value })}
                      className="w-full h-11 px-4 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm transition-all cursor-pointer"
                >
                  حفظ إعدادات الهوية
                </button>
              </form>
            </div>

            {/* Backup & Tools */}
            <div className="rounded-3xl border border-slate-800 bg-[#0B132B]/80 p-5 sm:p-7 shadow-xl space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Download className="h-5 w-5 text-amber-400" />
                <span>النسخ الاحتياطي ومشاركة البيانات</span>
              </h3>
              <p className="text-xs text-slate-400">
                يمكنك تنزيل ملف يحتوي على كافة الفرق والأعضاء وسجل النقاط لنقله لجهاز آخر أو حفظه كنسخة احتياطية.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleExportJson}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 font-bold text-xs sm:text-sm cursor-pointer transition-all"
                >
                  <Download className="h-4 w-4" />
                  <span>تصدير البيانات (Download JSON)</span>
                </button>

                <label className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-500/20 text-sky-300 border border-sky-500/40 hover:bg-sky-500/30 font-bold text-xs sm:text-sm cursor-pointer transition-all">
                  <Upload className="h-4 w-4" />
                  <span>استيراد كشف من ملف (Import JSON)</span>
                  <input type="file" accept=".json" onChange={handleImportJson} className="hidden" />
                </label>
              </div>

              {/* Google Sheets Sync Controls */}
              <div className="pt-6 border-t border-slate-800 space-y-4">
                <div className="flex items-center gap-2 text-emerald-300">
                  <Share2 className="h-5 w-5" />
                  <h4 className="font-bold text-sm">مزامنة جداول بيانات جوجل (Google Sheets)</h4>
                </div>
                
                <div className="flex flex-wrap gap-3">
                  {!authStore.hasAccessToken() ? (
                    <button
                      type="button"
                      onClick={async () => {
                        sounds.playTap();
                        const res = await authStore.loginWithGoogle();
                        if (res.success) showFeedback("تم تسجيل الدخول بحساب جوجل بنجاح!");
                        else showFeedback(res.error || "فشل تسجيل الدخول", "error");
                      }}
                      className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white border border-slate-700 font-bold text-xs flex items-center gap-2 cursor-pointer shadow-sm"
                    >
                      <KeyRound className="h-4 w-4 text-amber-400" />
                      <span>تسجيل الدخول بحساب جوجل للربط</span>
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={async () => {
                          sounds.playTap();
                          showFeedback("بدء المزامنة إلى جوجل شيت...", "success");
                          const res = await meetingStore.syncToSheets();
                          if (res.success) showFeedback("تمت المزامنة بنجاح! ✅");
                          else showFeedback(res.error || "فشل المزامنة", "error");
                        }}
                        className="px-5 py-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 font-bold text-xs flex items-center gap-2 cursor-pointer transition-all"
                      >
                        <Download className="h-4 w-4" />
                        <span>تصدير للشيت (Sync To Sheet)</span>
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          sounds.playTap();
                          showFeedback("جاري جلب البيانات من جوجل شيت...", "success");
                          const res = await meetingStore.syncFromSheets();
                          if (res.success) showFeedback("تم جلب البيانات بنجاح! ✅");
                          else showFeedback(res.error || "فشل الجلب", "error");
                        }}
                        className="px-5 py-2.5 rounded-xl bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/40 font-bold text-xs flex items-center gap-2 cursor-pointer transition-all"
                      >
                        <Upload className="h-4 w-4" />
                        <span>استيراد من الشيت (Sync From Sheet)</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 space-y-2">
                <h4 className="text-xs font-bold text-rose-300">منطقة العمليات الحساسة:</h4>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleResetScoresOnly}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 border border-amber-500/30 text-amber-300 hover:bg-amber-950/40 font-bold text-xs cursor-pointer transition-all"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>تصفير رصيد النقاط فقط لبدء موسم جديد</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleResetToDefaults}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white font-bold text-xs cursor-pointer transition-all"
                  >
                    <span>استعادة الفرق النموذجية الافتراضية</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* In-App Confirmation Modal (Replaces native window.confirm) */}
      {confirmDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md"
          dir="rtl"
          onClick={() => setConfirmDialog(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl bg-[#0B132B] border border-slate-700/80 p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center shrink-0">
                <Trash2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">{confirmDialog.title}</h3>
                <p className="text-xs text-slate-400">عملية تتطلب التأكيد</p>
              </div>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed">
              {confirmDialog.message}
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer transition-all"
              >
                {confirmDialog.cancelLabel || "إلغاء"}
              </button>
              <button
                type="button"
                onClick={confirmDialog.onConfirm}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs shadow-lg shadow-rose-600/30 cursor-pointer transition-all flex items-center gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>{confirmDialog.confirmLabel || "تأكيد الحذف"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Full Screen & Print Modal */}
      {activeQRModalEvent && (
        <QRCodeModal
          event={activeQRModalEvent}
          onClose={() => setActiveQRModalEvent(null)}
        />
      )}

      {/* QR Attendance Camera Scanner Modal */}
      {showQRScanner && (
        <QRScannerModal 
          onClose={() => setShowQRScanner(false)} 
          defaultEventId={typeof showQRScanner === "string" ? showQRScanner : undefined}
        />
      )}

      {/* User Switcher / Passcode Login Modal */}
      {showUserSwitcher && (
        <UserSwitcherModal onClose={() => setShowUserSwitcher(false)} />
      )}

      {/* Edit Member Permissions & Access Code Modal */}
      {editingMember && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn"
          dir="rtl"
        >
          <div className="relative w-full max-w-lg rounded-3xl border border-slate-700 bg-[#0B132B] p-5 sm:p-6 shadow-2xl text-slate-100 space-y-4 max-h-[92vh] overflow-y-auto">
            <button
              onClick={() => setEditingMember(null)}
              className="absolute top-4 left-4 p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="space-y-1 pr-6">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                  <Edit2 className="h-5 w-5" />
                </span>
                <h3 className="text-lg font-black text-white">تعديل بيانات العضو</h3>
              </div>
              <p className="text-xs text-slate-400">
                تحديث البيانات الأساسية والصلاحيات للعضو: <span className="text-amber-300 font-bold">{editingMember.name}</span>
              </p>
            </div>

            <div className="space-y-4">
              {/* Basic Details Section */}
              <div className="space-y-3 p-3 rounded-2xl bg-slate-900/50 border border-slate-800">
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-wider">البيانات الشخصية</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 block pr-1">اسم العضو:</label>
                    <input
                      type="text"
                      defaultValue={editingMember.name}
                      onBlur={async (e) => {
                        if (e.target.value.trim() && e.target.value !== editingMember.name) {
                          await meetingStore.updateMember(editingMember.id, { name: e.target.value.trim() }, currentUser);
                        }
                      }}
                      className="w-full h-10 px-3 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 block pr-1">رقم الهاتف:</label>
                    <input
                      type="text"
                      defaultValue={editingMember.phone}
                      onBlur={async (e) => {
                        if (e.target.value !== editingMember.phone) {
                          await meetingStore.updateMember(editingMember.id, { phone: e.target.value.trim() }, currentUser);
                        }
                      }}
                      className="w-full h-10 px-3 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 block pr-1">رابط الصورة الشخصية (Avatar URL):</label>
                  <input
                    type="url"
                    defaultValue={editingMember.avatarUrl}
                    onBlur={async (e) => {
                      if (e.target.value !== editingMember.avatarUrl) {
                        await meetingStore.updateMember(editingMember.id, { avatarUrl: e.target.value.trim() }, currentUser);
                      }
                    }}
                    placeholder="https://example.com/photo.jpg"
                    className="w-full h-10 px-3 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="h-px bg-slate-800 my-2" />
            </div>

            <form onSubmit={handleSaveMemberPerms} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300 block">الدور / الرتبة في الاجتماع:</label>
                  <select
                    value={permFormRole}
                    onChange={(e) => {
                      const nextRole = e.target.value as RoleType;
                      setPermFormRole(nextRole);
                      setPermFormFlags(getRoleDefaultPermissions(nextRole));
                    }}
                    className="w-full h-11 px-3 rounded-xl bg-slate-900 border border-slate-700 text-xs font-bold text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="member">مشارك عادي (Member)</option>
                    <option value="leader">قائد مجموعة (Team Leader)</option>
                    <option value="servant">خادم رفيق (Servant)</option>
                    <option value="admin">مدير نظام (Super Admin)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300 block">كود المرور السري (PIN / Passcode):</label>
                  <input
                    type="text"
                    value={permFormCode}
                    onChange={(e) => setPermFormCode(e.target.value)}
                    placeholder="كود فريد للدخول..."
                    className="w-full h-11 px-3 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white font-mono tracking-widest focus:outline-none focus:border-amber-400"
                    required
                  />
                </div>
              </div>

              {/* Permission Checkboxes */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <label className="text-xs font-bold text-slate-300 block">تحديد المهام والصلاحيات المسموح بها بدقة:</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permFormFlags.canAwardPoints}
                      onChange={(e) => setPermFormFlags({ ...permFormFlags, canAwardPoints: e.target.checked })}
                      className="w-4 h-4 rounded text-amber-500"
                    />
                    <span className="text-white font-bold">إضافة وتعديل النقاط يدويًا</span>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permFormFlags.canScanAttendance}
                      onChange={(e) => setPermFormFlags({ ...permFormFlags, canScanAttendance: e.target.checked })}
                      className="w-4 h-4 rounded text-amber-500"
                    />
                    <span className="text-white font-bold">مسح QR لتسجيل الحضور</span>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permFormFlags.canEditTeams}
                      onChange={(e) => setPermFormFlags({ ...permFormFlags, canEditTeams: e.target.checked })}
                      className="w-4 h-4 rounded text-amber-500"
                    />
                    <span className="text-white font-bold">تعديل وحذف الفرق</span>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permFormFlags.canEditMembers}
                      onChange={(e) => setPermFormFlags({ ...permFormFlags, canEditMembers: e.target.checked })}
                      className="w-4 h-4 rounded text-amber-500"
                    />
                    <span className="text-white font-bold">إضافة وتعديل الأعضاء</span>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permFormFlags.canCreateEvents}
                      onChange={(e) => setPermFormFlags({ ...permFormFlags, canCreateEvents: e.target.checked })}
                      className="w-4 h-4 rounded text-amber-500"
                    />
                    <span className="text-white font-bold">إنشاء فعاليات وتوليد QR</span>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permFormFlags.canManagePermissions}
                      onChange={(e) => setPermFormFlags({ ...permFormFlags, canManagePermissions: e.target.checked })}
                      className="w-4 h-4 rounded text-amber-500"
                    />
                    <span className="text-white font-bold">إدارة الصلاحيات والأمان</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-black hover:bg-amber-400 shadow-md active:scale-95 transition-all"
                >
                  حفظ الصلاحيات والكود ✨
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Member Identity Card Preview Modal */}
      {previewingCardMember && (
        <MemberCard
          member={previewingCardMember}
          team={data.teams.find((t) => t.id === previewingCardMember.teamId)}
          onClose={() => setPreviewingCardMember(null)}
        />
      )}
    </div>
  );
};
