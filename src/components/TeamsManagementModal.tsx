import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Shield,
  Plus,
  Edit2,
  Trash2,
  X,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Trophy,
  Zap,
  Search,
  RefreshCw,
  Crown,
  Camera,
  Check,
  Award,
  Layers,
  ArrowRight,
} from "lucide-react";
import type { CustomTeam, ProcessedMeetingTeam } from "../types";
import { meetingStore } from "../utils/meetingStore";
import { authStore, type SystemUser } from "../utils/authStore";
import { sounds } from "../utils/soundEffects";
import { useTheme } from "../utils/themeStore";

interface TeamsManagementModalProps {
  onClose: () => void;
  onOpenPhotoModal?: (team: CustomTeam) => void;
}

// 10 Preset Colors matching youth teams branding
const PRESET_COLORS = [
  { name: "ذهبي كهرماني", val: "#EAB308" },
  { name: "أزرق ملكي", val: "#3B82F6" },
  { name: "أخضر زمردي", val: "#10B981" },
  { name: "قرمزي ياقوتي", val: "#EF4444" },
  { name: "سماوي فيروزي", val: "#06B6D4" },
  { name: "أرجواني إمبراطوري", val: "#8B5CF6" },
  { name: "وردي نيون", val: "#EC4899" },
  { name: "برتقالي بركاني", val: "#F97316" },
  { name: "نيلي ليلي", val: "#6366F1" },
  { name: "فيروزي مائي", val: "#14B8A6" },
];

// 16 Preset Emblems
const PRESET_ICONS = [
  "🦁", "⚔️", "📜", "🛡️", "🕊️", "🏹", "⛵", "👑", "🔥", "🌟",
  "🦅", "🏆", "⚓", "⚡", "✝️", "🎯"
];

