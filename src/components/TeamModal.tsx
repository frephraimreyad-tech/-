import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  User,
  Trophy,
  Sparkles,
  Zap,
  Users,
  Search,
  Plus,
  Crown,
  Phone,
  CheckCircle,
  Clock,
  Calendar,
  History,
  Camera,
  QrCode,
  KeyRound,
  Lock,
  ShieldCheck,
} from "lucide-react";
import type { CustomMember, ProcessedMeetingTeam } from "../types";
import { sounds } from "../utils/soundEffects";
import { meetingStore } from "../utils/meetingStore";
import { formatArabicTimestamp } from "../utils/dateFormatter";
import { authStore, type SystemUser } from "../utils/authStore";
import { QRScannerModal } from "./QRScannerModal";

interface TeamModalProps {
  team: ProcessedMeetingTeam | null;
  onClose: () => void;
}

export const TeamModal: React.FC<TeamModalProps> = ({ team, onClose }) => {
  const [currentUser, setCurrentUser] = useState<SystemUser>(authStore.getCurrentUser());
  const [teamTab, setTeamTab] = useState<"members" | "history">("members");
  const [memberSearch, setMemberSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "leaders" | "members">("all");
  const [sortOrder, setSortOrder] = useState<"points" | "alpha">("points");
  const [idleSeconds, setIdleSeconds] = useState(50);
  const [quickAddPoints, setQuickAddPoints] = useState<number>(50);
  const [quickAddReason, setQuickAddReason] = useState<string>("");
  const [quickAddCategory, setQuickAddCategory] = useState<string>("رصد مباشر");
  const [showQuickForm, setShowQuickForm] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [showTeamScanner, setShowTeamScanner] = useState(false);
  const [showScannerForMember, setShowScannerForMember] = useState<CustomMember | null>(null);
  const [showAddMemberForm, setShowAddMemberForm] = useState(false);
  const [newMemberName, setNewMemberName] = useState("");

  useEffect(() => {
    const unsub = authStore.subscribe(() => {
      setCurrentUser(authStore.getCurrentUser());
    });
    return unsub;
  }, []);

  const activityReasons = useMemo(() => meetingStore.getActivityReasons(), [showQuickForm]);
  const teamTransactions = useMemo(() => (team ? meetingStore.getTeamTransactions(team.id) : []), [team, toastMsg]);

  // Auto idle countdown timer
  useEffect(() => {
    if (!team) return;
    setIdleSeconds(50);
    const interval = setInterval(() => {
      setIdleSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [team, onClose]);

  const resetTimer = () => {
    setIdleSeconds(50);
  };

  const handleClose = () => {
    sounds.playClose();
    onClose();
  };

  const handleAddNewMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!team || !newMemberName.trim()) return;

    if (!currentUser.permissions.canEditMembers) {
      setToastMsg("⚠️ صلاحية إضافة أعضاء مقصورة على المسؤولين فقط.");
      setTimeout(() => setToastMsg(null), 3000);
      return;
    }

    const res = await meetingStore.addMember(
      {
        name: newMemberName.trim(),
        teamId: team.id,
        role: "member",
        roleLabel: "مشارك",
        initialPoints: 0,
      },
      currentUser
    );

    if (res.success) {
      sounds.playVictory();
      setToastMsg(`تم إضافة العضو "${newMemberName}" بنجاح!`);
      setNewMemberName("");
      setShowAddMemberForm(false);
    } else {
      setToastMsg(`❌ فشل إضافة العضو: ${res.error || "خطأ غير معروف"}`);
    }
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleAwardTeamPoints = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!team) return;
    if (!currentUser.permissions.canAwardPoints) {
      sounds.playClose();
      setToastMsg("⚠️ رصد النقاط اليدوي مقصور على المسؤولين فقط. يمكن لقائد المجموعة مسح QR للحضور.");
      setTimeout(() => setToastMsg(null), 3500);
      return;
    }
    const res = await meetingStore.awardPoints(
      {
        targetType: "team",
        targetId: team.id,
        points: quickAddPoints,
        reason: quickAddReason || "رصد نقاط من شاشة الفريق",
        category: quickAddCategory || "رصد مباشر",
      },
      currentUser
    );
    if (res) {
      sounds.playVictory();
      setToastMsg(`تم إضافة +${quickAddPoints} XP للفريق بنجاح!`);
      setShowQuickForm(false);
      setQuickAddReason("");
    } else {
      sounds.playClose();
      setToastMsg("تعذر رصد النقاط");
    }
    setTimeout(() => setToastMsg(null), 3000);
  };

  const filteredMembers = useMemo(() => {
    if (!team) return [];
    let list = [...team.members];

    if (roleFilter === "leaders") {
      list = list.filter((m) => m.role === "leader");
    } else if (roleFilter === "members") {
      list = list.filter((m) => m.role !== "leader");
    }

    if (memberSearch.trim()) {
      const q = memberSearch.toLowerCase().trim();
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          (m.nameEn && m.nameEn.toLowerCase().includes(q)) ||
          (m.phone && m.phone.includes(q))
      );
    }

    if (sortOrder === "points") {
      list.sort((a, b) => (b.points || 0) - (a.points || 0));
    } else {
      list.sort((a, b) => a.name.localeCompare(b.name, "ar"));
    }

    return list;
  }, [team, roleFilter, memberSearch, sortOrder]);

  if (!team) return null;

  const isRank1 = team.rank === 1;
  const isRank2 = team.rank === 2;
  const isRank3 = team.rank === 3;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/85 backdrop-blur-xl overflow-y-auto selection:bg-amber-500/30"
        dir="rtl"
        onClick={handleClose}
        onTouchStart={resetTimer}
        onMouseMove={resetTimer}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.93, y: 25 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.93, y: 25 }}
          transition={{ type: "spring", stiffness: 350, damping: 28 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl bg-[#0B132B]/95 border border-slate-700/60 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8),0_0_40px_rgba(46,155,208,0.15)] text-slate-100 overflow-hidden font-arabic"
        >
          {/* Top color ribbon */}
          <div
            className="h-2.5 w-full shrink-0"
            style={{
              background: `linear-gradient(90deg, ${team.color}, #F5B21A, ${team.color})`,
            }}
          />

          {/* Modal Header */}
          <div className="relative p-5 sm:p-7 border-b border-slate-800/80 bg-gradient-to-b from-slate-900/90 to-transparent shrink-0">
            {/* Idle countdown indicator */}
            <div className="absolute top-4 left-20 hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-xs text-slate-300 font-sans">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Auto-idle: {idleSeconds}s</span>
            </div>

            {/* Close Button */}
            <button
              onClick={handleClose}
              className="absolute top-4 left-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 shadow-md active:scale-95 transition-all cursor-pointer z-10"
              aria-label="إغلاق"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pl-12 sm:pl-20">
              <div className="flex items-center gap-4">
                <div
                  className="flex h-16 w-16 sm:h-20 sm:w-20 shrink-0 items-center justify-center rounded-2xl shadow-xl text-3xl sm:text-4xl border-2"
                  style={{
                    backgroundColor: `${team.color}25`,
                    borderColor: team.color,
                    boxShadow: `0 0 25px ${team.color}40`,
                  }}
                >
                  <span>{team.icon}</span>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-xl font-black text-xs sm:text-sm border shadow-xs ${
                        isRank1
                          ? "bg-amber-500/20 text-amber-300 border-amber-500/50"
                          : isRank2
                          ? "bg-slate-400/20 text-slate-200 border-slate-400/50"
                          : isRank3
                          ? "bg-orange-500/20 text-orange-300 border-orange-500/50"
                          : "bg-blue-500/20 text-blue-300 border-blue-500/40"
                      }`}
                    >
                      <Trophy className="h-3.5 w-3.5" />
                      المركز #{team.rank}
                    </span>

                    <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                      {team.name}
                    </h2>
                  </div>

                  {team.slogan && (
                    <p className="text-xs sm:text-sm text-amber-200/90 font-medium">
                      "{team.slogan}"
                    </p>
                  )}
                  {team.leaderName && (
                    <p className="text-xs text-slate-400">
                      قائد المجموعة: <strong className="text-slate-200">{team.leaderName}</strong>
                    </p>
                  )}
                </div>
              </div>

              {/* Points & Quick Add Trigger */}
              <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 border-slate-800 pt-3 sm:pt-0 gap-2">
                <div className="text-right">
                  <div className="text-2xl sm:text-3xl font-black text-amber-400 tracking-tight font-display">
                    {team.points.toLocaleString("en-US")}{" "}
                    <span className="text-xs sm:text-sm font-bold text-amber-300/80 font-arabic">
                      XP
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    رصيد نقاط التحديات التراكمي
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      sounds.playTap();
                      setShowTeamScanner(true);
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-emerald-500/20 active:scale-95"
                    title="مسح رمز QR الفعالية لحضور أعضاء هذا الفريق"
                  >
                    <Camera className="h-3.5 w-3.5" />
                    <span>مسح QR للحضور 📱</span>
                  </button>

                  {currentUser.permissions.canAwardPoints && (
                    <button
                      type="button"
                      onClick={() => setShowQuickForm(!showQuickForm)}
                      className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>رصد نقاط للفريق ⚡</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Points Form Accordion */}
            {showQuickForm && (
              <form
                onSubmit={handleAwardTeamPoints}
                className="mt-4 p-4 rounded-2xl bg-slate-900 border border-amber-500/40 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-300">
                    إضافة نقاط سريعة لـ {team.name}:
                  </span>
                  <div className="flex items-center gap-1.5">
                    {[25, 50, 100, 200].map((pts) => (
                      <button
                        key={pts}
                        type="button"
                        onClick={() => setQuickAddPoints(pts)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border cursor-pointer ${
                          quickAddPoints === pts
                            ? "bg-amber-500 text-slate-950 border-amber-400"
                            : "bg-slate-800 text-slate-300 border-slate-700"
                        }`}
                      >
                        +{pts}
                      </button>
                    ))}
                  </div>
                </div>

                {activityReasons.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[11px] text-slate-400 block">
                      اختر سبب الرصد / نوع النشاط من الأنشطة المعتمدة:
                    </span>
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                      {activityReasons.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => {
                            setQuickAddReason(r.text);
                            setQuickAddPoints(r.points);
                            setQuickAddCategory(r.category);
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                            quickAddReason === r.text
                              ? "bg-amber-500 text-slate-950 border-amber-400 font-black shadow-xs"
                              : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
                          }`}
                        >
                          <span>{r.icon || "🎯"}</span>
                          <span>{r.text}</span>
                          <span className="opacity-80 font-mono">(+{r.points})</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={quickAddReason}
                    onChange={(e) => setQuickAddReason(e.target.value)}
                    placeholder="أو اكتب سبب النقطة يدوياً هنا..."
                    className="flex-1 h-9 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                  />
                  <button
                    type="submit"
                    className="px-4 h-9 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs cursor-pointer shadow-md shrink-0"
                  >
                    اعتماد +{quickAddPoints} XP
                  </button>
                </div>
              </form>
            )}

            {toastMsg && (
              <div className="mt-3 p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-xs font-bold flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>{toastMsg}</span>
              </div>
            )}
          </div>

          {/* Modal Body: Members List & Historical Log */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 space-y-5">
            {/* Modal Tabs Navigation: Members vs Activity History */}
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <button
                type="button"
                onClick={() => {
                  sounds.playTap();
                  setTeamTab("members");
                }}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 ${
                  teamTab === "members"
                    ? "bg-sky-500 text-slate-950 font-black shadow-md"
                    : "bg-slate-900/80 text-slate-300 hover:bg-slate-800 border border-slate-800"
                }`}
              >
                <Users className="h-4 w-4" />
                <span>أعضاء الفريق ({team.members.length})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  sounds.playTap();
                  setTeamTab("history");
                }}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 ${
                  teamTab === "history"
                    ? "bg-purple-600 text-white font-black shadow-md"
                    : "bg-slate-900/80 text-slate-300 hover:bg-slate-800 border border-slate-800"
                }`}
              >
                <Clock className="h-4 w-4 text-purple-300" />
                <span>سجل نشاط الفريق وتواريخه 🕒 ({teamTransactions.length})</span>
              </button>
            </div>

            {teamTab === "members" ? (
              <div className="space-y-5">
                {/* Members Section Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/20 text-sky-300 text-xs font-bold">
                      <Users className="h-4 w-4" />
                    </span>
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                        أعضاء الفريق المسجلين ({filteredMembers.length})
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        قائمة الشباب والشابات المنتسبين للمجموعة ونقاطهم الفردية
                      </p>
                    </div>
                  </div>
                {/* Filter and Sort Controls */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 flex-wrap sm:flex-nowrap">
                  {currentUser.permissions.canEditMembers && (
                    <button
                      type="button"
                      onClick={() => {
                        sounds.playTap();
                        setShowAddMemberForm(!showAddMemberForm);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
                        showAddMemberForm
                          ? "bg-emerald-500 text-slate-950 border-emerald-400 shadow-lg shadow-emerald-500/20"
                          : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30"
                      }`}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>إضافة عضو جديد 👤</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      sounds.playTap();
                      setRoleFilter("all");
                    }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        roleFilter === "all"
                          ? "bg-sky-500 text-slate-950 shadow-md"
                          : "bg-slate-800/80 text-slate-300 hover:bg-slate-700"
                      }`}
                    >
                      الكل ({team.members.length})
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        sounds.playTap();
                        setRoleFilter("leaders");
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        roleFilter === "leaders"
                          ? "bg-amber-500 text-slate-950 shadow-md"
                          : "bg-slate-800/80 text-slate-300 hover:bg-slate-700"
                      }`}
                    >
                      القادة ({team.leadersCount})
                    </button>

                    <div className="mr-auto sm:mr-0 pl-1">
                      <button
                        type="button"
                        onClick={() => {
                          sounds.playTap();
                          setSortOrder((prev) => (prev === "points" ? "alpha" : "points"));
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
                          sortOrder === "points"
                            ? "bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-xs"
                            : "bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700"
                        }`}
                      >
                        <Zap
                          className={`h-3.5 w-3.5 ${
                            sortOrder === "points"
                              ? "text-amber-400 fill-amber-400"
                              : "text-slate-400"
                          }`}
                        />
                        <span>{sortOrder === "points" ? "الأعلى نقاطاً ⚡" : "أبجدي 🔤"}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Add Member Form */}
                {showAddMemberForm && (
                  <motion.form
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    onSubmit={handleAddNewMember}
                    className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 space-y-3 shadow-inner"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-emerald-400 flex items-center gap-2">
                        <Plus className="h-3 w-3" />
                        <span>بيانات العضو الجديد لفريق {team.name}:</span>
                      </h4>
                      <button
                        type="button"
                        onClick={() => setShowAddMemberForm(false)}
                        className="text-slate-500 hover:text-white transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newMemberName}
                        onChange={(e) => setNewMemberName(e.target.value)}
                        placeholder="اكتب اسم العضو الرباعي هنا..."
                        className="flex-1 h-10 px-4 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-emerald-400 placeholder:text-slate-600"
                        autoFocus
                        required
                      />
                      <button
                        type="submit"
                        className="px-6 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-lg shadow-emerald-900/20 transition-all active:scale-95"
                      >
                        إضافة الآن ✅
                      </button>
                    </div>
                  </motion.form>
                )}

                {/* Member Search */}
                <div className="relative">
                  <Search className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    placeholder="ابحث باسم المشارك أو رقم الهاتف..."
                    className="w-full h-11 pr-11 pl-4 rounded-2xl bg-slate-900/90 border border-slate-700/80 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-400 shadow-inner"
                  />
                  {memberSearch && (
                    <button
                      type="button"
                      onClick={() => setMemberSearch("")}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white px-2 py-1 bg-slate-800 rounded-lg cursor-pointer"
                    >
                      مسح
                    </button>
                  )}
                </div>

                {/* Members Cards Grid */}
                {filteredMembers.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-sm">
                    لا يوجد أعضاء مطابقين للبحث في هذا الفريق.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {filteredMembers.map((member) => {
                      const isLeader = member.role === "leader";
                      const isServant = member.role === "servant";

                      return (
                        <div
                          key={member.id}
                          className={`p-3 sm:p-4 rounded-2xl border transition-all shadow-sm flex items-center gap-3.5 ${
                            isLeader
                              ? "border-amber-500/40 bg-gradient-to-l from-amber-950/30 via-slate-900/80 to-slate-900"
                              : isServant
                              ? "border-purple-500/40 bg-gradient-to-l from-purple-950/30 via-slate-900/80 to-slate-900"
                              : "border-slate-800/80 bg-slate-900/60 hover:bg-slate-900/80"
                          }`}
                        >
                          {/* Member Avatar */}
                          <div className="relative shrink-0">
                            <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-full border-2 border-slate-700/50 bg-slate-800 overflow-hidden flex items-center justify-center shadow-md">
                              {member.avatarUrl ? (
                                <img src={member.avatarUrl} alt={member.name} className="h-full w-full object-cover" />
                              ) : (
                                <User className="h-6 w-6 sm:h-7 sm:w-7 text-slate-500" />
                              )}
                            </div>
                            {isLeader && (
                              <div className="absolute -bottom-1 -right-1 bg-amber-500 rounded-full p-1 border-2 border-slate-900 shadow-sm">
                                <Crown className="h-2.5 w-2.5 text-slate-950" />
                              </div>
                            )}
                          </div>

                          <div className="space-y-0.5 min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-sm sm:text-base text-white truncate leading-tight">
                                {member.name}
                              </span>
                              {isLeader && (
                                <span className="px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[9px] font-black border border-amber-500/30">
                                  قائد
                                </span>
                              )}
                              {isServant && (
                                <span className="px-1.5 py-0.5 rounded-md bg-purple-500/20 text-purple-300 text-[9px] font-black border border-purple-500/30">
                                  خادم
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              {member.phone && (
                                <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono">
                                  <Phone className="h-2.5 w-2.5 text-slate-500" />
                                  <span>{member.phone}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <div className="text-left" dir="ltr">
                               <div className="flex items-center gap-1 text-amber-400">
                                  <span className="text-[10px] font-bold text-amber-500/70 font-arabic">XP</span>
                                  <span className="text-sm sm:text-base font-black font-mono leading-none">
                                     {member.points.toLocaleString("en-US")}
                                  </span>
                               </div>
                               <div className="text-[8px] text-slate-500 font-bold text-right" dir="rtl">نقاط العضو</div>
                            </div>

                            {/* Quick +25 points button for member */}
                            <button
                              type="button"
                              onClick={async () => {
                                await meetingStore.awardPoints({
                                  targetType: "member",
                                  targetId: member.id,
                                  points: 25,
                                  reason: `نقطة تميز للمشارك: ${member.name}`,
                                  category: "تحدي فردي",
                                });
                                sounds.playTap();
                                setToastMsg(`تم إضافة +25 XP للمشارك ${member.name}!`);
                                setTimeout(() => setToastMsg(null), 2500);
                              }}
                              className="h-8 w-8 rounded-xl bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-amber-400 text-xs font-bold border border-slate-700 flex items-center justify-center transition-all cursor-pointer"
                              title="إضافة +25 نقطة للمشارك فوراً"
                            >
                              +25
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              /* Historical Activity Timeline for this Team */
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                      <Clock className="h-4 w-4 text-purple-400" />
                      <span>السجل الزمني والتواريخ لنشاط فريق {team.name}</span>
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      سجل تاريخي دقيق (Timestamp) لكل عملية رصد نقاط تمت لهذا الفريق ومشاركيه
                    </p>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold font-mono">
                    {teamTransactions.length} عملية
                  </span>
                </div>

                {teamTransactions.length === 0 ? (
                  <div className="py-14 text-center text-slate-400 bg-slate-900/50 rounded-2xl border border-slate-800 space-y-2">
                    <Clock className="h-8 w-8 text-slate-600 mx-auto" />
                    <p className="text-sm font-bold text-slate-300">لا توجد عمليات رصد نقاط مسجلة لهذا الفريق حتى الآن</p>
                    <p className="text-xs text-slate-500">
                      يمكنك استخدام زر "رصد نقاط سريعة" بالأعلى لإضافة نقاط وتوثيقها فوراً.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                    {teamTransactions.map((tx) => {
                      const timeInfo = formatArabicTimestamp(tx.timestamp);
                      const isTeamTarget = tx.targetType === "team";

                      return (
                        <div
                          key={tx.id}
                          className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-start sm:items-center justify-between gap-3 shadow-xs"
                        >
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap text-xs">
                              <span
                                className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${
                                  isTeamTarget
                                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                    : "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                                }`}
                              >
                                {isTeamTarget ? "🏆 الفريق بالكامل" : `👤 ${tx.targetName}`}
                              </span>

                              <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-purple-300 border border-purple-500/20">
                                {tx.category || "عام"}
                              </span>

                              <span className="text-[10px] text-emerald-400 font-mono">
                                ({timeInfo.relative})
                              </span>
                            </div>

                            <p className="text-xs sm:text-sm font-bold text-white">
                              {tx.reason}
                            </p>

                            {tx.notes && (
                              <p className="text-[11px] text-slate-400 italic">
                                📝 {tx.notes}
                              </p>
                            )}

                            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono pt-0.5">
                              <span className="flex items-center gap-1 text-slate-300">
                                <Calendar className="h-3 w-3 text-amber-400" />
                                <span>{timeInfo.dateStr}</span>
                              </span>
                              <span>•</span>
                              <span className="text-amber-300/90 font-bold">
                                {timeInfo.timeStr}
                              </span>
                            </div>
                          </div>

                          <div className="shrink-0">
                            <span
                              className={`font-black font-mono text-sm sm:text-base px-2.5 py-1 rounded-xl border ${
                                tx.points > 0
                                  ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                                  : "bg-rose-500/15 border-rose-500/40 text-rose-300"
                              }`}
                            >
                              {tx.points > 0 ? `+${tx.points}` : tx.points} XP
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