export const TeamsManagementModal: React.FC<TeamsManagementModalProps> = ({
  onClose,
  onOpenPhotoModal,
}) => {
  const { isLight } = useTheme();
  const [data, setData] = useState(meetingStore.getData());
  const [currentUser] = useState<SystemUser>(authStore.getCurrentUser());
  const [searchQuery, setSearchQuery] = useState("");

  // Modals inside Management
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState<CustomTeam | null>(null);
  const [teamToDelete, setTeamToDelete] = useState<CustomTeam | null>(null);
  const [teamForPoints, setTeamForPoints] = useState<CustomTeam | null>(null);
  const [pointsDeltaInput, setPointsDeltaInput] = useState<number>(50);
  const [pointsReasonInput, setPointsReasonInput] = useState<string>("بونص تشجيعي من إدارة الفرق");

  // Form State for Adding / Editing
  const [formName, setFormName] = useState("");
  const [formIcon, setFormIcon] = useState("🦁");
  const [formColor, setFormColor] = useState("#EAB308");
  const [formSlogan, setFormSlogan] = useState("");
  const [formLeader, setFormLeader] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formPoints, setFormPoints] = useState<number>(0);
  const [formAvatarUrl, setFormAvatarUrl] = useState("");

  // Feedback toast
  const [feedback, setFeedback] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setFeedback({ text, type });
    setTimeout(() => setFeedback(null), 4000);
  };

  // Re-subscribe to store updates
  React.useEffect(() => {
    const unsub = meetingStore.subscribe(() => {
      setData({ ...meetingStore.getData() });
    });
    return () => unsub();
  }, []);

  const processedTeams: ProcessedMeetingTeam[] = useMemo(() => {
    return meetingStore.getProcessedTeams();
  }, [data]);

  const filteredTeams = useMemo(() => {
    if (!searchQuery.trim()) return processedTeams;
    const q = searchQuery.toLowerCase().trim();
    return processedTeams.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.leaderName && t.leaderName.toLowerCase().includes(q)) ||
        (t.slogan && t.slogan.toLowerCase().includes(q))
    );
  }, [processedTeams, searchQuery]);

  const totalTeamsCount = data.teams.length;
  const is10SlotsFull = totalTeamsCount >= 10;

  // Open Edit Modal for a team
  const handleOpenEdit = (team: CustomTeam) => {
    sounds.playTap();
    setEditingTeam(team);
    setFormName(team.name);
    setFormIcon(team.icon || "🦁");
    setFormColor(team.color || "#3B82F6");
    setFormSlogan(team.slogan || "");
    setFormLeader(team.leaderName || "");
    setFormDesc(team.description || "");
    setFormPoints(team.points || 0);
    setFormAvatarUrl(team.avatarUrl || "");
  };

  // Open Add Modal
  const handleOpenAdd = () => {
    sounds.playTap();
    setEditingTeam(null);
    setFormName("");
    setFormIcon(PRESET_ICONS[totalTeamsCount % PRESET_ICONS.length] || "🦁");
    setFormColor(PRESET_COLORS[totalTeamsCount % PRESET_COLORS.length]?.val || "#3B82F6");
    setFormSlogan("");
    setFormLeader("");
    setFormDesc("");
    setFormPoints(0);
    setFormAvatarUrl("");
    setShowAddModal(true);
  };

  // Save Team (Create or Update)
  const handleSaveTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      showToast("يرجى إدخال اسم الفريق", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingTeam) {
        // Update existing team
        const res = await meetingStore.updateTeam(
          editingTeam.id,
          {
            name: formName.trim(),
            icon: formIcon,
            color: formColor,
            slogan: formSlogan.trim(),
            leaderName: formLeader.trim(),
            description: formDesc.trim(),
            points: Number(formPoints) || 0,
            avatarUrl: formAvatarUrl.trim(),
          },
          currentUser
        );
        if (res.success) {
          sounds.playVictory();
          showToast(`تم تحديث بيانات فريق «${formName.trim()}» بنجاح! ⚡`, "success");
          setEditingTeam(null);
        } else {
          sounds.playClose();
          showToast(res.error || "تعذر تعديل الفريق", "error");
        }
      } else {
        // Create new team
        const res = await meetingStore.addTeam(
          {
            name: formName.trim(),
            icon: formIcon,
            color: formColor,
            slogan: formSlogan.trim(),
            leaderName: formLeader.trim(),
            description: formDesc.trim(),
            initialPoints: Number(formPoints) || 0,
            avatarUrl: formAvatarUrl.trim(),
          },
          currentUser
        );
        if (res.success && res.team) {
          sounds.playVictory();
          showToast(`تمت إضافة فريق «${res.team.name}» إلى قائمة الـ 10 فرق بنجاح! 🏆`, "success");
          setShowAddModal(false);
        } else {
          sounds.playClose();
          showToast(res.error || "تعذر إضافة الفريق", "error");
        }
      }
    } catch {
      showToast("حدث خطأ أثناء حفظ الفريق", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Team Confirm
  const handleDeleteTeam = async () => {
    if (!teamToDelete) return;
    setIsSubmitting(true);
    try {
      const res = await meetingStore.deleteTeam(teamToDelete.id, currentUser);
      if (res.success) {
        sounds.playVictory();
        showToast(`تم حذف فريق «${teamToDelete.name}» بنجاح`, "success");
        setTeamToDelete(null);
      } else {
        sounds.playClose();
        showToast(res.error || "تعذر حذف الفريق", "error");
      }
    } catch {
      showToast("حدث خطأ أثناء حذف الفريق", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick Points adjust
  const handleApplyPoints = async () => {
    if (!teamForPoints) return;
    setIsSubmitting(true);
    try {
      const res = await meetingStore.awardPoints(
        {
          targetType: "team",
          targetId: teamForPoints.id,
          points: pointsDeltaInput,
          reason: pointsReasonInput || "تحديث نقاط الفريق من واجهة إدارة الفرق",
          category: "إدارة الفرق",
        },
        currentUser
      );
      if (res) {
        sounds.playVictory();
        const sign = pointsDeltaInput > 0 ? "+" : "";
        showToast(`تم تحديث نقاط فريق «${teamForPoints.name}» بـ (${sign}${pointsDeltaInput} XP) بنجاح! ⚡`, "success");
        setTeamForPoints(null);
      } else {
        sounds.playClose();
        showToast("تعذر تحديث النقاط", "error");
      }
    } catch {
      showToast("حدث خطأ أثناء تحديث النقاط", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Populate standard 10 teams if less than 10
  const handlePopulateStandard10 = async () => {
    setIsSubmitting(true);
    try {
      const standard10 = [
        { name: "فريق مارمرقس", icon: "🦁", color: "#EAB308", slogan: "كاروز الديار المصرية", leaderName: "أنطونيوس إدوار", initialPoints: 1250 },
        { name: "فريق أثناسيوس", icon: "⚔️", color: "#3B82F6", slogan: "حامي الإيمان المستقيم", leaderName: "مينا شهيد", initialPoints: 1120 },
        { name: "فريق الأنبا شنودة", icon: "📜", color: "#10B981", slogan: "رئيس المتوحدين", leaderName: "د. مينا ماهر", initialPoints: 980 },
        { name: "فريق أمير الشهداء مارجرجس", icon: "🛡️", color: "#EF4444", slogan: "سريع الندهة والبطل المغوار", leaderName: "بيشوي عاطف", initialPoints: 940 },
        { name: "فريق الأنبا بيشوي", icon: "🕊️", color: "#06B6D4", slogan: "الرجل الكامل وحبيب مخلصنا الصالح", leaderName: "فادي سامح", initialPoints: 890 },
        { name: "فريق الأمير تادرس", icon: "🏹", color: "#8B5CF6", slogan: "قائد جند المسيح الأمين", leaderName: "كيرلس مجدي", initialPoints: 830 },
        { name: "فريق البابا كيرلس", icon: "⛵", color: "#EC4899", slogan: "كن مطمئناً جداً جداً", leaderName: "مارك رأفت", initialPoints: 790 },
        { name: "فريق الشهيد أبي سيفين", icon: "👑", color: "#F97316", slogan: "حامل السيفين الغالب بالصليب", leaderName: "يوسف مجدي", initialPoints: 750 },
        { name: "فريق الأنبا أنطونيوس", icon: "🔥", color: "#6366F1", slogan: "أب جميع الرهبان وكوكب البرية", leaderName: "مينا عادل", initialPoints: 710 },
        { name: "فريق القديسة دميانة", icon: "🌟", color: "#14B8A6", slogan: "عفيفة وقوية مع الأربعين عذراء", leaderName: "مارينا سامي", initialPoints: 680 },
      ];

      let added = 0;
      for (const t of standard10) {
        if (!data.teams.some((existing) => existing.name.includes(t.name) || t.name.includes(existing.name))) {
          if (data.teams.length + added < 10) {
            await meetingStore.addTeam(t, currentUser);
            added++;
          }
        }
      }
      sounds.playVictory();
      showToast(`تم استكمال الـ 10 فرق النموذجية بنجاح! تم إضافة ${added} فرق جديدة. 🏆`, "success");
    } catch {
      showToast("تعذر استكمال الفرق", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md overflow-y-auto"
      dir="rtl"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: "spring", stiffness: 350, damping: 25 }}
        className={`relative w-full max-w-5xl my-auto rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[92vh] ${
          isLight
            ? "bg-slate-50 border-slate-300 text-slate-900"
            : "bg-[#0B132B] border-slate-700/80 text-white"
        }`}
      >
        {/* Header Bar */}
        <div className={`p-4 sm:p-6 border-b flex items-start justify-between gap-4 ${
          isLight ? "border-slate-200 bg-white" : "border-slate-800 bg-slate-900/80"
        }`}>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="p-2 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <Shield className="h-6 w-6" />
              </span>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                واجهة إدارة الـ 10 فرق المتنافسة 🛡️
              </h2>
              <span className="px-3 py-1 rounded-full text-xs font-black bg-blue-600/20 border border-blue-500/40 text-blue-400 font-mono">
                {totalTeamsCount} / 10 فرق مسجلة
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400">
              تغيير أسماء وشعارات الفرق، حذف الفرق أو إضافة فرق جديدة، وضبط النقاط بما يتماشى مع نظام الـ 10 فرق المتنافسة.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              sounds.playTap();
              onClose();
            }}
            className="p-2 rounded-2xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer shrink-0"
            title="إغلاق"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 10-Slot System Status Bar */}
        <div className={`px-4 sm:px-6 py-3 border-b flex flex-col sm:flex-row items-center justify-between gap-3 text-xs ${
          isLight ? "bg-amber-50/70 border-amber-200 text-amber-950" : "bg-amber-950/30 border-amber-500/20 text-amber-200"
        }`}>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="flex items-center gap-1.5 font-bold">
              <Trophy className="h-4 w-4 text-amber-400" />
              <span>نظام الـ 10 فرق:</span>
            </div>
            {/* Visual Slots Progress (10 blocks) */}
            <div className="flex items-center gap-1">
              {Array.from({ length: 10 }).map((_, idx) => {
                const isFilled = idx < totalTeamsCount;
                return (
                  <div
                    key={idx}
                    className={`h-4 w-4 sm:h-5 sm:w-5 rounded-md flex items-center justify-center text-[10px] font-black font-mono transition-all ${
                      isFilled
                        ? "bg-amber-500 text-slate-950 shadow-xs"
                        : isLight
                        ? "bg-slate-200 text-slate-400 border border-dashed border-slate-300"
                        : "bg-slate-800 text-slate-500 border border-dashed border-slate-700"
                    }`}
                    title={isFilled ? `المقعد ${idx + 1} محجوز` : `المقعد ${idx + 1} شاغر`}
                  >
                    {idx + 1}
                  </div>
                );
              })}
            </div>
            <span className="font-mono font-bold text-amber-400">
              ({totalTeamsCount >= 10 ? "مكتمل 10/10 🏆" : `متبقي ${10 - totalTeamsCount} مقاعد`})
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {totalTeamsCount < 10 && (
              <button
                type="button"
                onClick={handlePopulateStandard10}
                disabled={isSubmitting}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 font-black text-xs shadow-md shadow-teal-500/20 hover:from-teal-400 hover:to-emerald-400 transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                title="إضافة الفرق المتبقية لتكتمل الـ 10 فرق النموذجية بأسماء القديسين"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>استكمال الـ 10 فرق تلقائياً</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleOpenAdd}
              className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs shadow-md shadow-blue-500/25 transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
            >
              <Plus className="h-4 w-4" />
              <span>إضافة فريق جديد ➕</span>
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`mx-4 sm:mx-6 mt-3 p-3 rounded-2xl border flex items-center gap-2.5 text-xs sm:text-sm font-bold shadow-lg animate-bounce ${
              feedback.type === "success"
                ? "bg-emerald-950/90 border-emerald-500/60 text-emerald-200"
                : "bg-rose-950/90 border-rose-500/60 text-rose-200"
            }`}
          >
            {feedback.type === "success" ? (
              <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
        )}

        {/* Search Bar */}
        <div className="p-4 sm:p-6 pb-2">
          <div className="relative">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث عن اسم فريق، شعار، أو اسم القائد..."
              className={`w-full h-10 pr-10 pl-4 rounded-2xl text-xs sm:text-sm focus:outline-none transition-all shadow-inner ${
                isLight
                  ? "bg-white border border-slate-300 text-slate-900 focus:border-blue-500"
                  : "bg-slate-900/90 border border-slate-700 text-white placeholder:text-slate-500 focus:border-amber-400"
              }`}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white px-2 py-0.5 bg-slate-800 rounded-lg cursor-pointer"
              >
                مسح
              </button>
            )}
          </div>
        </div>

        {/* Teams List Cards */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 pt-2 space-y-3">
          {filteredTeams.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm space-y-3">
              <Shield className="h-12 w-12 mx-auto text-slate-600 opacity-60" />
              <p>لا توجد فرق مطابقة للبحث.</p>
              <button
                type="button"
                onClick={handleOpenAdd}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-xs"
              >
                إضافة أول فريق الآن
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredTeams.map((team) => (
                <div
                  key={team.id}
                  className={`relative p-4 rounded-3xl border transition-all flex flex-col justify-between gap-3 shadow-md group ${
                    isLight
                      ? "bg-white border-slate-200 hover:border-slate-300 shadow-slate-200/50"
                      : "bg-slate-900/80 border-slate-800 hover:border-slate-700"
                  }`}
                  style={{ borderRightWidth: 5, borderRightColor: team.color || "#3B82F6" }}
                >
                  {/* Top Header info */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Avatar / Icon */}
                      <div
                        className="relative h-12 w-12 rounded-2xl flex items-center justify-center text-2xl shrink-0 overflow-hidden border shadow-sm"
                        style={{
                          backgroundColor: `${team.color}25`,
                          borderColor: team.color || "#3B82F6",
                        }}
                      >
                        {team.avatarUrl ? (
                          <img
                            src={team.avatarUrl}
                            alt={team.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span>{team.icon}</span>
                        )}
                      </div>

                      {/* Name & Slogan */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs px-2 py-0.5 rounded-full font-black font-mono bg-slate-800 text-amber-300">
                            #{team.rank}
                          </span>
                          <h3 className="text-base font-black truncate">
                            {team.name}
                          </h3>
                        </div>
                        <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">
                          {team.slogan || "لا يوجد شعار بعد"}
                        </p>
                      </div>
                    </div>

                    {/* Points Total */}
                    <div className="text-left shrink-0">
                      <div className="text-lg font-black text-amber-400 font-mono">
                        {team.points.toLocaleString()} XP
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {team.membersCount} عضو
                      </span>
                    </div>
                  </div>

                  {/* Metadata Row: Leader, Servants, Color Swatch */}
                  <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800/60">
                    <div className="flex items-center gap-3">
                      {team.leaderName && (
                        <span className="text-amber-300 font-semibold flex items-center gap-1">
                          <Crown className="h-3.5 w-3.5" />
                          <span>{team.leaderName}</span>
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <span
                          className="h-2.5 w-2.5 rounded-full inline-block"
                          style={{ backgroundColor: team.color }}
                        />
                        <span className="text-[11px] font-mono">{team.color}</span>
                      </span>
                    </div>

                    {/* Photo trigger */}
                    {onOpenPhotoModal && (
                      <button
                        type="button"
                        onClick={() => onOpenPhotoModal(team)}
                        className="text-xs text-slate-400 hover:text-amber-300 flex items-center gap-1 transition-colors cursor-pointer"
                        title="تغيير صورة الفريق"
                      >
                        <Camera className="h-3.5 w-3.5" />
                        <span>الصورة</span>
                      </button>
                    )}
                  </div>

                  {/* Action Buttons: Edit, Quick Points, Delete */}
                  <div className="flex items-center gap-1.5 pt-1">
                    {/* Edit Team */}
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(team)}
                      className="flex-1 py-1.5 px-2.5 rounded-xl bg-blue-600/15 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/30 text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1 active:scale-95"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      <span>تعديل الاسم والبيانات ✏️</span>
                    </button>

                    {/* Points Adjustment */}
                    <button
                      type="button"
                      onClick={() => {
                        sounds.playTap();
                        setTeamForPoints(team);
                        setPointsDeltaInput(50);
                      }}
                      className="py-1.5 px-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/30 text-xs font-black transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                      title="تعديل أو رصد نقاط الفريق"
                    >
                      <Zap className="h-3.5 w-3.5" />
                      <span>نقاط ⚡</span>
                    </button>

                    {/* Delete Team */}
                    <button
                      type="button"
                      onClick={() => {
                        sounds.playTap();
                        setTeamToDelete(team);
                      }}
                      className="p-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/30 text-xs transition-all cursor-pointer shrink-0 active:scale-95"
                      title="حذف هذا الفريق"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`p-4 border-t flex items-center justify-between gap-3 text-xs ${
          isLight ? "bg-slate-100 border-slate-200" : "bg-slate-900 border-slate-800 text-slate-400"
        }`}>
          <span>
            💡 جميع التعديلات تتم مزامنتها لحظياً ومباشرة مع لوحة الشرف الكبرى وسحاب فايربيس.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all cursor-pointer"
          >
            تم والإغلاق ✓
          </button>
        </div>
      </motion.div>

      {/* ========================================================= */}
      {/* ADD / EDIT TEAM SUB-MODAL */}
      {/* ========================================================= */}
      <AnimatePresence>
        {(showAddModal || editingTeam) && (
          <div className="fixed inset-0 z-[260] flex items-center justify-center p-3 bg-black/80 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className={`relative w-full max-w-lg my-auto rounded-3xl border shadow-2xl p-5 sm:p-6 space-y-4 ${
                isLight ? "bg-white border-slate-200 text-slate-900" : "bg-slate-900 border-slate-700 text-white"
              }`}
            >
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                    {editingTeam ? <Edit2 className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                  </span>
                  <h3 className="text-base sm:text-lg font-black">
                    {editingTeam ? `تعديل بيانات «${editingTeam.name}»` : "إضافة فريق جديد لقائمة الـ 10 فرق"}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingTeam(null);
                  }}
                  className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSaveTeam} className="space-y-3.5">
                {/* Team Name */}
                <div className="space-y-1">
                  <label className="text-xs font-bold block">
                    اسم الفريق: <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="مثال: فريق مارمرقس، فريق الأنبا بيشوي..."
                    className="w-full h-10 px-3.5 rounded-xl bg-slate-950 border border-slate-700 text-xs sm:text-sm text-white focus:outline-none focus:border-amber-400 shadow-inner"
                  />
                </div>

                {/* Slogan & Leader */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold block">شعار الفريق:</label>
                    <input
                      type="text"
                      value={formSlogan}
                      onChange={(e) => setFormSlogan(e.target.value)}
                      placeholder="مثال: كاروز الديار المصرية"
                      className="w-full h-10 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-400 shadow-inner"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold block">اسم قائد الفريق 👑:</label>
                    <input
                      type="text"
                      value={formLeader}
                      onChange={(e) => setFormLeader(e.target.value)}
                      placeholder="مثال: أنطونيوس إدوار"
                      className="w-full h-10 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-400 shadow-inner"
                    />
                  </div>
                </div>

                {/* Initial / Current Points */}
                <div className="space-y-1">
                  <label className="text-xs font-bold block">
                    رصيد النقاط (XP):
                  </label>
                  <input
                    type="number"
                    value={formPoints}
                    onChange={(e) => setFormPoints(Number(e.target.value))}
                    className="w-full h-10 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs sm:text-sm text-amber-300 font-mono font-bold focus:outline-none focus:border-amber-400 shadow-inner"
                  />
                </div>

                {/* Avatar URL */}
                <div className="space-y-1">
                  <label className="text-xs font-bold block">رابط صورة الفريق (اختياري):</label>
                  <input
                    type="text"
                    value={formAvatarUrl}
                    onChange={(e) => setFormAvatarUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full h-10 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-400 shadow-inner"
                  />
                </div>

                {/* Emblem Icon Picker */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold block">اختر أيقونة وشعار الفريق:</label>
                  <div className="flex items-center gap-1.5 flex-wrap p-2 rounded-xl bg-slate-950 border border-slate-800">
                    {PRESET_ICONS.map((icon) => (
                      <button
                        key={icon}
                        type="button"
                        onClick={() => setFormIcon(icon)}
                        className={`h-9 w-9 rounded-xl text-lg flex items-center justify-center transition-all cursor-pointer ${
                          formIcon === icon
                            ? "bg-amber-500/30 border-2 border-amber-400 scale-110 shadow-sm"
                            : "hover:bg-slate-800 opacity-80"
                        }`}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Color Swatch Picker */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold block">اختر لون الفريق المميز:</label>
                  <div className="grid grid-cols-5 gap-1.5 p-2 rounded-xl bg-slate-950 border border-slate-800">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c.val}
                        type="button"
                        onClick={() => setFormColor(c.val)}
                        className={`h-8 rounded-lg flex items-center justify-center gap-1 text-[10px] font-bold transition-all cursor-pointer border ${
                          formColor === c.val
                            ? "border-white ring-2 ring-white/50 scale-105"
                            : "border-transparent opacity-80 hover:opacity-100"
                        }`}
                        style={{ backgroundColor: c.val }}
                      >
                        {formColor === c.val && <Check className="h-3 w-3 text-white drop-shadow" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Buttons */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setEditingTeam(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-bold"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs shadow-md shadow-amber-500/25 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <CheckCircle className="h-4 w-4" />
                    <span>{editingTeam ? "حفظ التعديلات ✓" : "إضافة الفريق ✓"}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* DELETE TEAM CONFIRMATION MODAL */}
      {/* ========================================================= */}
      <AnimatePresence>
        {teamToDelete && (
          <div className="fixed inset-0 z-[270] flex items-center justify-center p-3 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md rounded-3xl border border-rose-500/50 bg-slate-900 text-white p-5 sm:p-6 space-y-4 shadow-2xl"
            >
              <div className="flex items-center gap-3 text-rose-400">
                <span className="p-2 rounded-2xl bg-rose-500/20">
                  <AlertCircle className="h-6 w-6" />
                </span>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white">
                    تأكيد حذف فريق «{teamToDelete.name}»
                  </h3>
                  <p className="text-xs text-rose-300">هذا الإجراء نهائي ولا يمكن التراجع عنه.</p>
                </div>
              </div>

              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed bg-slate-950/70 p-3 rounded-2xl border border-slate-800">
                سيتم حذف الفريق وجميع سجلاته التراكمية، وسيتم فك ارتباط الأعضاء التابعين له.
                هل أنت متأكد من الحذف؟
              </p>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTeamToDelete(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-bold"
                >
                  إلغاء التراجع
                </button>
                <button
                  type="button"
                  onClick={handleDeleteTeam}
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs shadow-md shadow-rose-600/30 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>تأكيد الحذف ✕</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* QUICK POINTS ADJUSTMENT MODAL */}
      {/* ========================================================= */}
      <AnimatePresence>
        {teamForPoints && (
          <div className="fixed inset-0 z-[270] flex items-center justify-center p-3 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md rounded-3xl border border-amber-500/40 bg-slate-900 text-white p-5 sm:p-6 space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                    <Zap className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="text-base font-black">
                      تعديل نقاط: «{teamForPoints.name}»
                    </h3>
                    <p className="text-xs text-amber-300 font-mono">
                      الرصيد الحالي: {teamForPoints.points.toLocaleString()} XP
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setTeamForPoints(null)}
                  className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold block">مقدار النقاط (+ إضافة / - خصم):</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[+20, +50, +100, -30].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setPointsDeltaInput(amt)}
                        className={`py-1.5 rounded-xl text-xs font-black font-mono transition-all cursor-pointer ${
                          pointsDeltaInput === amt
                            ? "bg-amber-500 text-slate-950 shadow-sm"
                            : "bg-slate-950 border border-slate-800 text-slate-300 hover:text-white"
                        }`}
                      >
                        {amt > 0 ? `+${amt}` : amt} XP
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    value={pointsDeltaInput}
                    onChange={(e) => setPointsDeltaInput(Number(e.target.value))}
                    className="w-full h-10 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs sm:text-sm text-amber-300 font-mono font-bold focus:outline-none focus:border-amber-400 mt-2 shadow-inner"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold block">سبب الرصد / البونص:</label>
                  <input
                    type="text"
                    value={pointsReasonInput}
                    onChange={(e) => setPointsReasonInput(e.target.value)}
                    placeholder="مثال: فوز في المسابقة، حضور مبكر..."
                    className="w-full h-10 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-400 shadow-inner"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setTeamForPoints(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleApplyPoints}
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs shadow-md shadow-amber-500/25 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Zap className="h-4 w-4" />
                  <span>تطبيق واعتماد النقاط ⚡</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
